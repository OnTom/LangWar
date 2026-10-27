import { api } from '../api.js';
import { escapeHtml } from '../format.js';
import { getCharacter, setCharacter } from '../state.js';
import { showBattle } from '../battle.js';

// Ozdoby mapy (jen pro vzhled): [ikona, x %, y %]
const DECORATIONS = [
  ['🌲', 31, 22], ['🌲', 43, 18], ['🌲', 33, 40], ['🌳', 44, 34], ['🌲', 8, 60],
  ['⛰️', 52, 12], ['⛰️', 66, 30], ['🏔️', 55, 32], ['🌾', 38, 74], ['🌾', 22, 88],
  ['🌻', 5, 40], ['🪨', 80, 80], ['🌵', 95, 44], ['🐑', 34, 58], ['🦅', 80, 18],
];

// Výprava: mapa s lokacemi a tahový souboj
export default function vyprava(el) {
  let map = null;
  let energy = null;
  let selected = null; // klíč vybrané lokace
  let stopBattle = null;
  let alive = true;
  let errorText = '';

  function stop() {
    stopBattle?.();
    stopBattle = null;
  }

  function setEnergy(value, max) {
    energy = { value, max };
    const c = getCharacter();
    if (c) setCharacter({ ...c, energy: value, energyMax: max });
  }

  function location(key) {
    return map.locations.find((l) => l.key === key);
  }

  function markerHtml(l) {
    const classes = ['map-loc', l.unlocked ? '' : 'locked', l.bossReady ? 'boss-ready' : '', l.key === selected ? 'selected' : '']
      .filter(Boolean)
      .join(' ');
    return `
      <button type="button" class="${classes}" data-loc="${l.key}" style="left: ${l.x}%; top: ${l.y}%"
        aria-label="${escapeHtml(l.name)}${l.unlocked ? '' : ` (od úrovně ${l.level})`}">
        <span class="map-loc-icon">${l.icon}${l.unlocked ? '' : '<span class="map-loc-lock">🔒</span>'}</span>
        <span class="map-loc-name">${escapeHtml(l.name)}${l.unlocked ? '' : ` · úr. ${l.level}`}</span>
        ${l.bossReady ? '<span class="map-loc-boss" title="Boss čeká!">👑</span>' : ''}
      </button>`;
  }

  // Cesta mezi lokacemi v pořadí, v jakém se odemykají
  function pathHtml() {
    const points = map.locations.map((l) => `${l.x},${l.y}`).join(' ');
    return `
      <svg class="map-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <path class="map-river" d="M 0 52 C 20 48, 30 60, 45 62 S 70 90, 100 86" />
        <polyline class="map-path" points="${points}" />
      </svg>`;
  }

  function detailHtml(l) {
    if (!l.unlocked) {
      return `
        <div class="loc-detail locked">
          <h3>🔒 ${escapeHtml(l.name)}</h3>
          <p>${escapeHtml(l.description)}</p>
          <p><strong>Odemkne se na ${l.level}. úrovni.</strong></p>
        </div>`;
    }
    const noEnergy = energy.value <= 0 ? 'disabled' : '';
    const enemyCard = (m, value, extra = '') => `
      <div class="enemy-card ${extra}">
        <span class="enemy-icon">${m.icon}</span>
        <div class="enemy-info">
          <strong>${escapeHtml(m.name)}</strong>
          <small>${escapeHtml(m.className)} · úr. ${m.level ?? l.enemyLevel}</small>
        </div>
        <button type="button" class="btn btn-small" data-enemy="${value}" ${noEnergy}>⚔️ Bojovat</button>
      </div>`;
    const bossCard = l.bossReady
      ? enemyCard(l.boss, 'boss', 'boss')
      : `<div class="enemy-card boss waiting">
          <span class="enemy-icon">❔</span>
          <div class="enemy-info">
            <strong>Boss lokace</strong>
            <small>Ukáže se po ${map.bossWinsRequired} vítězstvích</small>
            <div class="bar boss-bar"><div class="bar-fill" style="width: ${(l.bossCharge / map.bossWinsRequired) * 100}%"></div><span>${l.bossCharge} / ${map.bossWinsRequired}</span></div>
          </div>
        </div>`;
    return `
      <div class="loc-detail">
        <h3>${l.icon} ${escapeHtml(l.name)}</h3>
        <p class="loc-desc">${escapeHtml(l.description)}</p>
        <div class="loc-meta">
          <span>📚 ${l.topics.map((t) => `${t.icon} ${escapeHtml(t.name)}`).join(', ')}</span>
          <span>⚔️ Nepřátelé úr. ${l.enemyLevel}</span>
          <span>🏆 Vítězství: ${l.wins}${l.bossWins ? ` · 👑 ${l.bossWins}×` : ''}</span>
        </div>
        <div class="enemy-list">
          ${l.monsters.map((m, i) => enemyCard(m, i)).join('')}
          ${bossCard}
        </div>
        <button type="button" class="btn random-btn" data-enemy="" ${noEnergy}>🎲 Vrhnout se na kohokoli</button>
      </div>`;
  }

  function renderMap() {
    stop();
    selected ??= map.current;
    const current = location(selected);
    el.innerHTML = `
      <div class="panel expedition">
        <h2>🗺️ Výprava</h2>
        <div class="energy">
          <span>⚡ Energie</span>
          <div class="bar energy-bar"><div class="bar-fill" style="width: ${(energy.value / energy.max) * 100}%"></div><span>${energy.value} / ${energy.max}</span></div>
        </div>
        <div class="world-map">
          ${pathHtml()}
          ${DECORATIONS.map(([icon, x, y]) => `<span class="map-deco" style="left: ${x}%; top: ${y}%">${icon}</span>`).join('')}
          ${map.locations.map(markerHtml).join('')}
          <span class="map-hero" style="left: ${current.x}%; top: ${current.y}%">${getCharacter()?.avatar ?? '🧙'}</span>
        </div>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>
        <div class="loc-detail-box">${detailHtml(current)}</div>
      </div>`;
    el.querySelectorAll('[data-loc]').forEach((b) => b.addEventListener('click', () => select(b.dataset.loc)));
    bindDetail();
  }

  function bindDetail() {
    el.querySelectorAll('.loc-detail [data-enemy]').forEach((b) =>
      b.addEventListener('click', () => {
        const value = b.dataset.enemy;
        start(selected, value === '' ? undefined : value === 'boss' ? 'boss' : Number(value));
      })
    );
  }

  // Hrdina dojde k lokaci (bez čekání) a ukáže se její nabídka
  function select(key) {
    const l = location(key);
    errorText = '';
    el.querySelector('.error').textContent = '';
    if (l.unlocked) {
      selected = key;
      const hero = el.querySelector('.map-hero');
      hero.style.left = `${l.x}%`;
      hero.style.top = `${l.y}%`;
    }
    el.querySelectorAll('[data-loc]').forEach((b) => b.classList.toggle('selected', b.dataset.loc === key));
    el.querySelector('.loc-detail-box').innerHTML = detailHtml(l);
    bindDetail();
  }

  function renderBattle(battle) {
    stop();
    errorText = '';
    stopBattle = showBattle(el, battle, {
      onCharacter: setCharacter,
      onAgain: (key) => start(key),
      onLeave: load,
    });
  }

  async function start(key, enemy) {
    errorText = '';
    try {
      const data = await api('/battle/start', { method: 'POST', body: { location: key, enemy } });
      if (!alive) return;
      selected = key;
      setEnergy(data.energy, data.energyMax);
      renderBattle(data.battle);
    } catch (err) {
      if (!alive) return;
      errorText = err.message;
      await load();
    }
  }

  async function load() {
    try {
      const [mapData, current] = await Promise.all([api('/battle/map'), api('/battle')]);
      if (!alive) return;
      map = mapData.map;
      setEnergy(current.energy, current.energyMax);
      if (current.battle) renderBattle(current.battle);
      else renderMap();
    } catch (err) {
      if (!alive) return;
      el.innerHTML = `<div class="panel"><p class="error">${escapeHtml(err.message)}</p></div>`;
    }
  }

  el.innerHTML = '<div class="panel">Rozkládám mapu…</div>';
  load();
  return () => {
    alive = false;
    stop();
  };
}
