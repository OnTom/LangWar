import { api } from '../api.js';
import { setCharacter } from '../state.js';
import { itemNameHtml } from '../items.js';
import { escapeHtml } from '../format.js';

// Denní úkoly a truhla za splnění všech
export default function ukoly(el) {
  let daily = null;
  let errorText = '';
  let message = '';
  let busy = false;

  function render() {
    if (!daily) {
      el.innerHTML = `<div class="panel">${errorText ? `<p class="error">${escapeHtml(errorText)}</p>` : 'Hospodský čte vývěsku…'}</div>`;
      return;
    }
    const chest = daily.chest;
    el.innerHTML = `
      <div class="panel daily">
        <h2>📋 Denní úkoly</h2>
        <p class="intro">Na vývěsce u krčmy visí tři úkoly. O půlnoci je někdo strhne a pověsí nové.</p>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>
        ${message ? `<p class="daily-message">${message}</p>` : ''}

        <div class="daily-list">
          ${daily.tasks
            .map(
              (t) => `
            <div class="daily-task ${t.claimed ? 'claimed' : t.done ? 'done' : ''}">
              <span class="daily-icon">${t.icon}</span>
              <div class="daily-body">
                <strong>${t.text}</strong>
                <div class="bar daily-bar">
                  <div class="bar-fill" style="width: ${(t.progress / t.target) * 100}%"></div>
                  <span>${t.progress} / ${t.target}</span>
                </div>
                <small>Odměna: 💰 ${t.reward.gold} · ✨ ${t.reward.xp} XP</small>
              </div>
              ${
                t.claimed
                  ? '<span class="daily-state">✔ Vyzvednuto</span>'
                  : `<button type="button" class="btn btn-small claim-btn" data-slot="${t.slot}" ${t.done && !busy ? '' : 'disabled'}>Vyzvednout</button>`
              }
            </div>`
            )
            .join('')}
        </div>

        <div class="daily-chest ${chest.ready ? 'ready' : ''}">
          <span class="daily-icon">${chest.claimed ? '📭' : '🎁'}</span>
          <div class="daily-body">
            <strong>Truhla za všechny úkoly</strong>
            <small>${chest.claimed ? 'Dnes už otevřená. Zítra bude nová.' : 'Vyzvedni všechny tři úkoly a dostaneš předmět s vyšší šancí na vzácnost.'}</small>
          </div>
          ${chest.claimed ? '' : `<button type="button" class="btn btn-small chest-btn" ${chest.ready && !busy ? '' : 'disabled'}>Otevřít</button>`}
        </div>
      </div>`;

    el.querySelectorAll('.claim-btn').forEach((btn) =>
      btn.addEventListener('click', () => call('/daily/claim', { slot: Number(btn.dataset.slot) }))
    );
    el.querySelector('.chest-btn')?.addEventListener('click', () => call('/daily/chest'));
  }

  async function call(path, body) {
    busy = true;
    errorText = '';
    message = '';
    render();
    try {
      const data = await api(path, { method: 'POST', body });
      daily = data.daily;
      setCharacter(data.character);
      if (data.reward) {
        message = `Získal jsi 💰 ${data.reward.gold} a ✨ ${data.reward.xp} XP.${data.reward.levelsGained ? ' 🎉 Nová úroveň!' : ''}`;
      }
      if (data.chest) {
        message = data.chest.sold
          ? `V truhle jsi našel: ${itemNameHtml(data.chest.item)}. Inventář je ale plný, tak to šlo rovnou za 💰 ${data.chest.item.sellPrice} k obchodníkovi.`
          : `V truhle jsi našel: ${itemNameHtml(data.chest.item)}. Čeká v inventáři.`;
      }
    } catch (err) {
      errorText = err.message;
    }
    busy = false;
    render();
  }

  async function load() {
    try {
      const data = await api('/daily');
      daily = data.daily;
      setCharacter(data.character);
    } catch (err) {
      errorText = err.message;
    }
    render();
  }

  render();
  load();
}
