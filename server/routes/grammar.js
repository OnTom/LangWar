import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { findCharacter } from '../game/character.js';
import { TaskError } from '../game/lingo.js';
import { createGrammarTask, answerGrammarTask, grammarOverview, GRAMMAR_FORMATS } from '../game/grammar.js';
import { isLearned } from '../game/library.js';
import { unlockedTopics } from '../data/locations.js';
import { isAdmin, withSolution } from '../game/admin.js';

// Procvičování gramatiky: hráč jen naučené lekce (v knihovně), správce všechny hotové
const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  req.character = c;
  next();
});

function handle(fn) {
  return (req, res) => {
    try {
      fn(req, res);
    } catch (err) {
      if (err instanceof TaskError) return res.status(400).json({ error: err.message });
      throw err;
    }
  };
}

// GET /api/grammar – lekce a postup
router.get('/', (req, res) => {
  res.json({ lessons: grammarOverview(req.character.id), formats: GRAMMAR_FORMATS });
});

// POST /api/grammar/task  { lesson, format? }
router.post(
  '/task',
  handle((req, res) => {
    const { lesson, format } = req.body || {};
    const key = String(lesson ?? '');
    if (!isAdmin(req.user.id) && !isLearned(req.character.id, key)) {
      return res.status(403).json({ error: 'Tuhle lekci se nejdřív nauč v knihovně.' });
    }
    const task = createGrammarTask(req.character.id, {
      lesson: key,
      format: format || null,
      topics: unlockedTopics(req.character.level),
    });
    res.json({ task: withSolution(req.user.id, task) });
  })
);

// POST /api/grammar/answer  { taskId, answer } – answer: index, text, nebo pořadí kartiček
router.post(
  '/answer',
  handle((req, res) => {
    const { taskId, answer } = req.body || {};
    if (Array.isArray(answer) && answer.length > 20) return res.status(400).json({ error: 'Neplatná odpověď.' });
    res.json({ result: answerGrammarTask(req.character.id, taskId, answer, { context: 'grammar' }) });
  })
);

export default router;
