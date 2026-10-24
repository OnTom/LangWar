import db from '../db.js';
import {
  CLASSES,
  GUILD_UPGRADES,
  GUILD_UPGRADE_MAX,
  GUILD_BONUS_PER_LEVEL,
  GUILD_MAX_MEMBERS,
  guildUpgradeCost,
} from './rules.js';

export const ROLE_NAMES = { leader: 'Vůdce', officer: 'Důstojník', member: 'Člen' };

export function membership(characterId) {
  return db
    .prepare(
      `SELECT m.guild_id, m.role, g.name, g.emblem
       FROM guild_members m JOIN guilds g ON g.id = m.guild_id
       WHERE m.character_id = ?`
    )
    .get(characterId);
}

export function memberCount(guildId) {
  return db.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id = ?').get(guildId).n;
}

export function memberIds(guildId) {
  return db.prepare('SELECT character_id FROM guild_members WHERE guild_id = ?').all(guildId).map((r) => r.character_id);
}

// Bonus k odměnám z výprav podle vylepšení cechu (v procentech)
export function guildBonus(characterId) {
  const row = db
    .prepare(
      `SELECT g.upgrade_xp, g.upgrade_gold FROM guild_members m JOIN guilds g ON g.id = m.guild_id
       WHERE m.character_id = ?`
    )
    .get(characterId);
  return {
    xp: (row?.upgrade_xp || 0) * GUILD_BONUS_PER_LEVEL,
    gold: (row?.upgrade_gold || 0) * GUILD_BONUS_PER_LEVEL,
  };
}

export function applyBonus(value, percent) {
  return Math.round(value * (1 + percent / 100));
}

// Pozvánky pro hráče bez cechu
export function invitesFor(characterId) {
  return db
    .prepare(
      `SELECT i.id, g.id AS guild_id, g.name, g.emblem, g.motto, u.username AS invited_by
       FROM guild_invites i
       JOIN guilds g ON g.id = i.guild_id
       LEFT JOIN characters c ON c.id = i.invited_by
       LEFT JOIN users u ON u.id = c.user_id
       WHERE i.character_id = ?
       ORDER BY i.created_at DESC`
    )
    .all(characterId)
    .map((r) => ({
      id: r.id,
      guild: { id: r.guild_id, name: r.name, emblem: r.emblem, motto: r.motto, members: memberCount(r.guild_id) },
      invitedBy: r.invited_by,
    }));
}

// Kompletní přehled cechu z pohledu člena
export function guildDetail(guildId, viewerId) {
  const g = db.prepare('SELECT * FROM guilds WHERE id = ?').get(guildId);
  const members = db
    .prepare(
      `SELECT m.character_id, m.role, m.joined_at, c.avatar, c.class, c.level, c.honor, u.username AS name
       FROM guild_members m
       JOIN characters c ON c.id = m.character_id
       JOIN users u ON u.id = c.user_id
       WHERE m.guild_id = ?
       ORDER BY CASE m.role WHEN 'leader' THEN 0 WHEN 'officer' THEN 1 ELSE 2 END, c.level DESC, m.joined_at`
    )
    .all(guildId);
  const me = members.find((m) => m.character_id === viewerId);
  const canManage = me && me.role !== 'member';

  return {
    id: g.id,
    name: g.name,
    emblem: g.emblem,
    motto: g.motto,
    treasury: g.treasury,
    maxMembers: GUILD_MAX_MEMBERS,
    myRole: me?.role,
    honor: members.reduce((sum, m) => sum + m.honor, 0),
    members: members.map((m) => ({
      characterId: m.character_id,
      name: m.name,
      avatar: m.avatar,
      className: CLASSES[m.class].name,
      level: m.level,
      honor: m.honor,
      role: m.role,
      roleName: ROLE_NAMES[m.role],
      isMe: m.character_id === viewerId,
    })),
    upgrades: Object.entries(GUILD_UPGRADES).map(([key, u]) => {
      const level = g[`upgrade_${key}`];
      return {
        key,
        ...u,
        level,
        max: GUILD_UPGRADE_MAX,
        bonus: level * GUILD_BONUS_PER_LEVEL,
        cost: level < GUILD_UPGRADE_MAX ? guildUpgradeCost(level) : null,
      };
    }),
    // Rozeslané pozvánky vidí jen vedení
    pendingInvites: canManage
      ? db
          .prepare(
            `SELECT i.id, u.username AS name FROM guild_invites i
             JOIN characters c ON c.id = i.character_id JOIN users u ON u.id = c.user_id
             WHERE i.guild_id = ? ORDER BY i.created_at DESC`
          )
          .all(guildId)
      : [],
  };
}

// Žebříček cechů podle součtu cti členů
export function guildLadder(limit = 50) {
  return db
    .prepare(
      `SELECT g.id, g.name, g.emblem, COUNT(m.character_id) AS members, COALESCE(SUM(c.honor), 0) AS honor,
              MAX(CASE WHEN m.role = 'leader' THEN u.username END) AS leader
       FROM guilds g
       JOIN guild_members m ON m.guild_id = g.id
       JOIN characters c ON c.id = m.character_id
       JOIN users u ON u.id = c.user_id
       GROUP BY g.id
       ORDER BY honor DESC, members DESC, g.id
       LIMIT ?`
    )
    .all(limit)
    .map((g, i) => ({ rank: i + 1, ...g }));
}
