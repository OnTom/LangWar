import { Router } from 'express';
import db from '../db.js';
import { QUEST_TIME_SCALE } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { CLASSES, ARENA_OPPONENTS, ARENA_COOLDOWN, honorTransfer, arenaGold } from '../game/rules.js';
import {
  findCharacter,
  findCharacterById,
  characterCombatProfile,
  toView,
  rankOf,
  RANK_ORDER,
} from '../game/character.js';
import { createMonster } from '../game/monsters.js';
import { fight } from '../game/combat.js';
import GLADIATORS from '../data/arena.js';

const HISTORY_SIZE = 10;
const LADDER_SIZE = 50;

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

function saveOpponents(characterId, opponents) {
  db.prepare('UPDATE characters SET arena_opponents = ? WHERE id = ?').run(JSON.stringify(opponents), characterId);
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
    saveOpponents(c.id, list);
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
    profile: () => characterCombatProfile(p),
    character: p,
  };
}

function onQuest(characterId) {
  return Boolean(
    db.prepare('SELECT 1 FROM quests WHERE character_id = ? AND started_at IS NOT NULL').get(characterId)
  );
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

function arenaState(c) {
  return {
    honor: c.honor,
    rank: rankOf(c.id),
    readyAt: c.arena_ready_at,
    serverNow: Date.now(),
    onQuest: onQuest(c.id),
    opponents: getOpponents(c).map((o, index) => ({ index, ...resolveOpponent(o, c).view })),
    history: history(c),
  };
}

const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  req.character = c;
  next();
});

// GET /api/arena
router.get('/', (req, res) => {
  res.json(arenaState(req.character));
});

// GET /api/arena/ladder – síň slávy
router.get('/ladder', (req, res) => {
  const c = req.character;
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT c.id, c.avatar, c.class, c.level, c.honor, u.username AS name,
                ROW_NUMBER() OVER (ORDER BY ${RANK_ORDER}) AS rank
         FROM characters c JOIN users u ON u.id = c.user_id
       ) WHERE rank <= ? OR id = ? ORDER BY rank`
    )
    .all(LADDER_SIZE, c.id);
  const total = db.prepare('SELECT COUNT(*) AS n FROM characters').get().n;
  res.json({
    total,
    players: rows.map((r) => ({
      rank: r.rank,
      name: r.name,
      avatar: r.avatar,
      className: CLASSES[r.class].name,
      level: r.level,
      honor: r.honor,
      isMe: r.id === c.id,
    })),
  });
});

// POST /api/arena/fight  { index } – vyzvat soupeře ze seznamu
router.post('/fight', (req, res) => {
  const c = req.character;
  const now = Date.now();

  if (onQuest(c.id)) {
    return res.status(400).json({ error: 'Jsi na výpravě. Do arény můžeš, až se vrátíš.' });
  }
  if (now < c.arena_ready_at) {
    return res.status(400).json({ error: 'Ještě si nevydechl z minulého souboje. Počkej, až vyprší odpočet.' });
  }
  const opponents = getOpponents(c);
  const chosen = opponents[Number(req.body?.index)];
  if (!chosen) return res.status(404).json({ error: 'Takový soupeř v aréně nestojí.' });

  const opponent = resolveOpponent(chosen, c);
  const battle = fight(characterCombatProfile(c), opponent.profile());
  const won = battle.winner === 'a';
  const isNpc = chosen.type === 'npc';

  // Čest se přesouvá jen mezi skutečnými hráči
  let honorChange = 0;
  if (!isNpc) {
    const defHonor = opponent.character.honor;
    honorChange = won ? honorTransfer(c.honor, defHonor) : honorTransfer(defHonor, c.honor);
  }
  const gold = won ? Math.round(arenaGold(c.level) * (isNpc ? 0.5 : 1)) : 0;
  const readyAt = now + Math.round(ARENA_COOLDOWN * 1000 * QUEST_TIME_SCALE);

  const apply = db.transaction(() => {
    const attackerDelta = won ? honorChange : -honorChange;
    const updated = db
      .prepare(
        `UPDATE characters
         SET gold = gold + ?, honor = MAX(0, honor + ?), arena_ready_at = ?, arena_opponents = ''
         WHERE id = ? AND arena_ready_at <= ?`
      )
      .run(gold, attackerDelta, readyAt, c.id, now);
    if (updated.changes === 0) throw new Error('conflict');
    if (!isNpc) {
      db.prepare('UPDATE characters SET honor = MAX(0, honor + ?) WHERE id = ?').run(-attackerDelta, chosen.id);
    }
    db.prepare(
      `INSERT INTO arena_fights
         (attacker_id, defender_id, defender_name, defender_avatar, attacker_won, honor_change, gold, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(c.id, isNpc ? null : chosen.id, opponent.view.name, opponent.view.avatar, won ? 1 : 0, honorChange, gold, now);
  });

  try {
    apply();
  } catch (err) {
    if (err.message !== 'conflict') throw err;
    return res.status(409).json({ error: 'Souboj už proběhl. Zkus to znovu za chvíli.' });
  }

  const updated = findCharacter(req.user.id);
  res.json({
    result: { won, honorChange: won ? honorChange : -honorChange, gold, npc: isNpc },
    fight: {
      hero: { name: c.name, avatar: c.avatar, level: c.level, maxHp: battle.maxHp.a },
      enemy: { name: opponent.view.name, avatar: opponent.view.avatar, level: opponent.view.level, maxHp: battle.maxHp.b },
      log: battle.log.map((e) => ({ ...e, attacker: e.attacker === 'a' ? 'hero' : 'enemy' })),
    },
    character: toView(updated),
    arena: arenaState(updated),
  });
});

export default router;
