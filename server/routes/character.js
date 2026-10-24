import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import {
  ATTRIBUTES,
  ATTRIBUTE_KEYS,
  CLASSES,
  AVATARS,
  STARTING_GOLD,
  xpToNextLevel,
  upgradeCost,
  maxHp,
  damageRange,
  critChance,
} from '../game/rules.js';

const router = Router();
router.use(requireAuth);

function findCharacter(userId) {
  return db
    .prepare(
      `SELECT c.*, u.username AS name
       FROM characters c JOIN users u ON u.id = c.user_id
       WHERE c.user_id = ?`
    )
    .get(userId);
}

// Co klient dostane: uložené hodnoty + vše dopočítané serverem
function toView(c) {
  const attributes = {};
  for (const key of ATTRIBUTE_KEYS) {
    attributes[key] = {
      name: ATTRIBUTES[key].name,
      value: c[key],
      upgradeCost: upgradeCost(c.class, key, c[key]),
    };
  }
  const cls = CLASSES[c.class];
  return {
    name: c.name,
    class: c.class,
    className: cls.name,
    mainAttribute: cls.mainAttribute,
    avatar: c.avatar,
    level: c.level,
    xp: c.xp,
    xpToNextLevel: xpToNextLevel(c.level),
    gold: c.gold,
    attributes,
    stats: {
      hp: maxHp(c),
      damage: damageRange(c),
      critChance: critChance(c),
    },
  };
}

// GET /api/character/options – třídy, avatary a atributy pro vytvoření postavy
router.get('/options', (req, res) => {
  const classes = Object.fromEntries(
    Object.entries(CLASSES).map(([key, c]) => [
      key,
      { name: c.name, icon: c.icon, description: c.description, mainAttribute: c.mainAttribute, base: c.base },
    ])
  );
  res.json({ classes, avatars: AVATARS, attributes: ATTRIBUTES });
});

// GET /api/character – postava přihlášeného hráče (nebo null)
router.get('/', (req, res) => {
  const c = findCharacter(req.user.id);
  res.json({ character: c ? toView(c) : null });
});

// POST /api/character  { class, avatar }
router.post('/', (req, res) => {
  const { class: cls, avatar } = req.body || {};
  if (!Object.hasOwn(CLASSES, cls)) {
    return res.status(400).json({ error: 'Taková třída neexistuje. Ani v pohádkách.' });
  }
  if (!AVATARS.includes(avatar)) {
    return res.status(400).json({ error: 'Tenhle obličej nemáme na skladě.' });
  }
  if (findCharacter(req.user.id)) {
    return res.status(409).json({ error: 'Už máš hrdinu. Jeden ti nestačí?' });
  }

  const b = CLASSES[cls].base;
  db.prepare(
    `INSERT INTO characters
       (user_id, class, avatar, gold, strength, dexterity, intelligence, constitution, luck, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(req.user.id, cls, avatar, STARTING_GOLD, b.strength, b.dexterity, b.intelligence, b.constitution, b.luck, Date.now());

  res.status(201).json({ character: toView(findCharacter(req.user.id)) });
});

// POST /api/character/upgrade  { attribute }
router.post('/upgrade', (req, res) => {
  const { attribute } = req.body || {};
  if (!ATTRIBUTE_KEYS.includes(attribute)) {
    return res.status(400).json({ error: 'Neznámý atribut.' });
  }

  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });

  const cost = upgradeCost(c.class, attribute, c[attribute]);
  if (c.gold < cost) {
    return res.status(400).json({ error: 'Na tohle nemáš dost zlata. Zkus práci v krčmě.' });
  }

  // Název sloupce pochází jen z ATTRIBUTE_KEYS, takže je bezpečné ho vložit do SQL.
  // Podmínka na zlato i aktuální hodnotu chrání před dvojitým kliknutím.
  const result = db
    .prepare(
      `UPDATE characters SET gold = gold - ?, ${attribute} = ${attribute} + 1
       WHERE id = ? AND gold >= ? AND ${attribute} = ?`
    )
    .run(cost, c.id, cost, c[attribute]);

  if (result.changes === 0) {
    return res.status(409).json({ error: 'Něco se mezitím změnilo. Zkus to znovu.' });
  }

  res.json({ character: toView(findCharacter(req.user.id)) });
});

export default router;
