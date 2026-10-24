import { ATTRIBUTES, ATTRIBUTE_KEYS, CLASSES } from './rules.js';
import { SLOTS, SLOT_KEYS, NOUNS, RARITIES, STARTER_GEAR } from '../data/items.js';

export const INVENTORY_SIZE = 10;
export const BUY_PRICE_MULTIPLIER = 3; // obchodník prodává 3× dráž, než vykupuje

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomFactor(spread = 0.2) {
  return 1 - spread + Math.random() * spread * 2;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Jak se zvýhodnění (boost) rozdělí: ubere obyčejným, přidá vzácnějším
const BOOST_SHARE = { common: -1, rare: 0.6, epic: 0.3, legendary: 0.1 };

// Náhodná rarita; boost posune šance k lepším (např. u kouzelnice)
function pickRarity(boost = 0) {
  let roll = Math.random() * 100;
  for (const [key, r] of Object.entries(RARITIES)) {
    const chance = r.chance + boost * BOOST_SHARE[key];
    if (roll < chance) return key;
    roll -= chance;
  }
  return 'common';
}

// Které sloty může postava dané třídy dostat (štít jen válečník)
export function slotsForClass(cls) {
  return SLOT_KEYS.filter((s) => s !== 'shield' || cls === 'warrior');
}

function emptyItem(slot, level) {
  const item = { slot, class: null, level, armor: 0, damage_min: 0, damage_max: 0 };
  for (const key of ATTRIBUTE_KEYS) item[key] = 0;
  return item;
}

function addWeaponOrArmor(item, cls, power) {
  if (item.slot === 'weapon') {
    item.class = cls;
    item.damage_min = Math.max(1, Math.round(item.level * 2 * power * randomFactor(0.1)));
    item.damage_max = Math.max(item.damage_min + 1, Math.round(item.level * 4 * power * randomFactor(0.1)));
  }
  const armorFactor = SLOTS[item.slot].armorFactor;
  if (armorFactor > 0) {
    item.armor = Math.max(1, Math.round(item.level * armorFactor * power * randomFactor(0.1)));
  }
}

function itemValue(level, rarity) {
  return Math.round((5 + level * 5) * RARITIES[rarity].value);
}

/**
 * Vygeneruje náhodný předmět.
 * cls – pro koho je určen (zbraň bude pro tuto třídu, bonusy častěji do hlavního atributu)
 * slots – ze kterých slotů vybírat, rarityBoost – zvýhodnění vzácnějších předmětů
 */
export function generateItem({ level, cls, slots = slotsForClass(cls), rarityBoost = 0 }) {
  // Zbraň padá dvakrát častěji než ostatní
  const weighted = slots.flatMap((s) => (s === 'weapon' ? [s, s] : [s]));
  const slot = pick(weighted);
  const rarity = pickRarity(rarityBoost);
  const r = RARITIES[rarity];
  const item = emptyItem(slot, level);

  const [noun, icon] = pick(slot === 'weapon' ? NOUNS.weapon[cls] : NOUNS[slot]);
  item.name = `${noun} ${pick(r.suffixes)}`;
  item.icon = icon;
  item.rarity = rarity;

  // Bonusy k atributům; šperky mají silnější
  const jewelry = slot === 'ring' || slot === 'amulet';
  let attrs = [...ATTRIBUTE_KEYS].sort(() => Math.random() - 0.5);
  const main = CLASSES[cls].mainAttribute;
  if (Math.random() < 0.5) attrs = [main, ...attrs.filter((a) => a !== main)];
  for (const attr of attrs.slice(0, r.bonuses)) {
    item[attr] = Math.max(1, Math.round((1 + level * 0.7) * r.power * (jewelry ? 1.3 : 1) * randomFactor()));
  }

  addWeaponOrArmor(item, cls, r.power);
  item.value = itemValue(level, rarity);
  return item;
}

// Startovní výbava: obyčejné předměty 1. úrovně bez bonusů
export function starterItems(cls) {
  return STARTER_GEAR[cls].map((g) => {
    const item = emptyItem(g.slot, 1);
    item.name = g.name;
    item.icon = g.icon;
    item.rarity = 'common';
    addWeaponOrArmor(item, cls, 1);
    if (g.slot === 'weapon') {
      item.damage_min = 2;
      item.damage_max = 4;
    }
    item.value = 1;
    return item;
  });
}

// Co o předmětu uvidí klient
export function itemView(row, { inShop = false } = {}) {
  const bonuses = {};
  for (const key of ATTRIBUTE_KEYS) {
    if (row[key]) bonuses[key] = { name: ATTRIBUTES[key].name, value: row[key] };
  }
  return {
    id: row.id,
    slot: row.slot,
    slotName: SLOTS[row.slot].name,
    class: row.class,
    className: row.class ? CLASSES[row.class].name : null,
    name: row.name,
    icon: row.icon,
    rarity: row.rarity,
    rarityName: RARITIES[row.rarity].name,
    level: row.level,
    bonuses,
    armor: row.armor,
    damage: row.slot === 'weapon' ? { min: row.damage_min, max: row.damage_max } : null,
    sellPrice: row.value,
    ...(inShop ? { price: row.value * BUY_PRICE_MULTIPLIER } : {}),
  };
}

// Bojový profil: postava + bonusy a vlastnosti nasazených předmětů
export function combatProfile(c, equipped) {
  const profile = { ...c, weapon: null, armor: 0, shield: false };
  for (const item of equipped) {
    for (const key of ATTRIBUTE_KEYS) profile[key] += item[key];
    profile.armor += item.armor;
    if (item.slot === 'weapon') profile.weapon = { min: item.damage_min, max: item.damage_max };
    if (item.slot === 'shield') profile.shield = true;
  }
  return profile;
}

// Může postava předmět nasadit?
export function canEquip(cls, item) {
  if (item.slot === 'shield' && cls !== 'warrior') return 'Štít unese jen válečník. Ostatní by se pod ním zhroutili.';
  if (item.slot === 'weapon' && item.class !== cls) {
    return `Tuhle zbraň umí používat jen ${CLASSES[item.class].name.toLowerCase()}.`;
  }
  return null;
}
