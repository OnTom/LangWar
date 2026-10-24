import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { CHAT_MAX_LENGTH } from '../game/rules.js';
import { findCharacter } from '../game/character.js';
import { membership } from '../game/guild.js';
import { history, postMessage, guildChannel } from '../game/chat.js';

// Proti spamu: nejvýš 5 zpráv za 10 s a mezi zprávami aspoň 0,7 s (na postavu)
const BURST_WINDOW = 10_000;
const BURST_LIMIT = 5;
const MIN_GAP = 700;
const recent = new Map(); // characterId -> časy posledních zpráv

function tooFast(characterId) {
  const now = Date.now();
  const times = (recent.get(characterId) || []).filter((t) => now - t < BURST_WINDOW);
  if (times.length >= BURST_LIMIT || (times.length && now - times[times.length - 1] < MIN_GAP)) {
    recent.set(characterId, times);
    return true;
  }
  times.push(now);
  recent.set(characterId, times);
  return false;
}

// Občasný úklid, ať mapa neroste donekonečna
setInterval(() => {
  const now = Date.now();
  for (const [id, times] of recent) if (!times.some((t) => now - t < BURST_WINDOW)) recent.delete(id);
}, 60_000).unref();

const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  req.character = c;
  next();
});

// Kanál z požadavku: 'global' nebo 'guild' (cech hráče)
function resolveChannel(req, res, name) {
  if (name === 'global') return 'global';
  if (name === 'guild') {
    const m = membership(req.character.id);
    if (m) return guildChannel(m.guild_id);
    res.status(400).json({ error: 'Nejsi v žádném cechu.' });
    return null;
  }
  res.status(400).json({ error: 'Takový kanál neexistuje.' });
  return null;
}

// GET /api/chat?channel=global|guild – posledních pár zpráv
router.get('/', (req, res) => {
  const channel = resolveChannel(req, res, req.query.channel || 'global');
  if (!channel) return;
  res.json({ messages: history(channel) });
});

// POST /api/chat  { channel, text }
router.post('/', (req, res) => {
  const channel = resolveChannel(req, res, req.body?.channel);
  if (!channel) return;

  // Odstraní řídicí znaky a zalomení řádků, zkrátí mezery
  const text =
    typeof req.body?.text === 'string'
      ? req.body.text.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
      : '';
  if (!text) return res.status(400).json({ error: 'Prázdná zpráva. Hrdina mlčí.' });
  if (text.length > CHAT_MAX_LENGTH) {
    return res.status(400).json({ error: `Zpráva může mít nejvýš ${CHAT_MAX_LENGTH} znaků. Tohle už je román.` });
  }
  if (tooFast(req.character.id)) {
    return res.status(429).json({ error: 'Pomaleji, bardi to nestíhají zapisovat.' });
  }

  const c = req.character;
  const m = membership(c.id);
  const message = postMessage(channel, {
    characterId: c.id,
    name: c.name,
    avatar: c.avatar,
    guildName: channel === 'global' && m ? m.name : null,
    text,
  });
  res.status(201).json({ message });
});

export default router;
