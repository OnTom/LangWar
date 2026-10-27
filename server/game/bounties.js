// Zakázky z krčmy: „poraz X v lokaci Y“ a podobně. Plní se souboji na Výpravě.
import db from '../db.js';
import LOCATIONS from '../data/locations.js';
import {
  BOUNTY_SLOTS,
  BOUNTY_ITEM_CHANCE,
  BOSS_WINS_REQUIRED,
  bountySwapCost,
  battleReward,
} from './rules.js';
import { addXp } from './character.js';
import { generateItem, itemView } from './items.js';
import { insertItem, inventoryFree } from './inventory.js';
import { guildBonus, applyBonus } from './guild.js';
import { progressDaily } from './daily.js';

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

const LOCATION_BY_KEY = new Map(LOCATIONS.map((l) => [l.key, l]));

// Druhy zakázek: weight = jak často padají, size = rozsah cíle,
// value = kolik „vítězství“ odměny zakázka dá za každý bod cíle
const KINDS = {
  defeat: { weight: 4, size: [2, 3], value: 0.8, location: true },
  wins: { weight: 3, size: [3, 5], value: 0.6, location: true },
  spell: { weight: 2, size: [3, 5], value: 0.5, location: false },
  flawless: { weight: 2, size: [1, 2], value: 1.2, location: false },
  boss: { weight: 1, size: [1, 1], value: BOSS_WINS_REQUIRED * 0.6 + 2, location: true },
};

// Text zakázky pro hráče
function describe(b) {
  const l = LOCATION_BY_KEY.get(b.location);
  switch (b.kind) {
    case 'defeat':
      return `Poraz ${b.target}× ${l.monsters[b.enemy].icon} ${l.monsters[b.enemy].name} (${l.name})`;
    case 'wins':
      return `Vyhraj ${b.target} ${b.target < 5 ? 'souboje' : 'soubojů'} v lokaci ${l.icon} ${l.name}`;
    case 'boss':
      return `Poraz bosse ${l.boss.icon} ${l.boss.name} (${l.name})`;
    case 'spell':
      return `Zasáhni nepřítele ${b.target}× kouzlem`;
    default:
      return b.target === 1 ? 'Vyhraj souboj bez jediné chyby' : `Vyhraj ${b.target} souboje bez jediné chyby`;
  }
}

const FLAVOR = {
  defeat: 'Hospodský si mne ruce: „Ten neřád mi dluží za tři piva.“',
  wins: '„Udělej tam pořádek. Hosté se bojí chodit na záchod.“',
  boss: '„Za jeho hlavu je vypsaná odměna. Za zbytek nic.“',
  spell: '„Místní mág se vsadil, že kouzlit neumíš. Ukaž mu to.“',
  flawless: '„Bez chyby? To jsem naposledy viděl u svého účetního. Pak utekl.“',
};

// Nová zakázka do slotu – lokace bere hlavně z těch nejnovějších odemčených
function generate(c, slot, avoid = new Set()) {
  const unlocked = LOCATIONS.filter((l) => l.level <= c.level);
  const recent = unlocked.slice(-3);
  const kinds = Object.entries(KINDS).filter(([key]) => !avoid.has(key));
  const total = kinds.reduce((s, [, k]) => s + k.weight, 0);
  let roll = Math.random() * total;
  const [kind, def] = kinds.find(([, k]) => (roll -= k.weight) <= 0) ?? kinds[0];

  const location = def.location ? pick(Math.random() < 0.75 ? recent : unlocked) : null;
  const target = randomInt(...def.size);
  const unit = battleReward(Math.max(c.level, location?.level ?? 1));
  const value = def.value * target;
  return {
    character_id: c.id,
    slot,
    kind,
    location: location?.key ?? null,
    enemy: kind === 'defeat' ? randomInt(0, location.monsters.length - 1) : null,
    target,
    xp: Math.max(1, Math.round(unit.xp * value)),
    gold: Math.max(1, Math.round(unit.gold * value * 1.5)),
    item: Math.random() * 100 < BOUNTY_ITEM_CHANCE ? 1 : 0,
    created_at: Date.now(),
  };
}

const insertStmt = db.prepare(
  `INSERT INTO bounties (character_id, slot, kind, location, enemy, target, xp, gold, item, created_at)
   VALUES (@character_id, @slot, @kind, @location, @enemy, @target, @xp, @gold, @item, @created_at)`
);

function rowsOf(characterId) {
  return db.prepare('SELECT * FROM bounties WHERE character_id = ? ORDER BY slot').all(characterId);
}

// Doplní prázdné sloty; stejný druh zakázky se na nástěnce neopakuje, pokud to jde
const ensureBounties = db.transaction((c) => {
  const rows = rowsOf(c.id);
  const kinds = new Set(rows.map((r) => r.kind));
  for (let slot = 0; slot < BOUNTY_SLOTS; slot++) {
    if (rows.some((r) => r.slot === slot)) continue;
    const bounty = generate(c, slot, kinds.size < Object.keys(KINDS).length - 1 ? kinds : new Set());
    kinds.add(bounty.kind);
    insertStmt.run(bounty);
  }
});

function bountyView(b, bonus) {
  return {
    slot: b.slot,
    kind: b.kind,
    text: describe(b),
    flavor: FLAVOR[b.kind],
    location: b.location,
    progress: b.progress,
    target: b.target,
    done: b.progress >= b.target,
    xp: applyBonus(b.xp, bonus.xp),
    gold: applyBonus(b.gold, bonus.gold),
    item: Boolean(b.item),
  };
}

export function bountyState(c) {
  ensureBounties(c);
  const bonus = guildBonus(c.id);
  return { bounties: rowsOf(c.id).map((b) => bountyView(b, bonus)), swapCost: bountySwapCost(c.level) };
}

export function bountiesReady(characterId) {
  return db.prepare('SELECT COUNT(*) AS n FROM bounties WHERE character_id = ? AND progress >= target').get(characterId).n;
}

/**
 * Započítá událost ze souboje. event = { type: 'win', location, enemy, boss, flawless } nebo { type: 'spell' }.
 * Vrací texty zakázek, které se právě splnily.
 */
export function progressBounties(characterId, event) {
  const conditions = [];
  if (event.type === 'spell') conditions.push(["kind = 'spell'", []]);
  if (event.type === 'win') {
    conditions.push(["kind = 'wins' AND location = ?", [event.location]]);
    if (event.boss) conditions.push(["kind = 'boss' AND location = ?", [event.location]]);
    else conditions.push(["kind = 'defeat' AND location = ? AND enemy = ?", [event.location, event.enemy]]);
    if (event.flawless) conditions.push(["kind = 'flawless'", []]);
  }
  const completed = [];
  for (const [where, params] of conditions) {
    const rows = db
      .prepare(`SELECT * FROM bounties WHERE character_id = ? AND progress < target AND ${where}`)
      .all(characterId, ...params);
    for (const row of rows) {
      db.prepare('UPDATE bounties SET progress = progress + 1 WHERE id = ?').run(row.id);
      if (row.progress + 1 >= row.target) completed.push(describe(row));
    }
  }
  return completed;
}

export class BountyError extends Error {}

/** Vyzvedne odměnu za splněnou zakázku; na její místo přijde nová. */
export function claimBounty(c, slot) {
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM bounties WHERE character_id = ? AND slot = ?').get(c.id, slot);
    if (!row || row.progress < row.target) throw new BountyError('Tahle zakázka ještě není splněná.');
    db.prepare('DELETE FROM bounties WHERE id = ?').run(row.id);

    const bonus = guildBonus(c.id);
    const xp = applyBonus(row.xp, bonus.xp);
    let gold = applyBonus(row.gold, bonus.gold);
    let item = null;
    let itemSold = false;
    if (row.item) {
      const generated = generateItem({ level: c.level, cls: c.class });
      if (inventoryFree(c.id) > 0) {
        const id = insertItem(c.id, 'inventory', generated);
        item = itemView({ ...generated, id });
      } else {
        itemSold = true;
        gold += generated.value;
        item = itemView({ ...generated, id: null });
      }
    }
    const progress = addXp(c.level, c.xp, xp);
    db.prepare('UPDATE characters SET gold = gold + ?, xp = ?, level = ? WHERE id = ?').run(
      gold,
      progress.xp,
      progress.level,
      c.id
    );
    progressDaily(c.id, 'bounty_done');
    ensureBounties({ ...c, level: progress.level });
    return { text: describe(row), xp, gold, item, itemSold, levelsGained: progress.levelsGained };
  })();
}

/** Výměna nesplněné zakázky za jinou (za poplatek hospodskému). */
export function swapBounty(c, slot) {
  return db.transaction(() => {
    const row = db.prepare('SELECT * FROM bounties WHERE character_id = ? AND slot = ?').get(c.id, slot);
    if (!row) throw new BountyError('Taková zakázka na nástěnce není.');
    if (row.progress >= row.target) throw new BountyError('Splněnou zakázku nevyměňuj, vyzvedni si odměnu.');
    const cost = bountySwapCost(c.level);
    const paid = db.prepare('UPDATE characters SET gold = gold - ? WHERE id = ? AND gold >= ?').run(cost, c.id, cost);
    if (paid.changes === 0) throw new BountyError('Hospodský zadarmo nic nemění. Chybí ti zlato.');
    db.prepare('DELETE FROM bounties WHERE id = ?').run(row.id);
    const others = new Set(rowsOf(c.id).map((r) => r.kind));
    others.add(row.kind); // aby to byla opravdu jiná zakázka
    insertStmt.run(generate(c, slot, others));
  })();
}
