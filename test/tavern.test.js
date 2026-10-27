// Krčma: zakázky, jejich plnění souboji, výměna a denní úkoly
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, db } from './helpers.js';
import { getWord } from '../server/game/lingo.js';
import { progressBounties } from '../server/game/bounties.js';

const api = await startServer();
after(() => api.close());

function characterId(name) {
  return db.prepare('SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = ?').get(name).id;
}

function correctAnswer(taskId) {
  const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(taskId);
  const word = getWord(row.word_id);
  if (row.type === 'choice') return JSON.parse(row.data).options.findIndex((o) => o.wordId === word.id);
  return row.type === 'translate' ? word.display : word.de;
}

// Vyhraje souboj jednou správnou ranou (nepříteli zbývá 1 život)
async function quickWin(token, id, body) {
  const start = await api.post(token, '/battle/start', body);
  assert.equal(start.status, 201, JSON.stringify(start.body));
  const row = db.prepare("SELECT * FROM battles WHERE character_id = ? AND status = 'active'").get(id);
  const state = JSON.parse(row.state);
  state.enemy.hp = 1;
  db.prepare('UPDATE battles SET state = ? WHERE id = ?').run(JSON.stringify(state), row.id);
  const chosen = await api.post(token, '/battle/action', { action: 'heavy' });
  return api.post(token, '/battle/answer', { answer: correctAnswer(chosen.body.battle.task.id) });
}

test('krčma nabízí 3 různé zakázky a denní úkoly', async () => {
  const token = await api.player('Host', 'warrior');
  const { status, body } = await api.get(token, '/tavern');
  assert.equal(status, 200);
  assert.equal(body.bounties.length, 3);
  assert.equal(new Set(body.bounties.map((b) => b.kind)).size, 3);
  assert.ok(body.bounties.every((b) => b.text && b.xp > 0 && b.gold > 0 && b.progress === 0));
  assert.equal(body.daily.tasks.length, 3);
  assert.equal(body.character.bountiesReady, 0);
  // Zakázky se dají plnit jen v odemčených lokacích
  assert.ok(body.bounties.every((b) => !b.location || ['chalupa', 'statek'].includes(b.location)));
});

test('výhra posune zakázku, splněnou jde vyzvednout a přijde nová', async () => {
  const token = await api.player('Lovec', 'warrior');
  const id = characterId('Lovec');
  await api.get(token, '/tavern');
  db.prepare('DELETE FROM bounties WHERE character_id = ?').run(id);
  db.prepare(
    `INSERT INTO bounties (character_id, slot, kind, location, enemy, target, xp, gold, item, created_at)
     VALUES (?, 0, 'defeat', 'statek', 1, 1, 50, 70, 1, 0), (?, 1, 'wins', 'chalupa', NULL, 3, 10, 10, 0, 0),
            (?, 2, 'boss', 'chalupa', NULL, 1, 10, 10, 0, 0)`
  ).run(id, id, id);

  // Jiný nepřítel zakázku „poraz“ neposune
  await quickWin(token, id, { location: 'statek', enemy: 0 });
  let tavern = (await api.get(token, '/tavern')).body;
  assert.equal(tavern.bounties.find((b) => b.slot === 0).progress, 0);

  const win = await quickWin(token, id, { location: 'statek', enemy: 1 });
  assert.equal(win.body.battle.bountiesDone.length, 1);
  assert.match(win.body.battle.bountiesDone[0], /Revoluční prase/);
  assert.equal(win.body.character.bountiesReady, 1);

  const early = await api.post(token, '/tavern/claim', { slot: 1 });
  assert.equal(early.status, 400);

  const goldBefore = win.body.character.gold;
  const claim = await api.post(token, '/tavern/claim', { slot: 0 });
  assert.equal(claim.status, 200);
  assert.equal(claim.body.reward.xp, 50);
  assert.ok(claim.body.reward.item);
  assert.ok(claim.body.character.gold >= goldBefore + 70);
  const fresh = claim.body.bounties.find((b) => b.slot === 0);
  assert.equal(fresh.progress, 0, 'na místo splněné přišla nová zakázka');
  assert.equal((await api.post(token, '/tavern/claim', { slot: 0 })).status, 400, 'odměna jen jednou');
  assert.equal(claim.body.daily.tasks.length, 3);
});

test('zakázky na kouzla a bezchybné výhry', async () => {
  const token = await api.player('Mag', 'mage');
  const id = characterId('Mag');
  await api.get(token, '/tavern');
  db.prepare('DELETE FROM bounties WHERE character_id = ?').run(id);
  db.prepare(
    `INSERT INTO bounties (character_id, slot, kind, location, target, xp, gold, created_at)
     VALUES (?, 0, 'spell', NULL, 2, 5, 5, 0), (?, 1, 'flawless', NULL, 1, 5, 5, 0), (?, 2, 'boss', 'statek', 1, 5, 5, 0)`
  ).run(id, id, id);

  await api.post(token, '/battle/start', { location: 'chalupa' });
  const spell = await api.post(token, '/battle/action', { action: 'spell' });
  await api.post(token, '/battle/answer', { answer: correctAnswer(spell.body.battle.task.id) });
  const miss = await api.post(token, '/battle/action', { action: 'light' });
  await api.post(token, '/battle/answer', { answer: 'nic' });
  await api.post(token, '/battle/flee');

  let bounties = (await api.get(token, '/tavern')).body.bounties;
  assert.equal(bounties.find((b) => b.kind === 'spell').progress, 1);
  assert.ok(miss.body.battle.task);

  await quickWin(token, id, { location: 'chalupa' });
  bounties = (await api.get(token, '/tavern')).body.bounties;
  assert.equal(bounties.find((b) => b.kind === 'flawless').progress, 1);
});

test('chybná odpověď pokazí bezchybnou výhru', () => {
  const id = characterId('Mag');
  db.prepare("UPDATE bounties SET progress = 0, target = 2 WHERE character_id = ? AND kind = 'flawless'").run(id);
  progressBounties(id, { type: 'win', location: 'chalupa', enemy: 0, boss: false, flawless: false });
  const row = db.prepare("SELECT progress FROM bounties WHERE character_id = ? AND kind = 'flawless'").get(id);
  assert.equal(row.progress, 0);
});

test('výměna zakázky stojí zlato a dá jiný druh', async () => {
  const token = await api.player('Vybiravy', 'scout');
  const before = (await api.get(token, '/tavern')).body;
  const old = before.bounties[0];
  const swapped = await api.post(token, '/tavern/swap', { slot: 0 });
  assert.equal(swapped.status, 200);
  assert.notEqual(swapped.body.bounties[0].kind, old.kind);
  assert.equal(swapped.body.character.gold, before.character.gold - before.swapCost);

  db.prepare('UPDATE characters SET gold = 0 WHERE id = ?').run(characterId('Vybiravy'));
  const broke = await api.post(token, '/tavern/swap', { slot: 0 });
  assert.equal(broke.status, 400);
});

test('úkol ze souboje nejde „spotřebovat“ přes procvičování', async () => {
  const token = await api.player('Podvodnik', 'warrior');
  await api.post(token, '/battle/start', { location: 'chalupa' });
  const chosen = await api.post(token, '/battle/action', { action: 'heavy' });
  const taskId = chosen.body.battle.task.id;
  const practice = await api.post(token, '/lingo/answer', { taskId, answer: 'x' });
  assert.equal(practice.status, 400);
  const real = await api.post(token, '/battle/answer', { answer: correctAnswer(taskId) });
  assert.equal(real.body.result.correct, true);
});

test('správné odpovědi se počítají do denního úkolu se slovíčky', async () => {
  const token = await api.player('Pilny', 'mage');
  const id = characterId('Pilny');
  await api.get(token, '/tavern');
  db.prepare("UPDATE daily_tasks SET task_key = 'correct_words', target = 20 WHERE character_id = ? AND slot = 0").run(id);
  const { body } = await api.post(token, '/lingo/task', { type: 'translate', topic: 'rodina' });
  await api.post(token, '/lingo/answer', { taskId: body.task.id, answer: correctAnswer(body.task.id) });
  const daily = (await api.get(token, '/tavern')).body.daily;
  assert.equal(daily.tasks.find((t) => t.slot === 0).progress, 1);
});

test('staré questy jsou pryč', async () => {
  const token = await api.player('Pamětník', 'warrior');
  const r = await api.post(token, '/tavern/start', { slot: 0 });
  assert.equal(r.status, 404);
});
