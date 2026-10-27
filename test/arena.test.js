// Aréna: tahový souboj se slovíčky proti hráčům a NPC, čest a čekací doba
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, db } from './helpers.js';
import { getWord } from '../server/game/lingo.js';

const api = await startServer();
after(() => api.close());

const idOf = (name) =>
  db.prepare('SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = ?').get(name).id;
const honorOf = (name) => db.prepare('SELECT honor FROM characters WHERE id = ?').get(idOf(name)).honor;

function correctAnswer(taskId) {
  const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(taskId);
  const word = getWord(row.word_id);
  if (row.type === 'choice') return JSON.parse(row.data).options.findIndex((o) => o.wordId === word.id);
  return row.type === 'translate' ? word.display : word.de;
}

function readyForArena(name) {
  db.prepare('UPDATE characters SET arena_ready_at = 0 WHERE id = ?').run(idOf(name));
}

const defender = await api.player('Obrance', 'warrior');
const attacker = await api.player('Utocnik', 'mage');

test('aréna nabízí soupeře a souboj je tahový se slovíčky z odemčených lokací', async () => {
  const { body } = await api.get(attacker, '/arena');
  assert.equal(body.opponents.length, 3);
  assert.equal(body.battle, null);
  const index = body.opponents.find((o) => o.type === 'player').index;

  const start = await api.post(attacker, '/arena/fight', { index });
  assert.equal(start.status, 201);
  assert.equal(start.body.battle.kind, 'arena');
  assert.equal(start.body.battle.enemy.name, 'Obrance');
  assert.equal(start.body.battle.location.key, 'arena');

  const again = await api.post(attacker, '/arena/fight', { index });
  assert.equal(again.status, 409, 'souboj už běží');

  const chosen = await api.post(attacker, '/battle/action', { action: 'light' });
  const word = db.prepare('SELECT word_id FROM lingo_tasks WHERE id = ?').get(chosen.body.battle.task.id).word_id;
  assert.ok(['rodina', 'zvirata'].includes(word.split(':')[0]), word);

  // Po obnovení stránky se aréna vrátí do souboje
  const state = await api.get(attacker, '/arena');
  assert.equal(state.body.battle.id, start.body.battle.id);
  assert.ok(state.body.battle.task);
});

test('výhra vezme soupeři čest a přinese zlato; zapíše se do historie obou', async () => {
  const id = idOf('Utocnik');
  const before = { attacker: honorOf('Utocnik'), defender: honorOf('Obrance') };
  const row = db.prepare("SELECT * FROM battles WHERE character_id = ? AND status = 'active'").get(id);
  const state = JSON.parse(row.state);
  state.enemy.hp = 1;
  db.prepare('UPDATE battles SET state = ? WHERE id = ?').run(JSON.stringify(state), row.id);
  const task = (await api.post(attacker, '/battle/action', { action: 'light' })).body.battle.task;
  const r = await api.post(attacker, '/battle/answer', { answer: correctAnswer(task.id) });

  assert.equal(r.body.battle.status, 'won');
  const rewards = r.body.battle.rewards;
  assert.ok(rewards.honorChange > 0 && rewards.gold > 0 && rewards.xp > 0);
  assert.equal(honorOf('Utocnik'), before.attacker + rewards.honorChange);
  assert.equal(honorOf('Obrance'), before.defender - rewards.honorChange);

  const mine = (await api.get(attacker, '/arena')).body;
  assert.equal(mine.history[0].type, 'attack');
  assert.equal(mine.history[0].won, true);
  const theirs = (await api.get(defender, '/arena')).body;
  assert.equal(theirs.history[0].type, 'defense');
  assert.equal(theirs.history[0].won, false);
});

test('po souboji běží čekací doba', async () => {
  const r = await api.post(attacker, '/arena/fight', { index: 0 });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /dech/);
});

test('útěk z arény se počítá jako prohra', async () => {
  readyForArena('Obrance');
  const before = honorOf('Obrance');
  const { body } = await api.get(defender, '/arena');
  const index = body.opponents.find((o) => o.type === 'player' && o.name === 'Utocnik')?.index;
  assert.notEqual(index, undefined);
  await api.post(defender, '/arena/fight', { index });
  const fled = await api.post(defender, '/battle/flee');
  assert.equal(fled.body.battle.status, 'fled');
  assert.ok(fled.body.battle.rewards.honorChange < 0);
  assert.equal(honorOf('Obrance'), before + fled.body.battle.rewards.honorChange);
  assert.equal(fled.body.character.honor, honorOf('Obrance'));
});

test('NPC gladiátor: polovina zlata, žádná čest', async () => {
  readyForArena('Utocnik');
  db.prepare(`UPDATE characters SET arena_opponents = ? WHERE id = ?`).run(
    JSON.stringify([{ type: 'npc', index: 0 }, { type: 'npc', index: 1 }, { type: 'npc', index: 2 }]),
    idOf('Utocnik')
  );
  const honor = honorOf('Utocnik');
  const start = await api.post(attacker, '/arena/fight', { index: 0 });
  assert.equal(start.body.battle.enemy.name, 'Gladiátor Pepa');
  const row = db.prepare("SELECT * FROM battles WHERE character_id = ? AND status = 'active'").get(idOf('Utocnik'));
  const state = JSON.parse(row.state);
  state.enemy.hp = 1;
  db.prepare('UPDATE battles SET state = ? WHERE id = ?').run(JSON.stringify(state), row.id);
  const task = (await api.post(attacker, '/battle/action', { action: 'heavy' })).body.battle.task;
  const r = await api.post(attacker, '/battle/answer', { answer: correctAnswer(task.id) });
  assert.equal(r.body.battle.rewards.honorChange, 0);
  assert.ok(r.body.battle.rewards.npc);
  assert.equal(honorOf('Utocnik'), honor);
});

test('během výpravy do arény nejde (jeden souboj naráz)', async () => {
  const token = await api.player('Zaneprazdneny', 'scout');
  await api.post(token, '/battle/start', { location: 'chalupa' });
  const state = await api.get(token, '/arena');
  assert.equal(state.body.busyElsewhere, true);
  assert.equal(state.body.battle, null);
  const r = await api.post(token, '/arena/fight', { index: 0 });
  assert.equal(r.status, 409);
});
