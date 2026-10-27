import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { findCharacter, toView } from '../game/character.js';
import { bountyState, claimBounty, swapBounty, BountyError } from '../game/bounties.js';
import { dailyState } from '../game/daily.js';

// Krčma: hospodský vydává zakázky a na vývěsce visí denní úkoly
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
  res.json({ ...extra, ...bountyState(c), daily: dailyState(c), character: toView(c) });
}

function handle(fn) {
  return (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof BountyError) return res.status(400).json({ error: err.message });
      throw err;
    }
  };
}

// GET /api/tavern – zakázky, denní úkoly a postava
router.get('/', (req, res) => respond(req, res));

// POST /api/tavern/claim  { slot } – odměna za splněnou zakázku
router.post(
  '/claim',
  handle((req, res) => {
    const reward = claimBounty(req.character, Number(req.body?.slot));
    respond(req, res, { reward });
  })
);

// POST /api/tavern/swap  { slot } – vyměnit zakázku za jinou (za zlato)
router.post(
  '/swap',
  handle((req, res) => {
    swapBounty(req.character, Number(req.body?.slot));
    respond(req, res);
  })
);

export default router;
