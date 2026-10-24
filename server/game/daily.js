import db from '../db.js';
import DAILY_TASKS from '../data/daily.js';
import { DAILY_TASK_COUNT, DAILY_CHEST_RARITY_BOOST, dailyReward } from './rules.js';
import { today, addXp } from './character.js';
import { generateItem, itemView } from './items.js';
import { insertItem, inventoryFree } from './inventory.js';

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

// Vytvoří dnešní úkoly, pokud ještě nejsou (staré dny smaže)
const ensureDaily = db.transaction((characterId) => {
  const day = today();
  const exists = db.prepare('SELECT 1 FROM daily_tasks WHERE character_id = ? AND day = ?').get(characterId, day);
  if (exists) return;
  db.prepare('DELETE FROM daily_tasks WHERE character_id = ?').run(characterId);
  const keys = Object.keys(DAILY_TASKS).sort(() => Math.random() - 0.5).slice(0, DAILY_TASK_COUNT);
  const insert = db.prepare(
    'INSERT INTO daily_tasks (character_id, day, slot, task_key, target) VALUES (?, ?, ?, ?, ?)'
  );
  keys.forEach((key, slot) => insert.run(characterId, day, slot, key, randomInt(...DAILY_TASKS[key].target)));
});

// Započítá postup v úkolu daného druhu (volá se z krčmy, arény, obchodu…)
export function progressDaily(characterId, key, amount = 1) {
  ensureDaily(characterId);
  db.prepare(
    `UPDATE daily_tasks SET progress = MIN(target, progress + ?)
     WHERE character_id = ? AND day = ? AND task_key = ? AND claimed = 0`
  ).run(amount, characterId, today(), key);
}

function tasksOf(characterId) {
  return db
    .prepare('SELECT * FROM daily_tasks WHERE character_id = ? AND day = ? ORDER BY slot')
    .all(characterId, today());
}

function chestReady(c, tasks) {
  return tasks.length > 0 && tasks.every((t) => t.claimed) && c.daily_chest_day !== today();
}

// Kolik odměn čeká na vyzvednutí (pro odznak v menu)
export function dailyReadyCount(c) {
  const tasks = tasksOf(c.id);
  return tasks.filter((t) => t.progress >= t.target && !t.claimed).length + (chestReady(c, tasks) ? 1 : 0);
}

export function dailyState(c) {
  ensureDaily(c.id);
  const tasks = tasksOf(c.id);
  const reward = dailyReward(c.level);
  return {
    tasks: tasks.map((t) => ({
      slot: t.slot,
      text: DAILY_TASKS[t.task_key].text,
      icon: DAILY_TASKS[t.task_key].icon,
      progress: t.progress,
      target: t.target,
      done: t.progress >= t.target,
      claimed: Boolean(t.claimed),
      reward,
    })),
    chest: {
      ready: chestReady(c, tasks),
      claimed: c.daily_chest_day === today(),
    },
  };
}

// Vyzvedne odměnu za splněný úkol. Vrací odměnu, nebo null.
export function claimTask(c, slot) {
  const reward = dailyReward(c.level);
  return db.transaction(() => {
    const marked = db
      .prepare(
        `UPDATE daily_tasks SET claimed = 1
         WHERE character_id = ? AND day = ? AND slot = ? AND claimed = 0 AND progress >= target`
      )
      .run(c.id, today(), slot);
    if (marked.changes === 0) return null;
    const progress = addXp(c.level, c.xp, reward.xp);
    db.prepare('UPDATE characters SET gold = gold + ?, xp = ?, level = ? WHERE id = ?').run(
      reward.gold,
      progress.xp,
      progress.level,
      c.id
    );
    return { ...reward, levelsGained: progress.levelsGained };
  })();
}

// Otevře truhlu za všechny úkoly: předmět (při plném inventáři rovnou zlato)
export function claimChest(c) {
  return db.transaction(() => {
    if (!chestReady(c, tasksOf(c.id))) return null;
    const marked = db
      .prepare('UPDATE characters SET daily_chest_day = ? WHERE id = ? AND daily_chest_day != ?')
      .run(today(), c.id, today());
    if (marked.changes === 0) return null;

    const item = generateItem({ level: c.level, cls: c.class, rarityBoost: DAILY_CHEST_RARITY_BOOST });
    if (inventoryFree(c.id) > 0) {
      const id = insertItem(c.id, 'inventory', item);
      return { item: itemView({ ...item, id }), sold: false };
    }
    db.prepare('UPDATE characters SET gold = gold + ? WHERE id = ?').run(item.value, c.id);
    return { item: itemView({ ...item, id: null }), sold: true };
  })();
}
