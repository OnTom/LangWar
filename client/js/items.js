// Sdílené vykreslování předmětů (profil, obchod, krčma)

export const SLOT_ORDER = ['head', 'chest', 'hands', 'feet', 'weapon', 'shield', 'ring', 'amulet'];

export const SLOT_NAMES = {
  head: 'Hlava',
  chest: 'Tělo',
  hands: 'Ruce',
  feet: 'Nohy',
  weapon: 'Zbraň',
  shield: 'Štít',
  ring: 'Prsten',
  amulet: 'Amulet',
};

// Malý čtverec s ikonou předmětu (nebo prázdné místo)
export function itemSlotHtml(item, { emptyLabel = '', selected = false } = {}) {
  if (!item) {
    return `<div class="item-slot empty"><span>${emptyLabel}</span></div>`;
  }
  return `
    <button type="button" class="item-slot rarity-${item.rarity} ${selected ? 'selected' : ''}"
      data-item-id="${item.id}" title="${item.name}">
      ${item.icon}
    </button>`;
}

// Řádek s názvem pro seznamy (např. odměna v krčmě)
export function itemNameHtml(item) {
  return `<span class="item-name rarity-${item.rarity}">${item.icon} ${item.name}</span>`;
}

// Podrobnosti o předmětu; actions = [{ action, label, disabled }]
export function itemDetailHtml(item, { actions = [], note = '' } = {}) {
  const bonuses = Object.values(item.bonuses)
    .map((b) => `<li>+${b.value} ${b.name}</li>`)
    .join('');
  return `
    <div class="item-detail rarity-${item.rarity}">
      <div class="item-detail-head">
        <span class="item-detail-icon">${item.icon}</span>
        <div>
          <strong class="item-name rarity-${item.rarity}">${item.name}</strong>
          <div class="item-meta">${item.rarityName} · ${item.slotName} · úroveň ${item.level}</div>
          ${item.className ? `<div class="item-meta">Jen pro: ${item.className}</div>` : ''}
        </div>
      </div>
      <ul class="item-stats">
        ${item.damage ? `<li>🗡️ Poškození ${item.damage.min}–${item.damage.max}</li>` : ''}
        ${item.armor ? `<li>🛡️ Zbroj ${item.armor}</li>` : ''}
        ${bonuses}
      </ul>
      ${item.price !== undefined ? `<div class="item-price">Cena: 💰 ${item.price}</div>` : `<div class="item-meta">Výkupní cena: 💰 ${item.sellPrice}</div>`}
      ${note ? `<p class="item-note">${note}</p>` : ''}
      <div class="item-actions">
        ${actions
          .map(
            (a) => `<button type="button" class="btn btn-small ${a.secondary ? 'btn-secondary' : ''}"
              data-action="${a.action}" ${a.disabled ? 'disabled' : ''}>${a.label}</button>`
          )
          .join('')}
      </div>
    </div>`;
}
