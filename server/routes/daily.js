import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { findCharacter, toView } from '../game/character.js';
import { dailyState, claimTask, claimChest } from '../game/daily.js';

const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  req.character = c;
  next();
});

function respond(req, res, extra = {}) {
  const c = findCharacter(req.user.id);
  res.json({ ...extra, daily: dailyState(c), character: toView(c) });
}

// GET /api/daily
router.get('/', (req, res) => respond(req, res));

// POST /api/daily/claim  { slot }
router.post('/claim', (req, res) => {
  const reward = claimTask(req.character, Number(req.body?.slot));
  if (!reward) return res.status(400).json({ error: 'Tenhle úkol ještě není splněný, nebo už je vyzvednutý.' });
  respond(req, res, { reward });
});

// POST /api/daily/chest
router.post('/chest', (req, res) => {
  const chest = claimChest(req.character);
  if (!chest) {
    const opened = dailyState(req.character).chest.claimed;
    return res.status(400).json({
      error: opened ? 'Dnešní truhlu už jsi otevřel. Zítra bude nová.' : 'Truhla se otevře až po vyzvednutí všech dnešních úkolů.',
    });
  }
  respond(req, res, { chest });
});

export default router;
