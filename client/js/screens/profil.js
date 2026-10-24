import { api } from '../api.js';
import { getCharacter, setCharacter } from '../state.js';

export default function profil(el) {
  let errorText = '';
  let busy = false;

  function render() {
    const c = getCharacter();
    const xpPercent = Math.min(100, (c.xp / c.xpToNextLevel) * 100);

    el.innerHTML = `
      <div class="panel profile">
        <div class="profile-head">
          <div class="portrait">${c.avatar}</div>
          <div class="profile-info">
            <h2>${c.name}</h2>
            <div class="subtitle">${c.className} · úroveň ${c.level}</div>
            <div class="xp-bar" title="${c.xp} / ${c.xpToNextLevel} XP">
              <div class="xp-fill" style="width: ${xpPercent}%"></div>
              <span>${c.xp} / ${c.xpToNextLevel} XP</span>
            </div>
            <div class="gold">💰 ${c.gold} zlaťáků</div>
          </div>
        </div>

        <h3>Atributy</h3>
        <table class="attr-table">
          ${Object.entries(c.attributes)
            .map(
              ([key, a]) => `
            <tr class="${key === c.mainAttribute ? 'main' : ''}">
              <td>${a.name}</td>
              <td class="num">${a.value}</td>
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
        <p class="error" role="alert">${errorText}</p>

        <h3>Bojové hodnoty</h3>
        <table class="attr-table stats">
          <tr><td>❤️ Životy</td><td class="num">${c.stats.hp}</td></tr>
          <tr><td>🗡️ Poškození</td><td class="num">${c.stats.damage.min}–${c.stats.damage.max}</td></tr>
          <tr><td>🍀 Kritický zásah</td><td class="num">${c.stats.critChance} %</td></tr>
        </table>
      </div>
    `;

    el.querySelectorAll('.plus-btn').forEach((btn) =>
      btn.addEventListener('click', () => upgrade(btn.dataset.attr))
    );
  }

  async function upgrade(attribute) {
    busy = true;
    errorText = '';
    render();
    try {
      const { character } = await api('/character/upgrade', {
        method: 'POST',
        body: { attribute },
      });
      setCharacter(character);
    } catch (err) {
      errorText = err.message;
    }
    busy = false;
    render();
  }

  render();
}
