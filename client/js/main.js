import { api, setUnauthorizedHandler } from './api.js';
import { getToken, getUser, setUser, clearSession } from './session.js';
import { getCharacter, setCharacter, onCharacterChange } from './state.js';
import login from './screens/login.js';
import vytvoreni from './screens/vytvoreni.js';
import profil from './screens/profil.js';
import krcma from './screens/krcma.js';
import arena from './screens/arena.js';
import obchod from './screens/obchod.js';

// Každá obrazovka je funkce, která vykreslí obsah do předaného elementu
const screens = { profil, krcma, arena, obchod };
const DEFAULT_SCREEN = 'profil';

const screenEl = document.getElementById('screen');
const menuEl = document.getElementById('menu');

// Obrazovka může vrátit funkci pro úklid (např. zastavení časovače)
let cleanupScreen = null;

function clearScreen() {
  if (cleanupScreen) cleanupScreen();
  cleanupScreen = null;
  screenEl.innerHTML = '';
}

function showLogin() {
  menuEl.hidden = true;
  clearScreen();
  login(screenEl, { onLogin: loadCharacter });
}

// Po přihlášení: má hráč postavu? Pokud ne, nejdřív ji vytvoří.
async function loadCharacter() {
  menuEl.hidden = true;
  try {
    const { character } = await api('/character');
    if (!character) {
      clearScreen();
      return await vytvoreni(screenEl, { onCreated: startGame });
    }
    setCharacter(character);
    startGame();
  } catch (err) {
    if (getUser()) {
      clearScreen();
      screenEl.innerHTML = `<div class="panel"><p class="error">${err.message}</p></div>`;
    }
  }
}

function startGame() {
  menuEl.hidden = false;
  router();
}

function updateMenu(c) {
  document.getElementById('player-name').textContent = c ? `${c.avatar} ${c.name}` : '';
  document.getElementById('player-gold').textContent = c ? c.gold : '';
}

function logout() {
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

  clearScreen();
  const cleanup = render(screenEl);
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
document.getElementById('logout').addEventListener('click', logout);
window.addEventListener('hashchange', router);
init();
checkServer();
