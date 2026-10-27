import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { CLASSES } from '../game/rules.js';
import { findCharacter, RANK_ORDER } from '../game/character.js';
import { arenaState, startArenaBattle, ArenaError } from '../game/arena.js';
import { activeBattle, battleView } from '../game/expedition.js';

const LADDER_SIZE = 50;

const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  req.character = c;
  next();
});

// GET /api/arena – stav arény a případně probíhající souboj v aréně
router.get('/', (req, res) => {
  const row = activeBattle(req.character);
  const battle = row?.status === 'active' ? battleView(row) : null;
  // Probíhající souboj na výpravě se tu jen ohlásí
  res.json({
    ...arenaState(findCharacter(req.user.id)),
    battle: battle?.kind === 'arena' ? battle : null,
    busyElsewhere: battle !== null && battle.kind !== 'arena',
  });
});

// GET /api/arena/ladder – síň slávy
router.get('/ladder', (req, res) => {
  const c = req.character;
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT c.id, c.avatar, c.class, c.level, c.honor, u.username AS name,
                g.name AS guild_name, g.emblem AS guild_emblem,
                ROW_NUMBER() OVER (ORDER BY ${RANK_ORDER}) AS rank
         FROM characters c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN guild_members gm ON gm.character_id = c.id
         LEFT JOIN guilds g ON g.id = gm.guild_id
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
      guild: r.guild_name ? { name: r.guild_name, emblem: r.guild_emblem } : null,
      isMe: r.id === c.id,
    })),
  });
});

// POST /api/arena/fight  { index } – vyzvat soupeře ze seznamu (začne tahový souboj)
router.post('/fight', (req, res) => {
  try {
    const row = startArenaBattle(req.character, req.body?.index);
    res.status(201).json({ battle: battleView(row) });
  } catch (err) {
    if (err instanceof ArenaError) return res.status(err.status).json({ error: err.message });
    throw err;
  }
});

export default router;
