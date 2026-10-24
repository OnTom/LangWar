import { api } from './api.js';
import profil from './screens/profil.js';
import krcma from './screens/krcma.js';
import arena from './screens/arena.js';
import obchod from './screens/obchod.js';

// Každá obrazovka je funkce, která vykreslí obsah do předaného elementu
const screens = { profil, krcma, arena, obchod };
const DEFAULT_SCREEN = 'profil';

const screenEl = document.getElementById('screen');

function router() {
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

window.addEventListener('hashchange', router);
router();
checkServer();
