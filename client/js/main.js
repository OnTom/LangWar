import { api, setUnauthorizedHandler } from './api.js';
import { getToken, getUser, setUser, clearSession } from './session.js';
import login from './screens/login.js';
import profil from './screens/profil.js';
import krcma from './screens/krcma.js';
import arena from './screens/arena.js';
import obchod from './screens/obchod.js';

// Každá obrazovka je funkce, která vykreslí obsah do předaného elementu
const screens = { profil, krcma, arena, obchod };
const DEFAULT_SCREEN = 'profil';

const screenEl = document.getElementById('screen');
const menuEl = document.getElementById('menu');

function showLogin() {
  menuEl.hidden = true;
  screenEl.innerHTML = '';
  login(screenEl, { onLogin: startGame });
}

function startGame() {
  menuEl.hidden = false;
  document.getElementById('player-name').textContent = getUser().username;
  router();
}

function logout() {
  clearSession();
  location.hash = '';
  showLogin();
}

function router() {
  if (!getUser()) return;

  const name = location.hash.replace('#/', '') || DEFAULT_SCREEN;
  const render = screens[name] || screens[DEFAULT_SCREEN];

  document.querySelectorAll('#menu a').forEach((a) => {
    a.classList.toggle('active', a.dataset.screen === name);
  });

  screenEl.innerHTML = '';
  render(screenEl);
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
    startGame();
  } catch {
    // Neplatný token smaže handler pro 401; při výpadku serveru token necháme
    showLogin();
  }
}

setUnauthorizedHandler(logout);
document.getElementById('logout').addEventListener('click', logout);
window.addEventListener('hashchange', router);
init();
checkServer();
