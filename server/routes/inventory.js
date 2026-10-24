import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { findCharacter, toView } from '../game/character.js';
import { canEquip } from '../game/items.js';
import { getItem, inventoryFree } from '../game/inventory.js';

const router = Router();
router.use(requireAuth);

// Každá cesta potřebuje postavu a předmět, se kterým se pracuje
router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  const item = getItem(c.id, Number(req.body?.itemId));
  if (!item) return res.status(404).json({ error: 'Takový předmět nemáš.' });
  req.character = c;
  req.item = item;
  next();
});

function respond(req, res) {
  res.json({ character: toView(findCharacter(req.user.id)) });
}

// POST /api/inventory/equip  { itemId } – nasadit; původní předmět ve slotu jde do inventáře
router.post('/equip', (req, res) => {
  const { character: c, item } = req;
  if (item.location !== 'inventory') {
    return res.status(400).json({ error: 'Nasadit jde jen předmět z inventáře.' });
  }
  const problem = canEquip(c.class, item);
  if (problem) return res.status(400).json({ error: problem });

  db.transaction(() => {
    db.prepare(
      "UPDATE items SET location = 'inventory' WHERE character_id = ? AND location = 'equipped' AND slot = ?"
    ).run(c.id, item.slot);
    db.prepare("UPDATE items SET location = 'equipped' WHERE id = ?").run(item.id);
  })();
  respond(req, res);
});

// POST /api/inventory/unequip  { itemId }
router.post('/unequip', (req, res) => {
  const { character: c, item } = req;
  if (item.location !== 'equipped') {
    return res.status(400).json({ error: 'Tenhle předmět nemáš na sobě.' });
  }
  if (inventoryFree(c.id) <= 0) {
    return res.status(400).json({ error: 'Inventář je plný. Kam bys to dal, do kapsy?' });
  }
  db.prepare("UPDATE items SET location = 'inventory' WHERE id = ?").run(item.id);
  respond(req, res);
});

// POST /api/inventory/sell  { itemId } – prodej předmětu z inventáře
router.post('/sell', (req, res) => {
  const { character: c, item } = req;
  if (item.location !== 'inventory') {
    return res.status(400).json({ error: 'Prodat jde jen předmět z inventáře. Nejdřív ho sundej.' });
  }
  db.transaction(() => {
    db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
    db.prepare('UPDATE characters SET gold = gold + ? WHERE id = ?').run(item.value, c.id);
  })();
  respond(req, res);
});

export default router;
