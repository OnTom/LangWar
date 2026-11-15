// Knihovna: nákup lekcí, zkouška, kniha kouzel a správce
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, db } from './helpers.js';
import { SPELL_KINDS, CLASS_SPELLS, spellInfo } from '../server/data/spells.js';
import CONTENT from '../server/data/grammar/de-lessons.js';
import { LESSONS } from '../server/game/grammar.js';

const api = await startServer();
after(() => api.close());

const idOf = (name) =>
  db.prepare('SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = ?').get(name).id;
const setLevel = (name, level, gold = 10_000) =>
  db.prepare('UPDATE characters SET level = ?, gold = ? WHERE id = ?').run(level, gold, idOf(name));

// Správná (nebo schválně špatná) odpověď na gramatické cvičení
function answerFor(taskId, correct = true) {
  const data = JSON.parse(db.prepare('SELECT data FROM lingo_tasks WHERE id = ?').get(taskId).data);
  if (data.format === 'choice') {
    const right = data.options.indexOf(data.answers[0]);
    return correct ? right : (right + 1) % data.options.length;
  }
  if (data.format === 'order') {
    const used = new Set();
    const order = data.answers[0].split(' ').map((w) => {
      const i = data.tiles.findIndex((t, idx) => t === w && !used.has(idx));
      used.add(i);
      return i;
    });
    return correct ? order : [...order].reverse();
  }
  return correct ? data.answers[0] : 'špatně';
}

async function takeExam(token, lesson, pattern) {
  let res = await api.post(token, '/library/exam/start', { lesson });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  let exam = res.body.exam;
  for (const ok of pattern) {
    assert.equal(exam.task.untimed, true, 'zkouška je bez časového limitu');
    res = await api.post(token, '/library/exam/answer', { answer: answerFor(exam.task.id, ok) });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    exam = res.body.exam;
    if (exam.status !== 'active') break;
  }
  return res.body;
}

test('kouzla: každé povolání má pět vlastních kouzel ve třech stupních', () => {
  for (const cls of ['warrior', 'mage', 'scout']) {
    const names = SPELL_KINDS.map((k) => CLASS_SPELLS[cls][k].name);
    assert.equal(new Set(names).size, 5, cls);
    for (const kind of SPELL_KINDS) for (const rank of [1, 2, 3]) {
      const s = spellInfo(cls, kind, rank);
      assert.ok(s.name && s.effect && s.mana > 0, `${cls} ${kind} ${rank}`);
    }
  }
  assert.match(spellInfo('mage', 'heal', 1).effect, /25–30/);
});

test('hotové lekce mají text i cvičení', () => {
  for (const lesson of LESSONS.filter((l) => l.ready)) {
    const c = CONTENT[lesson.key];
    assert.ok(c, lesson.key);
    assert.ok(c.summary && c.intro.length && c.table.rows.length && c.examples.length && c.tips.length, lesson.key);
    for (const row of c.table.rows) assert.equal(row.length, c.table.head.length, `${lesson.key}: řádek tabulky`);
  }
});

test('knihovna: stav lekcí podle úrovně a pořadí', async () => {
  const token = await api.player('Ctenar', 'mage');
  const { body } = await api.get(token, '/library');
  const status = Object.fromEntries(body.lessons.map((l) => [l.key, l.status]));
  assert.equal(status.artikel, 'level', 'první lekce až od 2. úrovně');
  assert.equal(status.praesens, 'previous');
  assert.equal(status.dativ, 'soon');
  assert.equal(body.lessons[0].spell.name, 'Ohnivá koule');
  assert.deepEqual(body.spellbook.spells, []);

  setLevel('Ctenar', 2);
  const again = await api.get(token, '/library');
  assert.equal(again.body.lessons[0].status, 'available');
  assert.equal(again.body.lessons[0].price, 140);
});

test('nákup: zlato, pořadí lekcí, text až po koupi', async () => {
  const token = await api.player('Kupec', 'warrior');
  setLevel('Kupec', 10, 100);
  assert.equal((await api.get(token, '/library/lesson/artikel')).status, 403, 'text jen po koupi');
  let r = await api.post(token, '/library/buy', { lesson: 'artikel' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /zlata/);

  setLevel('Kupec', 10, 1000);
  r = await api.post(token, '/library/buy', { lesson: 'praesens' });
  assert.equal(r.status, 400, 'nejdřív předchozí lekce');
  r = await api.post(token, '/library/buy', { lesson: 'artikel' });
  assert.equal(r.status, 200);
  assert.equal(r.body.character.gold, 1000 - 140);
  assert.equal(r.body.lessons[0].status, 'bought');
  assert.equal((await api.post(token, '/library/buy', { lesson: 'artikel' })).status, 400, 'podruhé nejde');

  const lesson = await api.get(token, '/library/lesson/artikel');
  assert.equal(lesson.status, 200);
  assert.ok(lesson.body.lesson.content.intro.length);
  assert.equal(lesson.body.lesson.spell.name, 'Drtivý úder');
});

test('zkouška: dvě chyby = konec, opakování zdarma, 4 z 5 = kouzlo v knize', async () => {
  const token = await api.player('Student', 'scout');
  setLevel('Student', 3, 1000);
  await api.post(token, '/library/buy', { lesson: 'artikel' });

  let end = await takeExam(token, 'artikel', [true, false, false]);
  assert.equal(end.exam.status, 'failed');
  assert.equal(end.exam.asked, 3, 'po druhé chybě zkouška končí');
  assert.equal(end.lessons[0].status, 'bought');

  // Procvičovat jde až naučenou lekci
  assert.equal((await api.post(token, '/grammar/task', { lesson: 'artikel' })).status, 403);

  end = await takeExam(token, 'artikel', [true, false, true, true, true]);
  assert.equal(end.exam.status, 'passed');
  assert.equal(end.learnedSpell.name, 'Otrávený šíp');
  assert.equal(end.lessons[0].status, 'learned');
  assert.equal(end.lessons[1].status, 'available', 'další lekce se otevřela');
  assert.deepEqual(end.spellbook.slots, ['attack'], 'nové kouzlo se samo nasadí');
  assert.equal(end.character.gold, 1000 - 140, 'opakování zkoušky nic nestojí');

  assert.equal((await api.post(token, '/grammar/task', { lesson: 'artikel' })).status, 200);
  assert.equal((await api.post(token, '/library/exam/start', { lesson: 'artikel' })).status, 400, 'naučenou lekci už nezkouší');
});

test('rozpracovaná zkouška vydrží obnovení stránky', async () => {
  const token = await api.player('Prerusovac', 'mage');
  setLevel('Prerusovac', 3, 1000);
  await api.post(token, '/library/buy', { lesson: 'artikel' });
  const start = await api.post(token, '/library/exam/start', { lesson: 'artikel' });
  await api.post(token, '/library/exam/answer', { answer: answerFor(start.body.exam.task.id) });
  const state = await api.get(token, '/library');
  assert.equal(state.body.exam.asked, 1);
  const again = await api.post(token, '/library/exam/start', { lesson: 'artikel' });
  assert.equal(again.body.exam.id, start.body.exam.id);
  assert.equal(again.body.exam.task.id, state.body.exam.task.id, 'stejná otázka');
});

test('kniha kouzel: nejvýš 4 nasazená, jen naučená', async () => {
  const token = await api.player('Kouzelnik', 'mage');
  db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'Kouzelnik'").run();
  setLevel('Kouzelnik', 20);
  const learned = await api.post(token, '/admin/library', { action: 'learn-all' });
  assert.equal(learned.status, 200);
  assert.equal(learned.body.spellRanks.attack, 2, 'množné číslo = Útok II');

  const { body } = await api.get(token, '/library');
  assert.equal(body.spellbook.spells.length, 4, 'pět hotových lekcí = čtyři druhy kouzel');
  assert.equal(body.spellbook.slots.length, 4);
  assert.equal(body.spellbook.spells.find((s) => s.kind === 'attack').rankName, 'II');

  let r = await api.post(token, '/library/slots', { kinds: ['heal', 'attack'] });
  assert.deepEqual(r.body.spellbook.slots, ['heal', 'attack']);
  r = await api.post(token, '/library/slots', { kinds: ['buff'] });
  assert.equal(r.status, 400, 'Posílení ještě neumí');
  r = await api.post(token, '/library/slots', { kinds: ['attack', 'heal', 'defense', 'control', 'attack'] });
  assert.deepEqual(r.body.spellbook.slots, ['attack', 'heal', 'defense', 'control']);

  r = await api.post(token, '/admin/library', { action: 'forget' });
  assert.deepEqual(r.body.spellRanks, {});
  r = await api.post(token, '/admin/library', { action: 'learn', lesson: 'negation' });
  assert.equal(r.body.spellRanks.defense, 1);
  assert.equal((await api.post(token, '/admin/library', { action: 'learn', lesson: 'dativ' })).status, 400);
});
