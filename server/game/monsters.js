import { ATTRIBUTE_KEYS, CLASSES, monsterScale, monsterGear } from './rules.js';

// Vytvoří monstrum dané úrovně. Atributy vychází ze základu jeho třídy s trochou náhody.
export function createMonster({ name, icon, cls, level }) {
  const base = CLASSES[cls].base;
  const scale = monsterScale(level);
  const monster = { name, avatar: icon, class: cls, level, monster: true, ...monsterGear(cls, level) };
  for (const key of ATTRIBUTE_KEYS) {
    monster[key] = Math.max(1, Math.round(base[key] * scale * (0.9 + Math.random() * 0.2)));
  }
  return monster;
}

// Průměrný bojovník dané třídy a úrovně (bez náhody) – měřítko, se kterým se porovnávají
// atributy a výbava. Monstra se porovnávají s průměrným monstrem, hráči s běžným hráčem
// (vylepšuje atributy a nosí obyčejnou výbavu své úrovně).
export function parProfile(cls, level, monster = false) {
  const base = CLASSES[cls].base;
  if (monster) {
    const profile = { class: cls, level, ...monsterGear(cls, level) };
    for (const key of ATTRIBUTE_KEYS) profile[key] = Math.max(1, Math.round(base[key] * monsterScale(level)));
    return profile;
  }
  const profile = {
    class: cls,
    level,
    weapon: { min: 2 * level, max: 4 * level },
    armor: Math.round(level * (cls === 'warrior' ? 11 : 8)),
    shield: cls === 'warrior',
  };
  for (const key of ATTRIBUTE_KEYS) profile[key] = Math.max(1, Math.round(base[key] * (1 + HERO_GROWTH * (level - 1))));
  return profile;
}

// Jak rychle běžný hráč vylepšuje atributy (násobek základu za každou úroveň)
const HERO_GROWTH = 0.25;
