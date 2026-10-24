import { api } from '../api.js';
import { getCharacter, setCharacter } from '../state.js';
import { SLOT_ORDER, SLOT_NAMES, itemSlotHtml, itemDetailHtml } from '../items.js';
import { escapeHtml } from '../format.js';

// Proč postava předmět nemůže nasadit (stejná pravidla ověřuje i server)
function equipProblem(c, item) {
  if (item.slot === 'shield' && c.class !== 'warrior') return 'Štít unese jen válečník.';
  if (item.slot === 'weapon' && item.class !== c.class) return `Tuhle zbraň umí používat jen ${item.className.toLowerCase()}.`;
  return null;
}

export default function profil(el) {
  let errorText = '';
  let busy = false;
  let selectedId = null;

  function findItem(c, id) {
    const equipped = Object.values(c.equipment).find((i) => i && i.id === id);
    if (equipped) return { item: equipped, equipped: true };
    const inInventory = c.inventory.find((i) => i.id === id);
    return inInventory ? { item: inInventory, equipped: false } : null;
  }

  function detailHtml(c) {
    const found = selectedId !== null && findItem(c, selectedId);
    if (!found) {
      return '<p class="hint">Klikni na předmět a uvidíš, co umí.</p>';
    }
    const { item, equipped } = found;
    const inventoryFull = c.inventory.length >= c.inventorySize;

    if (equipped) {
      return itemDetailHtml(item, {
        actions: [{ action: 'unequip', label: 'Sundat', disabled: busy || inventoryFull }],
        note: inventoryFull ? 'Inventář je plný, není kam to sundat.' : '',
      });
    }

    const problem = equipProblem(c, item);
    const current = c.equipment[item.slot];
    return `
      ${itemDetailHtml(item, {
        actions: [
          { action: 'equip', label: 'Nasadit', disabled: busy || Boolean(problem) },
          { action: 'sell', label: `Prodat za 💰 ${item.sellPrice}`, disabled: busy, secondary: true },
        ],
        note: problem || '',
      })}
      ${current ? `<div class="compare-label">Teď máš na sobě:</div>${itemDetailHtml(current)}` : ''}`;
  }

  function render() {
    const c = getCharacter();
    if (selectedId !== null && !findItem(c, selectedId)) selectedId = null;
    const xpPercent = Math.min(100, (c.xp / c.xpToNextLevel) * 100);
    const slots = SLOT_ORDER.filter((s) => s !== 'shield' || c.class === 'warrior');
    const emptyInventory = Math.max(0, c.inventorySize - c.inventory.length);

    el.innerHTML = `
      <div class="panel profile">
        <div class="profile-head">
          <div class="portrait">${c.avatar}</div>
          <div class="profile-info">
            <h2>${escapeHtml(c.name)}</h2>
            <div class="subtitle">${c.className} · úroveň ${c.level}</div>
            ${c.guild ? `<div class="subtitle"><a href="#/cech">${c.guild.emblem} ${escapeHtml(c.guild.name)}</a> · ${c.guild.roleName}</div>` : ''}
            <div class="xp-bar" title="${c.xp} / ${c.xpToNextLevel} XP">
              <div class="xp-fill" style="width: ${xpPercent}%"></div>
              <span>${c.xp} / ${c.xpToNextLevel} XP</span>
            </div>
            <div class="gold">💰 ${c.gold} zlaťáků</div>
          </div>
        </div>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>

        <div class="profile-columns">
          <div>
            <h3>Výbava</h3>
            <div class="equipment-grid">
              ${slots
                .map(
                  (slot) => `
                <div class="equipment-cell">
                  ${itemSlotHtml(c.equipment[slot], { selected: c.equipment[slot]?.id === selectedId })}
                  <small>${SLOT_NAMES[slot]}</small>
                </div>`
                )
                .join('')}
            </div>

            <h3>Inventář <small>(${c.inventory.length}/${c.inventorySize})</small></h3>
            <div class="inventory-grid">
              ${c.inventory.map((item) => itemSlotHtml(item, { selected: item.id === selectedId })).join('')}
              ${'<div class="item-slot empty"></div>'.repeat(emptyInventory)}
            </div>

            <div class="item-detail-box">${detailHtml(c)}</div>
          </div>

          <div>
            <h3>Atributy</h3>
            <table class="attr-table">
              ${Object.entries(c.attributes)
                .map(
                  ([key, a]) => `
                <tr class="${key === c.mainAttribute ? 'main' : ''}">
                  <td>${a.name}</td>
                  <td class="num" title="Vlastní ${a.value} + výbava ${a.bonus}">
                    ${a.total}${a.bonus ? `<small class="bonus"> (+${a.bonus})</small>` : ''}
                  </td>
                  <td class="cost">💰 ${a.upgradeCost}</td>
                  <td>
                    <button type="button" class="plus-btn" data-attr="${key}"
                      ${busy || c.gold < a.upgradeCost ? 'disabled' : ''}
                      title="Vylepšit za ${a.upgradeCost} zlaťáků">+</button>
                  </td>
                </tr>`
                )
                .join('')}
            </table>

            <h3>Bojové hodnoty</h3>
            <table class="attr-table stats">
              <tr><td>❤️ Životy</td><td class="num">${c.stats.hp}</td></tr>
              <tr><td>🗡️ Poškození</td><td class="num">${c.stats.damage.min}–${c.stats.damage.max}</td></tr>
              <tr><td>🍀 Kritický zásah</td><td class="num">${c.stats.critChance} %</td></tr>
              <tr title="Zbroj snižuje poškození od soupeře stejné úrovně, nejvýš o ${c.stats.maxArmorReduction} %">
                <td>🦺 Zbroj ${c.stats.armor}</td><td class="num">${c.stats.armorReduction ? `−${c.stats.armorReduction}` : 0} %</td>
              </tr>
              ${c.class === 'warrior' ? `<tr><td>🛡️ Vykrytí úderu${c.stats.blockChance ? '' : ' (chybí štít)'}</td><td class="num">${c.stats.blockChance} %</td></tr>` : ''}
              ${c.stats.evadeChance ? `<tr><td>💨 Uhnutí</td><td class="num">${c.stats.evadeChance} %</td></tr>` : ''}
              ${c.stats.unblockable ? '<tr><td>✨ Kouzla nejde vykrýt ani jim uhnout</td><td class="num">✔</td></tr>' : ''}
            </table>
          </div>
        </div>
      </div>
    `;

    el.querySelectorAll('.plus-btn').forEach((btn) =>
      btn.addEventListener('click', () => call('/character/upgrade', { attribute: btn.dataset.attr }))
    );
    el.querySelectorAll('[data-item-id]').forEach((btn) =>
      btn.addEventListener('click', () => {
        const id = Number(btn.dataset.itemId);
        selectedId = selectedId === id ? null : id;
        errorText = '';
        render();
      })
    );
    el.querySelectorAll('.item-detail-box [data-action]').forEach((btn) =>
      btn.addEventListener('click', () => call(`/inventory/${btn.dataset.action}`, { itemId: selectedId }))
    );
  }

  async function call(path, body) {
    busy = true;
    errorText = '';
    render();
    try {
      const { character } = await api(path, { method: 'POST', body });
      setCharacter(character);
    } catch (err) {
      errorText = err.message;
    }
    busy = false;
    render();
  }

  render();
}
