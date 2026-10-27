import { api, setUnauthorizedHandler } from './api.js';
import { escapeHtml } from './format.js';
import { getToken, getUser, setUser, clearSession } from './session.js';
import { getCharacter, setCharacter, onCharacterChange } from './state.js';
import login from './screens/login.js';
import vytvoreni from './screens/vytvoreni.js';
import profil from './screens/profil.js';
import krcma from './screens/krcma.js';
import arena from './screens/arena.js';
import obchod from './screens/obchod.js';
import slava from './screens/slava.js';
import ukoly from './screens/ukoly.js';
import cech from './screens/cech.js';
import hospoda from './screens/hospoda.js';
import slovnicek from './screens/slovnicek.js';
import vyprava from './screens/vyprava.js';
import { connectChat, disconnectChat, onChat } from './chat.js';

// Každá obrazovka je funkce, která vykreslí obsah do předaného elementu
const screens = { profil, krcma, vyprava, arena, obchod, slovnicek, ukoly, cech, hospoda, slava };
const DEFAULT_SCREEN = 'profil';

const screenEl = document.getElementById('screen');
const menuEl = document.getElementById('menu');

// Obrazovka může vrátit funkci pro úklid (např. zastavení časovače)
let cleanupScreen = null;

// Uklidí starou obrazovku a vrátí nový prázdný kontejner. Každá obrazovka má
// vlastní kontejner, takže pozdě dorazivší data staré obrazovky už nic nepřepíšou.
function clearScreen() {
  if (cleanupScreen) cleanupScreen();
  cleanupScreen = null;
  const container = document.createElement('div');
  screenEl.replaceChildren(container);
  return container;
}

function showLogin() {
  menuEl.hidden = true;
  login(clearScreen(), { onLogin: loadCharacter });
}

// Po přihlášení: má hráč postavu? Pokud ne, nejdřív ji vytvoří.
async function loadCharacter() {
  menuEl.hidden = true;
  try {
    const { character } = await api('/character');
    if (!character) {
      return await vytvoreni(clearScreen(), { onCreated: startGame });
    }
    setCharacter(character);
    startGame();
  } catch (err) {
    if (getUser()) {
      clearScreen().innerHTML = `<div class="panel"><p class="error">${escapeHtml(err.message)}</p></div>`;
    }
  }
}

function startGame() {
  menuEl.hidden = false;
  connectChat();
  router();
}

function setBadge(id, count) {
  const badge = document.getElementById(id);
  badge.hidden = !count;
  badge.textContent = count || '';
}

function updateMenu(c) {
  document.getElementById('player-name').textContent = c ? `${c.avatar} ${c.name}` : '';
  document.getElementById('player-gold').textContent = c ? c.gold : '';
  // Odznaky: nevyzvednuté denní odměny a pozvánky do cechu
  setBadge('daily-badge', c?.dailyReady);
  setBadge('guild-badge', c && !c.guild ? c.guildInvites : 0);
}

function logout() {
  disconnectChat();
  setCharacter(null);
  clearSession();
  location.hash = '';
  showLogin();
}

function router() {
  if (!getUser() || !getCharacter()) return;

  const name = location.hash.replace('#/', '') || DEFAULT_SCREEN;
  const render = screens[name] || screens[DEFAULT_SCREEN];

  document.querySelectorAll('#menu a').forEach((a) => {
    a.classList.toggle('active', a.dataset.screen === name);
  });

  const cleanup = render(clearScreen());
  if (typeof cleanup === 'function') cleanupScreen = cleanup;
}

async function checkServer() {
  const el = document.getElementById('server-status');
  try {
    await api('/health');
    el.textContent = 'Server: 🟢 online';
  } catch {
    el.textContent = 'Server: 🔴 offline';
  }
}

// Při načtení stránky ověříme uložený token
async function init() {
  if (!getToken()) return showLogin();
  try {
    const { user } = await api('/auth/me');
    setUser(user);
    loadCharacter();
  } catch {
    // Neplatný token smaže handler pro 401; při výpadku serveru token necháme
    showLogin();
  }
}

setUnauthorizedHandler(logout);
onCharacterChange(updateMenu);
onChat(async (event) => {
  if (event.type === 'unread') setBadge('chat-badge', event.unread.global + event.unread.guild);
  // Server hlásí změnu (pozvánka, vyhození z cechu…): načteme postavu znovu
  if (event.type === 'refresh' && getUser()) {
    try {
      const { character } = await api('/character');
      if (character) setCharacter(character);
    } catch {}
  }
});
document.getElementById('logout').addEventListener('click', logout);
window.addEventListener('hashchange', router);
init();
checkServer();
