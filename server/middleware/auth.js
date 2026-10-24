import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

// Pustí dál jen požadavky s platným tokenem v hlavičce Authorization: Bearer <token>
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Nejdřív se musíš přihlásit.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.id, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'Přihlášení vypršelo. Přihlas se znovu.' });
  }
}
