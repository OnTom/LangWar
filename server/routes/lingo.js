import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { findCharacter } from '../game/character.js';
import {
  LANGUAGE,
  TASK_TYPES,
  TOPICS,
  createTask,
  answerTask,
  topicOverview,
  topicWords,
  TaskError,
} from '../game/lingo.js';
import { progressDaily } from '../game/daily.js';

// Slovníček: přehled slov a procvičování (bez odměn, jen pro učení)
const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  req.character = c;
  next();
});

// GET /api/lingo – témata a pokrok
router.get('/', (req, res) => {
  res.json({
    language: LANGUAGE,
    taskTypes: Object.entries(TASK_TYPES).map(([key, t]) => ({ key, ...t })),
    topics: topicOverview(req.character.id),
  });
});

// GET /api/lingo/words?topic=… – slova tématu s pokrokem
router.get('/words', (req, res) => {
  if (!TOPICS.some((t) => t.key === req.query.topic)) {
    return res.status(400).json({ error: 'Takové téma neexistuje.' });
  }
  res.json({ words: topicWords(req.character.id, req.query.topic) });
});

// POST /api/lingo/task  { type, topic? } – nový úkol na procvičení
router.post('/task', (req, res) => {
  const { type, topic } = req.body || {};
  if (!Object.hasOwn(TASK_TYPES, type)) return res.status(400).json({ error: 'Neznámý typ úkolu.' });
  if (topic && !TOPICS.some((t) => t.key === topic)) return res.status(400).json({ error: 'Takové téma neexistuje.' });
  res.json({ task: createTask(req.character.id, { type, topics: topic ? [topic] : null, context: 'practice' }) });
});

// POST /api/lingo/answer  { taskId, answer }
router.post('/answer', (req, res) => {
  try {
    // Úkoly ze souboje se vyhodnocují přes souboj, ne tady
    const result = answerTask(req.character.id, req.body?.taskId, req.body?.answer, { context: 'practice' });
    if (result.correct) progressDaily(req.character.id, 'correct_words');
    res.json({ result });
  } catch (err) {
    if (err instanceof TaskError) return res.status(400).json({ error: err.message });
    throw err;
  }
});

export default router;
