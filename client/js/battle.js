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
    </div>`;
}

function describe(e, battle) {
  const action = battle.actions.find((a) => a.key === e.action);
  if (e.actor === 'hero') {
    if (e.type === 'miss') return `❌ ${action.name}: vedle – slovo nevyšlo.`;
    if (e.type === 'crit') return `💥 ${action.name}: kritický zásah za ${e.damage}!`;
    return `${action.icon} ${action.name}: zásah za ${e.damage}.`;
  }
  const enemy = battle.enemy.name;
  if (e.type === 'evade') return `💨 Uhýbáš útoku.`;
  if (e.type === 'block') return `🛡️ Vykrýváš útok štítem.`;
  const spell = e.action === 'spell';
  if (e.type === 'crit') return `💥 ${enemy} ${spell ? 'sesílá ničivé kouzlo' : 'kriticky zasahuje'} za ${e.damage}!`;
  return spell ? `🔥 ${enemy} sesílá kouzlo za ${e.damage}.` : `👊 ${enemy} útočí za ${e.damage}.`;
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

  // Zásah: zatřese obráncem a ukáže číslo
  function animate(e) {
    const target = e.actor === 'hero' ? 'enemy' : 'hero';
    const box = el.querySelector(`.battle-fighter-${target}`);
    const float = box.querySelector('.battle-float');
    float.textContent = e.damage > 0 ? `-${e.damage}` : { miss: 'vedle', evade: 'uhnul', block: 'blok' }[e.type];
    float.className = `battle-float show ${e.type}`;
    if (e.damage > 0) {
      box.classList.remove('hit');
      void box.offsetWidth; // restart animace
      box.classList.add('hit');
    }
  }

  function renderActions() {
    controls.innerHTML = `
      <div class="battle-actions">
        ${battle.actions
          .map(
            (a) => `
          <button type="button" class="btn battle-action" data-action="${a.key}" ${a.available ? '' : 'disabled'}>
            <span class="battle-action-icon">${a.icon}</span>
            <strong>${escapeHtml(a.name)}</strong>
            <small>${escapeHtml(a.taskName)} · ${a.timeLimit} s</small>
            <small>${a.mana ? `💧 ${a.mana} many` : 'zdarma'} · síla ×${a.power}</small>
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
    const action = battle.actions.find((a) => a.key === battle.pendingAction);
    controls.innerHTML = `<div class="battle-task-head">${action.icon} ${escapeHtml(action.name)}</div><div class="battle-task"></div>`;
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
      const side = e.actor === 'hero' ? 'enemy' : 'hero';
      battle[side] = { ...battle[side], hp: e.hpLeft };
      if (e.actor === 'enemy') battle.enemy = { ...battle.enemy, mana: next.enemy.mana };
      setBars(side, battle[side]);
      animate(e);
      addLog(e);
    }
    battle = next;
    updateAll();
    show();
  }

  function renderEnd() {
    fleeBtn.hidden = true;
    const r = battle.rewards;
    const title = {
      won: battle.enemy.boss ? '👑 Boss poražen! Bardi o tom složí baladu.' : '🏆 Vítězství! Nepřítel leží na lopatkách.',
      lost: '💀 Porážka. Hrdina se probral v příkopu bez cti a bez bot.',
      fled: '🏃 Útěk! Nepřítel se posmívá, ale aspoň žiješ.',
    }[battle.status];
    controls.innerHTML = `
      <div class="battle-end battle-end-${battle.status}">
        <h3>${title}</h3>
        ${
          r
            ? `<div class="rewards"><span>✨ +${r.xp} XP</span><span>💰 +${r.gold} zlaťáků</span></div>
               ${r.item ? `<p class="reward-item">🎁 ${itemNameHtml(r.item)} ${r.itemSold ? `<br><small>Inventář byl plný, tak jsi to rovnou prodal za 💰 ${r.item.sellPrice}.</small>` : '<small>je v inventáři</small>'}</p>` : ''}
               ${r.levelsGained > 0 ? '<p class="level-up">🎉 Nová úroveň! Bardi už skládají písně (špatné).</p>' : ''}`
            : ''
        }
        ${battle.bountiesDone.map((t) => `<p class="bounty-done">📜 Zakázka splněna: ${escapeHtml(t)} – odměna čeká v krčmě.</p>`).join('')}
        <div class="battle-end-actions">
          <button type="button" class="btn again-btn">⚔️ Další souboj tady</button>
          <button type="button" class="btn btn-secondary leave-btn">← Zpět na mapu</button>
        </div>
      </div>`;
    controls.querySelector('.again-btn').addEventListener('click', () => onAgain?.(battle.location.key));
    controls.querySelector('.leave-btn').addEventListener('click', () => onLeave?.());
    controls.querySelector('.again-btn').focus();
    onEnd?.(battle);
  }

  function show() {
    fleeBtn.disabled = false;
    if (battle.status !== 'active') return renderEnd();
    if (battle.task) return renderPendingTask();
    renderActions();
  }

  fleeBtn.addEventListener('click', async () => {
    if (!confirm('Opravdu utéct? Souboj skončí bez odměny a energie se nevrací.')) return;
    try {
      const data = await api('/battle/flee', { method: 'POST' });
      if (!alive) return;
      stopTask?.();
      battle = data.battle;
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
