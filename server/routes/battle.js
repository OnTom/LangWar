import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ENERGY_MAX } from '../game/rules.js';
import { findCharacter, toView } from '../game/character.js';
import {
  BattleError,
  activeBattle,
  startBattle,
  chooseAction,
  answerAction,
  flee,
  battleView,
  currentEnergy,
  mapView,
} from '../game/expedition.js';

const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  req.character = c;
  next();
});

function energy(c) {
  return { energy: currentEnergy(c), energyMax: ENERGY_MAX };
}

// Chyby souboje pošleme hráči, ostatní nechá spadnout do obecného ošetření
function handle(fn) {
  return (req, res, next) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof BattleError) return res.status(err.status).json({ error: err.message });
      next(err);
    }
  };
}

// GET /api/battle – probíhající souboj (nebo null) a energie
router.get(
  '/',
  handle((req, res) => {
    const row = activeBattle(req.character);
    res.json({ battle: battleView(row?.status === 'active' ? row : null), ...energy(req.character) });
  })
);

// GET /api/battle/map – lokace Výpravy, postup v nich a energie
router.get(
  '/map',
  handle((req, res) => {
    res.json({ map: mapView(req.character), ...energy(req.character) });
  })
);

// POST /api/battle/start  { location, enemy?: číslo nepřítele | 'boss' }
router.post(
  '/start',
  handle((req, res) => {
    const row = startBattle(req.character, { location: req.body?.location, enemy: req.body?.enemy });
    res.status(201).json({ battle: battleView(row), ...energy(findCharacter(req.user.id)) });
  })
);

// POST /api/battle/action  { action: light | heavy | spell } → úkol
router.post(
  '/action',
  handle((req, res) => {
    const row = chooseAction(req.character, String(req.body?.action ?? ''));
    res.json({ battle: battleView(row) });
  })
);

// POST /api/battle/answer  { answer } → výsledek úkolu a průběh kola
router.post(
  '/answer',
  handle((req, res) => {
    const answer = req.body?.answer;
    if (answer !== null && answer !== undefined && typeof answer !== 'string' && typeof answer !== 'number') {
      return res.status(400).json({ error: 'Neplatná odpověď.' });
    }
    const { row, result, events } = answerAction(req.character, answer);
    const finished = row.status !== 'active';
    res.json({
      result,
      events,
      battle: battleView(row),
      character: finished ? toView(findCharacter(req.user.id)) : undefined,
    });
  })
);

// POST /api/battle/flee
router.post(
  '/flee',
  handle((req, res) => {
    res.json({ battle: battleView(flee(req.character)) });
  })
);

export default router;
