// Herní pravidla postavy: třídy, atributy a odvozené hodnoty.
// Všechny výpočty běží na serveru – klient jen zobrazuje výsledky.

export const ATTRIBUTES = {
  strength: { name: 'Síla', description: 'Hlavní atribut válečníka. Zvyšuje jeho poškození.' },
  dexterity: { name: 'Obratnost', description: 'Hlavní atribut lovce. Zvyšuje jeho poškození.' },
  intelligence: { name: 'Inteligence', description: 'Hlavní atribut mága. Zvyšuje jeho poškození.' },
  constitution: { name: 'Výdrž', description: 'Zvyšuje počet životů.' },
  luck: { name: 'Štěstí', description: 'Zvyšuje šanci na kritický zásah.' },
};

export const ATTRIBUTE_KEYS = Object.keys(ATTRIBUTES);

export const CLASSES = {
  warrior: {
    name: 'Válečník',
    icon: '🛡️',
    description: 'Řeší problémy silou. Hlavně proto, že jiné řešení nezná.',
    mainAttribute: 'strength',
    hpPerConstitution: 5,
    base: { strength: 10, dexterity: 5, intelligence: 3, constitution: 8, luck: 4 },
  },
  mage: {
    name: 'Mág',
    icon: '🔮',
    description: 'Ovládá mocná kouzla. A taky jedno na odstranění skvrn od kotlíku.',
    mainAttribute: 'intelligence',
    hpPerConstitution: 2,
    base: { strength: 3, dexterity: 4, intelligence: 10, constitution: 6, luck: 7 },
  },
  scout: {
    name: 'Lovec',
    icon: '🏹',
    description: 'Trefí veverku na sto kroků. Veverky ho proto nesnáší.',
    mainAttribute: 'dexterity',
    hpPerConstitution: 4,
    base: { strength: 4, dexterity: 10, intelligence: 4, constitution: 7, luck: 5 },
  },
};

export const AVATARS = ['🧔', '👩', '👨‍🦰', '👩‍🦳', '🧝', '🧛', '🧟', '🤡'];

export const STARTING_GOLD = 100;

// XP potřebné k dosažení další úrovně
export function xpToNextLevel(level) {
  return Math.round(100 * level ** 1.6);
}

// Cena vylepšení atributu roste s počtem už koupených bodů
export function upgradeCost(cls, attribute, value) {
  const bought = value - CLASSES[cls].base[attribute];
  return Math.floor(10 + 2 * bought + 0.1 * bought ** 2);
}

export function maxHp(c) {
  return c.constitution * CLASSES[c.class].hpPerConstitution * (c.level + 1);
}

// Zatím bez zbraní: základní poškození podle úrovně, násobené hlavním atributem
export function damageRange(c) {
  const main = c[CLASSES[c.class].mainAttribute];
  const multiplier = 1 + main / 10;
  return {
    min: Math.floor(c.level * 2 * multiplier),
    max: Math.floor(c.level * 4 * multiplier),
  };
}

// Šance na kritický zásah v procentech (proti soupeři stejné úrovně), max. 50 %
export function critChance(c) {
  return Math.min(50, Math.round(((c.luck * 5) / (c.level * 2)) * 10) / 10);
}
