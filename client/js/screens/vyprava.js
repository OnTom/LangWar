import { api } from '../api.js';
import { escapeHtml } from '../format.js';
import { getCharacter, setCharacter } from '../state.js';
import { showBattle } from '../battle.js';

// Výprava: výběr místa a tahový souboj. (Mapu s lokacemi přidá další fáze.)
export default function vyprava(el) {
  let topics = null;
  let energy = null;
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

  function renderPicker() {
    stop();
    el.innerHTML = `
      <div class="panel expedition">
        <h2>🗺️ Výprava</h2>
        <p class="intro">Vyber si kraj a vyraz rovnou do boje. Každý útok je úkol se slovíčkem: správná odpověď zasáhne, špatná mine.</p>
        <div class="energy">
          <span>⚡ Energie</span>
          <div class="bar energy-bar"><div class="bar-fill" style="width: ${(energy.value / energy.max) * 100}%"></div><span>${energy.value} / ${energy.max}</span></div>
        </div>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>
        <div class="topic-list">
          ${topics
            .map(
              (t) => `
            <div class="topic-card">
              <div class="topic-head"><span class="topic-icon">${t.icon}</span><strong>${escapeHtml(t.name)}</strong><small>úr. ${t.level}</small></div>
              <div class="topic-actions">
                <button type="button" class="btn btn-small" data-fight="${t.key}" ${energy.value > 0 ? '' : 'disabled'}>⚔️ Bojovat</button>
              </div>
            </div>`
            )
            .join('')}
        </div>
      </div>`;
    el.querySelectorAll('[data-fight]').forEach((b) => b.addEventListener('click', () => start(b.dataset.fight)));
  }

  function renderBattle(battle) {
    stop();
    errorText = '';
    stopBattle = showBattle(el, battle, {
      onCharacter: setCharacter,
      onAgain: start,
      onLeave: load,
    });
  }

  async function start(topic) {
    errorText = '';
    try {
      const data = await api('/battle/start', { method: 'POST', body: { topic } });
      if (!alive) return;
      setEnergy(data.energy, data.energyMax);
      renderBattle(data.battle);
    } catch (err) {
      if (!alive) return;
      errorText = err.message;
      if (topics) renderPicker();
    }
  }

  async function load() {
    try {
      const [lingo, current] = await Promise.all([api('/lingo'), api('/battle')]);
      if (!alive) return;
      topics = lingo.topics;
      setEnergy(current.energy, current.energyMax);
      if (current.battle) renderBattle(current.battle);
      else renderPicker();
    } catch (err) {
      if (!alive) return;
      el.innerHTML = `<div class="panel"><p class="error">${escapeHtml(err.message)}</p></div>`;
    }
  }

  el.innerHTML = '<div class="panel">Balím na výpravu…</div>';
  load();
  return () => {
    alive = false;
    stop();
  };
}
