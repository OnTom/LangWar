// Výprava: tahové souboje uložené v databázi, energie a odměny.
// Samotná pravidla souboje jsou v battle.js, úkoly se slovíčky v lingo.js.
import db from '../db.js';
import QUEST_TEMPLATES from '../data/quests.js';
import { BATTLE_ACTIONS, ENERGY_MAX, BATTLE_ITEM_CHANCE, battleReward } from './rules.js';
import { TASK_TYPES, TOPICS, TaskError, createTask, answerTask, openTask } from './lingo.js';
import { createBattle, actionError, payForAction, playRound } from './battle.js';
import { createMonster } from './monsters.js';
import { findCharacter, characterCombatProfile, addXp, today } from './character.js';
import { generateItem, itemView } from './items.js';
import { insertItem, inventoryFree } from './inventory.js';
import { guildBonus, applyBonus } from './guild.js';
import { progressDaily } from './daily.js';

export class BattleError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// --- Energie -------------------------------------------------------------------

// Každý den je energie zase plná
export function currentEnergy(c) {
  return c.energy_day === today() ? c.energy : ENERGY_MAX;
}

function spendEnergy(c) {
  const day = today();
  const spent = db
    .prepare(
      `UPDATE characters SET
         energy = CASE WHEN energy_day = @day THEN energy - 1 ELSE @max - 1 END,
         energy_day = @day
       WHERE id = @id AND (energy_day != @day OR energy > 0)`
    )
    .run({ id: c.id, day, max: ENERGY_MAX });
  return spent.changes > 0;
}

// --- Souboje -------------------------------------------------------------------

function findActive(characterId) {
  return db.prepare("SELECT * FROM battles WHERE character_id = ? AND status = 'active'").get(characterId);
}

function save(row, state, fields = {}) {
  const next = { ...row, ...fields, state: JSON.stringify(state), updated_at: Date.now() };
  db.prepare(
    `UPDATE battles SET status = @status, state = @state, pending_action = @pending_action,
       task_id = @task_id, updated_at = @updated_at WHERE id = @id`
  ).run(next);
  return next;
}

const PUBLIC_FIGHTER = ['name', 'avatar', 'class', 'level', 'hp', 'maxHp', 'mana', 'maxMana'];

function publicFighter(f) {
  return Object.fromEntries(PUBLIC_FIGHTER.map((k) => [k, f[k]]));
}

// Co o souboji uvidí klient (bez detailů výpočtu a bez správné odpovědi)
export function battleView(row) {
  if (!row) return null;
  const state = JSON.parse(row.state);
  const pending = row.task_id ? openTask(row.character_id, row.task_id) : null;
  return {
    id: row.id,
    status: row.status,
    turn: state.turn,
    location: state.location,
    hero: publicFighter(state.hero),
    enemy: publicFighter(state.enemy),
    actions: Object.entries(BATTLE_ACTIONS).map(([key, a]) => ({
      key,
      name: a.name,
      icon: a.icon,
      mana: a.mana,
      power: a.power,
      taskName: TASK_TYPES[a.task].name,
      timeLimit: TASK_TYPES[a.task].timeLimit,
      available: state.hero.mana >= a.mana,
    })),
    pendingAction: row.pending_action,
    task: pending && !pending.expired ? pending.task : null,
    log: state.log,
    rewards: state.rewards ?? null,
  };
}

function pickMonster(level) {
  const t = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];
  return createMonster({ name: t.monster, icon: t.monsterIcon, cls: t.monsterClass, level });
}

/** Začne souboj v daném tématu (zatím bez mapy – fáze 3 přidá lokace). */
export function startBattle(c, { topic } = {}) {
  if (findActive(c.id)) throw new BattleError('Už bojuješ. Nejdřív dobojuj, nebo uteč.', 409);
  const location = TOPICS.find((t) => t.key === topic);
  if (!location) throw new BattleError('Takové místo na mapě není.');

  const now = Date.now();
  const start = db.transaction(() => {
    if (!spendEnergy(c)) throw new BattleError('Na dnešek ti došla energie. Hrdina potřebuje spánek.');
    db.prepare("DELETE FROM battles WHERE character_id = ? AND status != 'active'").run(c.id);
    const state = createBattle({ ...characterCombatProfile(c), name: c.name, avatar: c.avatar }, pickMonster(c.level));
    state.location = { topic: location.key, name: location.name, icon: location.icon };
    state.topics = [location.key];
    const id = db
      .prepare('INSERT INTO battles (character_id, state, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(c.id, JSON.stringify(state), now, now).lastInsertRowid;
    return db.prepare('SELECT * FROM battles WHERE id = ?').get(id);
  });
  return start();
}

/** Hráč zvolil útok: zaplatí manu a dostane úkol. Rozpracovaný úkol nejde vyměnit. */
export function chooseAction(c, action) {
  const row = resolveExpired(c);
  if (!row) throw new BattleError('Teď nebojuješ.', 404);
  // Úkol už běží (klient ho dostane znovu), nebo souboj právě skončil vypršením času
  if (row.pending_action || row.status !== 'active') return row;

  const state = JSON.parse(row.state);
  const error = actionError(state, action);
  if (error) throw new BattleError(error);
  payForAction(state, action);
  const task = createTask(c.id, { type: BATTLE_ACTIONS[action].task, topics: state.topics, context: `battle:${row.id}` });
  return save(row, state, { pending_action: action, task_id: task.id });
}

// Vyhodnotí odpověď a odehraje kolo. Vrací { row, result, events }.
function playTurn(c, row, answer) {
  const state = JSON.parse(row.state);
  let result;
  try {
    result = answerTask(c.id, row.task_id, answer);
  } catch (err) {
    if (!(err instanceof TaskError)) throw err;
    // Úkol mezitím zmizel (např. byl smazán jako starý) – počítá se jako netrefa
    result = { correct: false, timedOut: true, expected: null, word: null };
  }
  const { events, outcome } = playRound(state, row.pending_action, { correct: result.correct, word: result.word });
  if (outcome) {
    state.rewards = outcome === 'won' ? giveRewards(c, state) : null;
    if (outcome === 'won') progressDaily(c.id, 'quest_win');
  }
  const saved = save(row, state, { status: outcome ?? 'active', pending_action: null, task_id: null });
  return { row: saved, result, events };
}

/** Odpověď na úkol aktuálního útoku. */
export function answerAction(c, answer) {
  const row = findActive(c.id);
  if (!row) throw new BattleError('Teď nebojuješ.', 404);
  if (!row.pending_action) throw new BattleError('Nejdřív si vyber útok.');
  return db.transaction(() => playTurn(c, row, answer))();
}

// Když hráč nechal úkol vypršet (zavřel stránku), kolo se odehraje jako netrefa
export function resolveExpired(c) {
  const row = findActive(c.id);
  if (!row?.pending_action) return row;
  const open = openTask(c.id, row.task_id);
  if (open && !open.expired) return row;
  return db.transaction(() => playTurn(c, row, null))().row;
}

/** Útěk: souboj končí bez odměny (energie se nevrací). */
export function flee(c) {
  const row = findActive(c.id);
  if (!row) throw new BattleError('Teď nebojuješ.', 404);
  if (row.task_id) db.prepare('DELETE FROM lingo_tasks WHERE id = ?').run(row.task_id);
  return save(row, JSON.parse(row.state), { status: 'fled', pending_action: null, task_id: null });
}

export function activeBattle(c) {
  return resolveExpired(c);
}

// Odměna za vítězství: XP, zlato (s bonusem cechu) a občas předmět
function giveRewards(c, state) {
  const base = battleReward(state.enemy.level);
  const bonus = guildBonus(c.id);
  const xp = applyBonus(base.xp, bonus.xp);
  let gold = applyBonus(base.gold, bonus.gold);

  let item = null;
  let itemSold = false;
  if (Math.random() * 100 < BATTLE_ITEM_CHANCE) {
    const generated = generateItem({ level: c.level, cls: c.class });
    if (inventoryFree(c.id) > 0) {
      const id = insertItem(c.id, 'inventory', generated);
      item = itemView(db.prepare('SELECT * FROM items WHERE id = ?').get(id));
    } else {
      itemSold = true;
      gold += generated.value;
      item = { name: generated.name, icon: generated.icon, rarity: generated.rarity, sellPrice: generated.value };
    }
  }

  const fresh = findCharacter(c.user_id);
  const progress = addXp(fresh.level, fresh.xp, xp);
  db.prepare('UPDATE characters SET gold = gold + ?, xp = ?, level = ? WHERE id = ?').run(
    gold,
    progress.xp,
    progress.level,
    c.id
  );
  return { xp, gold, item, itemSold, levelsGained: progress.levelsGained };
}
