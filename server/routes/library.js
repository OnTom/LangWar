import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { findCharacter, toView } from '../game/character.js';
import { TaskError } from '../game/lingo.js';
import { isAdmin, withSolution } from '../game/admin.js';
import {
  LibraryError,
  libraryState,
  lessonView,
  buyLesson,
  startExam,
  answerExam,
  setSpellSlots,
} from '../game/library.js';

// Knihovna: lekce gramatiky, zkoušky a kniha kouzel
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
      if (err instanceof LibraryError) return res.status(err.status).json({ error: err.message });
      if (err instanceof TaskError) return res.status(400).json({ error: err.message });
      throw err;
    }
  };
}

// Adminovi s režimem „ukazovat odpovědi“ přidá k otázce zkoušky řešení
function examWithSolution(req, exam) {
  return exam?.task ? { ...exam, task: withSolution(req.user.id, exam.task) } : exam;
}

function state(req) {
  const c = findCharacter(req.user.id);
  const library = libraryState(c);
  return { ...library, exam: examWithSolution(req, library.exam), character: toView(c) };
}

// GET /api/library – lekce, kniha kouzel, rozpracovaná zkouška
router.get('/', handle((req, res) => res.json(state(req))));

// GET /api/library/lesson/:key – text lekce
router.get(
  '/lesson/:key',
  handle((req, res) => {
    res.json({ lesson: lessonView(req.character, req.params.key, { admin: isAdmin(req.user.id) }) });
  })
);

// POST /api/library/buy  { lesson }
router.post(
  '/buy',
  handle((req, res) => {
    buyLesson(req.character, String(req.body?.lesson ?? ''));
    res.json(state(req));
  })
);

// POST /api/library/exam/start  { lesson }
router.post(
  '/exam/start',
  handle((req, res) => {
    const exam = startExam(req.character, String(req.body?.lesson ?? ''));
    res.json({ exam: examWithSolution(req, exam) });
  })
);

// POST /api/library/exam/answer  { answer } – index, text, nebo pořadí kartiček
router.post(
  '/exam/answer',
  handle((req, res) => {
    const answer = req.body?.answer;
    if (Array.isArray(answer) && answer.length > 20) return res.status(400).json({ error: 'Neplatná odpověď.' });
    const { result, exam, learnedSpell } = answerExam(req.character, answer);
    // Po skončení zkoušky pošle i nový stav knihovny (výsledek zkoušky má přednost)
    res.json({ ...(exam.status !== 'active' ? state(req) : {}), result, exam: examWithSolution(req, exam), learnedSpell });
  })
);

// POST /api/library/slots  { kinds: ['attack', 'heal', …] } – nasazená kouzla
router.post(
  '/slots',
  handle((req, res) => {
    setSpellSlots(req.character, req.body?.kinds);
    res.json(state(req));
  })
);

export default router;
