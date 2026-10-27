import { api } from '../api.js';
import { setCharacter } from '../state.js';
import { itemNameHtml } from '../items.js';
import { escapeHtml } from '../format.js';

// Krčma: zakázky od hospodského a denní úkoly na vývěsce. Bojuje se na Výpravě.
export default function krcma(el) {
  let data = null; // { bounties, swapCost, daily, character }
  let errorText = '';
  let message = '';
  let busy = false;
  let alive = true;

  function rewardText(r) {
    let text = `Odměna: 💰 ${r.gold} a ✨ ${r.xp} XP.`;
    if (r.item) {
      text += r.itemSold
        ? ` Inventář je plný, tak ${itemNameHtml(r.item)} šlo rovnou k obchodníkovi (už je v odměně).`
        : ` A navrch ${itemNameHtml(r.item)} – čeká v inventáři.`;
    }
    if (r.levelsGained) text += ' 🎉 Nová úroveň!';
    return text;
  }

  function bountiesHtml() {
    return `
      <div class="quest-list bounty-list">
        ${data.bounties
          .map(
            (b) => `
          <div class="quest-card bounty ${b.done ? 'done' : ''}">
            <h3>${escapeHtml(b.text)}</h3>
            <p>${escapeHtml(b.flavor)}</p>
            <div class="bar daily-bar"><div class="bar-fill" style="width: ${(b.progress / b.target) * 100}%"></div><span>${b.progress} / ${b.target}</span></div>
            <div class="rewards bounty-rewards">
              <span>✨ ${b.xp} XP</span><span>💰 ${b.gold}</span>${b.item ? '<span title="Navíc předmět">🎁 předmět</span>' : ''}
            </div>
            ${
              b.done
                ? `<button type="button" class="btn claim-bounty" data-slot="${b.slot}" ${busy ? 'disabled' : ''}>Vyzvednout odměnu</button>`
                : `<div class="bounty-actions">
                    ${b.location ? `<a class="btn btn-small" href="#/vyprava">🗺️ Na výpravu</a>` : ''}
                    <button type="button" class="btn btn-small btn-secondary swap-bounty" data-slot="${b.slot}" ${busy ? 'disabled' : ''}
                      title="Hospodský ti dá jinou zakázku">🔄 Jinou (💰 ${data.swapCost})</button>
                  </div>`
            }
          </div>`
          )
          .join('')}
      </div>`;
  }

  function dailyHtml() {
    const { tasks, chest } = data.daily;
    return `
      <div class="daily-list">
        ${tasks
          .map(
            (t) => `
          <div class="daily-task ${t.claimed ? 'claimed' : t.done ? 'done' : ''}">
            <span class="daily-icon">${t.icon}</span>
            <div class="daily-body">
              <strong>${t.text}</strong>
              <div class="bar daily-bar"><div class="bar-fill" style="width: ${(t.progress / t.target) * 100}%"></div><span>${t.progress} / ${t.target}</span></div>
              <small>Odměna: 💰 ${t.reward.gold} · ✨ ${t.reward.xp} XP</small>
            </div>
            ${
              t.claimed
                ? '<span class="daily-state">✔ Vyzvednuto</span>'
                : `<button type="button" class="btn btn-small claim-daily" data-slot="${t.slot}" ${t.done && !busy ? '' : 'disabled'}>Vyzvednout</button>`
            }
          </div>`
          )
          .join('')}
      </div>
      <div class="daily-chest ${chest.ready ? 'ready' : ''}">
        <span class="daily-icon">${chest.claimed ? '📭' : '🎁'}</span>
        <div class="daily-body">
          <strong>Truhla za všechny denní úkoly</strong>
          <small>${chest.claimed ? 'Dnes už otevřená. Zítra bude nová.' : 'Vyzvedni všechny tři úkoly a dostaneš předmět s vyšší šancí na vzácnost.'}</small>
        </div>
        ${chest.claimed ? '' : `<button type="button" class="btn btn-small chest-btn" ${chest.ready && !busy ? '' : 'disabled'}>Otevřít</button>`}
      </div>`;
  }

  function render() {
    if (!data) {
      el.innerHTML = `<div class="panel">${errorText ? `<p class="error">${escapeHtml(errorText)}</p>` : 'Hospodský leští korbely…'}</div>`;
      return;
    }
    const c = data.character;
    el.innerHTML = `
      <div class="panel tavern">
        <h2>🍺 Krčma U Opilého goblina</h2>
        <p class="intro">Hospodský tu rozdává zakázky a na vývěsce visí denní úkoly. Bojovat se chodí na výpravu.</p>
        <div class="energy">
          <span>⚡ Energie</span>
          <div class="bar energy-bar"><div class="bar-fill" style="width: ${(c.energy / c.energyMax) * 100}%"></div><span>${c.energy} / ${c.energyMax}</span></div>
        </div>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>
        ${message ? `<p class="daily-message">${message}</p>` : ''}

        <h3 class="section-title">📜 Zakázky hospodského</h3>
        ${bountiesHtml()}

        <h3 class="section-title">📋 Denní úkoly</h3>
        <p class="intro">O půlnoci je někdo strhne a pověsí nové.</p>
        ${dailyHtml()}
      </div>`;

    el.querySelectorAll('.claim-bounty').forEach((b) =>
      b.addEventListener('click', () => call('/tavern/claim', { slot: Number(b.dataset.slot) }))
    );
    el.querySelectorAll('.swap-bounty').forEach((b) =>
      b.addEventListener('click', () => call('/tavern/swap', { slot: Number(b.dataset.slot) }))
    );
    el.querySelectorAll('.claim-daily').forEach((b) =>
      b.addEventListener('click', () => call('/daily/claim', { slot: Number(b.dataset.slot) }))
    );
    el.querySelector('.chest-btn')?.addEventListener('click', () => call('/daily/chest'));
  }

  // Denní úkoly vrací jen { daily, character } – zbytek krčmy si pak načteme znovu
  async function call(path, body) {
    busy = true;
    errorText = '';
    message = '';
    render();
    try {
      const res = await api(path, { method: 'POST', body });
      if (!alive) return;
      if (res.reward && path === '/tavern/claim') message = `📜 Zakázka splněna! ${rewardText(res.reward)}`;
      if (res.reward && path === '/daily/claim') message = rewardText(res.reward);
      if (res.chest) {
        message = res.chest.sold
          ? `V truhle byl ${itemNameHtml(res.chest.item)}. Inventář je ale plný, tak to šlo rovnou za 💰 ${res.chest.item.sellPrice} k obchodníkovi.`
          : `V truhle byl ${itemNameHtml(res.chest.item)}. Čeká v inventáři.`;
      }
      await load();
    } catch (err) {
      if (!alive) return;
      errorText = err.message;
    }
    busy = false;
    render();
  }

  async function load() {
    try {
      const res = await api('/tavern');
      if (!alive) return;
      data = res;
      setCharacter(res.character);
    } catch (err) {
      errorText = err.message;
    }
    render();
  }

  render();
  load();
  return () => {
    alive = false;
  };
}
