// Knihovna: nákup lekcí gramatiky, zkouška a kniha kouzel.
// Lekce jdou v pořadí učebního plánu; složená lekce dá stupeň kouzla podle povolání.
import db from '../db.js';
import CONTENT_DE from '../data/grammar/de-lessons.js';
import { unlockedTopics } from '../data/locations.js';
import { SPELL_KINDS, spellInfo } from '../data/spells.js';
import { goldPerMinute } from './rules.js';
import { LESSONS, getLesson, createGrammarTask, answerGrammarTask, openGrammarTask, GRAMMAR_FORMATS } from './grammar.js';

export const EXAM_QUESTIONS = 5;
export const EXAM_PASS = 4;
export const SPELL_SLOTS = 4;

const CONTENT = CONTENT_DE;

export class LibraryError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// Lekci jde koupit, jen když má cvičení i text
const isReady = (lesson) => lesson.ready && Boolean(CONTENT[lesson.key]);

// Cena knihy: zhruba 10 vítězství na úrovni, kde se lekce odemyká
export function lessonPrice(lesson) {
  return goldPerMinute(lesson.level) * 20;
}

function lessonRows(characterId) {
  const rows = db.prepare('SELECT * FROM character_lessons WHERE character_id = ?').all(characterId);
  return new Map(rows.map((r) => [r.lesson, r]));
}

export function isLearned(characterId, lessonKey) {
  return Boolean(
    db.prepare('SELECT learned_at FROM character_lessons WHERE character_id = ? AND lesson = ?').get(characterId, lessonKey)
      ?.learned_at
  );
}

/** Nejvyšší naučený stupeň každého druhu kouzla: { attack: 2, heal: 1, … } */
export function spellRanks(characterId) {
  const rows = lessonRows(characterId);
  const ranks = {};
  for (const lesson of LESSONS) {
    if (!rows.get(lesson.key)?.learned_at) continue;
    const { kind, rank } = lesson.spell;
    ranks[kind] = Math.max(ranks[kind] ?? 0, rank);
  }
  return ranks;
}

/** Lekce, ze které se cvičí kouzlo daného druhu a stupně. */
export function spellLesson(kind, rank) {
  return LESSONS.find((l) => l.spell.kind === kind && l.spell.rank === rank);
}

function readSlots(c) {
  try {
    const slots = JSON.parse(c.spell_slots || '[]');
    return Array.isArray(slots) ? slots : [];
  } catch {
    return [];
  }
}

/** Nasazená kouzla (jen ta, která postava opravdu umí). */
export function equippedSpells(c) {
  const ranks = spellRanks(c.id);
  return readSlots(c).filter((kind) => ranks[kind]);
}

/** Nasazená kouzla připravená do souboje (snímek na začátku souboje). */
export function battleSpells(c) {
  const ranks = spellRanks(c.id);
  return equippedSpells(c).map((kind) => {
    const lesson = spellLesson(kind, ranks[kind]);
    return { key: `spell:${kind}`, ...spellInfo(c.class, kind, ranks[kind]), lesson: lesson.key, lessonName: lesson.name };
  });
}

function saveSlots(characterId, slots) {
  db.prepare('UPDATE characters SET spell_slots = ? WHERE id = ?').run(JSON.stringify(slots), characterId);
}

// Nové kouzlo se samo nasadí, když je volný slot
function autoEquip(characterId, kind) {
  const c = db.prepare('SELECT id, spell_slots FROM characters WHERE id = ?').get(characterId);
  const slots = readSlots(c);
  if (!slots.includes(kind) && slots.length < SPELL_SLOTS) saveSlots(characterId, [...slots, kind]);
}

function status(c, lesson, rows, index) {
  const row = rows.get(lesson.key);
  if (row?.learned_at) return 'learned';
  if (row) return 'bought';
  if (!isReady(lesson)) return 'soon';
  const previous = LESSONS[index - 1];
  if (previous && !rows.get(previous.key)?.learned_at) return 'previous';
  if (c.level < lesson.level) return 'level';
  return 'available';
}

// --- Zkouška ---------------------------------------------------------------------

function activeExam(characterId) {
  return db.prepare("SELECT * FROM library_exams WHERE character_id = ? AND status = 'active'").get(characterId);
}

function examView(exam) {
  if (!exam) return null;
  const open = exam.task_id ? openGrammarTask(exam.character_id, exam.task_id) : null;
  return {
    id: exam.id,
    lesson: exam.lesson,
    lessonName: getLesson(exam.lesson).name,
    asked: exam.asked,
    correct: exam.correct,
    total: EXAM_QUESTIONS,
    needed: EXAM_PASS,
    status: exam.status,
    task: open?.task ?? null,
  };
}

// Další otázka: formáty se střídají, aby zkouška prošla všechny druhy cvičení
function nextQuestion(c, exam) {
  const lesson = getLesson(exam.lesson);
  const format = lesson.formats[exam.asked % lesson.formats.length];
  const task = createGrammarTask(c.id, {
    lesson: lesson.key,
    format,
    topics: unlockedTopics(c.level),
    context: `exam:${exam.id}`,
    untimed: true,
  });
  db.prepare('UPDATE library_exams SET task_id = ? WHERE id = ?').run(task.id, exam.id);
  return db.prepare('SELECT * FROM library_exams WHERE id = ?').get(exam.id);
}

// --- Veřejné funkce -----------------------------------------------------------------

/** Celá knihovna pro klienta: lekce se stavem a cenou, kniha kouzel, rozpracovaná zkouška. */
export function libraryState(c) {
  const rows = lessonRows(c.id);
  const ranks = spellRanks(c.id);
  const slots = equippedSpells(c);
  return {
    lessons: LESSONS.map((lesson, index) => ({
      key: lesson.key,
      order: lesson.order,
      name: lesson.name,
      level: lesson.level,
      summary: CONTENT[lesson.key]?.summary ?? null,
      spell: spellInfo(c.class, lesson.spell.kind, lesson.spell.rank),
      status: status(c, lesson, rows, index),
      price: lessonPrice(lesson),
    })),
    spellbook: {
      max: SPELL_SLOTS,
      slots,
      spells: SPELL_KINDS.filter((kind) => ranks[kind]).map((kind) => ({
        ...spellInfo(c.class, kind, ranks[kind]),
        lesson: spellLesson(kind, ranks[kind]).name,
        equipped: slots.includes(kind),
      })),
    },
    exam: examView(activeExam(c.id)),
    examRules: { questions: EXAM_QUESTIONS, pass: EXAM_PASS },
  };
}

/** Koupí knihu (lekci) za zlato. */
export function buyLesson(c, key) {
  const index = LESSONS.findIndex((l) => l.key === key);
  const lesson = LESSONS[index];
  if (!lesson) throw new LibraryError('Taková kniha v knihovně není.', 404);
  const state = status(c, lesson, lessonRows(c.id), index);
  const reasons = {
    learned: 'Tuhle lekci už umíš.',
    bought: 'Tuhle knihu už máš.',
    soon: 'Na této knize se ještě píše.',
    previous: 'Nejdřív se nauč předchozí lekci.',
    level: `Tuhle knihu ti knihovník půjčí až od ${lesson.level}. úrovně.`,
  };
  if (reasons[state]) throw new LibraryError(reasons[state]);

  const price = lessonPrice(lesson);
  db.transaction(() => {
    const paid = db.prepare('UPDATE characters SET gold = gold - ? WHERE id = ? AND gold >= ?').run(price, c.id, price);
    if (paid.changes === 0) throw new LibraryError('Na tuhle knihu nemáš dost zlata.');
    db.prepare('INSERT INTO character_lessons (character_id, lesson, bought_at) VALUES (?, ?, ?)').run(c.id, lesson.key, Date.now());
  })();
}

/** Text lekce (jen pro koupenou nebo naučenou; správce vidí všechny hotové). */
export function lessonView(c, key, { admin = false } = {}) {
  const lesson = getLesson(key);
  if (!lesson) throw new LibraryError('Taková kniha v knihovně není.', 404);
  const row = lessonRows(c.id).get(key);
  if (!row && !(admin && isReady(lesson))) throw new LibraryError('Nejdřív si knihu kup.', 403);
  return {
    key: lesson.key,
    order: lesson.order,
    name: lesson.name,
    level: lesson.level,
    learned: Boolean(row?.learned_at),
    spell: spellInfo(c.class, lesson.spell.kind, lesson.spell.rank),
    formats: lesson.formats.map((f) => ({ key: f, name: GRAMMAR_FORMATS[f].name })),
    content: CONTENT[key] ?? null,
  };
}

/** Začne zkoušku z koupené lekce (rozpracovaná zkouška jiné lekce propadne). */
export function startExam(c, key) {
  const lesson = getLesson(key);
  const row = lessonRows(c.id).get(key);
  if (!lesson || !row) throw new LibraryError('Nejdřív si knihu kup.', 403);
  if (row.learned_at) throw new LibraryError('Tuhle lekci už umíš. Můžeš ji procvičovat.');

  const current = activeExam(c.id);
  if (current?.lesson === key) {
    // Pokračování po obnovení stránky; když otázka zmizela, přijde nová
    return examView(current.task_id && openGrammarTask(c.id, current.task_id) ? current : nextQuestion(c, current));
  }
  if (current) db.prepare("UPDATE library_exams SET status = 'failed' WHERE id = ?").run(current.id);

  const id = db
    .prepare('INSERT INTO library_exams (character_id, lesson, created_at) VALUES (?, ?, ?)')
    .run(c.id, key, Date.now()).lastInsertRowid;
  return examView(nextQuestion(c, db.prepare('SELECT * FROM library_exams WHERE id = ?').get(id)));
}

/**
 * Odpověď na otázku zkoušky. Po druhé chybě zkouška končí (4 z 5 už nejde),
 * po pěti otázkách se vyhodnotí. Složená zkouška = lekce naučená a kouzlo v knize kouzel.
 * Vrací { result, exam, learnedSpell }.
 */
export function answerExam(c, answer) {
  const exam = activeExam(c.id);
  if (!exam?.task_id) throw new LibraryError('Teď neskládáš žádnou zkoušku.', 404);

  return db.transaction(() => {
    const result = answerGrammarTask(c.id, exam.task_id, answer, { context: `exam:${exam.id}` });
    const asked = exam.asked + 1;
    const correct = exam.correct + (result.correct ? 1 : 0);
    const mistakes = asked - correct;

    let examStatus = 'active';
    if (mistakes > EXAM_QUESTIONS - EXAM_PASS) examStatus = 'failed';
    else if (asked >= EXAM_QUESTIONS) examStatus = correct >= EXAM_PASS ? 'passed' : 'failed';

    db.prepare('UPDATE library_exams SET asked = ?, correct = ?, status = ?, task_id = NULL WHERE id = ?').run(
      asked,
      correct,
      examStatus,
      exam.id
    );

    let learnedSpell = null;
    if (examStatus === 'passed') learnedSpell = learn(c, exam.lesson);

    let row = db.prepare('SELECT * FROM library_exams WHERE id = ?').get(exam.id);
    if (examStatus === 'active') row = nextQuestion(c, row);
    return { result, exam: examView(row), learnedSpell };
  })();
}

// Lekce naučená: zapíše se a kouzlo se nasadí do volného slotu
function learn(c, key) {
  const lesson = getLesson(key);
  db.prepare(
    `INSERT INTO character_lessons (character_id, lesson, bought_at, learned_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (character_id, lesson) DO UPDATE SET learned_at = excluded.learned_at`
  ).run(c.id, key, Date.now(), Date.now());
  autoEquip(c.id, lesson.spell.kind);
  return spellInfo(c.class, lesson.spell.kind, lesson.spell.rank);
}

/** Nastaví nasazená kouzla (nejvýš 4 různé naučené druhy). */
export function setSpellSlots(c, kinds) {
  if (!Array.isArray(kinds)) throw new LibraryError('Neplatný výběr kouzel.');
  const ranks = spellRanks(c.id);
  const unique = [...new Set(kinds.map(String))];
  if (unique.length > SPELL_SLOTS) throw new LibraryError(`Do souboje si vezmeš nejvýš ${SPELL_SLOTS} kouzla.`);
  if (unique.some((kind) => !ranks[kind])) throw new LibraryError('Tohle kouzlo ještě neumíš.');
  saveSlots(c.id, unique);
}

// --- Pro správce -----------------------------------------------------------------

/** Naučí lekci bez nákupu a zkoušky. */
export function adminLearn(c, key) {
  const lesson = getLesson(key);
  if (!lesson || !isReady(lesson)) throw new LibraryError('Tahle lekce ještě není hotová.');
  return learn(c, key);
}

/** Naučí všechny hotové lekce. */
export function adminLearnAll(c) {
  const ready = LESSONS.filter(isReady);
  for (const lesson of ready) learn(c, lesson.key);
  return ready.length;
}

/** Zapomene všechny lekce i kouzla (pro testování od začátku). */
export function adminForgetAll(c) {
  db.prepare('DELETE FROM character_lessons WHERE character_id = ?').run(c.id);
  db.prepare('DELETE FROM library_exams WHERE character_id = ?').run(c.id);
  saveSlots(c.id, []);
}
