import { api } from '../api.js';
import { setCharacter } from '../state.js';
import { playFight } from '../fight.js';
import { formatTime, timeAgo } from '../format.js';

// Aréna: souboje s ostatními hráči (a NPC gladiátory) o čest a zlato
export default function arena(el) {
  let state = null;
  let errorText = '';
  let busy = false;
  let clockOffset = 0;
  let fight = null; // probíhající přehrávání souboje
  let result = null;
  let pendingCharacter = null;
  let stopFight = null;

  const serverNow = () => Date.now() + clockOffset;

  function setState(s) {
    state = s;
    clockOffset = s.serverNow - Date.now();
  }

  const remaining = () => (state ? state.readyAt - serverNow() : 0);

  function statusHtml() {
    if (state.onQuest) {
      return '<p class="arena-status">🗺️ Jsi na výpravě. Do arény můžeš, až se vrátíš z krčmy.</p>';
    }
    if (remaining() > 0) {
      return `<p class="arena-status">😮‍💨 Další souboj za <strong class="arena-countdown">${formatTime(remaining())}</strong></p>`;
    }
    return '<p class="arena-status ready">💪 Jsi připraven k boji! Vyber si soupeře.</p>';
  }

  function historyHtml() {
    if (state.history.length === 0) {
      return '<p class="hint">Zatím žádné souboje. Diváci se nudí.</p>';
    }
    const now = serverNow();
    return `
      <ul class="arena-history">
        ${state.history
          .map((h) => {
            const text =
              h.type === 'attack'
                ? `Vyzval jsi ${h.opponentAvatar} <strong>${h.opponentName}</strong> a ${h.won ? 'vyhrál' : 'prohrál'}`
                : `${h.opponentAvatar} <strong>${h.opponentName}</strong> tě napadl a ${h.won ? 'prohrál' : 'vyhrál'}`;
            const changes = [
              h.honorChange ? `${h.honorChange > 0 ? '+' : ''}${h.honorChange} cti` : '',
              h.gold ? `+${h.gold} 💰` : '',
            ]
              .filter(Boolean)
              .join(', ');
            return `
              <li class="${h.won ? 'won' : 'lost'}">
                <span>${h.won ? '🏆' : '💀'} ${text}${changes ? ` (${changes})` : ''}</span>
                <small>${timeAgo(h.at, now)}</small>
              </li>`;
          })
          .join('')}
      </ul>`;
  }

  function render() {
    if (!state) {
      el.innerHTML = `<div class="panel">${errorText ? `<p class="error">${errorText}</p>` : 'Gladiátoři se rozcvičují…'}</div>`;
      return;
    }
    const canFight = !busy && !state.onQuest && remaining() <= 0;

    el.innerHTML = `
      <div class="panel arena">
        <h2>⚔️ Aréna</h2>
        <p class="intro">Dav řve, prodavač klobás křičí ještě hlasitěji. Vyber si soupeře.</p>
        <div class="arena-stats">
          <span>🏅 Čest: <strong>${state.honor}</strong></span>
          <span>📜 Pořadí: <strong>#${state.rank}</strong></span>
          <a href="#/slava">🏆 Síň slávy</a>
        </div>
        ${statusHtml()}
        <p class="error" role="alert">${errorText}</p>

        <div class="opponent-list">
          ${state.opponents
            .map(
              (o) => `
            <div class="opponent-card opponent-${o.type}">
              <div class="opponent-avatar">${o.avatar}</div>
              <strong>${o.name}</strong>
              <small>${o.className} · úroveň ${o.level}</small>
              <div class="opponent-honor">${o.type === 'npc' ? '🤖 NPC gladiátor' : `🏅 ${o.honor} cti`}</div>
              <button type="button" class="btn fight-btn" data-index="${o.index}" ${canFight ? '' : 'disabled'}>Vyzvat</button>
            </div>`
            )
            .join('')}
        </div>
        <p class="hint">Za výhru nad hráčem získáš zlato a čest, kterou mu vezmeš. NPC gladiátoři dají jen polovinu zlata a žádnou čest.</p>

        <h3>Poslední souboje</h3>
        ${historyHtml()}
      </div>`;

    el.querySelectorAll('.fight-btn').forEach((btn) =>
      btn.addEventListener('click', () => challenge(Number(btn.dataset.index)))
    );
  }

  function resultHtml() {
    const honor = result.honorChange
      ? `<span>🏅 ${result.honorChange > 0 ? '+' : ''}${result.honorChange} cti</span>`
      : '';
    if (!result.won) {
      return `
        <div class="quest-result lost">
          <h2>💀 Prohra!</h2>
          <p><em>${fight.enemy.name}</em> tě vyprovodil z arény za potlesku publika.</p>
          ${honor ? `<div class="rewards">${honor}</div>` : ''}
          <button type="button" class="btn continue-btn">Zpátky do arény</button>
        </div>`;
    }
    return `
      <div class="quest-result">
        <h2>🏆 Vítězství!</h2>
        <p>Porazil jsi soupeře <em>${fight.enemy.name}</em>. Dav šílí.</p>
        <div class="rewards">
          <span>💰 +${result.gold} zlaťáků</span>
          ${honor}
        </div>
        <button type="button" class="btn continue-btn">Zpátky do arény</button>
      </div>`;
  }

  function showFight() {
    el.innerHTML = `
      <div class="panel">
        <h2>⚔️ Aréna: ${fight.hero.name} vs. ${fight.enemy.name}</h2>
        <div class="fight-area"></div>
        <div class="fight-result"></div>
      </div>`;
    stopFight = playFight(el.querySelector('.fight-area'), fight, {
      onDone: () => {
        stopFight = null;
        setCharacter(pendingCharacter);
        pendingCharacter = null;
        const box = el.querySelector('.fight-result');
        box.innerHTML = resultHtml();
        box.querySelector('.continue-btn').addEventListener('click', () => {
          fight = null;
          result = null;
          render();
        });
        box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      },
    });
  }

  async function challenge(index) {
    busy = true;
    errorText = '';
    render();
    try {
      const data = await api('/arena/fight', { method: 'POST', body: { index } });
      setState(data.arena);
      fight = data.fight;
      result = data.result;
      pendingCharacter = data.character;
      busy = false;
      showFight();
    } catch (err) {
      errorText = err.message;
      busy = false;
      render();
    }
  }

  // Odpočet čekací doby; po jeho vypršení se odemknou tlačítka
  function tick() {
    if (!state || fight) return;
    const countdown = el.querySelector('.arena-countdown');
    if (countdown) {
      if (remaining() > 0) countdown.textContent = formatTime(remaining());
      else render();
    }
  }

  async function load() {
    try {
      setState(await api('/arena'));
    } catch (err) {
      errorText = err.message;
    }
    render();
  }

  render();
  load();
  const timer = setInterval(tick, 250);

  return () => {
    clearInterval(timer);
    if (stopFight) stopFight();
    if (pendingCharacter) setCharacter(pendingCharacter);
  };
}
