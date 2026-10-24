import db from '../db.js';
import { CHAT_HISTORY, CHAT_KEEP } from './rules.js';

// Doručovatelé v reálném čase (nastaví je WebSocket server)
let deliver = () => {};
let notifier = () => {};
export function setDeliver(fn) {
  deliver = fn;
}
export function setNotifier(fn) {
  notifier = fn;
}

// Řekne klientům daných postav, ať si znovu načtou svá data (např. přišla pozvánka do cechu)
export function notifyCharacters(characterIds) {
  notifier(characterIds);
}

export const guildChannel = (guildId) => `guild:${guildId}`;

function messageView(row) {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    guildName: row.guild_name,
    text: row.text,
    system: Boolean(row.system),
    at: row.created_at,
  };
}

// Uloží zprávu, promaže staré a pošle ji všem, kdo kanál poslouchají
export function postMessage(channel, { characterId = null, name, avatar, guildName = null, text, system = false }) {
  const info = db
    .prepare(
      `INSERT INTO chat_messages (channel, character_id, name, avatar, guild_name, text, system, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(channel, characterId, name, avatar, guildName, text, system ? 1 : 0, Date.now());
  // Nechá v kanálu jen posledních CHAT_KEEP zpráv
  db.prepare(
    `DELETE FROM chat_messages WHERE channel = ? AND id < (
       SELECT id FROM chat_messages WHERE channel = ? ORDER BY id DESC LIMIT 1 OFFSET ?
     )`
  ).run(channel, channel, CHAT_KEEP - 1);

  const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(info.lastInsertRowid);
  const message = messageView(row);
  deliver(channel, message);
  return message;
}

// Systémová zpráva do cechovního chatu (např. „Pepa se přidal k cechu“)
export function postGuildEvent(guildId, text) {
  return postMessage(guildChannel(guildId), { name: 'Cechovní kronika', avatar: '📜', text, system: true });
}

export function history(channel) {
  return db
    .prepare('SELECT * FROM chat_messages WHERE channel = ? ORDER BY id DESC LIMIT ?')
    .all(channel, CHAT_HISTORY)
    .reverse()
    .map(messageView);
}
