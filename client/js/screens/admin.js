import { api } from '../api.js';
import { setCharacter } from '../state.js';
import { escapeHtml, timeAgo } from '../format.js';

const KIND_NAMES = { attack: 'Útok', heal: 'Léčení', defense: 'Obrana', control: 'Kontrola', buff: 'Posílení' };

// Administrace pro testování hry. Server pustí jen adminy, tady jde hlavně o pohodlné ovládání.
export default function admin(el) {
  let data = null;
  let errorText = '';
  let message = '';
  let busy = false;
  let alive = true;

  const options = (map, selected = '') =>
    Object.entries(map)
      .map(([key, name]) => `<option value="${key}" ${key === selected ? 'selected' : ''}>${escapeHtml(name)}</option>`)
      .join('');

  function render() {
    if (!data) {
      el.innerHTML = `<div class="panel">${errorText ? `<p class="error">${escapeHtml(errorText)}</p>` : 'Načítám administraci…'}</div>`;
      return;
    }
    const c = data.character;
    const dis = busy ? 'disabled' : '';
    el.innerHTML = `
      <div class="panel admin">
        <h2>🛠️ Administrace</h2>
        <p class="intro">Pomůcky pro testování. Každá akce se zapíše do záznamu dole. Hráči tuhle stránku nevidí.</p>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>
        ${message ? `<p class="daily-message">${escapeHtml(message)}</p>` : ''}
        ${
          !c
            ? '<p>Nemáš postavu. <a href="#/profil">Vytvoř si ji</a>.</p>'
            : `
        <div class="admin-grid">
          <section class="admin-box">
            <h3>🧙 Postava</h3>
            <p>${c.avatar} <strong>${escapeHtml(c.name)}</strong> · ${escapeHtml(c.className)} · úroveň ${c.level} · 💰 ${c.gold} · ⚡ ${data.energy}/${data.energyMax}</p>
            <form data-form="level" class="admin-row">
              <label>Úroveň <input name="level" type="number" min="1" max="100" value="${c.level}"></label>
              <button class="btn btn-small" ${dis}>Nastavit</button>
            </form>
            <form data-form="gold" class="admin-row">
              <label>Zlato <input name="amount" type="number" value="1000"></label>
              <button class="btn btn-small" ${dis}>Přidat</button>
            </form>
            <form data-form="energy" class="admin-row">
              <label>Energie <input name="energy" type="number" min="0" max="999" value="${data.energyMax}"></label>
              <button class="btn btn-small" ${dis}>Nastavit</button>
            </form>
            <div class="admin-row"><button type="button" class="btn btn-small btn-secondary" data-post="arena-ready" ${dis}>⚔️ Aréna bez čekání</button></div>
          </section>

          <section class="admin-box">
            <h3>💪 Atributy (vlastní body)</h3>
            <form data-form="attributes" class="admin-attrs">
              ${Object.entries(data.attributes)
                .map(
                  ([key, name]) =>
                    `<label>${escapeHtml(name)} <input name="${key}" type="number" min="1" max="999" value="${c.attributes[key].value}"></label>`
                )
                .join('')}
              <button class="btn btn-small" ${dis}>Uložit atributy</button>
            </form>
          </section>

          <section class="admin-box">
            <h3>🎁 Předmět do inventáře</h3>
            <form data-form="item" class="admin-attrs">
              <label>Slot <select name="slot"><option value="">náhodný</option>${options(data.slots)}</select></label>
              <label>Rarita <select name="rarity"><option value="">náhodná</option>${options(data.rarities)}</select></label>
              <label>Úroveň <input name="level" type="number" min="1" max="100" value="${c.level}"></label>
              <button class="btn btn-small" ${dis}>Vytvořit</button>
            </form>
            <p class="hint">Inventář: ${c.inventory.length} / ${c.inventorySize}</p>
          </section>

          <section class="admin-box">
            <h3>🗺️ Výprava a souboj</h3>
            <form data-form="boss" class="admin-row">
              <label>Lokace <select name="location">${data.locations
                .map((l) => `<option value="${l.key}">${l.icon} ${escapeHtml(l.name)} (úr. ${l.level}, boss ${l.bossCharge}/${data.bossWinsRequired})</option>`)
                .join('')}</select></label>
              <button class="btn btn-small" ${dis}>👑 Boss připraven</button>
            </form>
            <p class="hint">Lokace se odemykají úrovní – stačí nastavit úroveň výš.</p>
            <div class="admin-row">
              <button type="button" class="btn btn-small" data-post="battle" data-body='{"action":"weaken"}' ${dis || !data.activeBattle ? 'disabled' : ''}>Nepříteli 1 život</button>
              <button type="button" class="btn btn-small btn-secondary" data-post="battle" data-body='{"action":"end"}' ${dis || !data.activeBattle ? 'disabled' : ''}>Ukončit souboj bez následků</button>
            </div>
            ${data.activeBattle ? '' : '<p class="hint">Teď neprobíhá žádný souboj.</p>'}
            <label class="admin-check">
              <input type="checkbox" class="answers-toggle" ${data.showAnswers ? 'checked' : ''} ${dis}>
              Ukazovat správné odpovědi v úkolech (souboj, aréna, Slovníček)
            </label>
          </section>

          <section class="admin-box">
            <h3>🍺 Krčma</h3>
            <div class="admin-row">
              <button type="button" class="btn btn-small" data-post="bounties" data-body='{"action":"complete"}' ${dis}>Splnit zakázky</button>
              <button type="button" class="btn btn-small btn-secondary" data-post="bounties" data-body='{"action":"reset"}' ${dis}>Nové zakázky</button>
            </div>
            <div class="admin-row">
              <button type="button" class="btn btn-small" data-post="daily" data-body='{"action":"complete"}' ${dis}>Splnit denní úkoly</button>
              <button type="button" class="btn btn-small btn-secondary" data-post="daily" data-body='{"action":"reset"}' ${dis}>Nové denní úkoly a truhla</button>
            </div>
          </section>

          <section class="admin-box">
            <h3>📖 Kouzla a knihovna</h3>
            <form data-form="library" class="admin-row">
              <input type="hidden" name="action" value="learn">
              <label>Lekce <select name="lesson">${data.lessons
                .filter((l) => l.ready)
                .map((l) => `<option value="${l.key}">${l.order}. ${escapeHtml(l.name)}</option>`)
                .join('')}</select></label>
              <button class="btn btn-small" ${dis}>Naučit bez zkoušky</button>
            </form>
            <div class="admin-row">
              <button type="button" class="btn btn-small" data-post="library" data-body='{"action":"learn-all"}' ${dis}>Naučit všechny hotové</button>
              <button type="button" class="btn btn-small btn-secondary" data-post="library" data-body='{"action":"forget"}' ${dis}>Zapomenout vše</button>
            </div>
            <p class="hint">Umí: ${
              Object.entries(data.spellRanks)
                .map(([kind, rank]) => `${KIND_NAMES[kind]} ${'I'.repeat(rank)}`)
                .join(', ') || 'zatím nic'
            }</p>
          </section>

          <section class="admin-box danger">
            <h3>⚠️ Začít znovu</h3>
            <p class="hint">Smaže postavu i s výbavou a postupem. Účet zůstane a hned si založíš novou.</p>
            <button type="button" class="btn btn-small reset-btn" ${dis}>Smazat postavu</button>
          </section>
        </div>`
        }

        <h3>📜 Záznam akcí</h3>
        ${
          data.log.length
            ? `<ul class="admin-log">${data.log
                .map((l) => `<li><strong>${escapeHtml(l.admin ?? '?')}</strong>: ${escapeHtml(l.action)}${l.details ? ` – ${escapeHtml(l.details)}` : ''} <small>${timeAgo(l.at)}</small></li>`)
                .join('')}</ul>`
            : '<p class="hint">Zatím nic.</p>'
        }
      </div>`;

    el.querySelectorAll('form[data-form]').forEach((form) =>
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const body = {};
        for (const [key, value] of new FormData(form)) if (value !== '') body[key] = form.elements[key].type === 'number' ? Number(value) : value;
        call(form.dataset.form, body);
      })
    );
    el.querySelectorAll('[data-post]').forEach((b) =>
      b.addEventListener('click', () => call(b.dataset.post, b.dataset.body ? JSON.parse(b.dataset.body) : {}))
    );
    el.querySelector('.answers-toggle')?.addEventListener('change', (e) => call('answers', { enabled: e.target.checked }));
    el.querySelector('.reset-btn')?.addEventListener('click', async () => {
      if (!confirm('Opravdu smazat postavu? Tohle nejde vrátit.')) return;
      await call('reset-character');
      if (!errorText) {
        location.hash = '';
        location.reload();
      }
    });
  }

  async function call(path, body = {}) {
    busy = true;
    errorText = '';
    message = '';
    render();
    try {
      const res = await api(`/admin/${path}`, { method: 'POST', body });
      if (!alive) return;
      data = res;
      message = res.message;
      if (res.character) setCharacter(res.character);
    } catch (err) {
      errorText = err.message;
    }
    busy = false;
    if (alive) render();
  }

  async function load() {
    try {
      data = await api('/admin');
    } catch (err) {
      errorText = err.message;
    }
    if (alive) render();
  }

  render();
  load();
  return () => {
    alive = false;
  };
}
