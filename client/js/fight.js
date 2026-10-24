// Přehrání souboje ze záznamu, který spočítal server.
// Použije se pro questy i (později) pro arénu.

const STEP_MS = 700;

function fighterHtml(side, f) {
  return `
    <div class="fighter fighter-${side}">
      <div class="fighter-avatar">${f.avatar}</div>
      <div class="fighter-name">${f.name}</div>
      <div class="fighter-level">úroveň ${f.level}</div>
      <div class="bar hp-bar">
        <div class="bar-fill" style="width: 100%"></div>
        <span>${f.maxHp} / ${f.maxHp}</span>
      </div>
    </div>`;
}

function describe(e, names) {
  const attacker = names[e.attacker];
  const defender = names[e.attacker === 'hero' ? 'enemy' : 'hero'];
  switch (e.type) {
    case 'crit':
      return `💥 ${attacker} zasahuje kriticky za ${e.damage}!`;
    case 'evade':
      return `💨 ${defender} uhýbá.`;
    case 'block':
      return `🛡️ ${defender} vykrývá úder.`;
    default:
      return `🗡️ ${attacker} zasahuje za ${e.damage}.`;
  }
}

// Vrací funkci pro úklid (zastaví přehrávání)
export function playFight(el, fight, { onDone }) {
  const names = { hero: fight.hero.name, enemy: fight.enemy.name };
  const maxHp = { hero: fight.hero.maxHp, enemy: fight.enemy.maxHp };

  el.innerHTML = `
    <div class="fight">
      <div class="fighters">
        ${fighterHtml('hero', fight.hero)}
        <div class="vs">VS</div>
        ${fighterHtml('enemy', fight.enemy)}
      </div>
      <ol class="fight-log"></ol>
      <button type="button" class="btn btn-secondary skip-btn">Přeskočit souboj</button>
    </div>`;

  const logEl = el.querySelector('.fight-log');
  const skipBtn = el.querySelector('.skip-btn');
  let index = 0;
  let timer = null;

  function setHp(side, hp) {
    const box = el.querySelector(`.fighter-${side}`);
    box.querySelector('.bar-fill').style.width = `${(hp / maxHp[side]) * 100}%`;
    box.querySelector('.bar span').textContent = `${hp} / ${maxHp[side]}`;
  }

  function show(e, animate) {
    const defender = e.attacker === 'hero' ? 'enemy' : 'hero';
    setHp(defender, e.hpLeft);

    const li = document.createElement('li');
    li.className = `log-${e.attacker} log-${e.type}`;
    li.textContent = describe(e, names);
    logEl.prepend(li);

    if (animate && e.damage > 0) {
      const box = el.querySelector(`.fighter-${defender}`);
      box.classList.remove('hit');
      void box.offsetWidth; // restart animace
      box.classList.add('hit');
    }
  }

  function finish() {
    clearInterval(timer);
    timer = null;
    skipBtn.remove();
    onDone();
  }

  function step() {
    show(fight.log[index++], true);
    if (index >= fight.log.length) finish();
  }

  skipBtn.addEventListener('click', () => {
    while (index < fight.log.length) show(fight.log[index++], false);
    finish();
  });

  timer = setInterval(step, STEP_MS);

  return () => clearInterval(timer);
}
