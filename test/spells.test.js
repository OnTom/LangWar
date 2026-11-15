// Kouzla v souboji: účinky, mana, selhání a průběh přes API
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, db } from './helpers.js';
import { createBattle, playRound, actionError, payForAction } from '../server/game/battle.js';
import { createMonster } from '../server/game/monsters.js';
import { spellInfo, SPELL_POWER } from '../server/data/spells.js';

const api = await startServer();
after(() => api.close());

// Souboj, ve kterém hrdina ani nepřítel hned nepadnou
function battle(cls, spells) {
  const hero = { ...createMonster({ name: 'H', icon: '🧔', cls, level: 5 }), monster: false };
  const state = createBattle(hero, createMonster({ name: 'M', icon: '👹', cls: 'warrior', level: 5 }));
  state.spells = spells.map(([kind, rank]) => ({ key: `spell:${kind}`, ...spellInfo(cls, kind, rank) }));
  state.hero.maxHp = 1000;
  state.hero.hp = 500;
  state.enemy.hp = state.enemy.maxHp = 1000;
  state.hero.mana = state.hero.maxMana = 100;
  state.hero.evade = state.hero.block = 0;
  return state;
}

function cast(state, action, correct = true) {
  assert.equal(actionError(state, action), null);
  payForAction(state, action);
  return playRound(state, action, { correct });
}

test('útočné kouzlo: absolutní poškození, mana se platí předem', () => {
  const s = battle('mage', [['attack', 1]]);
  s.enemy.armorReduction = 0;
  const { events } = cast(s, 'spell:attack');
  assert.equal(events[0].type, 'spell');
  const [min, max] = SPELL_POWER.attack[1];
  assert.ok(events[0].damage >= min && events[0].damage <= max, String(events[0].damage));
  assert.equal(s.hero.mana, 100 - 15 + 3, 'cena 15, pak se doplní 3');
});

test('selhání kouzla vrátí 20 % many a nepřítel normálně útočí', () => {
  const s = battle('mage', [['attack', 2]]);
  const { events } = cast(s, 'spell:attack', false);
  assert.equal(events[0].type, 'fizzle');
  assert.equal(events[0].refund, 5, '20 % z 25');
  assert.equal(s.enemy.hp, 1000);
  assert.equal(events[1].actor, 'enemy');
  assert.equal(s.hero.mana, 100 - 25 + 5 + 3);
});

test('bez many ani bez nasazení kouzlo nejde', () => {
  const s = battle('warrior', [['heal', 1]]);
  s.hero.mana = 10;
  assert.match(actionError(s, 'spell:heal'), /mana/);
  assert.match(actionError(s, 'spell:attack'), /nasazené/);
});

test('léčení, štít a omráčení', () => {
  const s = battle('warrior', [['heal', 1], ['defense', 2], ['control', 2]]);
  let { events } = cast(s, 'spell:heal');
  assert.ok(events[0].heal >= 25 && events[0].heal <= 30);
  assert.equal(events[0].heroHp, 500 + events[0].heal);

  ({ events } = cast(s, 'spell:defense'));
  const shield = events[0].shield;
  assert.ok(shield >= 45 && shield <= 55);
  const enemyHit = events[1];
  assert.ok(enemyHit.absorbed > 0 || ['evade', 'block'].includes(enemyHit.type), 'štít pohltil úder');

  s.enemy.mana = 0; // nepřítel nekouzlí
  ({ events } = cast(s, 'spell:control'));
  assert.equal(events[0].effect, 'stun');
  assert.ok(events[0].damage >= 15 && events[0].damage <= 20, 'stupeň II přidá poškození');
  assert.equal(events[1].type, 'stunned', 'nepřítel vynechá tah');
  assert.equal(s.enemy.stunned, false, 'omráčení platí jen jeden tah');
});

test('posílení přidá bonus k dalším zásahům a spotřebuje se', () => {
  const s = battle('warrior', [['buff', 1]]);
  cast(s, 'spell:buff');
  assert.equal(s.hero.empower.attacks, 2);
  const bonus = s.hero.empower.bonus;
  let { events } = playRound(s, 'heavy', { correct: false });
  assert.equal(s.hero.empower.attacks, 2, 'netrefa posílení nespotřebuje');
  ({ events } = playRound(s, 'heavy', { correct: true }));
  assert.equal(events[0].bonus, bonus);
  playRound(s, 'heavy', { correct: true });
  assert.equal(s.hero.empower, null);
});

test('Otrávený šíp: část hned, zbytek jedem ve dvou kolech; válečník ignoruje zbroj', () => {
  const s = battle('scout', [['attack', 1]]);
  const { events } = cast(s, 'spell:attack');
  assert.ok(events[0].poison.perTurn > 0);
  const tick = events.find((e) => e.type === 'poison');
  assert.ok(tick, 'jed působí na konci kola');
  playRound(s, 'light', { correct: false });
  assert.equal(s.enemy.poison, null, 'jed vyprchá po dvou kolech');

  const w = battle('warrior', [['attack', 1]]);
  w.enemy.armorReduction = 50;
  const hit = cast(w, 'spell:attack').events[0];
  assert.ok(hit.damage >= 30, 'zbroj Drtivý úder nesnižuje');
});

test('přes API: nasazené kouzlo v souboji, gramatické cvičení, výsledek', async () => {
  const token = await api.player('Carodej', 'mage');
  db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'Carodej'").run();
  await api.post(token, '/admin/level', { level: 5 });
  await api.post(token, '/admin/library', { action: 'learn', lesson: 'artikel' });
  await api.post(token, '/admin/library', { action: 'learn', lesson: 'praesens' });

  const start = await api.post(token, '/battle/start', { location: 'chalupa' });
  const spells = start.body.battle.spells;
  assert.deepEqual(spells.map((s) => s.name), ['Ohnivá koule', 'Léčivé světlo']);
  assert.equal(spells[0].mana, 15);
  const mana = start.body.battle.hero.mana;

  const chosen = await api.post(token, '/battle/action', { action: 'spell:attack' });
  assert.equal(chosen.status, 200, JSON.stringify(chosen.body));
  const task = chosen.body.battle.task;
  assert.equal(task.grammar, true);
  assert.equal(task.lesson, 'artikel');
  assert.equal(chosen.body.battle.hero.mana, mana - 15, 'mana zaplacená hned');

  const data = JSON.parse(db.prepare('SELECT data FROM lingo_tasks WHERE id = ?').get(task.id).data);
  const answer = data.format === 'choice' ? data.options.indexOf(data.answers[0]) : data.answers[0];
  const r = await api.post(token, '/battle/answer', { answer });
  assert.equal(r.body.result.correct, true);
  assert.equal(r.body.events[0].type, 'spell');
  assert.ok(r.body.events[0].damage >= 20, 'Ohnivá koule zasáhla');

  // Kouzlo, které není nasazené
  assert.equal((await api.post(token, '/battle/action', { action: 'spell:buff' })).status, 400);
  // Obnovení stránky během kouzla: úkol se vrátí
  await api.post(token, '/battle/action', { action: 'spell:heal' });
  const again = await api.get(token, '/battle');
  assert.equal(again.body.battle.task.grammar, true);
  assert.equal(again.body.battle.pendingAction, 'spell:heal');
});

test('zakázka na kouzla: jen pro toho, kdo kouzlí, a plní se úspěšným kouzlem', async () => {
  const token = await api.player('Lovkyne', 'scout');
  const id = db.prepare("SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = 'Lovkyne'").get().id;
  db.prepare('UPDATE characters SET level = 5 WHERE id = ?').run(id);
  db.prepare("INSERT INTO character_lessons (character_id, lesson, bought_at, learned_at) VALUES (?, 'artikel', 1, 1)").run(id);
  db.prepare(`UPDATE characters SET spell_slots = '["attack"]' WHERE id = ?`).run(id);
  await api.get(token, '/tavern');
  db.prepare('DELETE FROM bounties WHERE character_id = ?').run(id);
  db.prepare(
    `INSERT INTO bounties (character_id, slot, kind, location, target, xp, gold, created_at)
     VALUES (?, 0, 'spell', NULL, 3, 5, 5, 0), (?, 1, 'boss', 'statek', 1, 5, 5, 0), (?, 2, 'boss', 'chalupa', 1, 5, 5, 0)`
  ).run(id, id, id);

  const start = await api.post(token, '/battle/start', { location: 'chalupa' });
  assert.equal(start.status, 201, JSON.stringify(start.body));
  const chosen = await api.post(token, '/battle/action', { action: 'spell:attack' });
  assert.equal(chosen.status, 200, JSON.stringify(chosen.body));
  const data = JSON.parse(db.prepare('SELECT data FROM lingo_tasks WHERE id = ?').get(chosen.body.battle.task.id).data);
  await api.post(token, '/battle/answer', { answer: data.format === 'choice' ? data.options.indexOf(data.answers[0]) : data.answers[0] });
  const bounty = (await api.get(token, '/tavern')).body.bounties.find((b) => b.kind === 'spell');
  assert.equal(bounty.progress, 1);
  assert.match(bounty.text, /kouzla/);
});

// --- Kouzla nepřátel ------------------------------------------------------------

import { npcSpells } from '../server/game/library.js';

function enemyBattle(enemySpells) {
  const s = battle('warrior', []);
  s.enemy.spells = enemySpells.map(([kind, rank]) => ({ key: `spell:${kind}`, ...spellInfo('scout', kind, rank) }));
  s.enemy.class = 'scout';
  s.enemy.mana = s.enemy.maxMana = 1000;
  return s;
}

test('nepřátelé dostávají kouzla podle úrovně jako hráči', () => {
  assert.deepEqual(npcSpells('mage', 1, 4), []);
  assert.deepEqual(npcSpells('mage', 2, 4).map((s) => `${s.kind}${s.rank}`), ['attack1']);
  const l9 = npcSpells('warrior', 9, 4);
  assert.equal(l9.length, 4);
  assert.equal(l9.find((s) => s.kind === 'attack').rank, 2, 'na 9. úrovni Útok II');
  assert.equal(npcSpells('scout', 30, 2).length, 2);
  assert.ok(npcSpells('scout', 30, 2).every((s) => ['attack', 'heal'].includes(s.kind)), 'přednost má útok a léčení');
});

test('nepřítel se při nízkých životech léčí a kouzla mu občas selžou', () => {
  let healed = 0;
  let fizzled = 0;
  for (let i = 0; i < 200; i++) {
    const s = enemyBattle([['heal', 1]]);
    s.enemy.hp = 100;
    const { events } = playRound(s, 'heavy', { correct: false });
    const e = events.find((x) => x.actor === 'enemy');
    if (e.type === 'spell' && e.effect === 'heal') healed++;
    if (e.type === 'fizzle') fizzled++;
  }
  assert.ok(healed > 80, `léčil se ${healed}×`);
  assert.ok(fizzled > 10, `selhalo ${fizzled}×`);
});

test('štít nepřítele pohltí zásah hrdiny, jed nepřítele pálí hrdinu', () => {
  const s = enemyBattle([]);
  s.enemy.shield = 1000;
  s.enemy.armorReduction = 0;
  const { events } = playRound(s, 'heavy', { correct: true });
  assert.equal(events[0].damage, 0);
  assert.ok(events[0].absorbed > 0);
  assert.equal(s.enemy.hp, 1000);

  const p = enemyBattle([]);
  p.hero.poison = { perTurn: 7, turns: 2 };
  const round = playRound(p, 'heavy', { correct: false });
  const tick = round.events.find((e) => e.type === 'poison' && e.actor === 'enemy');
  assert.equal(tick.damage, 7);
  assert.equal(p.hero.poison.turns, 1);
});

test('kontrola nepřítele hrdinu zmate: příští úkol má méně času', async () => {
  const s = enemyBattle([['control', 2]]);
  let dazed = false;
  for (let i = 0; i < 100 && !dazed; i++) {
    s.hero.dazed = false;
    const { events } = playRound(s, 'heavy', { correct: false });
    dazed = events.some((e) => e.actor === 'enemy' && e.effect === 'daze');
  }
  assert.ok(dazed && s.hero.dazed);

  const token = await api.player('Zmateny', 'warrior');
  const id = db.prepare("SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = 'Zmateny'").get().id;
  await api.post(token, '/battle/start', { location: 'chalupa' });
  db.prepare("UPDATE battles SET state = json_set(state, '$.hero.dazed', json('true')) WHERE character_id = ? AND status = 'active'").run(id);
  const chosen = await api.post(token, '/battle/action', { action: 'light' });
  assert.equal(chosen.body.battle.task.timeLimit, 6, '10 s × 0,6');
  assert.equal(chosen.body.battle.hero.dazed, false, 'zmatení platí jen na jeden úkol');
});

test('monstrum na mapě a soupeř v aréně kouzlí', async () => {
  const token = await api.player('Vyzyvatel', 'mage');
  const id = db.prepare("SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = 'Vyzyvatel'").get().id;
  db.prepare('UPDATE characters SET level = 9 WHERE id = ?').run(id);
  const start = await api.post(token, '/battle/start', { location: 'chalupa' });
  assert.equal(start.body.battle.enemySpells.length, 2);
  await api.post(token, '/battle/flee');

  // Soupeř v aréně = skutečný hráč s naučeným kouzlem
  const rival = await api.player('Soupeř', 'scout');
  const rivalId = db.prepare("SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = 'Soupeř'").get().id;
  db.prepare("INSERT INTO character_lessons (character_id, lesson, bought_at, learned_at) VALUES (?, 'artikel', 1, 1)").run(rivalId);
  db.prepare(`UPDATE characters SET spell_slots = '["attack"]' WHERE id = ?`).run(rivalId);
  assert.ok(rival);
  db.prepare('UPDATE characters SET arena_opponents = ? WHERE id = ?').run(
    JSON.stringify([{ type: 'player', id: rivalId }, { type: 'npc', index: 0 }, { type: 'npc', index: 1 }]),
    id
  );
  const fight = await api.post(token, '/arena/fight', { index: 0 });
  assert.equal(fight.status, 201, JSON.stringify(fight.body));
  assert.deepEqual(fight.body.battle.enemySpells.map((s) => s.name), ['Otrávený šíp']);
});
