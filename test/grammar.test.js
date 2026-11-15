// Gramatika: data, generátory cvičení, kontrola odpovědí a přístup
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, db } from './helpers.js';
import GRAMMAR from '../server/data/grammar/de.js';
import GENERATORS, { FORMATS, conjugate, parseNoun } from '../server/game/grammar/de.js';
import { WORDS } from '../server/game/lingo.js';
import { LESSONS } from '../server/game/grammar.js';

const api = await startServer();
after(() => api.close());

const admin = await api.player('Ucitel', 'mage');
const player = await api.player('Zak', 'warrior');
db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'Ucitel'").run();

const NOUNS = WORDS.filter((w) => w.pos === 'n').map(parseNoun);
const ADJECTIVES = WORDS.filter((w) => w.pos === 'a');
const randomPick = (items) => items[Math.floor(Math.random() * items.length)];

test('učební plán: 15 lekcí, každý druh kouzla má stupně I–III', () => {
  assert.equal(LESSONS.length, 15);
  for (const kind of ['attack', 'heal', 'defense', 'control', 'buff']) {
    const ranks = LESSONS.filter((l) => l.spell.kind === kind).map((l) => l.spell.rank).sort();
    assert.deepEqual(ranks, [1, 2, 3], kind);
  }
  const levels = LESSONS.map((l) => l.level);
  assert.deepEqual(levels, [...levels].sort((a, b) => a - b), 'lekce jdou podle úrovně');
  assert.deepEqual(
    LESSONS.filter((l) => l.ready).map((l) => l.key),
    ['artikel', 'praesens', 'negation', 'akkusativ', 'plural']
  );
});

test('množná čísla patří ke skutečným podstatným jménům ze slovní zásoby', () => {
  const nouns = new Set(NOUNS.map((n) => n.de));
  for (const [noun, plural] of Object.entries(GRAMMAR.plurals)) {
    assert.ok(nouns.has(noun), `${noun} není ve slovní zásobě`);
    assert.match(plural, /^[A-ZÄÖÜ]/, `${noun}: množné číslo velkým písmenem`);
  }
  assert.ok(Object.keys(GRAMMAR.plurals).length >= 150);
});

test('časování pravidelných sloves včetně kmenů na -t/-d a sykavku', () => {
  const cases = [
    ['spielen', 'ich', 'spiele'], ['spielen', 'du', 'spielst'], ['spielen', 'er', 'spielt'],
    ['spielen', 'wir', 'spielen'], ['spielen', 'ihr', 'spielt'], ['spielen', 'sie_pl', 'spielen'],
    ['arbeiten', 'du', 'arbeitest'], ['arbeiten', 'er', 'arbeitet'], ['arbeiten', 'ihr', 'arbeitet'],
    ['finden', 'sie_sg', 'findet'], ['warten', 'du', 'wartest'],
    ['tanzen', 'du', 'tanzt'], ['reisen', 'du', 'reist'], ['reisen', 'er', 'reist'],
  ];
  for (const [verb, person, form] of cases) assert.equal(conjugate(verb, person), form, `${verb} ${person}`);
});

test('každý generátor dává platná cvičení ve všech formátech', () => {
  for (const [lesson, formats] of Object.entries(FORMATS)) {
    for (const format of formats) {
      for (let i = 0; i < 150; i++) {
        const e = GENERATORS[lesson]({ format, nouns: NOUNS, adjectives: ADJECTIVES, pick: randomPick });
        const where = `${lesson}/${format}: ${e.prompt}`;
        assert.ok(e.item && e.prompt && e.solution && e.rule && e.instruction, where);
        assert.ok(e.answers.length >= 1, where);
        if (format === 'choice') {
          assert.equal(e.options.filter((o) => e.answers.includes(o)).length, 1, `${where}: právě jedna správná možnost`);
          assert.equal(new Set(e.options).size, e.options.length, `${where}: možnosti se neopakují`);
        }
        if (format === 'order') {
          assert.deepEqual([...e.tiles].sort(), e.answers[0].split(' ').sort(), `${where}: kartičky = slova věty`);
        }
        if (format !== 'order') assert.match(e.prompt, /___/, where);
      }
    }
  }
});

test('hráč bez práv správce gramatiku zatím nevidí', async () => {
  assert.equal((await api.get(player, '/grammar')).status, 403);
  assert.equal((await api.post(player, '/grammar/task', { lesson: 'artikel' })).status, 403);
});

async function grammarTask(body) {
  const r = await api.post(admin, '/grammar/task', body);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(r.body.task.id);
  return { task: r.body.task, data: JSON.parse(row.data) };
}

test('úkol neprozradí odpověď; výběr, doplnění i velikost písmen', async () => {
  const { task, data } = await grammarTask({ lesson: 'artikel', format: 'choice' });
  assert.equal(task.grammar, true);
  assert.equal(task.timeLimit, 15);
  assert.ok(!/answers|solution|rule/.test(JSON.stringify(task)), 'zadání neobsahuje řešení');
  const right = data.options.indexOf(data.answers[0]);
  let r = await api.post(admin, '/grammar/answer', { taskId: task.id, answer: right });
  assert.equal(r.body.result.correct, true);
  assert.equal(r.body.result.expected, data.solution);

  const fill = await grammarTask({ lesson: 'plural', format: 'fill' });
  assert.equal(fill.task.timeLimit, 25);
  r = await api.post(admin, '/grammar/answer', { taskId: fill.task.id, answer: fill.data.answers[0].toLowerCase() });
  assert.equal(r.body.result.correct, false, 'podstatné jméno musí začínat velkým písmenem');
  assert.ok(r.body.result.rule);

  const fill2 = await grammarTask({ lesson: 'praesens', format: 'fill' });
  r = await api.post(admin, '/grammar/answer', { taskId: fill2.task.id, answer: ` ${fill2.data.answers[0]} ` });
  assert.equal(r.body.result.correct, true, 'mezery na okrajích nevadí');
  r = await api.post(admin, '/grammar/answer', { taskId: fill2.task.id, answer: fill2.data.answers[0] });
  assert.equal(r.status, 400, 'odpověď jen jednou');
});

test('skládání věty z kartiček', async () => {
  const { task, data } = await grammarTask({ lesson: 'negation', format: 'order' });
  assert.equal(task.timeLimit, 30);
  assert.ok(task.tiles.length >= 3);
  const words = data.answers[0].split(' ');
  const used = new Set();
  const order = words.map((w) => {
    const i = data.tiles.findIndex((t, idx) => t === w && !used.has(idx));
    used.add(i);
    return i;
  });
  let r = await api.post(admin, '/grammar/answer', { taskId: task.id, answer: order });
  assert.equal(r.body.result.correct, true);

  const wrong = await grammarTask({ lesson: 'negation', format: 'order' });
  r = await api.post(admin, '/grammar/answer', { taskId: wrong.task.id, answer: [0, 0, 0] });
  assert.equal(r.body.result.correct, false, 'kartička nejde použít dvakrát');
});

test('vypršení času, chyby se zapisují a opakují častěji', async () => {
  const { task } = await grammarTask({ lesson: 'akkusativ', format: 'fill' });
  db.prepare('UPDATE lingo_tasks SET expires_at = ? WHERE id = ?').run(Date.now() - 10_000, task.id);
  const r = await api.post(admin, '/grammar/answer', { taskId: task.id, answer: 'den' });
  assert.equal(r.body.result.timedOut, true);
  assert.equal(r.body.result.correct, false);

  const overview = await api.get(admin, '/grammar');
  const lesson = overview.body.lessons.find((l) => l.key === 'akkusativ');
  assert.ok(lesson.wrong >= 1);
  const stats = db.prepare("SELECT * FROM grammar_stats WHERE lesson = 'akkusativ'").all();
  assert.ok(stats.length >= 1);
});

test('gramatický úkol nejde zodpovědět přes slovíčka ani obráceně', async () => {
  const { task } = await grammarTask({ lesson: 'artikel', format: 'fill' });
  assert.equal((await api.post(admin, '/lingo/answer', { taskId: task.id, answer: 'der' })).status, 400);
  const vocab = await api.post(admin, '/lingo/task', { type: 'translate' });
  assert.equal((await api.post(admin, '/grammar/answer', { taskId: vocab.body.task.id, answer: 'x' })).status, 400);
  // Gramatický úkol zůstal nezodpovězený a jde normálně vyhodnotit
  const r = await api.post(admin, '/grammar/answer', { taskId: task.id, answer: 'der' });
  assert.equal(r.status, 200);
});

test('lekce bez cvičení a neznámý formát', async () => {
  assert.equal((await api.post(admin, '/grammar/task', { lesson: 'dativ' })).status, 400);
  assert.equal((await api.post(admin, '/grammar/task', { lesson: 'artikel', format: 'order' })).status, 400);
  assert.equal((await api.post(admin, '/grammar/task', { lesson: 'neexistuje' })).status, 400);
});

test('správce v režimu „ukazovat odpovědi“ vidí řešení', async () => {
  await api.post(admin, '/admin/answers', { enabled: true });
  const r = await api.post(admin, '/grammar/task', { lesson: 'artikel', format: 'choice' });
  assert.match(r.body.task.adminSolution, /^\d\. (der|die|das)$/);
});
