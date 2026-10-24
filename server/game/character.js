import db from '../db.js';
import { TIMEZONE } from '../config.js';
import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  CLASSES,
  THIRST_MAX,
  xpToNextLevel,
  upgradeCost,
  maxHp,
  damageRange,
  critChance,
} from './rules.js';

export function findCharacter(userId) {
  return db
    .prepare(
      `SELECT c.*, u.username AS name
       FROM characters c JOIN users u ON u.id = c.user_id
       WHERE c.user_id = ?`
    )
    .get(userId);
}

// Dnešní datum (RRRR-MM-DD) v herním časovém pásmu
function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE }).format(new Date());
}

// Nový den = plná žízeň. Vrací postavu s aktuálními hodnotami.
export function refreshThirst(c) {
  const day = today();
  if (c.thirst_day === day) return c;
  db.prepare('UPDATE characters SET thirst = ?, thirst_day = ? WHERE id = ?').run(THIRST_MAX, day, c.id);
  return { ...c, thirst: THIRST_MAX, thirst_day: day };
}

// Přičte XP a případně zvýší úroveň (i o víc úrovní najednou)
export function addXp(level, xp, gained) {
  let newLevel = level;
  let newXp = xp + gained;
  while (newXp >= xpToNextLevel(newLevel)) {
    newXp -= xpToNextLevel(newLevel);
    newLevel++;
  }
  return { level: newLevel, xp: newXp, levelsGained: newLevel - level };
}

// Co klient dostane: uložené hodnoty + vše dopočítané serverem
export function toView(c) {
  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) {
    attributes[key] = {
      name: ATTRIBUTES[key].name,
      value: c[key],
      upgradeCost: upgradeCost(c.class, key, c[key]),
    };
  }
  const cls = CLASSES[c.class];
  return {
    name: c.name,
    class: c.class,
    className: cls.name,
    mainAttribute: cls.mainAttribute,
    avatar: c.avatar,
    level: c.level,
    xp: c.xp,
    xpToNextLevel: xpToNextLevel(c.level),
    gold: c.gold,
    attributes,
    stats: {
      hp: maxHp(c),
      damage: damageRange(c),
      critChance: critChance(c),
      blockChance: cls.blockChance,
      evadeChance: cls.evadeChance,
      unblockable: cls.unblockable,
    },
  };
}
