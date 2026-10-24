// Spojení s chatem přes WebSocket. Udržuje se po celou dobu hraní,
// aby šlo počítat nepřečtené zprávy i mimo obrazovku Hospoda.
import { getToken } from './session.js';

// Kódy, po kterých nemá smysl se znovu připojovat (neplatné přihlášení apod.)
const NO_RETRY = [4003, 4004, 4005];

let socket = null;
let stopped = true;
let retries = 0;
let online = false;
let activeChannel = null; // kanál, který má hráč právě otevřený
const unread = { global: 0, guild: 0 };
const listeners = new Set();

function emit(event) {
  listeners.forEach((fn) => fn(event));
}

function open() {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  socket = new WebSocket(`${protocol}://${location.host}/ws`);

  socket.addEventListener('open', () => {
    socket.send(JSON.stringify({ type: 'auth', token: getToken() }));
  });

  socket.addEventListener('message', (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'ready') {
      retries = 0;
      online = true;
      emit({ type: 'status', online });
    } else if (data.type === 'refresh') {
      emit(data);
    } else if (data.type === 'message') {
      if (activeChannel !== data.channel) {
        unread[data.channel]++;
        emit({ type: 'unread', unread: { ...unread } });
      }
      emit(data);
    }
  });

  socket.addEventListener('close', (e) => {
    online = false;
    emit({ type: 'status', online });
    if (stopped || NO_RETRY.includes(e.code)) return;
    // Opakované připojení s rostoucí pauzou (1 s, 2 s, 4 s… nejvýš 30 s)
    setTimeout(() => !stopped && open(), Math.min(30_000, 1000 * 2 ** retries++));
  });
}

export function connectChat() {
  if (!stopped) return;
  stopped = false;
  open();
}

export function disconnectChat() {
  stopped = true;
  socket?.close();
  socket = null;
  unread.global = 0;
  unread.guild = 0;
  emit({ type: 'unread', unread: { ...unread } });
}

export function onChat(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function isOnline() {
  return online;
}

export function getUnread() {
  return { ...unread };
}

// Obrazovka Hospoda hlásí, který kanál má hráč otevřený (null = žádný)
export function setActiveChannel(channel) {
  activeChannel = channel;
  if (channel) {
    unread[channel] = 0;
    emit({ type: 'unread', unread: { ...unread } });
  }
}
