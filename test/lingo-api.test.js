// Procvičování přes API: tvorba úkolů, odpovědi, statistiky
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, db } from './helpers.js';

const api = await startServer();
after(() => api.close());

const token = await api.player('Student', 'mage');

test('přehled témat', async () => {
  const { status, body } = await api.get(token, '/lingo');
  assert.equal(status, 200);
  assert.equal(body.language.code, 'de');
  assert.ok(body.topics.length >= 10);
  assert.ok(body.topics.every((t) => t.seen === 0 && t.learned === 0));
});

test('úkol neprozradí správnou odpověď', async () => {
  const { body } = await api.post(token, '/lingo/task', { type: 'choice', topic: 'zvirata' });
  const text = JSON.stringify(body.task);
  assert.equal(body.task.options.length, 4);
  assert.ok(!/wordId|correct|answer/i.test(text), text);
});

test('výběr z možností: správná a špatná odpověď', async () => {
  const { body } = await api.post(token, '/lingo/task', { type: 'choice', topic: 'zvirata' });
  const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(body.task.id);
  const data = JSON.parse(row.data);
  const right = data.options.findIndex((o) => o.wordId === row.word_id);

  const ok = await api.post(token, '/lingo/answer', { taskId: body.task.id, answer: right });
  assert.equal(ok.body.result.correct, true);

  const again = await api.post(token, '/lingo/answer', { taskId: body.task.id, answer: right });
  assert.equal(again.status, 400, 'na úkol nejde odpovědět dvakrát');

  const next = await api.post(token, '/lingo/task', { type: 'choice', topic: 'zvirata' });
  const row2 = db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(next.body.task.id);
  const wrong = JSON.parse(row2.data).options.findIndex((o) => o.wordId !== row2.word_id);
  const bad = await api.post(token, '/lingo/answer', { taskId: next.body.task.id, answer: wrong });
  assert.equal(bad.body.result.correct, false);
  assert.ok(bad.body.result.expected);
});

test('psaný překlad do češtiny i do němčiny', async () => {
  const t1 = await api.post(token, '/lingo/task', { type: 'translate', topic: 'jidlo' });
  const w1 = db.prepare('SELECT word_id FROM lingo_tasks WHERE id = ?').get(t1.body.task.id).word_id;
  const { getWord } = await import('../server/game/lingo.js');
  const r1 = await api.post(token, '/lingo/answer', { taskId: t1.body.task.id, answer: getWord(w1).display.toUpperCase() });
  assert.equal(r1.body.result.correct, true);

  const t2 = await api.post(token, '/lingo/task', { type: 'reverse', topic: 'jidlo' });
  const w2 = getWord(db.prepare('SELECT word_id FROM lingo_tasks WHERE id = ?').get(t2.body.task.id).word_id);
  const r2 = await api.post(token, '/lingo/answer', { taskId: t2.body.task.id, answer: w2.de });
  assert.equal(r2.body.result.correct, true);
});

test('po vypršení času se odpověď nepočítá', async () => {
  const { body } = await api.post(token, '/lingo/task', { type: 'translate', topic: 'telo' });
  const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(body.task.id);
  db.prepare('UPDATE lingo_tasks SET expires_at = ? WHERE id = ?').run(Date.now() - 5000, row.id);
  const { getWord } = await import('../server/game/lingo.js');
  const r = await api.post(token, '/lingo/answer', { taskId: row.id, answer: getWord(row.word_id).display });
  assert.equal(r.body.result.correct, false);
  assert.equal(r.body.result.timedOut, true);
});

test('bez odpovědi (vypršel čas v prohlížeči) se úkol nepočítá, ani když je správná 1. možnost', async () => {
  for (let i = 0; i < 5; i++) {
    const { body } = await api.post(token, '/lingo/task', { type: 'choice', topic: 'zvirata' });
    const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(body.task.id);
    // Správná odpověď schválně na první místo
    const data = JSON.parse(row.data);
    const right = data.options.findIndex((o) => o.wordId === row.word_id);
    [data.options[0], data.options[right]] = [data.options[right], data.options[0]];
    db.prepare('UPDATE lingo_tasks SET data = ? WHERE id = ?').run(JSON.stringify(data), row.id);

    const r = await api.post(token, '/lingo/answer', { taskId: row.id, answer: null });
    assert.equal(r.body.result.correct, false);
    assert.equal(r.body.result.timedOut, true);
  }
});

test('cizí úkol nejde zodpovědět', async () => {
  const other = await api.player('Jiny', 'scout');
  const { body } = await api.post(token, '/lingo/task', { type: 'choice' });
  const r = await api.post(other, '/lingo/answer', { taskId: body.task.id, answer: 0 });
  assert.equal(r.status, 400);
});

test('statistiky se ukládají a ukazují ve Slovníčku', async () => {
  const { body } = await api.get(token, '/lingo');
  assert.ok(body.topics.find((t) => t.key === 'zvirata').seen >= 1);
  const words = await api.get(token, '/lingo/words?topic=zvirata');
  assert.ok(words.body.words.some((w) => w.correct + w.wrong > 0));
});

test('chybná slova se objevují častěji', async () => {
  const { pickWord, WORDS } = await import('../server/game/lingo.js');
  const characterId = db.prepare("SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = 'Student'").get().id;
  const target = WORDS.find((w) => w.topic === 'pocasi');
  db.prepare(
    `INSERT INTO word_stats (character_id, word_id, correct, wrong, last_seen) VALUES (?, ?, 0, 30, ?)
     ON CONFLICT (character_id, word_id) DO UPDATE SET wrong = 30, correct = 0`
  ).run(characterId, target.id, Date.now());
  let hits = 0;
  for (let i = 0; i < 300; i++) if (pickWord(characterId, ['pocasi']).id === target.id) hits++;
  // 23 slov v tématu: bez váhy by padlo zhruba 13×, s váhou výrazně víc
  assert.ok(hits > 60, `chybné slovo padlo jen ${hits}× z 300`);
});
