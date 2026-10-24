import { api } from '../api.js';
import { setCharacter } from '../state.js';

// Vytvoření postavy: výběr třídy a obličeje
export default async function vytvoreni(el, { onCreated }) {
  el.innerHTML = '<div class="panel">Načítám šatník…</div>';
  const { classes, avatars, attributes } = await api('/character/options');

  let selectedClass = Object.keys(classes)[0];
  let selectedAvatar = avatars[0];

  el.innerHTML = `
    <div class="panel create-panel">
      <h2>Stvoř svého hrdinu</h2>
      <p class="intro">Vyber si povolání. Rodiče by chtěli účetního, ale to tu nemáme.</p>

      <h3>Povolání</h3>
      <div class="class-list">
        ${Object.entries(classes)
          .map(
            ([key, c]) => `
          <button type="button" class="choice class-card" data-class="${key}">
            <span class="class-icon">${c.icon}</span>
            <strong>${c.name}</strong>
            <small>${c.description}</small>
            <span class="main-attr">Hlavní atribut: ${attributes[c.mainAttribute].name}</span>
          </button>`
          )
          .join('')}
      </div>

      <h3>Vzhled</h3>
      <div class="avatar-list">
        ${avatars
          .map((a) => `<button type="button" class="choice avatar-choice" data-avatar="${a}">${a}</button>`)
          .join('')}
      </div>

      <h3>Počáteční atributy</h3>
      <table class="attr-table base-attrs"></table>

      <p class="error" role="alert"></p>
      <button type="button" class="btn create-btn">Vyrazit do světa</button>
    </div>
  `;

  const baseTable = el.querySelector('.base-attrs');
  const errorEl = el.querySelector('.error');
  const createBtn = el.querySelector('.create-btn');

  function update() {
    el.querySelectorAll('.class-card').forEach((b) =>
      b.classList.toggle('selected', b.dataset.class === selectedClass)
    );
    el.querySelectorAll('.avatar-choice').forEach((b) =>
      b.classList.toggle('selected', b.dataset.avatar === selectedAvatar)
    );
    const cls = classes[selectedClass];
    baseTable.innerHTML = Object.entries(attributes)
      .map(
        ([key, a]) => `
        <tr class="${key === cls.mainAttribute ? 'main' : ''}">
          <td>${a.name}</td><td class="num">${cls.base[key]}</td>
        </tr>`
      )
      .join('');
  }

  el.querySelectorAll('.class-card').forEach((b) =>
    b.addEventListener('click', () => {
      selectedClass = b.dataset.class;
      update();
    })
  );
  el.querySelectorAll('.avatar-choice').forEach((b) =>
    b.addEventListener('click', () => {
      selectedAvatar = b.dataset.avatar;
      update();
    })
  );

  createBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    createBtn.disabled = true;
    try {
      const { character } = await api('/character', {
        method: 'POST',
        body: { class: selectedClass, avatar: selectedAvatar },
      });
      setCharacter(character);
      onCreated();
    } catch (err) {
      errorEl.textContent = err.message;
      createBtn.disabled = false;
    }
  });

  update();
}
