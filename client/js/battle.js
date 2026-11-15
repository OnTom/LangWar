// Tahový souboj: hrdina vlevo, nepřítel vpravo, nahoře životy a mana.
// Hráč zvolí útok, splní úkol se slovíčkem a pak útočí nepřítel. Vše počítá server.
import { api } from './api.js';
import { escapeHtml } from './format.js';
import { itemNameHtml } from './items.js';
import { renderTask, resultHtml } from './lingo.js';

const STEP_MS = 650; // pauza mezi útokem hrdiny a odpovědí nepřítele

function barsHtml(side, f) {
  return `
    <div class="battle-bars battle-bars-${side}">
      <div class="battle-name">${f.boss ? '👑 ' : ''}${escapeHtml(f.name)} <small>úr. ${f.level}</small></div>
      <div class="bar hp-bar"><div class="bar-fill"></div><span></span></div>
      <div class="bar mana-bar"><div class="bar-fill"></div><span></span></div>
      <div class="battle-status"></div>
    </div>`;
}

// Stavy z kouzel (štít, posílení, omráčení, zmatení, jed) pod ukazateli
function statusHtml(f) {
  const chips = [];
  if (f.shield) chips.push(`🛡️ štít ${f.shield}`);
  if (f.empower) chips.push(`💪 +${f.empower.bonus} (${f.empower.attacks}×)`);
  if (f.stunned) chips.push('💫 omráčení');
  if (f.dazed) chips.push('😵 zmatení: méně času');
  if (f.poison) chips.push(`☠️ jed ${f.poison.perTurn} (${f.poison.turns}×)`);
  return chips.map((c) => `<span class="status-chip">${c}</span>`).join('');
}

const absorbedText = (e) => (e.absorbed ? ` (štít pohltil ${e.absorbed})` : '');

// Účinek kouzla slovy – z pohledu hrdiny (sesílá hrdina) nebo nepřítele
const SPELL_TEXT = {
  hero: {
    damage: (e) => `zásah za ${e.damage}${e.poison ? ` a jed (${e.poison.perTurn} za kolo)` : ''}${absorbedText(e)}`,
    heal: (e) => `léčí ${e.heal} životů`,
    shield: (e) => `štít pohltí ${e.shield} poškození`,
    stun: (e) => `nepřítel vynechá tah${e.damage ? ` a dostane ${e.damage}` : ''}`,
    buff: (e) => `další ${e.attacks} útoky silnější o ${e.bonus}`,
  },
  enemy: {
    damage: (e) => `zásah za ${e.damage}${e.poison ? ` a jed (${e.poison.perTurn} za kolo)` : ''}${absorbedText(e)}`,
    heal: (e) => `léčí se o ${e.heal} životů`,
    shield: (e) => `štít mu pohltí ${e.shield} poškození`,
    daze: (e) => `zmatení – příští úkol máš na méně času${e.damage ? `, zásah za ${e.damage}` : ''}`,
    buff: (e) => `jeho další ${e.attacks} útoky budou silnější o ${e.bonus}`,
  },
};

function describe(e, battle) {
  const action = battle.actions.find((a) => a.key === e.action) ?? { name: 'Útok', icon: '⚔️' };
  const enemy = battle.enemy.name;
  if (e.type === 'stunned') return `💫 Omráčení: ${enemy} vynechává tah.`;
  if (e.type === 'poison') return e.actor === 'hero' ? `☠️ Jed pálí nepřítele za ${e.damage}.` : `☠️ Jed tě pálí za ${e.damage}.`;
  if (e.actor === 'hero') {
    if (e.type === 'fizzle') return `💨 ${e.spell.icon} ${e.spell.name}: kouzlo selhalo (vráceno ${e.refund} many).`;
    if (e.type === 'spell') return `✨ ${e.spell.icon} ${e.spell.name} ${e.spell.rankName}: ${SPELL_TEXT.hero[e.effect](e)}.`;
    const bonus = e.bonus ? ` (posíleno +${e.bonus})` : '';
    if (e.type === 'miss') return `❌ ${action.name}: vedle – slovo nevyšlo.`;
    if (e.type === 'crit') return `💥 ${action.name}: kritický zásah za ${e.damage}${bonus}${absorbedText(e)}!`;
    return `${action.icon} ${action.name}: zásah za ${e.damage}${bonus}${absorbedText(e)}.`;
  }
  if (e.type === 'fizzle') return `💨 ${enemy}: ${e.spell.icon} ${e.spell.name} se nepovedlo.`;
  if (e.type === 'spell') return `🔮 ${enemy} sesílá ${e.spell.icon} ${e.spell.name} ${e.spell.rankName}: ${SPELL_TEXT.enemy[e.effect](e)}.`;
  if (e.type === 'evade') return `💨 Uhýbáš útoku.`;
  if (e.type === 'block') return `🛡️ Vykrýváš útok štítem.`;
  if (e.type === 'crit') return `💥 ${enemy} kriticky zasahuje za ${e.damage}${absorbedText(e)}!`;
  return `👊 ${enemy} útočí za ${e.damage}${absorbedText(e)}.`;
}

/**
 * Vykreslí souboj do el. onEnd(battle) se zavolá po konci (výhra, prohra, útěk),
 * onCharacter(character) když server pošle novou podobu postavy.
 * Vrací funkci pro úklid.
 */
export function showBattle(el, initial, { onEnd, onCharacter, onAgain, onLeave }) {
  let battle = initial;
  let stopTask = null;
  let alive = true;
  const timers = new Set();

  const wait = (ms) =>
    new Promise((resolve) => {
      const t = setTimeout(() => {
        timers.delete(t);
        resolve();
      }, ms);
      timers.add(t);
    });

  el.innerHTML = `
    <div class="panel battle">
      <div class="battle-top">
        ${barsHtml('hero', battle.hero)}
        <div class="battle-turn"></div>
        ${barsHtml('enemy', battle.enemy)}
      </div>
      ${
        battle.enemySpells?.length
          ? `<div class="enemy-spells">Nepřítel umí: ${battle.enemySpells
              .map((sp) => `<span title="${escapeHtml(sp.effect)}">${sp.icon} ${escapeHtml(sp.name)} ${sp.rankName}</span>`)
              .join(' · ')}</div>`
          : ''
      }
      <div class="battle-stage">
        <div class="battle-fighter battle-fighter-hero"><span class="fighter-avatar">${battle.hero.avatar}</span><span class="battle-float"></span></div>
        <div class="battle-location">${battle.location.icon} ${escapeHtml(battle.location.name)}</div>
        <div class="battle-fighter battle-fighter-enemy${battle.enemy.boss ? ' boss' : ''}"><span class="fighter-avatar">${battle.enemy.avatar}</span><span class="battle-float"></span></div>
      </div>
      <div class="battle-feedback"></div>
      <div class="battle-controls"></div>
      <p class="error" role="alert"></p>
      <ol class="fight-log battle-log"></ol>
      <button type="button" class="link-inline flee-btn">🏃 Utéct ze souboje</button>
    </div>`;

  const controls = el.querySelector('.battle-controls');
  const feedback = el.querySelector('.battle-feedback');
  const errorEl = el.querySelector('.error');
  const logEl = el.querySelector('.battle-log');
  const fleeBtn = el.querySelector('.flee-btn');

  function setBars(side, f) {
    const box = el.querySelector(`.battle-bars-${side}`);
    box.querySelector('.hp-bar .bar-fill').style.width = `${(f.hp / f.maxHp) * 100}%`;
    box.querySelector('.hp-bar span').textContent = `❤️ ${f.hp} / ${f.maxHp}`;
    box.querySelector('.mana-bar .bar-fill').style.width = `${f.maxMana ? (f.mana / f.maxMana) * 100 : 0}%`;
    box.querySelector('.mana-bar span').textContent = `💧 ${f.mana} / ${f.maxMana}`;
    box.querySelector('.battle-status').innerHTML = statusHtml(f);
  }

  function updateAll() {
    setBars('hero', battle.hero);
    setBars('enemy', battle.enemy);
    el.querySelector('.battle-turn').textContent = `Kolo ${battle.turn}`;
  }

  function addLog(e) {
    const li = document.createElement('li');
    li.className = `log-${e.actor} log-${e.type}`;
    li.textContent = describe(e, battle);
    logEl.prepend(li);
  }

  function float(side, text, cls, shake = false) {
    const box = el.querySelector(`.battle-fighter-${side}`);
    const f = box.querySelector('.battle-float');
    f.textContent = text;
    f.className = 'battle-float';
    void f.offsetWidth; // restart animace
    f.className = `battle-float show ${cls}`;
    if (shake) {
      box.classList.remove('hit');
      void box.offsetWidth;
      box.classList.add('hit');
    }
  }

  // Zásah, kouzlo, jed…: číslo nad bojovníkem a případně zatřesení
  function animate(e) {
    const self = e.actor; // kdo jedná
    const foe = self === 'hero' ? 'enemy' : 'hero';
    if (e.type === 'fizzle') return float(self, '💨 selhalo', 'miss');
    if (e.type === 'stunned') return float('enemy', '💫', 'miss');
    if (e.type === 'poison') return float(foe, `☠️ -${e.damage}`, 'poison', true);
    if (e.type === 'spell') {
      if (e.effect === 'heal') return float(self, `+${e.heal}`, 'heal');
      if (e.effect === 'shield') return float(self, `🛡️ ${e.shield}`, 'heal');
      if (e.effect === 'buff') return float(self, `💪 +${e.bonus}`, 'heal');
      const icon = e.effect === 'daze' ? '😵' : e.effect === 'stun' ? '💫' : '✨';
      return float(foe, e.damage ? `${icon} -${e.damage}` : icon, 'spell', e.damage > 0);
    }
    const text = e.damage > 0 ? `-${e.damage}` : e.absorbed ? '🛡️' : { miss: 'vedle', evade: 'uhnul', block: 'blok' }[e.type];
    float(foe, text, e.type, e.damage > 0);
  }

  function spellsHtml() {
    if (!battle.spells?.length) return '';
    return `
      <div class="battle-spells">
        ${battle.spells
          .map(
            (sp) => `
          <button type="button" class="btn battle-spell" data-action="${sp.key}" ${sp.available ? '' : 'disabled'}
            title="${escapeHtml(sp.effect)}">
            <span class="battle-action-icon">${sp.icon}</span>
            <strong>${escapeHtml(sp.name)} ${sp.rankName}</strong>
            <small>💧 ${sp.mana} · ${escapeHtml(sp.lessonName)}</small>
          </button>`
          )
          .join('')}
      </div>`;
  }

  function renderActions() {
    controls.innerHTML = `
      ${spellsHtml()}
      <div class="battle-actions">
        ${battle.actions
          .map(
            (a) => `
          <button type="button" class="btn battle-action" data-action="${a.key}" ${a.available ? '' : 'disabled'}>
            <span class="battle-action-icon">${a.icon}</span>
            <strong>${escapeHtml(a.name)}</strong>
            <small>${escapeHtml(a.taskName)} · ${a.timeLimit} s</small>
            <small>🇩🇪 ⇄ 🇨🇿 · síla ×${a.power}</small>
          </button>`
          )
          .join('')}
      </div>`;
    controls.querySelectorAll('[data-action]').forEach((b) =>
      b.addEventListener('click', () => choose(b.dataset.action))
    );
  }

  async function choose(action) {
    errorEl.textContent = '';
    controls.querySelectorAll('button').forEach((b) => (b.disabled = true));
    try {
      const data = await api('/battle/action', { method: 'POST', body: { action } });
      if (!alive) return;
      battle = data.battle;
      updateAll();
      show();
    } catch (err) {
      if (!alive) return;
      errorEl.textContent = err.message;
      renderActions();
    }
  }

  function renderPendingTask() {
    const spell = battle.spells?.find((sp) => sp.key === battle.pendingAction);
    const action = spell ?? battle.actions.find((a) => a.key === battle.pendingAction);
    const head = spell
      ? `${spell.icon} ${escapeHtml(spell.name)} ${spell.rankName} – splň cvičení a kouzlo se provede`
      : `${action.icon} ${escapeHtml(action.name)}`;
    controls.innerHTML = `<div class="battle-task-head">${head}</div><div class="battle-task"></div>`;
    feedback.innerHTML = '';
    fleeBtn.disabled = true;
    stopTask = renderTask(controls.querySelector('.battle-task'), battle.task, { onAnswer: answer });
  }

  async function answer(value) {
    try {
      const data = await api('/battle/answer', { method: 'POST', body: { answer: value } });
      if (!alive) return;
      stopTask?.();
      stopTask = null;
      controls.innerHTML = '';
      feedback.innerHTML = resultHtml(data.result);
      if (data.character) onCharacter?.(data.character);
      await playEvents(data.events, data.battle);
    } catch (err) {
      if (!alive) return;
      errorEl.textContent = err.message;
      // Stav mohl na serveru mezitím pokročit – načteme ho znovu
      const data = await api('/battle').catch(() => null);
      if (!alive) return;
      if (data?.battle) {
        battle = data.battle;
        updateAll();
        show();
      } else {
        onLeave?.();
      }
    }
  }

  // Přehraje kolo: nejdřív útok hrdiny, po chvilce nepřítele
  async function playEvents(events, next) {
    for (const [i, e] of events.entries()) {
      if (i > 0) await wait(STEP_MS);
      if (!alive) return;
      // Životy obou stran po události (kouzla mění i hrdinu: léčení, štít)
      battle.hero = { ...battle.hero, hp: e.heroHp ?? battle.hero.hp };
      battle.enemy = { ...battle.enemy, hp: e.enemyHp ?? battle.enemy.hp };
      if (e.actor === 'enemy') battle.enemy = { ...battle.enemy, mana: next.enemy.mana };
      setBars('hero', battle.hero);
      setBars('enemy', battle.enemy);
      animate(e);
      addLog(e);
    }
    battle = next;
    updateAll();
    show();
  }

  function rewardsHtml(r) {
    if (!r) return '';
    const parts = [];
    if (r.xp) parts.push(`<span>✨ +${r.xp} XP</span>`);
    if (r.gold) parts.push(`<span>💰 +${r.gold} zlaťáků</span>`);
    if (r.honorChange) parts.push(`<span>🏅 ${r.honorChange > 0 ? '+' : ''}${r.honorChange} cti</span>`);
    return `
      ${parts.length ? `<div class="rewards">${parts.join('')}</div>` : ''}
      ${r.item ? `<p class="reward-item">🎁 ${itemNameHtml(r.item)} ${r.itemSold ? `<br><small>Inventář byl plný, tak předmět rovnou putoval k obchodníkovi za 💰 ${r.item.sellPrice}.</small>` : '<small>je v inventáři</small>'}</p>` : ''}
      ${r.levelsGained > 0 ? '<p class="level-up">🎉 Nová úroveň! Bardi už skládají písně (špatné).</p>' : ''}`;
  }

  function renderEnd() {
    fleeBtn.hidden = true;
    const arena = battle.kind === 'arena';
    const title = arena
      ? {
          won: '🏆 Vítězství! Dav šílí a prodavač klobás dává slevu.',
          lost: '💀 Prohra! Publikum tleská – ale soupeři.',
          fled: '🏃 Útěk z arény! Dav píská, čest je fuč.',
        }[battle.status]
      : {
          won: battle.enemy.boss ? '👑 Boss poražen! Bardi o tom složí baladu.' : '🏆 Vítězství! Nepřítel leží na lopatkách.',
          lost: '💀 Porážka. Hrdina se probral v příkopu bez cti a bez bot.',
          fled: '🏃 Útěk! Nepřítel se posmívá, ale aspoň žiješ.',
        }[battle.status];
    controls.innerHTML = `
      <div class="battle-end battle-end-${battle.status}">
        <h3>${title}</h3>
        ${rewardsHtml(battle.rewards)}
        ${battle.bountiesDone.map((t) => `<p class="bounty-done">📜 Zakázka splněna: ${escapeHtml(t)} – odměna čeká v krčmě.</p>`).join('')}
        <div class="battle-end-actions">
          ${onAgain ? '<button type="button" class="btn again-btn">⚔️ Další souboj tady</button>' : ''}
          <button type="button" class="btn ${onAgain ? 'btn-secondary' : ''} leave-btn">${arena ? '← Zpět do arény' : '← Zpět na mapu'}</button>
        </div>
      </div>`;
    controls.querySelector('.again-btn')?.addEventListener('click', () => onAgain(battle.location.key));
    controls.querySelector('.leave-btn').addEventListener('click', () => onLeave?.());
    (controls.querySelector('.again-btn') ?? controls.querySelector('.leave-btn')).focus();
    onEnd?.(battle);
  }

  function show() {
    fleeBtn.disabled = false;
    if (battle.status !== 'active') return renderEnd();
    if (battle.task) return renderPendingTask();
    renderActions();
  }

  fleeBtn.addEventListener('click', async () => {
    const warning =
      battle.kind === 'arena'
        ? 'Opravdu utéct? V aréně se útěk počítá jako prohra.'
        : 'Opravdu utéct? Souboj skončí bez odměny a energie se nevrací.';
    if (!confirm(warning)) return;
    try {
      const data = await api('/battle/flee', { method: 'POST' });
      if (!alive) return;
      stopTask?.();
      battle = data.battle;
      if (data.character) onCharacter?.(data.character);
      show();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  for (const e of [...battle.log]) addLog(e);
  updateAll();
  show();

  return () => {
    alive = false;
    stopTask?.();
    timers.forEach(clearTimeout);
  };
}
