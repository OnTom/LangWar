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
    damageFactor: 1,
    blockChance: 20, // % útoků, které vykryje (zatím bez štítu)
    evadeChance: 0,
    unblockable: false,
    base: { strength: 10, dexterity: 5, intelligence: 3, constitution: 8, luck: 4 },
  },
  mage: {
    name: 'Mág',
    icon: '🔮',
    description: 'Ovládá mocná kouzla. A taky jedno na odstranění skvrn od kotlíku.',
    mainAttribute: 'intelligence',
    hpPerConstitution: 2,
    damageFactor: 2.25, // křehký, ale kouzla pořádně bolí
    blockChance: 0,
    evadeChance: 0,
    unblockable: true, // kouzlům se nedá uhnout ani je vykrýt
    base: { strength: 3, dexterity: 4, intelligence: 10, constitution: 6, luck: 7 },
  },
  scout: {
    name: 'Lovec',
    icon: '🏹',
    description: 'Trefí veverku na sto kroků. Veverky ho proto nesnáší.',
    mainAttribute: 'dexterity',
    hpPerConstitution: 4,
    damageFactor: 1.25,
    blockChance: 0,
    evadeChance: 35, // % útoků, kterým uhne
    unblockable: false,
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

// Zatím bez zbraní: základní poškození podle úrovně a třídy, násobené hlavním atributem
export function damageRange(c) {
  const cls = CLASSES[c.class];
  const multiplier = cls.damageFactor * (1 + c[cls.mainAttribute] / 10);
  return {
    min: Math.floor(c.level * 2 * multiplier),
    max: Math.floor(c.level * 4 * multiplier),
  };
}

// Šance na kritický zásah v procentech proti soupeři dané úrovně, max. 50 %
export function critChance(c, opponentLevel = c.level) {
  return Math.min(50, Math.round(((c.luck * 5) / (opponentLevel * 2)) * 10) / 10);
}

export const CRIT_MULTIPLIER = 2;

// --- Questy -----------------------------------------------------------------

// Denní zásoba žízně v sekundách (100 minut). Quest stojí tolik žízně, jak dlouho trvá.
export const THIRST_MAX = 100 * 60;
export const QUEST_OFFERS = 3;

// Délka questu v minutách: na začátku krátké, s úrovní se prodlužují
export function questDurationRange(level) {
  return { min: 1, max: Math.min(10, 3 + Math.floor(level / 2)) };
}

// Odměny za minutu questu; zhruba 12 minut questů na jednu úroveň
export function xpPerMinute(level) {
  return xpToNextLevel(level) / 12;
}

export function goldPerMinute(level) {
  return 3 + level * 2;
}

// Typy nabídek: jedna spíš na XP, jedna na zlato, jedna vyvážená
export const QUEST_TYPES = [
  { xp: 1.5, gold: 0.6 },
  { xp: 0.6, gold: 1.5 },
  { xp: 1, gold: 1 },
];

// --- Souboje a monstra ------------------------------------------------------

// Pojistka proti nekonečnému souboji (počet útoků celkem)
export const MAX_FIGHT_ATTACKS = 200;

// Síla monstra: základ jeho třídy násobený podle úrovně
export function monsterScale(level) {
  return 0.75 + 0.12 * (level - 1);
}
