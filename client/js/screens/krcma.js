import { api } from '../api.js';
import { setCharacter } from '../state.js';

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

// Krčma: nabídka questů, běžící výprava s odpočtem a odměny
export default function krcma(el) {
  let tavern = null;
  let result = null; // výsledek právě dokončené výpravy
  let errorText = '';
  let busy = false;
  let clockOffset = 0; // rozdíl hodin serveru a prohlížeče
  let timer = null;

  const serverNow = () => Date.now() + clockOffset;

  function setTavern(t) {
    tavern = t;
    clockOffset = t.serverNow - Date.now();
  }

  async function call(path, body) {
    busy = true;
    errorText = '';
    render();
    try {
      return await api(path, { method: 'POST', body });
    } catch (err) {
      errorText = err.message;
      return null;
    } finally {
      busy = false;
    }
  }

  async function start(slot) {
    const data = await call('/tavern/start', { slot });
    if (data) setTavern(data);
    render();
  }

  async function complete() {
    const data = await call('/tavern/complete');
    if (data) {
      setTavern(data.tavern);
      setCharacter(data.character);
      result = data.result;
    }
    render();
  }

  async function cancel() {
    if (!confirm('Opravdu chceš výpravu vzdát? Žízeň ti hospodský vrátí.')) return;
    const data = await call('/tavern/cancel');
    if (data) setTavern(data);
    render();
  }

  function thirstBar() {
    const minutes = Math.floor(tavern.thirst / 60);
    const percent = (tavern.thirst / tavern.thirstMax) * 100;
    return `
      <div class="thirst">
        <span>🍺 Žízeň</span>
        <div class="bar thirst-bar" title="Každá minuta výpravy stojí minutu žízně. Doplní se o půlnoci.">
          <div class="bar-fill" style="width: ${percent}%"></div>
          <span>${minutes} / ${tavern.thirstMax / 60} min</span>
        </div>
      </div>`;
  }

  function renderResult() {
    return `
      <div class="panel quest-result">
        <h2>🏆 Výprava splněna!</h2>
        <p><strong>${result.title}</strong></p>
        <p>Porazil jsi protivníka: <em>${result.monster}</em>.</p>
        <div class="rewards">
          <span>✨ +${result.xp} XP</span>
          <span>💰 +${result.gold} zlaťáků</span>
        </div>
        ${result.levelsGained > 0 ? '<p class="level-up">🎉 Nová úroveň! Bardi už skládají písně (špatné).</p>' : ''}
        <button type="button" class="btn continue-btn">Zpátky do krčmy</button>
      </div>`;
  }

  function renderActive() {
    const q = tavern.active;
    const total = q.endsAt - q.startedAt;
    const remaining = q.endsAt - serverNow();
    const done = remaining <= 0;
    const percent = Math.min(100, ((total - Math.max(0, remaining)) / total) * 100);

    return `
      <div class="panel">
        <h2>🗺️ Na výpravě</h2>
        <h3>${q.title}</h3>
        <p>${q.description}</p>
        <p class="monster">Na konci čeká: <strong>${q.monster}</strong></p>
        <div class="bar quest-bar">
          <div class="bar-fill" style="width: ${percent}%"></div>
          <span class="countdown">${done ? 'Hotovo!' : formatTime(remaining)}</span>
        </div>
        <div class="rewards">
          <span>✨ ${q.xp} XP</span>
          <span>💰 ${q.gold} zlaťáků</span>
        </div>
        <p class="error" role="alert">${errorText}</p>
        ${
          done
            ? `<button type="button" class="btn complete-btn" ${busy ? 'disabled' : ''}>Vyzvednout odměnu</button>`
            : `<button type="button" class="btn btn-secondary cancel-btn" ${busy ? 'disabled' : ''}>Vzdát výpravu</button>`
        }
      </div>`;
  }

  function renderOffers() {
    return `
      <div class="panel tavern">
        <h2>🍺 Krčma U Zlámané Halapartny</h2>
        <p class="intro">Hospodský si tě změří pohledem a vytáhne zpod pultu tři zmačkané papírky.</p>
        ${thirstBar()}
        <p class="error" role="alert">${errorText}</p>
        <div class="quest-list">
          ${tavern.offers
            .map((q) => {
              const affordable = tavern.thirst >= q.duration;
              return `
              <div class="quest-card">
                <h3>${q.title}</h3>
                <p>${q.description}</p>
                <div class="quest-meta">
                  <span>⏳ ${formatTime(q.duration * 1000)}</span>
                  <span>✨ ${q.xp} XP</span>
                  <span>💰 ${q.gold}</span>
                </div>
                <button type="button" class="btn start-btn" data-slot="${q.slot}"
                  ${busy || !affordable ? 'disabled' : ''}>
                  ${affordable ? 'Vyrazit' : 'Málo žízně'}
                </button>
              </div>`;
            })
            .join('')}
        </div>
      </div>`;
  }

  function render() {
    if (!tavern) {
      el.innerHTML = `<div class="panel">${errorText ? `<p class="error">${errorText}</p>` : 'Hospodský hledá papíry…'}</div>`;
      return;
    }
    if (result) {
      el.innerHTML = renderResult();
      el.querySelector('.continue-btn').addEventListener('click', () => {
        result = null;
        render();
      });
      return;
    }
    if (tavern.active) {
      el.innerHTML = renderActive();
      el.querySelector('.complete-btn')?.addEventListener('click', complete);
      el.querySelector('.cancel-btn')?.addEventListener('click', cancel);
      return;
    }
    el.innerHTML = renderOffers();
    el.querySelectorAll('.start-btn').forEach((btn) =>
      btn.addEventListener('click', () => start(Number(btn.dataset.slot)))
    );
  }

  // Každou sekundu překreslí odpočet; po doběhnutí jednou celé zobrazení
  function tick() {
    if (!tavern?.active || result) return;
    const q = tavern.active;
    const remaining = q.endsAt - serverNow();
    const countdown = el.querySelector('.countdown');
    const fill = el.querySelector('.quest-bar .bar-fill');
    if (remaining <= 0 && !el.querySelector('.complete-btn')) {
      render();
    } else if (countdown && remaining > 0) {
      const total = q.endsAt - q.startedAt;
      countdown.textContent = formatTime(remaining);
      fill.style.width = `${((total - remaining) / total) * 100}%`;
    }
  }

  async function load() {
    try {
      setTavern(await api('/tavern'));
    } catch (err) {
      errorText = err.message;
    }
    render();
  }

  render();
  load();
  timer = setInterval(tick, 250);

  // Úklid při odchodu z obrazovky
  return () => clearInterval(timer);
}
