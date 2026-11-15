// Gramatická cvičení: tvorba úkolů, kontrola odpovědí a sledování chyb.
// Úkoly se ukládají do stejné tabulky jako slovíčka (lingo_tasks, typ g_*).
// Správnou odpověď zná jen server – klient dostane zadání, možnosti nebo kartičky slov.
import crypto from 'node:crypto';
import db from '../db.js';
import GRAMMAR_DE from '../data/grammar/de.js';
import GENERATORS_DE, { FORMATS as FORMATS_DE, parseNoun } from './grammar/de.js';
import { WORDS, TaskError, clean } from './lingo.js';

// Jazyky: učební plán (data) + generátory cvičení. Kouzla jsou pro všechny jazyky stejná.
const LANGUAGES = {
  de: { data: GRAMMAR_DE, generators: GENERATORS_DE, formats: FORMATS_DE },
};
const LANG = LANGUAGES.de;

export const GRAMMAR_FORMATS = {
  choice: { name: 'Výběr z možností', timeLimit: 15 },
  fill: { name: 'Doplň', timeLimit: 25 },
  order: { name: 'Poskládej větu', timeLimit: 30 },
};

const GRACE_MS = 2000;
const TASK_TTL_MS = 60 * 60 * 1000;
const RECENT_ITEMS = 3; // tolik posledních položek se hned neopakuje

export const LESSONS = LANG.data.lessons.map((l, index) => ({
  ...l,
  order: index + 1,
  ready: Boolean(l.ready && LANG.generators[l.key]),
  formats: LANG.formats[l.key] ?? [],
}));

export function getLesson(key) {
  return LESSONS.find((l) => l.key === key);
}

const NOUNS = WORDS.filter((w) => w.pos === 'n').map(parseNoun);
const ADJECTIVES = WORDS.filter((w) => w.pos === 'a');

// --- Výběr položky (častěji to, v čem hráč chybuje) --------------------------------

function statsFor(characterId, lesson) {
  const rows = db.prepare('SELECT item, correct, wrong FROM grammar_stats WHERE character_id = ? AND lesson = ?').all(characterId, lesson);
  return new Map(rows.map((r) => [r.item, r]));
}

function weight(stat) {
  if (!stat) return 1.5;
  return 1 + (2 * stat.wrong) / (stat.correct + 1);
}

function makePicker(characterId, lesson) {
  const stats = statsFor(characterId, lesson);
  const recent = new Set(
    db
      .prepare("SELECT word_id FROM lingo_tasks WHERE character_id = ? AND type LIKE 'g\\_%' ESCAPE '\\' ORDER BY created_at DESC LIMIT ?")
      .all(characterId, RECENT_ITEMS)
      .map((r) => r.word_id)
  );
  return (items, keyOf) => {
    let pool = items.filter((x) => !recent.has(`${lesson}:${keyOf(x)}`));
    if (pool.length < 4) pool = items;
    const total = pool.reduce((sum, x) => sum + weight(stats.get(keyOf(x))), 0);
    let roll = Math.random() * total;
    for (const x of pool) {
      roll -= weight(stats.get(keyOf(x)));
      if (roll <= 0) return x;
    }
    return pool[pool.length - 1];
  };
}

// --- Úkoly ---------------------------------------------------------------------------

function publicTask(row) {
  const data = JSON.parse(row.data);
  const lesson = getLesson(data.lesson);
  return {
    id: row.id,
    type: row.type,
    grammar: true,
    lesson: data.lesson,
    lessonName: lesson.name,
    format: data.format,
    typeName: data.instruction,
    prompt: data.prompt,
    hint: data.hint,
    from: 'de',
    to: 'de',
    options: data.options ?? null,
    tiles: data.tiles ?? null,
    timeLimit: GRAMMAR_FORMATS[data.format].timeLimit,
    expiresAt: row.expires_at,
    serverNow: Date.now(),
  };
}

// Správná odpověď pro režim správce „ukazovat odpovědi“
function adminSolution(exercise) {
  if (exercise.options) {
    const index = exercise.options.findIndex((o) => exercise.answers.includes(o));
    return `${index + 1}. ${exercise.options[index]}`;
  }
  if (exercise.tiles) return exercise.answers[0];
  return exercise.answers.join(' / ');
}

/**
 * Nové gramatické cvičení. lesson = klíč lekce, format = choice | fill | order (jinak náhodně),
 * topics = z jakých témat brát podstatná jména (zbytek slovní zásoby, když je jich málo),
 * context = k čemu úkol patří ('grammar' pro procvičování, 'battle:12' pro souboj).
 */
export function createGrammarTask(characterId, { lesson: lessonKey, format = null, topics = null, context = 'grammar' }) {
  const lesson = getLesson(lessonKey);
  if (!lesson?.ready) throw new TaskError('Tahle lekce zatím nemá cvičení.');
  if (format && !lesson.formats.includes(format)) throw new TaskError('Takové cvičení tahle lekce nemá.');
  const chosen = format ?? lesson.formats[Math.floor(Math.random() * lesson.formats.length)];

  let nouns = topics?.length ? NOUNS.filter((n) => topics.includes(n.topic)) : NOUNS;
  if (nouns.length < 8) nouns = NOUNS;

  const exercise = LANG.generators[lesson.key]({
    format: chosen,
    nouns,
    adjectives: ADJECTIVES,
    pick: makePicker(characterId, lesson.key),
  });

  const now = Date.now();
  db.prepare('DELETE FROM lingo_tasks WHERE created_at < ?').run(now - TASK_TTL_MS);
  db.prepare('DELETE FROM lingo_tasks WHERE character_id = ? AND context = ? AND answered_at IS NULL').run(characterId, context);

  const data = { lesson: lesson.key, format: chosen, ...exercise, adminSolution: adminSolution(exercise) };
  const id = crypto.randomBytes(12).toString('hex');
  db.prepare(
    `INSERT INTO lingo_tasks (id, character_id, word_id, type, context, data, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    characterId,
    `${lesson.key}:${exercise.item}`,
    `g_${chosen}`,
    context,
    JSON.stringify(data),
    now,
    now + GRAMMAR_FORMATS[chosen].timeLimit * 1000
  );
  return publicTask(db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(id));
}

// Kontrola odpovědi podle formátu; velikost písmen i diakritika musí sedět
function isCorrect(data, answer) {
  if (data.format === 'choice') {
    const index = Number(answer);
    return Number.isInteger(index) && data.answers.includes(data.options[index]);
  }
  if (data.format === 'order') {
    // Odpověď = pořadí kartiček (indexy); každá kartička právě jednou
    if (!Array.isArray(answer) || answer.length !== data.tiles.length) return false;
    const indexes = answer.map(Number);
    if (new Set(indexes).size !== indexes.length || indexes.some((i) => !Number.isInteger(i) || !data.tiles[i])) return false;
    const sentence = indexes.map((i) => data.tiles[i]).join(' ');
    return data.answers.includes(sentence);
  }
  return data.answers.some((a) => clean(a) === clean(answer));
}

function recordStat(characterId, lesson, item, correct) {
  db.prepare(
    `INSERT INTO grammar_stats (character_id, lesson, item, correct, wrong, last_seen) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (character_id, lesson, item) DO UPDATE SET
       correct = correct + excluded.correct, wrong = wrong + excluded.wrong, last_seen = excluded.last_seen`
  ).run(characterId, lesson, item, correct ? 1 : 0, correct ? 0 : 1, Date.now());
}

/**
 * Vyhodnotí odpověď na gramatické cvičení (každé jde zodpovědět jen jednou).
 * Vrací { correct, timedOut, expected, rule, grammar: true, lesson, context }.
 */
export function answerGrammarTask(characterId, taskId, answer, { context = null } = {}) {
  const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ? AND character_id = ?').get(String(taskId), characterId);
  if (!row || !row.type.startsWith('g_')) throw new TaskError('Takový úkol neexistuje nebo už vypršel.');
  if (context && row.context !== context) throw new TaskError('Tenhle úkol patří k něčemu jinému.');

  const now = Date.now();
  const claimed = db.prepare('UPDATE lingo_tasks SET answered_at = ? WHERE id = ? AND answered_at IS NULL').run(now, row.id);
  if (claimed.changes === 0) throw new TaskError('Na tenhle úkol už jsi odpověděl.');

  const data = JSON.parse(row.data);
  const noAnswer = answer === null || answer === undefined || (typeof answer === 'string' && answer.trim() === '');
  const timedOut = noAnswer || now > row.expires_at + GRACE_MS;
  const correct = !timedOut && isCorrect(data, answer);

  recordStat(characterId, data.lesson, data.item, correct);
  return {
    correct,
    timedOut,
    grammar: true,
    lesson: data.lesson,
    expected: data.solution,
    rule: data.rule,
    context: row.context,
  };
}

/** Přehled lekcí s postupem hráče (kolik položek viděl, úspěšnost). */
export function grammarOverview(characterId) {
  const rows = db
    .prepare('SELECT lesson, COUNT(*) AS items, SUM(correct) AS correct, SUM(wrong) AS wrong FROM grammar_stats WHERE character_id = ? GROUP BY lesson')
    .all(characterId);
  const byLesson = new Map(rows.map((r) => [r.lesson, r]));
  return LESSONS.map((l) => {
    const s = byLesson.get(l.key);
    return {
      key: l.key,
      order: l.order,
      name: l.name,
      level: l.level,
      spell: l.spell,
      ready: l.ready,
      formats: l.formats.map((f) => ({ key: f, name: GRAMMAR_FORMATS[f].name })),
      correct: s?.correct ?? 0,
      wrong: s?.wrong ?? 0,
    };
  });
}
