// Jazykové úkoly: výběr slov, tvorba úkolů a kontrola odpovědí.
// Správnou odpověď zná jen server – klient dostane jen zadání.
import crypto from 'node:crypto';
import db from '../db.js';
import VOCAB from '../data/words/de.js';

export const LANGUAGE = { code: VOCAB.language, name: VOCAB.languageName };

// Typy úkolů: výběr z možností (oběma směry), překlad do češtiny, překlad do cizího jazyka
export const TASK_TYPES = {
  choice: { name: 'Vyber překlad', timeLimit: 10, from: 'de', to: 'cz' },
  choice_reverse: { name: 'Vyber překlad', timeLimit: 10, from: 'cz', to: 'de' },
  translate: { name: 'Přelož do češtiny', timeLimit: 15, from: 'de', to: 'cz' },
  reverse: { name: 'Přelož do němčiny', timeLimit: 15, from: 'cz', to: 'de' },
};

const CHOICE_OPTIONS = 4;
const GRACE_MS = 2000; // tolerance na zpoždění sítě
const TASK_TTL_MS = 60 * 60 * 1000; // staré nezodpovězené úkoly se po hodině mažou
const ARTICLES = ['der', 'die', 'das'];

// --- Slovní zásoba ------------------------------------------------------------

// U přídavných jmen uznáme i ženský a střední rod (velký → velká, velké)
function expandCzech(forms, pos) {
  if (pos !== 'a') return forms;
  return forms.flatMap((f) => (f.endsWith('ý') ? [f, `${f.slice(0, -1)}á`, `${f.slice(0, -1)}é`] : [f]));
}

export const TOPICS = Object.entries(VOCAB.topics).map(([key, t]) => ({
  key,
  name: t.name,
  icon: t.icon,
  level: t.level,
}));

export const WORDS = Object.entries(VOCAB.topics).flatMap(([topic, t]) =>
  t.words.map(([de, cz, pos]) => {
    const forms = cz.split('|');
    return { id: `${topic}:${de}`, topic, level: t.level, de, pos, display: forms[0], cz: expandCzech(forms, pos) };
  })
);

const WORDS_BY_ID = new Map(WORDS.map((w) => [w.id, w]));

export function getWord(id) {
  return WORDS_BY_ID.get(id);
}

// --- Kontrola odpovědí --------------------------------------------------------

// Sjednocení zápisu: jedna mezera, bez interpunkce na okrajích.
// Velikost písmen ani diakritiku (háčky, čárky, přehlásky, ß) NEMĚNÍME – musí být správně.
export function clean(text) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s.,!?;:"'„“‚‘()-]+|[\s.,!?;:"'„“‚‘()-]+$/g, '');
}

// Pro porovnávání slov mezi sebou (stejný význam apod.), kde na velikosti písmen nezáleží
export function normalize(text) {
  return clean(text).toLocaleLowerCase('cs');
}

function splitArticle(de) {
  const [first, ...rest] = de.split(' ');
  return ARTICLES.includes(first.toLowerCase()) ? { article: first, noun: rest.join(' ') } : { article: null, noun: de };
}

// Překlad do češtiny: stačí kterékoli uznávané synonymum, velikost písmen musí sedět
export function checkCzech(word, input) {
  const answer = clean(input);
  return word.cz.some((form) => clean(form) === answer);
}

// Překlad do němčiny: velikost písmen musí sedět (podstatná jména velkým písmenem).
// U podstatných jmen projde i bez členu, ale napsaný člen musí sedět; na začátku smí být
// velkým písmenem jako na začátku věty („Der Hund“).
// Zadání může mít víc správných slov (např. „měsíc“ = der Mond i der Monat).
export function checkGerman(words, input) {
  const answer = splitArticle(clean(input));
  return words.some((w) => {
    const expected = splitArticle(w.de);
    if (answer.noun !== expected.noun) return false;
    if (answer.article === null) return true;
    const capitalized = expected.article && expected.article[0].toUpperCase() + expected.article.slice(1);
    return expected.article !== null && (answer.article === expected.article || answer.article === capitalized);
  });
}

// Všechna slova, která mají daný český překlad (pro úkoly „přelož do němčiny“)
function wordsWithCzech(czech) {
  const key = normalize(czech);
  return WORDS.filter((w) => w.cz.some((f) => normalize(f) === key));
}

// --- Výběr slova ---------------------------------------------------------------

function statsFor(characterId) {
  const rows = db.prepare('SELECT word_id, correct, wrong FROM word_stats WHERE character_id = ?').all(characterId);
  return new Map(rows.map((r) => [r.word_id, r]));
}

// Častěji vybírá slova, ve kterých hráč chybuje; nová slova mají mírnou přednost
function wordWeight(stat) {
  if (!stat) return 1.5;
  return 1 + (2 * stat.wrong) / (stat.correct + 1);
}

function pickWeighted(items, weightOf) {
  const total = items.reduce((sum, item) => sum + weightOf(item), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= weightOf(item);
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

export function pickWord(characterId, topics) {
  let pool = topics?.length ? WORDS.filter((w) => topics.includes(w.topic)) : WORDS;
  if (pool.length === 0) pool = WORDS;

  // Neopakovat slova z posledních pár úkolů
  const recent = new Set(
    db
      .prepare('SELECT word_id FROM lingo_tasks WHERE character_id = ? ORDER BY created_at DESC LIMIT 3')
      .all(characterId)
      .map((r) => r.word_id)
  );
  const fresh = pool.filter((w) => !recent.has(w.id));
  if (fresh.length >= 4) pool = fresh;

  const stats = statsFor(characterId);
  return pickWeighted(pool, (w) => wordWeight(stats.get(w.id)));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Možnosti pro výběr: správný překlad + 3 jiná slova ze stejného tématu.
// Vynechá slova se stejným významem nebo zápisem, aby správná byla jen jedna možnost.
// toForeign = možnosti v cizím jazyce (zadání je české slovo).
function choiceOptions(word, toForeign = false) {
  const taken = new Set(word.cz.map(normalize));
  const distinct = (w) =>
    w.id !== word.id && normalize(w.de) !== normalize(word.de) && !w.cz.some((f) => taken.has(normalize(f)));
  let candidates = WORDS.filter((w) => w.topic === word.topic && distinct(w));
  if (candidates.length < CHOICE_OPTIONS - 1) candidates = WORDS.filter(distinct);
  const others = shuffle(candidates).slice(0, CHOICE_OPTIONS - 1);
  return shuffle([word, ...others]).map((w) => ({ wordId: w.id, text: toForeign ? w.de : w.display }));
}

const isChoice = (type) => type === 'choice' || type === 'choice_reverse';

// --- Úkoly ------------------------------------------------------------------------

function publicTask(row) {
  const data = JSON.parse(row.data);
  const type = TASK_TYPES[row.type];
  return {
    id: row.id,
    type: row.type,
    typeName: type.name,
    prompt: data.prompt,
    from: type.from,
    to: type.to,
    options: data.options ? data.options.map((o) => o.text) : null,
    timeLimit: data.timeLimit ?? type.timeLimit,
    expiresAt: row.expires_at,
    serverNow: Date.now(),
  };
}

/**
 * Vytvoří nový úkol pro postavu.
 * type – choice | translate | reverse, topics – z jakých témat brát slova,
 * context – k čemu úkol patří (např. 'practice' nebo 'battle:12')
 */
export function createTask(characterId, { type, topics = null, context = 'practice', timeScale = 1 }) {
  if (!Object.hasOwn(TASK_TYPES, type)) throw new Error(`Neznámý typ úkolu: ${type}`);
  const now = Date.now();
  db.prepare('DELETE FROM lingo_tasks WHERE created_at < ?').run(now - TASK_TTL_MS);
  // Nezodpovězené úkoly ve stejném kontextu propadnou (hráč si nemůže „přeskakovat“)
  db.prepare('DELETE FROM lingo_tasks WHERE character_id = ? AND context = ? AND answered_at IS NULL').run(
    characterId,
    context
  );

  const word = pickWord(characterId, topics);
  // timeScale < 1 = méně času (zmatení v souboji)
  const timeLimit = Math.max(4, Math.round(TASK_TYPES[type].timeLimit * timeScale));
  const data = { prompt: TASK_TYPES[type].from === 'de' ? word.de : word.display, timeLimit };
  if (isChoice(type)) data.options = choiceOptions(word, type === 'choice_reverse');

  const id = crypto.randomBytes(12).toString('hex');
  db.prepare(
    `INSERT INTO lingo_tasks (id, character_id, word_id, type, context, data, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, characterId, word.id, type, context, JSON.stringify(data), now, now + timeLimit * 1000);

  return publicTask(db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(id));
}

/**
 * Nezodpovězený úkol (např. po obnovení stránky během souboje).
 * Vrací { task, expired } – expired = čas i s tolerancí vypršel – nebo null.
 */
export function openTask(characterId, taskId) {
  const row = db
    .prepare('SELECT * FROM lingo_tasks WHERE id = ? AND character_id = ? AND answered_at IS NULL')
    .get(String(taskId), characterId);
  if (!row) return null;
  return { task: publicTask(row), expired: Date.now() > row.expires_at + GRACE_MS };
}

/** Správná odpověď na úkol – jen pro administraci (režim „ukazovat odpovědi“). */
export function taskSolution(taskId) {
  const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(String(taskId));
  if (!row) return null;
  if (row.type.startsWith('g_')) return JSON.parse(row.data).adminSolution; // gramatika (grammar.js)
  const word = getWord(row.word_id);
  const data = JSON.parse(row.data);
  if (isChoice(row.type)) {
    const index = data.options.findIndex((o) => o.wordId === word.id);
    return `${index + 1}. ${data.options[index].text}`;
  }
  if (row.type === 'translate') return word.cz.filter((f, i, all) => all.indexOf(f) === i).join(', ');
  const candidates = wordsWithCzech(data.prompt);
  return (candidates.length ? candidates : [word]).map((w) => w.de).join(' / ');
}

function recordStat(characterId, wordId, correct) {
  db.prepare(
    `INSERT INTO word_stats (character_id, word_id, correct, wrong, last_seen) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (character_id, word_id) DO UPDATE SET
       correct = correct + excluded.correct, wrong = wrong + excluded.wrong, last_seen = excluded.last_seen`
  ).run(characterId, wordId, correct ? 1 : 0, correct ? 0 : 1, Date.now());
}

export class TaskError extends Error {}

/**
 * Vyhodnotí odpověď. Každý úkol jde zodpovědět jen jednou.
 * context – když je zadaný, úkol musí patřit k němu (jinak se odpověď odmítne).
 * Vrací { correct, timedOut, expected, word: { de, cz }, context }.
 */
export function answerTask(characterId, taskId, answer, { context = null } = {}) {
  const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ? AND character_id = ?').get(String(taskId), characterId);
  if (!row) throw new TaskError('Takový úkol neexistuje nebo už vypršel.');
  // Úkol jiného druhu (např. ze souboje) se tady nesmí ani „spotřebovat“
  if (context && row.context !== context) throw new TaskError('Tenhle úkol patří k souboji.');
  if (row.type.startsWith('g_')) throw new TaskError('Gramatické cvičení se vyhodnocuje jinde.');

  const now = Date.now();
  const claimed = db
    .prepare('UPDATE lingo_tasks SET answered_at = ? WHERE id = ? AND answered_at IS NULL')
    .run(now, row.id);
  if (claimed.changes === 0) throw new TaskError('Na tenhle úkol už jsi odpověděl.');

  const word = getWord(row.word_id);
  const data = JSON.parse(row.data);
  // Bez odpovědi (klientovi vypršel čas) nebo po limitu se úkol počítá jako nesplněný
  const noAnswer = answer === null || answer === undefined || String(answer).trim() === '';
  const timedOut = noAnswer || now > row.expires_at + GRACE_MS;

  let correct = false;
  let expected;
  if (isChoice(row.type)) {
    const index = Number(answer);
    correct = !noAnswer && Number.isInteger(index) && data.options[index]?.wordId === word.id;
    expected = row.type === 'choice' ? word.display : word.de;
  } else if (row.type === 'translate') {
    correct = checkCzech(word, answer);
    expected = word.cz.filter((f, i, all) => all.indexOf(f) === i).slice(0, 3).join(', ');
  } else {
    const candidates = wordsWithCzech(data.prompt);
    correct = checkGerman(candidates.length ? candidates : [word], answer);
    expected = (candidates.length ? candidates : [word]).map((w) => w.de).join(' / ');
  }
  if (timedOut) correct = false;

  recordStat(characterId, word.id, correct);
  return { correct, timedOut, expected, word: { de: word.de, cz: word.display }, context: row.context };
}

// --- Přehled pro Slovníček -------------------------------------------------------

const LEARNED_CORRECT = 3; // slovo je „naučené“, když ho hráč aspoň 3× trefil a víc trefuje, než chybuje

function isLearned(stat) {
  return stat && stat.correct >= LEARNED_CORRECT && stat.correct > stat.wrong;
}

export function topicOverview(characterId) {
  const stats = statsFor(characterId);
  return TOPICS.map((t) => {
    const words = WORDS.filter((w) => w.topic === t.key);
    return {
      ...t,
      total: words.length,
      seen: words.filter((w) => stats.has(w.id)).length,
      learned: words.filter((w) => isLearned(stats.get(w.id))).length,
    };
  });
}

export function topicWords(characterId, topic) {
  const stats = statsFor(characterId);
  return WORDS.filter((w) => w.topic === topic).map((w) => {
    const s = stats.get(w.id);
    return { de: w.de, cz: w.display, correct: s?.correct ?? 0, wrong: s?.wrong ?? 0, learned: Boolean(isLearned(s)) };
  });
}
