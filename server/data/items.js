// Názvy a ikony předmětů. Název = podstatné jméno + přívlastek podle rarity
// (přívlastek je v 2. pádě, takže sedí ke všem rodům: „Helma z bazaru“, „Meč bohů“).

export const SLOTS = {
  head: { name: 'Hlava', armorFactor: 2 },
  chest: { name: 'Tělo', armorFactor: 3 },
  hands: { name: 'Ruce', armorFactor: 1.5 },
  feet: { name: 'Nohy', armorFactor: 1.5 },
  weapon: { name: 'Zbraň', armorFactor: 0 },
  shield: { name: 'Štít', armorFactor: 3 },
  ring: { name: 'Prsten', armorFactor: 0 },
  amulet: { name: 'Amulet', armorFactor: 0 },
};

export const SLOT_KEYS = Object.keys(SLOTS);

export const NOUNS = {
  head: [
    ['Helma', '🪖'],
    ['Kápě', '🎩'],
    ['Čepice', '🧢'],
    ['Kastrol', '🍲'],
    ['Koruna', '👑'],
    ['Čelenka', '👑'],
    ['Klobouk', '🎩'],
  ],
  chest: [
    ['Zbroj', '🦺'],
    ['Kroužková košile', '🥋'],
    ['Kazajka', '🧥'],
    ['Župan', '🥻'],
    ['Kožich', '🧥'],
    ['Krunýř', '🦺'],
  ],
  hands: [
    ['Rukavice', '🧤'],
    ['Palčáky', '🧤'],
    ['Chňapky', '🧤'],
    ['Kovové rukavice', '🧤'],
  ],
  feet: [
    ['Boty', '🥾'],
    ['Holínky', '👢'],
    ['Bačkory', '🩴'],
    ['Sandály', '👡'],
    ['Pantofle', '🥿'],
    ['Okované boty', '🥾'],
  ],
  shield: [
    ['Štít', '🛡️'],
    ['Pavéza', '🛡️'],
    ['Poklice', '🛡️'],
    ['Puklice', '🛡️'],
    ['Dveře od kurníku', '🚪'],
  ],
  ring: [
    ['Prsten', '💍'],
    ['Pečetní prsten', '💍'],
    ['Snubní prsten', '💍'],
    ['Prstýnek', '💍'],
  ],
  amulet: [
    ['Amulet', '📿'],
    ['Talisman', '🧿'],
    ['Medailonek', '📿'],
    ['Řetěz', '⛓️'],
    ['Zub na provázku', '🦷'],
  ],
  // Zbraně jsou podle třídy
  weapon: {
    warrior: [
      ['Meč', '🗡️'],
      ['Sekera', '🪓'],
      ['Palcát', '🔨'],
      ['Válečné kladivo', '🔨'],
      ['Obouruční meč', '⚔️'],
      ['Vidle', '🔱'],
    ],
    mage: [
      ['Hůl', '🪄'],
      ['Hůlka', '🪄'],
      ['Grimoár', '📖'],
      ['Křišťálová koule', '🔮'],
      ['Koště', '🧹'],
    ],
    scout: [
      ['Luk', '🏹'],
      ['Kuše', '🏹'],
      ['Prak', '🪃'],
      ['Bumerang', '🪃'],
      ['Vrhací nože', '🔪'],
    ],
  },
};

export const RARITIES = {
  common: {
    name: 'Obyčejný',
    chance: 70,
    bonuses: 1, // počet atributů s bonusem
    power: 1,
    value: 1,
    suffixes: [
      'z bazaru',
      'po dědovi',
      'z výprodeje',
      'ze smetiště',
      'od souseda',
      'z druhé ruky',
      'z vesnické kovárny',
      's drobnou vadou',
      'z pouti',
    ],
  },
  rare: {
    name: 'Vzácný',
    chance: 22,
    bonuses: 2,
    power: 1.15,
    value: 2.5,
    suffixes: [
      'z trpasličí kovárny',
      'elfích mistrů',
      'statečnosti',
      'z královské zbrojnice',
      'rychlého hobita',
      'hraničářů',
      'z rytířského turnaje',
    ],
  },
  epic: {
    name: 'Epický',
    chance: 7,
    bonuses: 3,
    power: 1.3,
    value: 6,
    suffixes: [
      'dračího hněvu',
      'věčné kocoviny',
      'rozzuřeného býka',
      'tisíce hospod',
      'temného pána',
      'severního větru',
    ],
  },
  legendary: {
    name: 'Legendární',
    chance: 1,
    bonuses: 4,
    power: 1.5,
    value: 15,
    suffixes: ['bohů', 'konce světa', 'legendárního Pepy', 'posledního draka', 'věčné slávy'],
  },
};

// Startovní výbava nové postavy
export const STARTER_GEAR = {
  warrior: [
    { slot: 'weapon', name: 'Rezavý meč', icon: '🗡️' },
    { slot: 'shield', name: 'Poklice od hrnce', icon: '🛡️' },
  ],
  mage: [{ slot: 'weapon', name: 'Ohořelá hůl', icon: '🪄' }],
  scout: [{ slot: 'weapon', name: 'Ohnutý luk', icon: '🏹' }],
};
