// Aréna: tahové souboje se slovíčky proti ostatním hráčům (hraje za ně počítač
// podle jejich atributů a výbavy) a NPC gladiátorům. Vítěz bere čest a zlato.
import db from '../db.js';
import { QUEST_TIME_SCALE } from '../config.js';
import LOCATIONS from '../data/locations.js';
import GLADIATORS from '../data/arena.js';
import {
  CLASSES,
  ARENA_OPPONENTS,
  ARENA_COOLDOWN,
  ARENA_DAILY_XP_WINS,
  honorTransfer,
  arenaGold,
  arenaXp,
} from './rules.js';
import { findCharacter, findCharacterById, characterCombatProfile, rankOf, today, addXp } from './character.js';
import { progressDaily } from './daily.js';
import { createMonster } from './monsters.js';
import { createBattle } from './battle.js';

const HISTORY_SIZE = 10;

export class ArenaError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Vybere soupeře: skuteční hráči s podobnou ctí, zbytek doplní NPC gladiátoři
function pickOpponents(c) {
  const nearest = db
    .prepare('SELECT id FROM characters WHERE id != ? ORDER BY ABS(honor - ?) LIMIT 10')
    .all(c.id, c.honor);
  const players = shuffle(nearest)
    .slice(0, ARENA_OPPONENTS)
    .map((p) => ({ type: 'player', id: p.id }));
  const npcs = shuffle(GLADIATORS.map((_, i) => i))
    .slice(0, ARENA_OPPONENTS - players.length)
    .map((index) => ({ type: 'npc', index }));
  return [...players, ...npcs];
}

// Uložený seznam soupeřů; když chybí nebo někdo z hráčů zmizel, vybere nový
function getOpponents(c) {
  let list = [];
  try {
    list = JSON.parse(c.arena_opponents || '[]');
  } catch {}
  const valid =
    list.length === ARENA_OPPONENTS &&
    list.every((o) => (o.type === 'npc' ? GLADIATORS[o.index] : findCharacterById(o.id)));
  if (!valid) {
    list = pickOpponents(c);
    db.prepare('UPDATE characters SET arena_opponents = ? WHERE id = ?').run(JSON.stringify(list), c.id);
  }
  return list;
}

// Soupeř připravený k souboji i k zobrazení
function resolveOpponent(o, c) {
  if (o.type === 'npc') {
    const g = GLADIATORS[o.index];
    return {
      view: { type: 'npc', name: g.name, avatar: g.avatar, className: CLASSES[g.class].name, level: c.level, honor: null },
      profile: () => createMonster({ name: g.name, icon: g.avatar, cls: g.class, level: c.level }),
    };
  }
  const p = findCharacterById(o.id);
  return {
    view: { type: 'player', name: p.name, avatar: p.avatar, className: CLASSES[p.class].name, level: p.level, honor: p.honor },
    profile: () => ({ ...characterCombatProfile(p), name: p.name, avatar: p.avatar }),
  };
}

// Posledních pár soubojů: útoky i obrany, vždy z pohledu hráče
function history(c) {
  return db
    .prepare(
      `SELECT f.*, u.username AS attacker_name, a.avatar AS attacker_avatar
       FROM arena_fights f
       JOIN characters a ON a.id = f.attacker_id
       JOIN users u ON u.id = a.user_id
       WHERE f.attacker_id = ? OR f.defender_id = ?
       ORDER BY f.created_at DESC, f.id DESC LIMIT ?`
    )
    .all(c.id, c.id, HISTORY_SIZE)
    .map((f) => {
      const attacked = f.attacker_id === c.id;
      const won = attacked ? Boolean(f.attacker_won) : !f.attacker_won;
      return {
        at: f.created_at,
        type: attacked ? 'attack' : 'defense',
        opponentName: attacked ? f.defender_name : f.attacker_name,
        opponentAvatar: attacked ? f.defender_avatar : f.attacker_avatar,
        won,
        honorChange: won ? f.honor_change : -f.honor_change,
        gold: attacked ? f.gold : 0,
      };
    });
}

// Kolik dnešních výher ještě dá bonusové XP
function xpWinsToday(c) {
  return c.arena_xp_day === today() ? c.arena_xp_wins : 0;
}

export function arenaState(c) {
  return {
    xpWinsLeft: Math.max(0, ARENA_DAILY_XP_WINS - xpWinsToday(c)),
    xpWinsMax: ARENA_DAILY_XP_WINS,
    xpPerWin: arenaXp(c.level),
    honor: c.honor,
    rank: rankOf(c.id),
    readyAt: c.arena_ready_at,
    serverNow: Date.now(),
    opponents: getOpponents(c).map((o, index) => ({ index, ...resolveOpponent(o, c).view })),
    history: history(c),
  };
}

// Slovíčka v aréně: ze všech témat lokací, které má hrdina odemčené
function arenaTopics(c) {
  const topics = LOCATIONS.filter((l) => l.level <= c.level).flatMap((l) => l.topics);
  return [...new Set(topics)];
}

/** Vyzve soupeře ze seznamu – začne tahový souboj. Čekací doba běží od začátku souboje. */
export function startArenaBattle(c, index) {
  const now = Date.now();
  if (db.prepare("SELECT 1 FROM battles WHERE character_id = ? AND status = 'active'").get(c.id)) {
    throw new ArenaError('Už bojuješ. Nejdřív dobojuj, nebo uteč.', 409);
  }
  if (now < c.arena_ready_at) {
    throw new ArenaError('Po minulém souboji ještě lapáš po dechu. Počkej, až vyprší odpočet.');
  }
  const chosen = getOpponents(c)[Number(index)];
  if (!chosen) throw new ArenaError('Takový soupeř v aréně nestojí.', 404);

  const opponent = resolveOpponent(chosen, c);
  const state = createBattle({ ...characterCombatProfile(c), name: c.name, avatar: c.avatar }, opponent.profile());
  state.kind = 'arena';
  state.location = { key: 'arena', name: 'Aréna', icon: '🏟️' };
  state.topics = arenaTopics(c);
  state.opponent = { ...chosen, name: opponent.view.name, avatar: opponent.view.avatar };

  return db.transaction(() => {
    const readyAt = now + Math.round(ARENA_COOLDOWN * 1000 * QUEST_TIME_SCALE);
    const updated = db
      .prepare("UPDATE characters SET arena_ready_at = ?, arena_opponents = '' WHERE id = ? AND arena_ready_at <= ?")
      .run(readyAt, c.id, now);
    if (updated.changes === 0) throw new ArenaError('Souboj už začal. Zkus to znovu za chvíli.', 409);
    db.prepare("DELETE FROM battles WHERE character_id = ? AND status != 'active'").run(c.id);
    const id = db
      .prepare('INSERT INTO battles (character_id, state, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(c.id, JSON.stringify(state), now, now).lastInsertRowid;
    return db.prepare('SELECT * FROM battles WHERE id = ?').get(id);
  })();
}

/**
 * Konec souboje v aréně (výhra, prohra nebo útěk = prohra): čest, zlato, XP, historie.
 * Volá se uvnitř transakce souboje. Vrací odměny pro zobrazení.
 */
export function finishArenaBattle(c, state, outcome) {
  const won = outcome === 'won';
  const fresh = findCharacter(c.user_id);
  const isNpc = state.opponent.type === 'npc';
  const defender = isNpc ? null : findCharacterById(state.opponent.id);

  // Čest se přesouvá jen mezi skutečnými hráči (soupeř mezitím mohl účet smazat)
  let honorChange = 0;
  if (defender) {
    honorChange = won ? honorTransfer(fresh.honor, defender.honor) : honorTransfer(defender.honor, fresh.honor);
  }
  const gold = won ? Math.round(arenaGold(fresh.level) * (isNpc ? 0.5 : 1)) : 0;

  // Prvních pár výher dne dá navíc XP
  const winsToday = xpWinsToday(fresh);
  const xp = won && winsToday < ARENA_DAILY_XP_WINS ? arenaXp(fresh.level) : 0;
  const progress = addXp(fresh.level, fresh.xp, xp);

  const attackerDelta = won ? honorChange : -honorChange;
  db.prepare(
    `UPDATE characters SET gold = gold + ?, honor = MAX(0, honor + ?), xp = ?, level = ?,
       arena_xp_day = ?, arena_xp_wins = ? WHERE id = ?`
  ).run(gold, attackerDelta, progress.xp, progress.level, today(), winsToday + (xp ? 1 : 0), c.id);
  if (defender) {
    db.prepare('UPDATE characters SET honor = MAX(0, honor + ?) WHERE id = ?').run(-attackerDelta, defender.id);
  }
  db.prepare(
    `INSERT INTO arena_fights
       (attacker_id, defender_id, defender_name, defender_avatar, attacker_won, honor_change, gold, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(c.id, defender?.id ?? null, state.opponent.name, state.opponent.avatar, won ? 1 : 0, honorChange, gold, Date.now());

  progressDaily(c.id, 'arena_fight');
  if (won) progressDaily(c.id, 'arena_win');
  return { xp, gold, honorChange: attackerDelta, npc: isNpc, item: null, itemSold: false, levelsGained: progress.levelsGained };
}
