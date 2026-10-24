import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { findCharacter, toView, today } from '../game/character.js';
import { generateItem, itemView, slotsForClass, BUY_PRICE_MULTIPLIER } from '../game/items.js';
import { insertItem, getItems, getItem, inventoryFree } from '../game/inventory.js';

const SHOP_SIZE = 6;

const SHOPS = {
  smith: {
    name: 'Zbrojíř Kovadlina',
    greeting: 'Všechno ručně kované! Teda většinou. Občas to kove můj švagr.',
    slots: ['weapon', 'shield', 'head', 'chest', 'hands', 'feet'],
    rarityBoost: 0,
  },
  magic: {
    name: 'Kouzelnice Bylinka',
    greeting: 'Prsteny, amulety, nic není prokleté. Skoro nic.',
    slots: ['ring', 'amulet'],
    rarityBoost: 15, // u kouzelnice padají vzácnější věci častěji
  },
};

// Cena za nové zboží mimo denní obnovu
function refreshCost(level) {
  return 10 + level * 5;
}

function location(shop) {
  return `shop_${shop}`;
}

function restock(c, shop) {
  const cfg = SHOPS[shop];
  const slots = cfg.slots.filter((s) => slotsForClass(c.class).includes(s));
  db.prepare('DELETE FROM items WHERE character_id = ? AND location = ?').run(c.id, location(shop));
  for (let i = 0; i < SHOP_SIZE; i++) {
    insertItem(c.id, location(shop), generateItem({ level: c.level, cls: c.class, slots, rarityBoost: cfg.rarityBoost }));
  }
}

// Každý den nové zboží v obou obchodech
const ensureStock = db.transaction((c) => {
  const day = today();
  if (c.shop_day === day) return;
  for (const shop of Object.keys(SHOPS)) restock(c, shop);
  db.prepare('UPDATE characters SET shop_day = ? WHERE id = ?').run(day, c.id);
});

function shopState(c) {
  return {
    refreshCost: refreshCost(c.level),
    shops: Object.fromEntries(
      Object.entries(SHOPS).map(([key, cfg]) => [
        key,
        {
          name: cfg.name,
          greeting: cfg.greeting,
          items: getItems(c.id, location(key)).map((row) => itemView(row, { inShop: true })),
        },
      ])
    ),
  };
}

function respond(req, res) {
  const c = findCharacter(req.user.id);
  res.json({ ...shopState(c), character: toView(c) });
}

const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  ensureStock(c);
  req.character = c;
  next();
});

// GET /api/shop – zboží obou obchodníků
router.get('/', respond);

// POST /api/shop/buy  { itemId }
router.post('/buy', (req, res) => {
  const c = req.character;
  const item = getItem(c.id, Number(req.body?.itemId));
  if (!item || !item.location.startsWith('shop_')) {
    return res.status(404).json({ error: 'Tohle obchodník nemá. Možná to už někdo koupil.' });
  }
  const price = item.value * BUY_PRICE_MULTIPLIER;
  if (c.gold < price) {
    return res.status(400).json({ error: 'Na to nemáš. Obchodník se tváří uraženě.' });
  }
  if (inventoryFree(c.id) <= 0) {
    return res.status(400).json({ error: 'Inventář je plný. Něco prodej.' });
  }

  const ok = db.transaction(() => {
    const paid = db.prepare('UPDATE characters SET gold = gold - ? WHERE id = ? AND gold >= ?').run(price, c.id, price);
    const moved = db
      .prepare("UPDATE items SET location = 'inventory' WHERE id = ? AND location = ?")
      .run(item.id, item.location);
    if (paid.changes === 0 || moved.changes === 0) throw new Error('conflict');
    return true;
  });
  try {
    ok();
  } catch (err) {
    if (err.message !== 'conflict') throw err;
    return res.status(409).json({ error: 'Něco se mezitím změnilo. Zkus to znovu.' });
  }
  respond(req, res);
});

// POST /api/shop/refresh  { shop } – nové zboží za poplatek
router.post('/refresh', (req, res) => {
  const c = req.character;
  const shop = req.body?.shop;
  if (!Object.hasOwn(SHOPS, shop)) {
    return res.status(400).json({ error: 'Takový obchod tu není.' });
  }
  const cost = refreshCost(c.level);
  const ok = db.transaction(() => {
    const paid = db.prepare('UPDATE characters SET gold = gold - ? WHERE id = ? AND gold >= ?').run(cost, c.id, cost);
    if (paid.changes === 0) return false;
    restock(c, shop);
    return true;
  })();
  if (!ok) return res.status(400).json({ error: 'Na nové zboží nemáš dost zlata.' });
  respond(req, res);
});

export default router;
