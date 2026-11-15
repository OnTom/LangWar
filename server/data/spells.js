// Kouzla: pět druhů, každý ve třech stupních. Účinky jsou absolutní (nezávislé na úrovni postavy),
// každé povolání má vlastní kouzla. Gramatika pod kouzly je v učebním plánu jazyka (data/grammar).

export const SPELL_KINDS = ['attack', 'heal', 'defense', 'control', 'buff'];

export const KIND_NAMES = {
  attack: 'Útok',
  heal: 'Léčení',
  defense: 'Obrana',
  control: 'Kontrola',
  buff: 'Posílení',
};

export const RANK_NAMES = ['', 'I', 'II', 'III'];

// Cena many podle stupně
export const SPELL_MANA = { 1: 15, 2: 25, 3: 40 };

// Když cvičení nevyjde, kouzlo selže a vrátí se jen tahle část many
export const SPELL_FAIL_REFUND = 0.2;

// Síla podle druhu a stupně: [min, max]
export const SPELL_POWER = {
  attack: { 1: [30, 36], 2: [60, 70], 3: [100, 115] },
  heal: { 1: [25, 30], 2: [55, 65], 3: [90, 105] },
  defense: { 1: [20, 25], 2: [45, 55], 3: [80, 90] },
  control: { 1: [0, 0], 2: [15, 20], 3: [40, 50] }, // poškození navíc k omráčení
  buff: { 1: [8, 10], 2: [15, 18], 3: [25, 30] }, // bonus k poškození dalších útoků
};

// Posílení platí na tolik dalších útoků
export const BUFF_ATTACKS = { 1: 2, 2: 3, 3: 3 };

// Otrávený šíp: část poškození hned, zbytek jedem v dalších kolech
export const POISON_TURNS = 2;
export const POISON_SHARE = 0.5; // polovina poškození jde do jedu (a jed dá celkem o 20 % víc)
export const POISON_BONUS = 1.2;

const range = ([min, max]) => (min === max ? `${min}` : `${min}–${max}`);

function effectText(cls, kind, rank) {
  const power = SPELL_POWER[kind][rank];
  switch (kind) {
    case 'attack':
      if (cls === 'scout') {
        const total = power.map((p) => Math.round(p * POISON_BONUS));
        return `Zásah a jed: celkem ${range(total)} poškození (polovina hned, zbytek během ${POISON_TURNS} kol)`;
      }
      if (cls === 'warrior') return `Zásah za ${range(power)} poškození, zbroj nepřítele ho nesníží`;
      return `Zásah za ${range(power)} poškození`;
    case 'heal':
      return `Vyléčí ${range(power)} životů`;
    case 'defense':
      return `Pohltí ${range(power)} poškození z dalších útoků nepřítele`;
    case 'control':
      return rank === 1 ? 'Nepřítel vynechá příští tah' : `Nepřítel vynechá příští tah a utrží ${range(power)} poškození`;
    default:
      return `Další ${BUFF_ATTACKS[rank]} útoky zasáhnou o ${range(power)} silněji`;
  }
}

// Názvy, ikony a popisy podle povolání
export const CLASS_SPELLS = {
  warrior: {
    attack: { name: 'Drtivý úder', icon: '🔨', flavor: 'Rána, po které se i štíty omlouvají.' },
    heal: { name: 'Druhý dech', icon: '💨', flavor: 'Hluboký nádech, krátká modlitba a zase do boje.' },
    defense: { name: 'Štítový val', icon: '🛡️', flavor: 'Za štítem je klid. Většinou.' },
    control: { name: 'Omračující rána', icon: '💫', flavor: 'Nepřítel chvíli počítá hvězdičky.' },
    buff: { name: 'Válečný pokřik', icon: '📯', flavor: 'Řev, ze kterého dostanou strach i sousedé.' },
  },
  mage: {
    attack: { name: 'Ohnivá koule', icon: '🔥', flavor: 'Klasika. Nikdy nevyjde z módy.' },
    heal: { name: 'Léčivé světlo', icon: '✨', flavor: 'Teplé světlo, které hojí rány i nálady.' },
    defense: { name: 'Magický štít', icon: '🔮', flavor: 'Neviditelná bublina. Neprasknout!' },
    control: { name: 'Zmrazení', icon: '❄️', flavor: 'Nepřítel ztuhne. Doslova.' },
    buff: { name: 'Soustředění', icon: '🧘', flavor: 'Óm. Pak bum.' },
  },
  scout: {
    attack: { name: 'Otrávený šíp', icon: '🏹', flavor: 'Bolí hned a pak ještě chvíli.' },
    heal: { name: 'Bylinný obklad', icon: '🌿', flavor: 'Babiččin recept. Smrdí, ale funguje.' },
    defense: { name: 'Kouřová clona', icon: '🌫️', flavor: 'Kde nic není, tam se špatně míří.' },
    control: { name: 'Síť', icon: '🕸️', flavor: 'Nepřítel se zamotá jako ryba.' },
    buff: { name: 'Orlí oko', icon: '🦅', flavor: 'Vidíš každou mezeru ve zbroji.' },
  },
};

/** Kouzlo povolání v daném stupni: název, ikona, popis účinku a cena many. */
export function spellInfo(cls, kind, rank) {
  const spell = CLASS_SPELLS[cls][kind];
  return {
    kind,
    kindName: KIND_NAMES[kind],
    rank,
    rankName: RANK_NAMES[rank],
    name: spell.name,
    icon: spell.icon,
    flavor: spell.flavor,
    effect: effectText(cls, kind, rank),
    mana: SPELL_MANA[rank],
  };
}
