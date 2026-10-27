import { api } from '../api.js';
import { setCharacter } from '../state.js';
import { showBattle } from '../battle.js';
import { formatTime, timeAgo, escapeHtml } from '../format.js';

// Aréna: souboje s ostatními hráči (a NPC gladiátory) o čest a zlato
export default function arena(el) {
  let state = null;
  let errorText = '';
  let busy = false;
  let clockOffset = 0;
  let stopBattle = null; // probíhající tahový souboj

  const serverNow = () => Date.now() + clockOffset;

  function setState(s) {
    state = s;
    clockOffset = s.serverNow - Date.now();
  }

  const remaining = () => (state ? state.readyAt - serverNow() : 0);

  function statusHtml() {
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
                ? `⚔️ Výzva: ${h.opponentAvatar} <strong>${escapeHtml(h.opponentName)}</strong> – ${h.won ? 'výhra' : 'prohra'}`
                : `🛡️ Obrana proti ${h.opponentAvatar} <strong>${escapeHtml(h.opponentName)}</strong> – ${h.won ? 'výhra' : 'prohra'}`;
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
      el.innerHTML = `<div class="panel">${errorText ? `<p class="error">${escapeHtml(errorText)}</p>` : 'Gladiátoři se rozcvičují…'}</div>`;
      return;
    }
    const canFight = !busy && !state.busyElsewhere && remaining() <= 0;

    el.innerHTML = `
      <div class="panel arena">
        <h2>⚔️ Aréna</h2>
        <p class="intro">Dav řve, prodavač klobás křičí ještě hlasitěji. Vyber si soupeře – i tady je každý útok úkol se slovíčkem. Za soupeře bojuje počítač podle jeho atributů a výbavy.</p>
        ${state.busyElsewhere ? '<p class="arena-status">🗺️ Právě bojuješ na výpravě. Nejdřív dobojuj tam.</p>' : ''}
        <div class="arena-stats">
          <span>🏅 Čest: <strong>${state.honor}</strong></span>
          <span>📜 Pořadí: <strong>#${state.rank}</strong></span>
          <a href="#/slava">🏆 Síň slávy</a>
        </div>
        ${statusHtml()}
        <p class="hint">✨ Bonus: ještě ${state.xpWinsLeft} z ${state.xpWinsMax} dnešních výher dá navíc ${state.xpPerWin} XP.</p>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>

        <div class="opponent-list">
          ${state.opponents
            .map(
              (o) => `
            <div class="opponent-card opponent-${o.type}">
              <div class="opponent-avatar">${o.avatar}</div>
              <strong>${escapeHtml(o.name)}</strong>
              <small>${o.className} · úroveň ${o.level}</small>
              <div class="opponent-honor">${o.type === 'npc' ? '🤖 NPC gladiátor' : `🏅 ${o.honor} cti`}</div>
              <button type="button" class="btn fight-btn" data-index="${o.index}" ${canFight ? '' : 'disabled'}>Vyzvat</button>
            </div>`
            )
            .join('')}
        </div>
        <p class="hint">Za výhru nad hráčem získáš zlato a čest, kterou mu vezmeš. NPC gladiátoři dají jen polovinu zlata a žádnou čest. Útěk se počítá jako prohra. Slovíčka jsou ze všech odemčených lokací.</p>

        <h3>Poslední souboje</h3>
        ${historyHtml()}
      </div>`;

    el.querySelectorAll('.fight-btn').forEach((btn) =>
      btn.addEventListener('click', () => challenge(Number(btn.dataset.index)))
    );
  }

  function showArenaBattle(battle) {
    stopBattle = showBattle(el, battle, {
      onCharacter: setCharacter,
      onLeave: () => {
        stopBattle?.();
        stopBattle = null;
        load();
      },
    });
  }

  async function challenge(index) {
    busy = true;
    errorText = '';
    render();
    try {
      const data = await api('/arena/fight', { method: 'POST', body: { index } });
      busy = false;
      showArenaBattle(data.battle);
    } catch (err) {
      errorText = err.message;
      busy = false;
      await load();
    }
  }

  // Odpočet čekací doby; po jeho vypršení se odemknou tlačítka
  function tick() {
    if (!state || stopBattle) return;
    const countdown = el.querySelector('.arena-countdown');
    if (countdown) {
      if (remaining() > 0) countdown.textContent = formatTime(remaining());
      else render();
    }
  }

  async function load() {
    try {
      const data = await api('/arena');
      setState(data);
      // Rozehraný souboj v aréně (např. po obnovení stránky) pokračuje
      if (data.battle) return showArenaBattle(data.battle);
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
    stopBattle?.();
  };
}
