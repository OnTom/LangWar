import db from '../db.js';
import { TIMEZONE } from '../config.js';
import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  CLASSES,
  ENERGY_MAX,
  xpToNextLevel,
  upgradeCost,
  maxHp,
  damageRange,
  critChance,
  blockChance,
  armorReduction,
} from './rules.js';
import { SLOT_KEYS } from '../data/items.js';
import { itemView, combatProfile, INVENTORY_SIZE } from './items.js';
import { getItems } from './inventory.js';
import { dailyReadyCount } from './daily.js';
import { bountiesReady } from './bounties.js';
import { membership, ROLE_NAMES } from './guild.js';

const SELECT_CHARACTER = `SELECT c.*, u.username AS name FROM characters c JOIN users u ON u.id = c.user_id`;

export function findCharacter(userId) {
  return db.prepare(`${SELECT_CHARACTER} WHERE c.user_id = ?`).get(userId);
}

export function findCharacterById(characterId) {
  return db.prepare(`${SELECT_CHARACTER} WHERE c.id = ?`).get(characterId);
}

// Pořadí v síni slávy (podle cti, pak úrovně, pak kdo byl dřív)
export const RANK_ORDER = 'c.honor DESC, c.level DESC, c.id ASC';

export function rankOf(characterId) {
  return db
    .prepare(
      `SELECT rank FROM (SELECT c.id, ROW_NUMBER() OVER (ORDER BY ${RANK_ORDER}) AS rank FROM characters c)
       WHERE id = ?`
    )
    .get(characterId).rank;
}

// Dnešní datum (RRRR-MM-DD) v herním časovém pásmu
export function today() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE }).format(new Date());
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

// Postava připravená do souboje (atributy včetně bonusů, zbraň, zbroj, štít)
export function characterCombatProfile(c) {
  return combatProfile(c, getItems(c.id, 'equipped'));
}

function guildSummary(characterId) {
  const m = membership(characterId);
  return m ? { id: m.guild_id, name: m.name, emblem: m.emblem, role: m.role, roleName: ROLE_NAMES[m.role] } : null;
}

// Co klient dostane: uložené hodnoty + vše dopočítané serverem
export function toView(c) {
  const equippedRows = getItems(c.id, 'equipped');
  const profile = combatProfile(c, equippedRows);
  const cls = CLASSES[c.class];

  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) {
    attributes[key] = {
      name: ATTRIBUTES[key].name,
      value: c[key], // vlastní body (z nich se počítá cena vylepšení)
      bonus: profile[key] - c[key], // bonus z výbavy
      total: profile[key],
      upgradeCost: upgradeCost(c.class, key, c[key]),
    };
  }

  const equipment = Object.fromEntries(SLOT_KEYS.map((slot) => [slot, null]));
  for (const row of equippedRows) equipment[row.slot] = itemView(row);

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
    honor: c.honor,
    energy: c.energy_day === today() ? c.energy : ENERGY_MAX,
    energyMax: ENERGY_MAX,
    dailyReady: dailyReadyCount(c),
    bountiesReady: bountiesReady(c.id),
    guild: guildSummary(c.id),
    guildInvites: db.prepare('SELECT COUNT(*) AS n FROM guild_invites WHERE character_id = ?').get(c.id).n,
    attributes,
    stats: {
      hp: maxHp(profile),
      damage: damageRange(profile),
      critChance: critChance(profile),
      armor: profile.armor,
      armorReduction: armorReduction(profile),
      maxArmorReduction: cls.maxArmorReduction,
      blockChance: blockChance(profile),
      evadeChance: cls.evadeChance,
      unblockable: cls.unblockable,
    },
    equipment,
    inventory: getItems(c.id, 'inventory').map((row) => itemView(row)),
    inventorySize: INVENTORY_SIZE,
  };
}
