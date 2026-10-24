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
    blockChance: 25, // % útoků, které vykryje – jen se štítem
    evadeChance: 0,
    maxArmorReduction: 50, // zbroj sníží poškození nejvýš o 50 %
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
    maxArmorReduction: 10,
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
    maxArmorReduction: 25,
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

// Funkce níže pracují s „bojovým profilem“: postava nebo monstrum včetně
// výbavy – { class, level, strength…luck, weapon: {min, max} | null, armor, shield }

// Poškození = výcvik podle úrovně + zbraň, násobené třídou a hlavním atributem
export function damageRange(f) {
  const cls = CLASSES[f.class];
  const weapon = f.weapon ?? { min: 0, max: 0 };
  const multiplier = cls.damageFactor * (1 + f[cls.mainAttribute] / 10);
  return {
    min: Math.max(1, Math.floor((f.level + weapon.min) * multiplier)),
    max: Math.max(1, Math.floor((f.level * 2 + weapon.max) * multiplier)),
  };
}

// Válečník vykrývá jen se štítem
export function blockChance(f) {
  return f.shield ? CLASSES[f.class].blockChance : 0;
}

// O kolik % sníží zbroj poškození od útočníka dané úrovně
export function armorReduction(f, attackerLevel = f.level) {
  const reduction = (f.armor || 0) / attackerLevel;
  return Math.min(CLASSES[f.class].maxArmorReduction, Math.round(reduction * 10) / 10);
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
export const QUEST_ITEM_CHANCE = 25; // % questů, které nabízí i předmět

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

const MONSTER_GROWTH = 0.2; // o kolik násobků základu monstra sílí s každou úrovní
const MONSTER_WEAPON = 1.5; // zbraň monstra: 1,5–3× úroveň

// Síla monstra: základ jeho třídy násobený podle úrovně
export function monsterScale(level) {
  return 0.75 + MONSTER_GROWTH * (level - 1);
}

// Výbava monster: zbraň jako běžná zbraň dané úrovně, zbroj podle třídy
export function monsterGear(cls, level) {
  const armorPerLevel = { warrior: 8, scout: 5, mage: 2 }[cls];
  return {
    weapon: { min: Math.round(level * MONSTER_WEAPON), max: Math.round(level * MONSTER_WEAPON * 2) },
    armor: Math.round(level * armorPerLevel * 0.5),
    shield: cls === 'warrior',
  };
}

// --- Aréna ------------------------------------------------------------------

export const ARENA_OPPONENTS = 3;
export const ARENA_COOLDOWN = 10 * 60; // sekund mezi souboji v aréně

// Kolik cti se přesune: za výhru nad silnějším víc, za prohru se silnějším míň
export function honorTransfer(winnerHonor, loserHonor) {
  return Math.max(2, Math.min(25, Math.round(10 + (loserHonor - winnerHonor) / 20)));
}

// Zlato za vítězství v aréně (NPC gladiátor dá polovinu)
export function arenaGold(level) {
  return goldPerMinute(level) * 3;
}

// Prvních pár výher v aréně každý den dá navíc XP
export const ARENA_DAILY_XP_WINS = 5;

export function arenaXp(level) {
  return Math.max(1, Math.round(xpToNextLevel(level) / 15));
}

// --- Denní úkoly ------------------------------------------------------------

export const DAILY_TASK_COUNT = 3;

export function dailyReward(level) {
  return { gold: goldPerMinute(level) * 5, xp: Math.max(1, Math.round(xpToNextLevel(level) / 10)) };
}

// Truhla za splnění všech denních úkolů: předmět s vyšší šancí na vzácnost
export const DAILY_CHEST_RARITY_BOOST = 25;
