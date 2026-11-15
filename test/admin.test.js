// Administrace: přístup jen pro adminy a testovací pomůcky
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, db } from './helpers.js';

const api = await startServer();
after(() => api.close());

const admin = await api.player('Spravce', 'mage');
const player = await api.player('Obycejny', 'warrior');
db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'Spravce'").run();

test('běžný hráč do administrace nesmí a nevidí odpovědi', async () => {
  const r = await api.get(player, '/admin');
  assert.equal(r.status, 403);
  assert.equal((await api.post(player, '/admin/gold', { amount: 1000 })).status, 403);
  assert.equal((await api.get(player, '/character')).body.character.isAdmin, false);

  db.prepare("UPDATE users SET admin_show_answers = 1 WHERE username = 'Obycejny'").run();
  const task = await api.post(player, '/lingo/task', { type: 'choice' });
  assert.equal(task.body.task.adminSolution, undefined, 'příznak bez práv admina nic neprozradí');
});

test('admin vidí administraci a mění úroveň, zlato, energii a atributy', async () => {
  assert.equal((await api.get(admin, '/character')).body.character.isAdmin, true);
  const state = await api.get(admin, '/admin');
  assert.equal(state.status, 200);
  assert.equal(state.body.locations.length, 11);

  let r = await api.post(admin, '/admin/level', { level: 15 });
  assert.equal(r.body.character.level, 15);
  assert.equal((await api.post(admin, '/admin/level', { level: 0 })).status, 400);

  const gold = r.body.character.gold;
  r = await api.post(admin, '/admin/gold', { amount: 5000 });
  assert.equal(r.body.character.gold, gold + 5000);
  r = await api.post(admin, '/admin/gold', { amount: -1_000_000 });
  assert.equal(r.body.character.gold, 0, 'zlato nejde do mínusu');

  r = await api.post(admin, '/admin/energy', { energy: 7 });
  assert.equal(r.body.energy, 7);

  r = await api.post(admin, '/admin/attributes', { intelligence: 50, luck: 20 });
  assert.equal(r.body.character.attributes.intelligence.value, 50);
  assert.equal(r.body.character.attributes.luck.value, 20);
  assert.equal(r.body.character.attributes.strength.value, 3, 'neuvedené atributy zůstanou');

  // Odemčená vysoká lokace po zvýšení úrovně
  const start = await api.post(admin, '/battle/start', { location: 'zrcadla' });
  assert.equal(start.status, 201);
});

test('předmět, boss, souboj a ukazování odpovědí', async () => {
  let r = await api.post(admin, '/admin/item', { slot: 'ring', rarity: 'legendary', level: 20 });
  const ring = r.body.character.inventory.at(-1);
  assert.equal(ring.slot, 'ring');
  assert.equal(ring.rarity, 'legendary');
  assert.equal(ring.level, 20);
  assert.equal((await api.post(admin, '/admin/item', { slot: 'shield' })).status, 400, 'mág štít nenosí');

  r = await api.post(admin, '/admin/boss', { location: 'les' });
  assert.equal(r.body.locations.find((l) => l.key === 'les').bossCharge, 5);

  r = await api.post(admin, '/admin/answers', { enabled: true });
  assert.equal(r.body.showAnswers, true);
  const chosen = await api.post(admin, '/battle/action', { action: 'light' });
  assert.match(chosen.body.battle.task.adminSolution, /^\d\. /);
  const practice = await api.post(admin, '/lingo/task', { type: 'translate', topic: 'rodina' });
  assert.ok(practice.body.task.adminSolution);

  r = await api.post(admin, '/admin/battle', { action: 'weaken' });
  assert.equal(r.status, 200);
  const battle = await api.get(admin, '/battle');
  assert.equal(battle.body.battle.enemy.hp, 1);

  r = await api.post(admin, '/admin/battle', { action: 'end' });
  assert.equal(r.body.activeBattle, false);
  assert.equal((await api.get(admin, '/battle')).body.battle, null);
});

test('zakázky, denní úkoly a záznam akcí', async () => {
  await api.get(admin, '/tavern');
  await api.post(admin, '/admin/bounties', { action: 'complete' });
  let tavern = (await api.get(admin, '/tavern')).body;
  assert.ok(tavern.bounties.every((b) => b.done));
  await api.post(admin, '/admin/daily', { action: 'complete' });
  tavern = (await api.get(admin, '/tavern')).body;
  assert.ok(tavern.daily.tasks.every((t) => t.done));

  const { body } = await api.get(admin, '/admin');
  assert.ok(body.log.length >= 8);
  assert.equal(body.log[0].admin, 'Spravce');
});

test('smazání postavy (účet zůstane)', async () => {
  const r = await api.post(admin, '/admin/reset-character');
  assert.equal(r.status, 200);
  assert.equal(r.body.character, null);
  assert.equal((await api.get(admin, '/character')).body.character, null);
  assert.equal((await api.get(admin, '/admin')).status, 200, 'admin zůstává adminem i bez postavy');
});
