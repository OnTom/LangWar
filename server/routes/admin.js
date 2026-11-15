import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { ATTRIBUTES, ATTRIBUTE_KEYS, ENERGY_MAX, BOSS_WINS_REQUIRED } from '../game/rules.js';
import { findCharacter, toView, today } from '../game/character.js';
import { generateItem } from '../game/items.js';
import { insertItem, inventoryFree } from '../game/inventory.js';
import { SLOTS, RARITIES } from '../data/items.js';
import LOCATIONS from '../data/locations.js';
import { membership } from '../game/guild.js';
import { currentEnergy } from '../game/expedition.js';
import { isAdmin, showsAnswers, logAction, recentLog } from '../game/admin.js';

// Administrace pro testování: úroveň, zlato, energie, předměty, souboje…
// Dostupná jen pro adminy; každá akce se zapíše do admin_log.
const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  if (!isAdmin(req.user.id)) return res.status(403).json({ error: 'Sem mají přístup jen správci hry.' });
  req.character = findCharacter(req.user.id);
  next();
});

const MAX_LEVEL = 100;
const MAX_ATTRIBUTE = 999;

class AdminError extends Error {}

function int(value, min, max, label) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new AdminError(`${label} musí být celé číslo ${min}–${max}.`);
  return n;
}

function needCharacter(req) {
  if (!req.character) throw new AdminError('Nejdřív si vytvoř postavu.');
  return req.character;
}

function state(req) {
  const c = findCharacter(req.user.id);
  const progress = c ? db.prepare('SELECT * FROM location_progress WHERE character_id = ?').all(c.id) : [];
  const battle = c ? db.prepare("SELECT id FROM battles WHERE character_id = ? AND status = 'active'").get(c.id) : null;
  return {
    character: c ? toView(c) : null,
    energy: c ? currentEnergy(c) : 0,
    energyMax: ENERGY_MAX,
    activeBattle: Boolean(battle),
    showAnswers: showsAnswers(req.user.id),
    attributes: Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, ATTRIBUTES[k].name])),
    slots: Object.fromEntries(Object.entries(SLOTS).map(([k, s]) => [k, s.name])),
    rarities: Object.fromEntries(Object.entries(RARITIES).map(([k, r]) => [k, r.name])),
    locations: LOCATIONS.map((l) => {
      const p = progress.find((x) => x.location === l.key);
      return { key: l.key, name: l.name, icon: l.icon, level: l.level, wins: p?.wins ?? 0, bossCharge: p?.boss_charge ?? 0 };
    }),
    bossWinsRequired: BOSS_WINS_REQUIRED,
    log: recentLog(),
  };
}

// Každá akce: provede se, zapíše do logu a vrátí nový stav administrace
function action(name, fn) {
  return (req, res) => {
    try {
      const details = fn(req) ?? '';
      logAction(req.user.id, name, details);
      res.json({ ...state(req), message: `Hotovo: ${name}${details ? ` (${details})` : ''}` });
    } catch (err) {
      if (err instanceof AdminError) return res.status(400).json({ error: err.message });
      throw err;
    }
  };
}

// GET /api/admin
router.get('/', (req, res) => res.json(state(req)));

// POST /api/admin/level  { level } – nastaví úroveň (XP od nuly)
router.post(
  '/level',
  action('úroveň', (req) => {
    const c = needCharacter(req);
    const level = int(req.body?.level, 1, MAX_LEVEL, 'Úroveň');
    db.prepare('UPDATE characters SET level = ?, xp = 0 WHERE id = ?').run(level, c.id);
    return `${c.level} → ${level}`;
  })
);

// POST /api/admin/gold  { amount } – přidá (nebo záporným číslem ubere) zlato
router.post(
  '/gold',
  action('zlato', (req) => {
    const c = needCharacter(req);
    const amount = int(req.body?.amount, -10_000_000, 10_000_000, 'Množství zlata');
    db.prepare('UPDATE characters SET gold = MAX(0, gold + ?) WHERE id = ?').run(amount, c.id);
    return `${amount > 0 ? '+' : ''}${amount}`;
  })
);

// POST /api/admin/energy  { energy }
router.post(
  '/energy',
  action('energie', (req) => {
    const c = needCharacter(req);
    const energy = int(req.body?.energy, 0, 999, 'Energie');
    db.prepare('UPDATE characters SET energy = ?, energy_day = ? WHERE id = ?').run(energy, today(), c.id);
    return String(energy);
  })
);

// POST /api/admin/arena-ready – zruší čekání v aréně
router.post(
  '/arena-ready',
  action('aréna bez čekání', (req) => {
    const c = needCharacter(req);
    db.prepare('UPDATE characters SET arena_ready_at = 0 WHERE id = ?').run(c.id);
  })
);

// POST /api/admin/attributes  { strength, dexterity, … } – vlastní body atributů
router.post(
  '/attributes',
  action('atributy', (req) => {
    const c = needCharacter(req);
    const values = {};
    for (const key of ATTRIBUTE_KEYS) {
      values[key] = int(req.body?.[key] ?? c[key], 1, MAX_ATTRIBUTE, ATTRIBUTES[key].name);
    }
    db.prepare(
      `UPDATE characters SET ${ATTRIBUTE_KEYS.map((k) => `${k} = @${k}`).join(', ')} WHERE id = @id`
    ).run({ ...values, id: c.id });
    return ATTRIBUTE_KEYS.map((k) => `${ATTRIBUTES[k].name} ${values[k]}`).join(', ');
  })
);

// POST /api/admin/item  { slot?, rarity?, level? } – předmět do inventáře
router.post(
  '/item',
  action('předmět', (req) => {
    const c = needCharacter(req);
    const { slot, rarity } = req.body ?? {};
    if (slot && !Object.hasOwn(SLOTS, slot)) throw new AdminError('Neznámý slot.');
    if (slot === 'shield' && c.class !== 'warrior') throw new AdminError('Štít může nosit jen válečník.');
    if (rarity && !Object.hasOwn(RARITIES, rarity)) throw new AdminError('Neznámá rarita.');
    const level = int(req.body?.level ?? c.level, 1, MAX_LEVEL, 'Úroveň předmětu');
    if (inventoryFree(c.id) <= 0) throw new AdminError('Inventář je plný.');
    const item = generateItem({ level, cls: c.class, ...(slot ? { slots: [slot] } : {}), ...(rarity ? { rarity } : {}) });
    insertItem(c.id, 'inventory', item);
    return `${item.icon} ${item.name} (úr. ${level})`;
  })
);

// POST /api/admin/boss  { location } – boss v lokaci je hned připravený
router.post(
  '/boss',
  action('boss připraven', (req) => {
    const c = needCharacter(req);
    const location = LOCATIONS.find((l) => l.key === req.body?.location);
    if (!location) throw new AdminError('Neznámá lokace.');
    db.prepare(
      `INSERT INTO location_progress (character_id, location, boss_charge) VALUES (?, ?, ?)
       ON CONFLICT (character_id, location) DO UPDATE SET boss_charge = excluded.boss_charge`
    ).run(c.id, location.key, BOSS_WINS_REQUIRED);
    return location.name;
  })
);

// POST /api/admin/bounties  { action: 'complete' | 'reset' }
router.post(
  '/bounties',
  action('zakázky', (req) => {
    const c = needCharacter(req);
    if (req.body?.action === 'complete') {
      db.prepare('UPDATE bounties SET progress = target WHERE character_id = ?').run(c.id);
      return 'všechny splněné';
    }
    if (req.body?.action === 'reset') {
      db.prepare('DELETE FROM bounties WHERE character_id = ?').run(c.id);
      return 'nové zakázky';
    }
    throw new AdminError('Neznámá akce.');
  })
);

// POST /api/admin/daily  { action: 'complete' | 'reset' }
router.post(
  '/daily',
  action('denní úkoly', (req) => {
    const c = needCharacter(req);
    if (req.body?.action === 'complete') {
      db.prepare('UPDATE daily_tasks SET progress = target WHERE character_id = ? AND day = ?').run(c.id, today());
      return 'všechny splněné';
    }
    if (req.body?.action === 'reset') {
      db.prepare('DELETE FROM daily_tasks WHERE character_id = ?').run(c.id);
      db.prepare("UPDATE characters SET daily_chest_day = '' WHERE id = ?").run(c.id);
      return 'nové úkoly a truhla';
    }
    throw new AdminError('Neznámá akce.');
  })
);

// POST /api/admin/battle  { action: 'weaken' | 'end' } – probíhající souboj
router.post(
  '/battle',
  action('souboj', (req) => {
    const c = needCharacter(req);
    const row = db.prepare("SELECT * FROM battles WHERE character_id = ? AND status = 'active'").get(c.id);
    if (!row) throw new AdminError('Teď neprobíhá žádný souboj.');
    if (req.body?.action === 'weaken') {
      const battleState = JSON.parse(row.state);
      battleState.enemy.hp = 1;
      db.prepare('UPDATE battles SET state = ? WHERE id = ?').run(JSON.stringify(battleState), row.id);
      return 'nepřítel má 1 život';
    }
    if (req.body?.action === 'end') {
      // Ukončí souboj bez odměny i bez ztráty cti
      if (row.task_id) db.prepare('DELETE FROM lingo_tasks WHERE id = ?').run(row.task_id);
      db.prepare('DELETE FROM battles WHERE id = ?').run(row.id);
      return 'ukončen bez následků';
    }
    throw new AdminError('Neznámá akce.');
  })
);

// POST /api/admin/answers  { enabled } – ukazovat správné odpovědi v úkolech
router.post(
  '/answers',
  action('ukazovat odpovědi', (req) => {
    const enabled = Boolean(req.body?.enabled);
    db.prepare('UPDATE users SET admin_show_answers = ? WHERE id = ?').run(enabled ? 1 : 0, req.user.id);
    return enabled ? 'zapnuto' : 'vypnuto';
  })
);

// POST /api/admin/reset-character – smaže postavu (účet zůstane), hráč si založí novou
router.post(
  '/reset-character',
  action('nová postava', (req) => {
    const c = needCharacter(req);
    if (membership(c.id)) throw new AdminError('Postava je v cechu. Nejdřív z něj odejdi.');
    db.prepare('DELETE FROM characters WHERE id = ?').run(c.id);
    req.character = null;
    return 'postava smazána';
  })
);

export default router;
