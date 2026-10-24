import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { loginLimiter, registerLimiter } from '../middleware/security.js';

const router = Router();

const USERNAME_RE = /^[\p{L}\p{N}_]{3,20}$/u;
const PASSWORD_MIN = 6;
const PASSWORD_MAX_BYTES = 72; // bcrypt čte jen prvních 72 bajtů, delší heslo by se tiše zkrátilo

// Neexistující účet ověříme proti tomuhle hashi, aby odpověď trvala stejně dlouho
// a podle rychlosti nešlo poznat, která jména existují
const DUMMY_HASH = bcrypt.hashSync('neexistujici-ucet', 10);

function createToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function validate(username, password) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return 'Jméno musí mít 3–20 znaků a obsahovat jen písmena, číslice nebo podtržítko.';
  }
  if (typeof password !== 'string' || password.length < PASSWORD_MIN) {
    return `Heslo musí mít aspoň ${PASSWORD_MIN} znaků. I goblini mají delší.`;
  }
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) {
    return 'Heslo je moc dlouhé (nejvýš 72 bajtů, tedy zhruba 36–72 znaků podle diakritiky).';
  }
  return null;
}

// POST /api/auth/register  { username, password }
router.post('/register', registerLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  const error = validate(username, password);
  if (error) return res.status(400).json({ error });

  const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
  if (exists) {
    return res.status(409).json({ error: 'Tohle jméno už nosí jiný hrdina.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = db
    .prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)')
    .run(username, passwordHash, Date.now());

  const user = { id: result.lastInsertRowid, username };
  res.status(201).json({ token: createToken(user), user });
});

// POST /api/auth/login  { username, password }
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Vyplň jméno i heslo.' });
  }

  const row = db
    .prepare('SELECT id, username, password_hash FROM users WHERE username = ?')
    .get(username);

  const valid = await bcrypt.compare(password, row ? row.password_hash : DUMMY_HASH);
  const ok = row && valid;
  if (!ok) {
    return res.status(401).json({ error: 'Špatné jméno nebo heslo.' });
  }

  const user = { id: row.id, username: row.username };
  res.json({ token: createToken(user), user });
});

// GET /api/auth/me – kdo jsem (ověří platnost tokenu)
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(401).json({ error: 'Účet neexistuje.' });
  res.json({ user });
});

export default router;
