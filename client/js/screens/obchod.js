import { api } from '../api.js';
import { getCharacter, setCharacter } from '../state.js';
import { itemSlotHtml, itemDetailHtml } from '../items.js';

// Obchod: zbrojíř a kouzelnice, nákup i prodej
export default function obchod(el) {
  let data = null;
  let current = 'smith';
  let selected = null; // { id, from: 'shop' | 'inventory' }
  let errorText = '';
  let busy = false;

  function selectedItem(c) {
    if (!selected) return null;
    const list = selected.from === 'shop' ? data.shops[current].items : c.inventory;
    return list.find((i) => i.id === selected.id) || null;
  }

  function detailHtml(c) {
    const item = selectedItem(c);
    if (!item) return '<p class="hint">Vyber předmět u obchodníka nebo ve svém inventáři.</p>';

    if (selected.from === 'shop') {
      const full = c.inventory.length >= c.inventorySize;
      const tooExpensive = c.gold < item.price;
      const same = c.equipment[item.slot];
      return `
        ${itemDetailHtml(item, {
          actions: [{ action: 'buy', label: `Koupit za 💰 ${item.price}`, disabled: busy || full || tooExpensive }],
          note: full ? 'Inventář je plný.' : tooExpensive ? 'Na tohle nemáš dost zlata.' : '',
        })}
        ${same ? `<div class="compare-label">Teď máš na sobě:</div>${itemDetailHtml(same)}` : ''}`;
    }
    return itemDetailHtml(item, {
      actions: [{ action: 'sell', label: `Prodat za 💰 ${item.sellPrice}`, disabled: busy }],
    });
  }

  function render() {
    if (!data) {
      el.innerHTML = `<div class="panel">${errorText ? `<p class="error">${errorText}</p>` : 'Obchodníci otevírají krámky…'}</div>`;
      return;
    }
    const c = getCharacter();
    if (selected && !selectedItem(c)) selected = null;
    const shop = data.shops[current];
    const emptyInventory = Math.max(0, c.inventorySize - c.inventory.length);

    el.innerHTML = `
      <div class="panel shop">
        <div class="tabs">
          ${Object.entries(data.shops)
            .map(([key, s]) => `<button type="button" data-shop="${key}" class="${key === current ? 'active' : ''}">${s.name}</button>`)
            .join('')}
        </div>
        <p class="intro">„${shop.greeting}“</p>

        <div class="shop-columns">
          <div>
            <h3>Zboží</h3>
            <div class="shop-grid">
              ${shop.items.map((i) => itemSlotHtml(i, { selected: selected?.from === 'shop' && selected.id === i.id })).join('')}
              ${'<div class="item-slot empty"><span>prodáno</span></div>'.repeat(Math.max(0, 6 - shop.items.length))}
            </div>
            <button type="button" class="btn btn-secondary btn-small refresh-btn" ${busy || c.gold < data.refreshCost ? 'disabled' : ''}>
              🔄 Nové zboží za 💰 ${data.refreshCost}
            </button>

            <h3>Tvůj inventář <small>(${c.inventory.length}/${c.inventorySize})</small></h3>
            <div class="inventory-grid">
              ${c.inventory.map((i) => itemSlotHtml(i, { selected: selected?.from === 'inventory' && selected.id === i.id })).join('')}
              ${'<div class="item-slot empty"></div>'.repeat(emptyInventory)}
            </div>
            <p class="hint">💰 ${c.gold} zlaťáků · nové zboží zdarma každý den o půlnoci</p>
          </div>
          <div>
            <p class="error" role="alert">${errorText}</p>
            <div class="item-detail-box">${detailHtml(c)}</div>
          </div>
        </div>
      </div>`;

    el.querySelectorAll('[data-shop]').forEach((btn) =>
      btn.addEventListener('click', () => {
        current = btn.dataset.shop;
        selected = null;
        errorText = '';
        render();
      })
    );
    el.querySelectorAll('.shop-grid [data-item-id]').forEach((btn) =>
      btn.addEventListener('click', () => select('shop', Number(btn.dataset.itemId)))
    );
    el.querySelectorAll('.inventory-grid [data-item-id]').forEach((btn) =>
      btn.addEventListener('click', () => select('inventory', Number(btn.dataset.itemId)))
    );
    el.querySelector('.refresh-btn').addEventListener('click', () => call('/shop/refresh', { shop: current }));
    el.querySelector('[data-action="buy"]')?.addEventListener('click', () => call('/shop/buy', { itemId: selected.id }));
    el.querySelector('[data-action="sell"]')?.addEventListener('click', () =>
      call('/inventory/sell', { itemId: selected.id })
    );
  }

  function select(from, id) {
    selected = selected?.from === from && selected.id === id ? null : { from, id };
    errorText = '';
    render();
  }

  async function call(path, body) {
    busy = true;
    errorText = '';
    render();
    try {
      const result = await api(path, { method: 'POST', body });
      if (result.shops) data = result;
      setCharacter(result.character);
    } catch (err) {
      errorText = err.message;
    }
    busy = false;
    render();
  }

  async function load() {
    try {
      data = await api('/shop');
      setCharacter(data.character);
    } catch (err) {
      errorText = err.message;
    }
    render();
  }

  render();
  load();
}
