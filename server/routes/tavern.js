import { Router } from 'express';
import db from '../db.js';
import { QUEST_TIME_SCALE } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { THIRST_MAX } from '../game/rules.js';
import { findCharacter, refreshThirst, addXp, toView } from '../game/character.js';
import { generateOffers } from '../game/quests.js';
import { createMonster } from '../game/monsters.js';
import { fight } from '../game/combat.js';

const router = Router();
router.use(requireAuth);

// Každá cesta krčmy potřebuje postavu s aktuální žízní
router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  req.character = refreshThirst(c);
  next();
});

const insertQuest = db.prepare(
  `INSERT INTO quests
     (character_id, slot, title, description, monster, monster_icon, monster_class, duration, xp, gold)
   VALUES
     (@characterId, @slot, @title, @description, @monster, @monsterIcon, @monsterClass, @duration, @xp, @gold)`
);

const createOffers = db.transaction((c) => {
  db.prepare('DELETE FROM quests WHERE character_id = ?').run(c.id);
  for (const offer of generateOffers(c.level)) {
    insertQuest.run({ characterId: c.id, ...offer });
  }
});

function questView(q) {
  return {
    slot: q.slot,
    title: q.title,
    description: q.description,
    monster: q.monster,
    monsterIcon: q.monster_icon,
    duration: q.duration,
    xp: q.xp,
    gold: q.gold,
    startedAt: q.started_at,
    endsAt: q.ends_at,
  };
}

// Stav krčmy: žízeň, nabídky nebo právě běžící quest
function tavernState(c) {
  let quests = db.prepare('SELECT * FROM quests WHERE character_id = ? ORDER BY slot').all(c.id);
  if (quests.length === 0) {
    createOffers(c);
    quests = db.prepare('SELECT * FROM quests WHERE character_id = ? ORDER BY slot').all(c.id);
  }
  const active = quests.find((q) => q.started_at !== null);
  return {
    thirst: c.thirst,
    thirstMax: THIRST_MAX,
    active: active ? questView(active) : null,
    offers: active ? [] : quests.map(questView),
    serverNow: Date.now(),
  };
}

function findActive(characterId) {
  return db
    .prepare('SELECT * FROM quests WHERE character_id = ? AND started_at IS NOT NULL')
    .get(characterId);
}

// GET /api/tavern
router.get('/', (req, res) => {
  res.json(tavernState(req.character));
});

// POST /api/tavern/start  { slot }
router.post('/start', (req, res) => {
  const c = req.character;
  const slot = Number(req.body?.slot);

  if (findActive(c.id)) {
    return res.status(409).json({ error: 'Už jsi na výpravě. Hrdina se nemůže rozdvojit.' });
  }
  const quest = db
    .prepare('SELECT * FROM quests WHERE character_id = ? AND slot = ? AND started_at IS NULL')
    .get(c.id, slot);
  if (!quest) {
    return res.status(404).json({ error: 'Takový quest hospodský nenabízí.' });
  }
  if (c.thirst < quest.duration) {
    return res.status(400).json({ error: 'Máš málo žízně. Hrdina bez piva nikam nejde. Zkus to zítra.' });
  }

  const now = Date.now();
  const endsAt = now + Math.round(quest.duration * 1000 * QUEST_TIME_SCALE);

  const start = db.transaction(() => {
    const paid = db
      .prepare('UPDATE characters SET thirst = thirst - ? WHERE id = ? AND thirst >= ?')
      .run(quest.duration, c.id, quest.duration);
    const started = db
      .prepare('UPDATE quests SET started_at = ?, ends_at = ? WHERE id = ? AND started_at IS NULL')
      .run(now, endsAt, quest.id);
    if (paid.changes === 0 || started.changes === 0) {
      throw new Error('conflict');
    }
    // Ostatní nabídky propadnou
    db.prepare('DELETE FROM quests WHERE character_id = ? AND id != ?').run(c.id, quest.id);
  });

  try {
    start();
  } catch (err) {
    if (err.message !== 'conflict') throw err;
    return res.status(409).json({ error: 'Něco se mezitím změnilo. Zkus to znovu.' });
  }

  res.json(tavernState({ ...c, thirst: c.thirst - quest.duration }));
});

// POST /api/tavern/complete – vyzvedne odměnu za dokončený quest
router.post('/complete', (req, res) => {
  const c = req.character;
  const quest = findActive(c.id);

  if (!quest) {
    return res.status(404).json({ error: 'Nejsi na žádné výpravě.' });
  }
  if (Date.now() < quest.ends_at) {
    return res.status(400).json({ error: 'Výprava ještě neskončila. Trpělivost je taky ctnost.' });
  }

  // Na konci výpravy čeká souboj s monstrem stejné úrovně
  const monster = createMonster({
    name: quest.monster,
    icon: quest.monster_icon,
    cls: quest.monster_class,
    level: c.level,
  });
  const battle = fight(c, monster);
  const won = battle.winner === 'a';

  // Odměna jen za vítězství
  const progress = won ? addXp(c.level, c.xp, quest.xp) : { level: c.level, xp: c.xp, levelsGained: 0 };
  const goldGained = won ? quest.gold : 0;

  const complete = db.transaction(() => {
    const removed = db.prepare('DELETE FROM quests WHERE id = ?').run(quest.id);
    if (removed.changes === 0) throw new Error('conflict');
    db.prepare('UPDATE characters SET gold = gold + ?, xp = ?, level = ? WHERE id = ?').run(
      goldGained,
      progress.xp,
      progress.level,
      c.id
    );
    createOffers({ ...c, level: progress.level });
  });

  try {
    complete();
  } catch (err) {
    if (err.message !== 'conflict') throw err;
    return res.status(409).json({ error: 'Odměnu už sis vyzvedl.' });
  }

  const updated = refreshThirst(findCharacter(req.user.id));
  res.json({
    result: {
      title: quest.title,
      won,
      xp: won ? quest.xp : 0,
      gold: goldGained,
      levelsGained: progress.levelsGained,
    },
    fight: {
      hero: { name: c.name, avatar: c.avatar, level: c.level, maxHp: battle.maxHp.a },
      enemy: { name: monster.name, avatar: monster.avatar, level: monster.level, maxHp: battle.maxHp.b },
      // 'a' = hrdina, 'b' = monstrum
      log: battle.log.map((e) => ({ ...e, attacker: e.attacker === 'a' ? 'hero' : 'enemy' })),
    },
    character: toView(updated),
    tavern: tavernState(updated),
  });
});

// POST /api/tavern/cancel – zrušení výpravy, žízeň se vrátí
router.post('/cancel', (req, res) => {
  const c = req.character;
  const quest = findActive(c.id);
  if (!quest) {
    return res.status(404).json({ error: 'Nejsi na žádné výpravě.' });
  }

  const cancel = db.transaction(() => {
    const removed = db.prepare('DELETE FROM quests WHERE id = ?').run(quest.id);
    if (removed.changes === 0) throw new Error('conflict');
    db.prepare('UPDATE characters SET thirst = MIN(?, thirst + ?) WHERE id = ?').run(
      THIRST_MAX,
      quest.duration,
      c.id
    );
    createOffers(c);
  });

  try {
    cancel();
  } catch (err) {
    if (err.message !== 'conflict') throw err;
    return res.status(409).json({ error: 'Výprava už skončila.' });
  }

  res.json(tavernState(refreshThirst(findCharacter(req.user.id))));
});

export default router;
