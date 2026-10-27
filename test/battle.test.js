// Tahový souboj: útoky, úkoly, kola, odměny, energie
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer, db } from './helpers.js';
import { getWord } from '../server/game/lingo.js';
import { createBattle, playRound } from '../server/game/battle.js';
import { createMonster } from '../server/game/monsters.js';
import { ENERGY_MAX } from '../server/game/rules.js';

const api = await startServer();
after(() => api.close());

// Správná (nebo schválně špatná) odpověď na úkol podle záznamu v databázi
function answerFor(taskId, correct = true) {
  const row = db.prepare('SELECT * FROM lingo_tasks WHERE id = ?').get(taskId);
  const word = getWord(row.word_id);
  if (row.type === 'choice') {
    const options = JSON.parse(row.data).options;
    return options.findIndex((o) => (o.wordId === word.id) === correct);
  }
  if (!correct) return 'nesmysl';
  return row.type === 'translate' ? word.display : word.de;
}

async function turn(token, action, correct = true) {
  const chosen = await api.post(token, '/battle/action', { action });
  assert.equal(chosen.status, 200, JSON.stringify(chosen.body));
  return api.post(token, '/battle/answer', { answer: answerFor(chosen.body.battle.task.id, correct) });
}

test('souboj trvá při vyrovnaných silách pár kol', () => {
  const hero = { ...createMonster({ name: 'H', icon: '🧔', cls: 'warrior', level: 3 }) };
  let total = 0;
  for (let i = 0; i < 200; i++) {
    const state = createBattle(hero, createMonster({ name: 'M', icon: '👹', cls: 'scout', level: 3 }));
    while (!playRound(state, 'heavy', { correct: true }).outcome);
    total += state.turn;
  }
  const avg = total / 200;
  assert.ok(avg >= 3 && avg <= 6, `průměrně ${avg} kol`);
});

test('souboj se začíná v existujícím tématu a stojí energii', async () => {
  const token = await api.player('Bojovnik', 'warrior');
  const bad = await api.post(token, '/battle/start', { location: 'neexistuje' });
  assert.equal(bad.status, 400);

  const { status, body } = await api.post(token, '/battle/start', { location: 'statek' });
  assert.equal(status, 201);
  assert.equal(body.energy, ENERGY_MAX - 1);
  assert.equal(body.battle.status, 'active');
  assert.ok(body.battle.hero.hp > 0 && body.battle.enemy.hp > 0);
  assert.equal(body.battle.task, null);
  assert.ok(!('damage' in body.battle.enemy), 'klient nedostane výpočetní detaily');

  const twice = await api.post(token, '/battle/start', { location: 'statek' });
  assert.equal(twice.status, 409);
});

test('zvolený útok dá úkol, který nejde vyměnit za jiný', async () => {
  const token = await api.player('Vymenovac', 'mage');
  await api.post(token, '/battle/start', { location: 'chalupa' });
  const first = await api.post(token, '/battle/action', { action: 'heavy' });
  assert.equal(first.body.battle.task.type, 'translate');
  assert.equal(first.body.battle.pendingAction, 'heavy');

  const second = await api.post(token, '/battle/action', { action: 'light' });
  assert.equal(second.body.battle.task.id, first.body.battle.task.id);
  assert.equal(second.body.battle.pendingAction, 'heavy');

  // Úkol souboje nejde zodpovědět přes procvičování
  const practice = await api.post(token, '/lingo/answer', { taskId: first.body.battle.task.id, answer: 'x' });
  assert.equal(practice.status, 400);
});

test('správná odpověď zasáhne, špatná mine; pak útočí nepřítel', async () => {
  const token = await api.player('Trefa', 'warrior');
  const start = await api.post(token, '/battle/start', { location: 'chalupa' });
  const enemyHp = start.body.battle.enemy.hp;

  const miss = await turn(token, 'light', false);
  assert.equal(miss.body.result.correct, false);
  assert.equal(miss.body.events[0].type, 'miss');
  assert.equal(miss.body.battle.enemy.hp, enemyHp);
  assert.equal(miss.body.events[1].actor, 'enemy');
  assert.equal(miss.body.battle.turn, 2);

  const hit = await turn(token, 'heavy', true);
  assert.equal(hit.body.result.correct, true);
  assert.ok(['hit', 'crit'].includes(hit.body.events[0].type));
  assert.ok(hit.body.battle.enemy.hp < enemyHp);
});

test('kouzlo stojí manu a bez many nejde', async () => {
  const token = await api.player('Kouzelnik', 'warrior');
  const start = await api.post(token, '/battle/start', { location: 'chalupa' });
  const mana = start.body.battle.hero.mana;
  const spell = await api.post(token, '/battle/action', { action: 'spell' });
  assert.equal(spell.body.battle.task.type, 'reverse');
  assert.equal(spell.body.battle.hero.mana, mana - 10);
  await api.post(token, '/battle/answer', { answer: 'nesmysl' });

  const again = await api.post(token, '/battle/action', { action: 'spell' });
  assert.equal(again.status, 400, 'válečník s 11 manou má jen na jedno kouzlo');
  assert.match(again.body.error, /mana/);
});

test('vítězství přinese odměnu, souboj pak skončí', async () => {
  const token = await api.player('Vitez', 'warrior');
  await api.post(token, '/battle/start', { location: 'statek' });
  const before = (await api.get(token, '/character')).body.character;
  // Nepřítel se zbytkem života padne první ranou
  const row = db.prepare("SELECT * FROM battles WHERE status = 'active' ORDER BY id DESC").get();
  const state = JSON.parse(row.state);
  state.enemy.hp = 1;
  db.prepare('UPDATE battles SET state = ? WHERE id = ?').run(JSON.stringify(state), row.id);

  const r = await turn(token, 'heavy', true);
  assert.equal(r.body.battle.status, 'won');
  assert.equal(r.body.events.length, 1, 'poražený nepřítel už neútočí');
  assert.ok(r.body.battle.rewards.xp > 0 && r.body.battle.rewards.gold > 0);
  assert.ok(r.body.character.gold >= before.gold + r.body.battle.rewards.gold);

  const now = await api.get(token, '/battle');
  assert.equal(now.body.battle, null);
});

test('vypršený úkol se počítá jako netrefa i po zavření stránky', async () => {
  const token = await api.player('Spioch', 'scout');
  const start = await api.post(token, '/battle/start', { location: 'chalupa' });
  const chosen = await api.post(token, '/battle/action', { action: 'light' });
  db.prepare('UPDATE lingo_tasks SET expires_at = ? WHERE id = ?').run(Date.now() - 10_000, chosen.body.battle.task.id);

  const { body } = await api.get(token, '/battle');
  assert.equal(body.battle.turn, 2);
  assert.equal(body.battle.enemy.hp, start.body.battle.enemy.hp);
  assert.equal(body.battle.log[0].type, 'miss');
  assert.equal(body.battle.pendingAction, null);
});

test('útěk ukončí souboj bez odměny', async () => {
  const token = await api.player('Zbabelec', 'mage');
  await api.post(token, '/battle/start', { location: 'chalupa' });
  const fled = await api.post(token, '/battle/flee');
  assert.equal(fled.body.battle.status, 'fled');
  assert.equal((await api.post(token, '/battle/action', { action: 'light' })).status, 404);
});

test('bez energie se nebojuje', async () => {
  const token = await api.player('Unaveny', 'warrior');
  const { today } = await import('../server/game/character.js');
  db.prepare("UPDATE characters SET energy = 0, energy_day = ? WHERE id = (SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = 'Unaveny')").run(today());
  const r = await api.post(token, '/battle/start', { location: 'statek' });
  assert.equal(r.status, 400);
  assert.match(r.body.error, /energie/);
  assert.equal((await api.get(token, '/character')).body.character.energy, 0);
});

test('mapa: lokace se odemykají úrovní a nepřítel jde vybrat', async () => {
  const token = await api.player('Poutnik', 'scout');
  const { body } = await api.get(token, '/battle/map');
  const chalupa = body.map.locations.find((l) => l.key === 'chalupa');
  const zrcadla = body.map.locations.find((l) => l.key === 'zrcadla');
  assert.equal(chalupa.unlocked, true);
  assert.equal(zrcadla.unlocked, false);
  assert.equal(chalupa.monsters.length, 3);
  assert.equal(chalupa.bossReady, false);

  const locked = await api.post(token, '/battle/start', { location: 'zrcadla' });
  assert.equal(locked.status, 400);
  assert.match(locked.body.error, /úrovně/);

  const bossTooEarly = await api.post(token, '/battle/start', { location: 'chalupa', enemy: 'boss' });
  assert.equal(bossTooEarly.status, 400);

  const picked = await api.post(token, '/battle/start', { location: 'statek', enemy: 1 });
  assert.equal(picked.status, 201);
  assert.equal(picked.body.battle.enemy.name, 'Revoluční prase');
  assert.equal(picked.body.battle.location.key, 'statek');

  // Úkoly berou slova z témat lokace
  const chosen = await api.post(token, '/battle/action', { action: 'light' });
  const row = db.prepare('SELECT word_id FROM lingo_tasks WHERE id = ?').get(chosen.body.battle.task.id);
  assert.ok(row.word_id.startsWith('zvirata:'));

  const after = await api.get(token, '/battle/map');
  assert.equal(after.body.map.current, 'statek');
});

test('po 5 výhrách v lokaci se ukáže boss a dá větší odměnu', async () => {
  const token = await api.player('Lovec', 'warrior');
  const id = db.prepare("SELECT c.id FROM characters c JOIN users u ON u.id = c.user_id WHERE u.username = 'Lovec'").get().id;
  db.prepare("INSERT INTO location_progress (character_id, location, wins, boss_charge) VALUES (?, 'chalupa', 5, 5)").run(id);
  const map = await api.get(token, '/battle/map');
  assert.equal(map.body.map.locations.find((l) => l.key === 'chalupa').bossReady, true);

  const start = await api.post(token, '/battle/start', { location: 'chalupa', enemy: 'boss' });
  assert.equal(start.status, 201);
  assert.equal(start.body.battle.enemy.boss, true);
  assert.equal(start.body.battle.enemy.name, 'Tchyně z pekla');

  const row = db.prepare("SELECT * FROM battles WHERE character_id = ? AND status = 'active'").get(id);
  const state = JSON.parse(row.state);
  state.enemy.hp = 1;
  db.prepare('UPDATE battles SET state = ? WHERE id = ?').run(JSON.stringify(state), row.id);
  const r = await turn(token, 'heavy', true);
  assert.equal(r.body.battle.status, 'won');
  assert.ok(r.body.battle.rewards.item, 'boss dá vždy předmět');
  assert.ok(r.body.battle.rewards.xp >= 30);

  const progress = db.prepare("SELECT * FROM location_progress WHERE character_id = ? AND location = 'chalupa'").get(id);
  assert.deepEqual([progress.wins, progress.boss_charge, progress.boss_wins], [6, 0, 1]);
});

test('každá lokace má existující témata, 3 nepřátele a bosse', async () => {
  const { default: LOCATIONS } = await import('../server/data/locations.js');
  const { TOPICS } = await import('../server/game/lingo.js');
  const { CLASSES } = await import('../server/game/rules.js');
  for (const l of LOCATIONS) {
    assert.ok(l.topics.every((t) => TOPICS.some((x) => x.key === t)), l.key);
    assert.equal(l.monsters.length, 3, l.key);
    assert.ok([...l.monsters, l.boss].every((m) => CLASSES[m.cls]), l.key);
  }
  assert.equal(new Set(LOCATIONS.map((l) => l.key)).size, LOCATIONS.length);
});
