import { Router } from 'express';
import db from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import {
  GUILD_CREATE_COST,
  GUILD_MAX_MEMBERS,
  GUILD_EMBLEMS,
  GUILD_UPGRADES,
  GUILD_UPGRADE_MAX,
  guildUpgradeCost,
} from '../game/rules.js';
import { findCharacter, findCharacterById, toView } from '../game/character.js';
import { membership, memberCount, memberIds, invitesFor, guildDetail, guildLadder, ROLE_NAMES } from '../game/guild.js';
import { postGuildEvent, notifyCharacters } from '../game/chat.js';

const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} '_-]{1,22}[\p{L}\p{N}]$/u;
const MOTTO_MAX = 100;

// Chyba pro hráče: vrátí se jako 400 s tímhle textem
class GuildError extends Error {}
const fail = (message) => {
  throw new GuildError(message);
};

function cleanText(text, max) {
  return typeof text === 'string' ? text.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

const router = Router();
router.use(requireAuth);

router.use((req, res, next) => {
  const c = findCharacter(req.user.id);
  if (!c) return res.status(404).json({ error: 'Nejdřív si vytvoř postavu.' });
  req.character = c;
  req.member = membership(c.id);
  next();
});

function respond(req, res) {
  const c = findCharacter(req.user.id);
  const m = membership(c.id);
  res.json({
    guild: m ? guildDetail(m.guild_id, c.id) : null,
    invites: m ? [] : invitesFor(c.id),
    options: { emblems: GUILD_EMBLEMS, createCost: GUILD_CREATE_COST, maxMembers: GUILD_MAX_MEMBERS },
    character: toView(c),
  });
}

// Obal pro akce: chyby GuildError se vrátí jako 400
function action(handler) {
  return (req, res) => {
    try {
      handler(req, res);
      respond(req, res);
    } catch (err) {
      if (err instanceof GuildError) return res.status(400).json({ error: err.message });
      throw err;
    }
  };
}

function requireMember(req) {
  if (!req.member) fail('Nejsi v žádném cechu.');
  return req.member;
}

function requireManager(req) {
  const m = requireMember(req);
  if (m.role === 'member') fail('Na tohle musíš být vůdce nebo důstojník.');
  return m;
}

function requireLeader(req) {
  const m = requireMember(req);
  if (m.role !== 'leader') fail('Tohle smí jen vůdce cechu.');
  return m;
}

// Cílový člen stejného cechu
function targetMember(req, m) {
  const target = db
    .prepare('SELECT * FROM guild_members WHERE character_id = ? AND guild_id = ?')
    .get(Number(req.body?.characterId), m.guild_id);
  if (!target) fail('Takový člen v cechu není.');
  if (target.character_id === req.character.id) fail('Tohle nejde udělat sám se sebou.');
  return { ...target, name: findCharacterById(target.character_id).name };
}

// GET /api/guild – můj cech nebo pozvánky
router.get('/', respond);

// GET /api/guild/ladder – žebříček cechů
router.get('/ladder', (req, res) => {
  res.json({ guilds: guildLadder(), myGuildId: req.member?.guild_id ?? null });
});

// POST /api/guild/create  { name, emblem, motto }
router.post(
  '/create',
  action((req) => {
    const c = req.character;
    if (req.member) fail('Už jsi v cechu. Nejdřív z něj odejdi.');
    const name = cleanText(req.body?.name, 24);
    if (!NAME_RE.test(name)) fail('Název cechu musí mít 3–24 znaků (písmena, číslice, mezera, pomlčka, apostrof).');
    const emblem = req.body?.emblem;
    if (!GUILD_EMBLEMS.includes(emblem)) fail('Takový erb v heraldické knize není.');
    if (db.prepare('SELECT 1 FROM guilds WHERE name = ?').get(name)) fail('Cech s tímhle názvem už existuje.');
    if (c.gold < GUILD_CREATE_COST) fail(`Založení cechu stojí ${GUILD_CREATE_COST} zlaťáků. Tolik nemáš.`);

    db.transaction(() => {
      const paid = db
        .prepare('UPDATE characters SET gold = gold - ? WHERE id = ? AND gold >= ?')
        .run(GUILD_CREATE_COST, c.id, GUILD_CREATE_COST);
      if (paid.changes === 0) fail('Na založení cechu nemáš dost zlata.');
      const guildId = db
        .prepare('INSERT INTO guilds (name, emblem, motto, created_at) VALUES (?, ?, ?, ?)')
        .run(name, emblem, cleanText(req.body?.motto, MOTTO_MAX), Date.now()).lastInsertRowid;
      db.prepare("INSERT INTO guild_members (character_id, guild_id, role, joined_at) VALUES (?, ?, 'leader', ?)").run(
        c.id,
        guildId,
        Date.now()
      );
      db.prepare('DELETE FROM guild_invites WHERE character_id = ?').run(c.id);
      postGuildEvent(guildId, `${c.name} zakládá cech ${name}. Ať žije ${name}!`);
    })();
  })
);

// POST /api/guild/invite  { name } – pozvat hráče podle jména
router.post(
  '/invite',
  action((req) => {
    const m = requireManager(req);
    const target = db
      .prepare(
        `SELECT c.id, u.username AS name FROM users u JOIN characters c ON c.user_id = u.id WHERE u.username = ?`
      )
      .get(cleanText(req.body?.name, 20));
    if (!target) fail('Takového hrdinu neznáme.');
    if (membership(target.id)) fail(`${target.name} už je v nějakém cechu.`);
    if (memberCount(m.guild_id) >= GUILD_MAX_MEMBERS) fail('Cech je plný.');
    const added = db
      .prepare('INSERT OR IGNORE INTO guild_invites (guild_id, character_id, invited_by, created_at) VALUES (?, ?, ?, ?)')
      .run(m.guild_id, target.id, req.character.id, Date.now());
    if (added.changes === 0) fail(`${target.name} už pozvánku má.`);
    notifyCharacters([target.id]);
  })
);

// POST /api/guild/invite/cancel  { inviteId } – zrušit rozeslanou pozvánku
router.post(
  '/invite/cancel',
  action((req) => {
    const m = requireManager(req);
    db.prepare('DELETE FROM guild_invites WHERE id = ? AND guild_id = ?').run(Number(req.body?.inviteId), m.guild_id);
  })
);

// POST /api/guild/accept  { inviteId }
router.post(
  '/accept',
  action((req) => {
    const c = req.character;
    if (req.member) fail('Už jsi v cechu.');
    const invite = db
      .prepare('SELECT * FROM guild_invites WHERE id = ? AND character_id = ?')
      .get(Number(req.body?.inviteId), c.id);
    if (!invite) fail('Tahle pozvánka už neplatí.');

    db.transaction(() => {
      if (memberCount(invite.guild_id) >= GUILD_MAX_MEMBERS) fail('Cech je mezitím plný.');
      db.prepare("INSERT INTO guild_members (character_id, guild_id, role, joined_at) VALUES (?, ?, 'member', ?)").run(
        c.id,
        invite.guild_id,
        Date.now()
      );
      db.prepare('DELETE FROM guild_invites WHERE character_id = ?').run(c.id);
      postGuildEvent(invite.guild_id, `Nový člen cechu: ${c.name}. Vítej!`);
    })();
    notifyCharacters(memberIds(invite.guild_id));
  })
);

// POST /api/guild/decline  { inviteId }
router.post(
  '/decline',
  action((req) => {
    db.prepare('DELETE FROM guild_invites WHERE id = ? AND character_id = ?').run(
      Number(req.body?.inviteId),
      req.character.id
    );
  })
);

// POST /api/guild/leave – vůdce může odejít jen jako poslední (tím cech zanikne)
router.post(
  '/leave',
  action((req) => {
    const m = requireMember(req);
    const count = memberCount(m.guild_id);
    if (m.role === 'leader' && count > 1) fail('Vůdce nemůže opustit cech. Nejdřív předej vedení jinému členovi.');
    db.transaction(() => {
      if (count === 1) {
        db.prepare('DELETE FROM guilds WHERE id = ?').run(m.guild_id);
        db.prepare('DELETE FROM chat_messages WHERE channel = ?').run(`guild:${m.guild_id}`);
      } else {
        db.prepare('DELETE FROM guild_members WHERE character_id = ?').run(req.character.id);
        postGuildEvent(m.guild_id, `${req.character.name} odchází z cechu.`);
      }
    })();
    notifyCharacters(memberIds(m.guild_id));
  })
);

// POST /api/guild/kick  { characterId }
router.post(
  '/kick',
  action((req) => {
    const m = requireManager(req);
    const target = targetMember(req, m);
    if (target.role === 'leader') fail('Vůdce vyhodit nejde.');
    if (m.role === 'officer' && target.role !== 'member') fail('Důstojník může vyhodit jen řadového člena.');
    db.prepare('DELETE FROM guild_members WHERE character_id = ?').run(target.character_id);
    postGuildEvent(m.guild_id, `${target.name} dostává z cechu padáka. Dveře ukazuje ${req.character.name}.`);
    notifyCharacters([target.character_id, ...memberIds(m.guild_id)]);
  })
);

// POST /api/guild/role  { characterId, role: 'officer' | 'member' }
router.post(
  '/role',
  action((req) => {
    const m = requireLeader(req);
    const target = targetMember(req, m);
    const role = req.body?.role;
    if (role !== 'officer' && role !== 'member') fail('Neznámá role.');
    db.prepare('UPDATE guild_members SET role = ? WHERE character_id = ?').run(role, target.character_id);
    postGuildEvent(m.guild_id, `${target.name} je teď ${ROLE_NAMES[role].toLowerCase()}.`);
    notifyCharacters(memberIds(m.guild_id));
  })
);

// POST /api/guild/transfer  { characterId } – předat vedení
router.post(
  '/transfer',
  action((req) => {
    const m = requireLeader(req);
    const target = targetMember(req, m);
    db.transaction(() => {
      db.prepare("UPDATE guild_members SET role = 'leader' WHERE character_id = ?").run(target.character_id);
      db.prepare("UPDATE guild_members SET role = 'officer' WHERE character_id = ?").run(req.character.id);
    })();
    postGuildEvent(m.guild_id, `${req.character.name} předává vedení cechu. Novým vůdcem je ${target.name}!`);
    notifyCharacters(memberIds(m.guild_id));
  })
);

// POST /api/guild/donate  { amount } – příspěvek do pokladnice
router.post(
  '/donate',
  action((req) => {
    const m = requireMember(req);
    const amount = Math.floor(Number(req.body?.amount));
    if (!Number.isFinite(amount) || amount < 1) fail('Zadej, kolik zlaťáků chceš darovat.');
    db.transaction(() => {
      const paid = db
        .prepare('UPDATE characters SET gold = gold - ? WHERE id = ? AND gold >= ?')
        .run(amount, req.character.id, amount);
      if (paid.changes === 0) fail('Tolik zlata nemáš.');
      db.prepare('UPDATE guilds SET treasury = treasury + ? WHERE id = ?').run(amount, m.guild_id);
    })();
    postGuildEvent(m.guild_id, `${req.character.name} přispívá do pokladnice: 💰 ${amount}.`);
  })
);

// POST /api/guild/upgrade  { upgrade: 'xp' | 'gold' }
router.post(
  '/upgrade',
  action((req) => {
    const m = requireManager(req);
    const key = req.body?.upgrade;
    if (!Object.hasOwn(GUILD_UPGRADES, key)) fail('Takové vylepšení neexistuje.');
    const column = `upgrade_${key}`; // klíč je ověřený výše
    const guild = db.prepare('SELECT * FROM guilds WHERE id = ?').get(m.guild_id);
    const level = guild[column];
    if (level >= GUILD_UPGRADE_MAX) fail('Tohle vylepšení je už na maximu.');
    const cost = guildUpgradeCost(level);
    const done = db
      .prepare(
        `UPDATE guilds SET treasury = treasury - ?, ${column} = ${column} + 1
         WHERE id = ? AND treasury >= ? AND ${column} = ?`
      )
      .run(cost, m.guild_id, cost, level);
    if (done.changes === 0) fail(`V pokladnici chybí zlato (potřeba ${cost}).`);
    postGuildEvent(m.guild_id, `${GUILD_UPGRADES[key].icon} ${GUILD_UPGRADES[key].name}: úroveň ${level + 1}! (vylepšuje ${req.character.name})`);
  })
);

// POST /api/guild/motto  { motto }
router.post(
  '/motto',
  action((req) => {
    const m = requireLeader(req);
    db.prepare('UPDATE guilds SET motto = ? WHERE id = ?').run(cleanText(req.body?.motto, MOTTO_MAX), m.guild_id);
  })
);

export default router;
