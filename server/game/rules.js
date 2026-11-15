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

// --- Odměny ---------------------------------------------------------------

// Základní jednotka zlata pro danou úroveň (souboje, aréna, denní úkoly, zakázky)
export function goldPerMinute(level) {
  return 3 + level * 2;
}

// --- Zakázky v krčmě ----------------------------------------------------------

export const BOUNTY_SLOTS = 3;
export const BOUNTY_ITEM_CHANCE = 30; // % zakázek, za které je navíc předmět

// Cena za výměnu zakázky u hospodského
export function bountySwapCost(level) {
  return goldPerMinute(level) * 2;
}

// --- Souboje a monstra ------------------------------------------------------

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

// --- Tahové souboje (Výprava) -----------------------------------------------

// Denní energie: každý souboj na výpravě stojí 1 bod
export const ENERGY_MAX = 50;

// Základní útoky hráče. Každý útok = jazykový úkol se slovíčkem; zásah jen při správné odpovědi.
// tasks = typy úkolů, ze kterých se náhodně vybírá (střídá se překlad do češtiny a do cizího jazyka),
// power násobí hod poškození. Kouzla (s gramatikou) přibudou samostatně.
export const BATTLE_ACTIONS = {
  light: { name: 'Lehký útok', icon: '🗡️', taskName: 'Vyber překlad', tasks: ['choice', 'choice_reverse'], power: 0.7 },
  heavy: { name: 'Těžký útok', icon: '🪓', taskName: 'Napiš překlad', tasks: ['translate', 'reverse'], power: 1 },
};

// --- Měřítko soubojů ------------------------------------------------------------
// Čísla v souboji rostou s úrovní zhruba lineárně, aby kouzla s pevnou (absolutní) silou
// dávala smysl: léčení za 25–30 životů je na začátku čtvrtina životů, později méně.
// Atributy, výbava a povolání čísla posouvají nahoru či dolů (viz battleStats v battle.js).

// Životy hrdiny průměrné postavy dané úrovně
export function parHp(level) {
  return 100 + 7 * (level - 1);
}

// Průměrný těžký zásah hrdiny průměrné postavy dané úrovně
export function parHit(level) {
  return 16 + (level - 1);
}

// Nepřítel vydrží zhruba tolik průměrných těžkých zásahů hrdiny…
export const BATTLE_HERO_HITS = 3.5;
// …a hrdina vydrží zhruba tolik průměrných zásahů nepřítele (před zbrojí a obranou)
export const BATTLE_ENEMY_HITS = 8;

// Povolání v souboji: válečník víc vydrží, mág víc bije
export const BATTLE_CLASS = {
  warrior: { hp: 1.15, damage: 0.95 },
  mage: { hp: 0.85, damage: 1.15 },
  scout: { hp: 1, damage: 1 },
};

// O kolik můžou atributy a výbava posunout životy a poškození proti průměru (násobek)
export const BATTLE_FACTOR_MIN = 0.6;
export const BATTLE_FACTOR_MAX = 1.8;
export const BATTLE_DAMAGE_SPREAD = 0.2; // zásah je náhodně ±20 % kolem průměru

// Ochrana začátečníků: nepřátelé bijí hrdinu na 1. úrovni slaběji, od 5. úrovně naplno
export function beginnerDamageScale(heroLevel) {
  return Math.min(1, 0.7 + 0.075 * (heroLevel - 1));
}

// Mana: základ + 1 bod za každý bod Inteligence; každé kolo se trochu doplní
export function maxMana(f) {
  return 30 + f.intelligence;
}
export const MANA_REGEN = 3;

export const BATTLE_CRIT_MULTIPLIER = 1.5;
export const ENEMY_SPELL_SUCCESS = 75; // % kouzel nepřítele, která vyjdou (i nepřátelé se pletou)
export const DAZE_TIME_FACTOR = 0.6; // zmatený hrdina (kouzlo kontroly nepřítele) má na příští úkol méně času
export const BATTLE_ITEM_CHANCE = 10; // % vítězství, za která padne předmět

// Boss lokace: objeví se po několika výhrách v lokaci, je silnější a dá větší odměnu i jistý předmět
export const BOSS_WINS_REQUIRED = 5;
export const BOSS_LEVEL_BONUS = 1;
export const BOSS_HP = 1.3; // boss se navíc léčí a staví štíty
export const BOSS_DAMAGE = 1.2;
export const BOSS_REWARD = 3;
export const BOSS_RARITY_BOOST = 15;

// Kolik kouzel umí nepřítel řízený počítačem (stupně podle úrovně)
export const MONSTER_SPELLS = 2;
export const BOSS_SPELLS = 3;
export const GLADIATOR_SPELLS = 3;

// Odměna za vítězný souboj: zhruba 10 vítězství na úroveň
export function battleReward(level) {
  return { xp: Math.max(1, Math.round(xpToNextLevel(level) / 10)), gold: goldPerMinute(level) * 2 };
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

// --- Cechy ------------------------------------------------------------------

export const GUILD_CREATE_COST = 100;
export const GUILD_MAX_MEMBERS = 20;
export const GUILD_EMBLEMS = ['🐉', '🦁', '🐺', '🦅', '🐻', '🦄', '🍺', '⚔️', '🛡️', '🔥', '💀', '🌙', '🍄', '🐸'];

// Vylepšení cechu: každá úroveň přidá všem členům bonus k odměnám z výprav
export const GUILD_UPGRADES = {
  xp: { name: 'Síň učenců', icon: '📚', description: 'Víc zkušeností z výprav' },
  gold: { name: 'Zlatá komora', icon: '💰', description: 'Víc zlata z výprav' },
};
export const GUILD_UPGRADE_MAX = 10;
export const GUILD_BONUS_PER_LEVEL = 2; // %

export function guildUpgradeCost(currentLevel) {
  return 200 * (currentLevel + 1) ** 2;
}

// --- Chat -------------------------------------------------------------------

export const CHAT_MAX_LENGTH = 300;
export const CHAT_HISTORY = 50; // kolik posledních zpráv klient dostane
export const CHAT_KEEP = 500; // kolik zpráv v kanálu uchovávat
