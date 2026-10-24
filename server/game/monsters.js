import { ATTRIBUTE_KEYS, CLASSES, monsterScale, monsterGear } from './rules.js';

// Vytvoří monstrum dané úrovně. Atributy vychází ze základu jeho třídy s trochou náhody.
export function createMonster({ name, icon, cls, level }) {
  const base = CLASSES[cls].base;
  const scale = monsterScale(level);
  const monster = { name, avatar: icon, class: cls, level, ...monsterGear(cls, level) };
  for (const key of ATTRIBUTE_KEYS) {
    monster[key] = Math.max(1, Math.round(base[key] * scale * (0.9 + Math.random() * 0.2)));
  }
  return monster;
}
