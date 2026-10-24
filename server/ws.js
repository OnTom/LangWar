// WebSocket pro chat: server jím jen doručuje nové zprávy.
// Zprávy se posílají přes REST (/api/chat), kde jsou limity a kontroly.
//
// Protokol:
//   klient → { type: 'auth', token }        (do 5 s po připojení)
//   server → { type: 'ready' }
//   server → { type: 'message', channel: 'global' | 'guild', message }
//   server → { type: 'refresh' }            (změnilo se něco, co se týká hráče)
import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';
import { findCharacter } from './game/character.js';
import { memberIds } from './game/guild.js';
import { setDeliver, setNotifier } from './game/chat.js';

const AUTH_TIMEOUT = 5000;
const PING_INTERVAL = 30_000;
const MAX_SOCKETS_PER_CHARACTER = 3; // např. víc otevřených záložek

export function attachChat(server) {
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 2048 });

  wss.on('connection', (socket) => {
    socket.isAlive = true;
    socket.characterId = null;
    const authTimer = setTimeout(() => socket.close(4001, 'auth timeout'), AUTH_TIMEOUT);

    socket.on('pong', () => {
      socket.isAlive = true;
    });

    // Jediná zpráva, kterou od klienta čekáme, je přihlášení
    socket.on('message', (data) => {
      if (socket.characterId) return;
      let msg;
      try {
        msg = JSON.parse(data);
      } catch {
        return socket.close(4002, 'bad message');
      }
      let payload;
      try {
        payload = jwt.verify(msg?.token, JWT_SECRET, { algorithms: ['HS256'] });
      } catch {
        return socket.close(4003, 'unauthorized');
      }
      const c = findCharacter(payload.id);
      if (!c) return socket.close(4004, 'no character');

      clearTimeout(authTimer);
      socket.characterId = c.id;

      // Moc spojení jedné postavy: zavřeme to nejstarší
      const mine = [...wss.clients].filter((s) => s.characterId === c.id);
      if (mine.length > MAX_SOCKETS_PER_CHARACTER) mine[0].close(4005, 'too many connections');

      socket.send(JSON.stringify({ type: 'ready' }));
    });

    socket.on('close', () => clearTimeout(authTimer));
    socket.on('error', () => {});
  });

  // Mrtvá spojení (např. zavřený notebook) po čase odpojíme
  const ping = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, PING_INTERVAL);

  // Doručení nové zprávy: Náves všem, cechovní zprávy jen aktuálním členům cechu
  setDeliver((channel, message) => {
    const isGuild = channel.startsWith('guild:');
    const allowed = isGuild ? new Set(memberIds(Number(channel.slice('guild:'.length)))) : null;
    const data = JSON.stringify({ type: 'message', channel: isGuild ? 'guild' : 'global', message });
    for (const socket of wss.clients) {
      if (socket.readyState !== socket.OPEN || !socket.characterId) continue;
      if (allowed && !allowed.has(socket.characterId)) continue;
      socket.send(data);
    }
  });

  setNotifier((characterIds) => {
    const ids = new Set(characterIds);
    const data = JSON.stringify({ type: 'refresh' });
    for (const socket of wss.clients) {
      if (socket.readyState === socket.OPEN && ids.has(socket.characterId)) socket.send(data);
    }
  });

  return {
    close() {
      clearInterval(ping);
      for (const socket of wss.clients) socket.close(1001, 'server shutdown');
      wss.close();
    },
  };
}
