import { api } from '../api.js';
import { setCharacter } from '../state.js';
import { escapeHtml } from '../format.js';
import { onChat } from '../chat.js';

// Cech: založení, pozvánky, členové, pokladnice a vylepšení
export default function cech(el) {
  let data = null; // { guild, invites, options, character }
  let ladder = [];
  let errorText = '';
  let busy = false;
  let selectedEmblem = null;
  const draft = { name: '', motto: '' }; // rozepsaný formulář založení přežije chybu

  async function call(path, body, confirmText) {
    if (confirmText && !confirm(confirmText)) return;
    busy = true;
    errorText = '';
    render();
    try {
      data = await api(path, { method: 'POST', body: body || {} });
      setCharacter(data.character);
      if (!data.guild) await loadLadder();
    } catch (err) {
      errorText = err.message;
    }
    busy = false;
    render();
  }

  async function loadLadder() {
    try {
      ladder = (await api('/guild/ladder')).guilds;
    } catch {
      ladder = [];
    }
  }

  const dis = (cond = false) => (busy || cond ? 'disabled' : '');

  // --- Hráč bez cechu --------------------------------------------------------

  function noGuildHtml() {
    const { invites, options } = data;
    const gold = data.character.gold;
    selectedEmblem ??= options.emblems[0];
    return `
      <div class="panel guild">
        <h2>🏰 Cechy</h2>
        <p class="intro">Sám hrdina toho moc nezmůže. V cechu se dá sdílet zlato, bonusy i drby.</p>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>

        <h3>Pozvánky</h3>
        ${
          invites.length
            ? `<ul class="guild-invites">
                ${invites
                  .map(
                    (i) => `
                  <li>
                    <span class="guild-emblem-small">${i.guild.emblem}</span>
                    <div class="guild-invite-body">
                      <strong>${escapeHtml(i.guild.name)}</strong>
                      <small>Členů: ${i.guild.members} · zve ${escapeHtml(i.invitedBy || 'neznámý')}</small>
                      ${i.guild.motto ? `<em>„${escapeHtml(i.guild.motto)}“</em>` : ''}
                    </div>
                    <button type="button" class="btn btn-small" data-accept="${i.id}" ${dis()}>Přijmout</button>
                    <button type="button" class="btn btn-small btn-secondary" data-decline="${i.id}" ${dis()}>Odmítnout</button>
                  </li>`
                  )
                  .join('')}
              </ul>`
            : '<p class="hint">Zatím tě nikdo nepozval. Napiš do Hospody, že hledáš cech, nebo si založ vlastní.</p>'
        }

        <h3>Založit cech</h3>
        <form class="guild-create">
          <label>Název cechu
            <input name="name" maxlength="24" required placeholder="např. Rytíři Kulatého Stolu" value="${escapeHtml(draft.name)}">
          </label>
          <label>Motto (nepovinné)
            <input name="motto" maxlength="100" placeholder="např. Pivo a čest!" value="${escapeHtml(draft.motto)}">
          </label>
          <div class="emblem-list" role="radiogroup" aria-label="Erb">
            ${options.emblems
              .map(
                (e) => `<button type="button" class="choice emblem-choice ${e === selectedEmblem ? 'selected' : ''}" data-emblem="${e}">${e}</button>`
              )
              .join('')}
          </div>
          <button type="submit" class="btn" ${dis(gold < options.createCost)}>
            Založit cech za 💰 ${options.createCost}
          </button>
          ${gold < options.createCost ? '<p class="hint">Na založení cechu nemáš dost zlata.</p>' : ''}
        </form>

        ${ladderHtml()}
      </div>`;
  }

  function ladderHtml(myGuildId = null) {
    if (!ladder.length) return '';
    return `
      <h3>Nejslavnější cechy</h3>
      <table class="ladder-table">
        <thead><tr><th>#</th><th>Cech</th><th class="num">Členové</th><th class="num">Čest</th></tr></thead>
        <tbody>
          ${ladder
            .map(
              (g) => `
            <tr class="${g.id === myGuildId ? 'me' : ''}">
              <td class="rank">${g.rank}.</td>
              <td>${g.emblem} <strong>${escapeHtml(g.name)}</strong> <small>(vůdce ${escapeHtml(g.leader || '?')})</small></td>
              <td class="num">${g.members}</td>
              <td class="num">${g.honor}</td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;
  }

  // --- Člen cechu -------------------------------------------------------------

  function memberActions(g, m) {
    if (m.isMe) return '';
    const buttons = [];
    if (g.myRole === 'leader') {
      buttons.push(
        m.role === 'officer'
          ? `<button type="button" class="btn btn-small btn-secondary" data-role="member" data-id="${m.characterId}" ${dis()}>Degradovat</button>`
          : `<button type="button" class="btn btn-small btn-secondary" data-role="officer" data-id="${m.characterId}" ${dis()}>Povýšit</button>`
      );
      buttons.push(
        `<button type="button" class="btn btn-small btn-secondary" data-transfer="${m.characterId}" data-name="${escapeHtml(m.name)}" ${dis()}>Předat vedení</button>`
      );
    }
    const canKick = (g.myRole === 'leader' && m.role !== 'leader') || (g.myRole === 'officer' && m.role === 'member');
    if (canKick) {
      buttons.push(
        `<button type="button" class="btn btn-small" data-kick="${m.characterId}" data-name="${escapeHtml(m.name)}" ${dis()}>Vyhodit</button>`
      );
    }
    return `<div class="member-actions">${buttons.join('')}</div>`;
  }

  function guildHtml() {
    const g = data.guild;
    const manager = g.myRole !== 'member';
    const leader = g.myRole === 'leader';
    return `
      <div class="panel guild">
        <div class="guild-head">
          <div class="guild-emblem">${g.emblem}</div>
          <div>
            <h2>${escapeHtml(g.name)}</h2>
            ${g.motto ? `<p class="guild-motto">„${escapeHtml(g.motto)}“</p>` : ''}
            <div class="guild-stats">
              <span>👥 ${g.members.length}/${g.maxMembers}</span>
              <span>🏅 ${g.honor} cti</span>
              <span>💰 ${g.treasury} v pokladnici</span>
              <a href="#/hospoda">💬 Cechovní chat</a>
            </div>
          </div>
        </div>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>

        <h3>Pokladnice</h3>
        <form class="guild-donate">
          <input name="amount" type="number" min="1" max="${data.character.gold}" placeholder="Kolik zlaťáků" aria-label="Kolik zlaťáků darovat">
          <button type="submit" class="btn btn-small" ${dis(data.character.gold < 1)}>Přispět</button>
          <small>Máš 💰 ${data.character.gold}. Ze zlata v pokladnici platí vedení vylepšení.</small>
        </form>

        <h3>Vylepšení cechu</h3>
        <div class="guild-upgrades">
          ${g.upgrades
            .map(
              (u) => `
            <div class="guild-upgrade">
              <span class="daily-icon">${u.icon}</span>
              <div class="daily-body">
                <strong>${u.name} · úroveň ${u.level}/${u.max}</strong>
                <small>${u.description}: teď +${u.bonus} % pro všechny členy</small>
              </div>
              ${
                u.cost === null
                  ? '<span class="daily-state">Maximum</span>'
                  : manager
                    ? `<button type="button" class="btn btn-small" data-upgrade="${u.key}" ${dis(g.treasury < u.cost)}>Vylepšit za 💰 ${u.cost}</button>`
                    : `<small>Další úroveň: 💰 ${u.cost}</small>`
              }
            </div>`
            )
            .join('')}
        </div>

        <h3>Členové</h3>
        <table class="ladder-table guild-members">
          <thead><tr><th>Hrdina</th><th class="ladder-class">Povolání</th><th class="num">Úr.</th><th class="num">Čest</th><th>Role</th><th></th></tr></thead>
          <tbody>
            ${g.members
              .map(
                (m) => `
              <tr class="${m.isMe ? 'me' : ''}">
                <td>${m.avatar} <strong>${escapeHtml(m.name)}</strong></td>
                <td class="ladder-class">${m.className}</td>
                <td class="num">${m.level}</td>
                <td class="num">${m.honor}</td>
                <td>${m.role === 'leader' ? '👑 ' : m.role === 'officer' ? '⭐ ' : ''}${m.roleName}</td>
                <td>${memberActions(g, m)}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>

        ${
          manager
            ? `
          <h3>Pozvat hrdinu</h3>
          <form class="guild-invite">
            <input name="name" maxlength="20" required placeholder="Jméno hrdiny" aria-label="Jméno hrdiny">
            <button type="submit" class="btn btn-small" ${dis(g.members.length >= g.maxMembers)}>Pozvat</button>
          </form>
          ${
            g.pendingInvites.length
              ? `<ul class="guild-pending">
                  ${g.pendingInvites
                    .map(
                      (i) => `<li>✉️ ${escapeHtml(i.name)} <button type="button" class="link-inline" data-cancel-invite="${i.id}" ${dis()}>zrušit</button></li>`
                    )
                    .join('')}
                </ul>`
              : ''
          }`
            : ''
        }

        ${
          leader
            ? `
          <h3>Motto cechu</h3>
          <form class="guild-motto-form">
            <input name="motto" maxlength="100" value="${escapeHtml(g.motto)}" aria-label="Motto cechu">
            <button type="submit" class="btn btn-small btn-secondary" ${dis()}>Uložit</button>
          </form>`
            : ''
        }

        <p class="guild-leave">
          <button type="button" class="btn btn-small btn-secondary leave-btn" ${dis()}>
            ${g.members.length === 1 ? 'Rozpustit cech' : 'Opustit cech'}
          </button>
        </p>
      </div>`;
  }

  // --- Vykreslení a události ---------------------------------------------------

  function render() {
    if (!data) {
      el.innerHTML = `<div class="panel">${errorText ? `<p class="error">${escapeHtml(errorText)}</p>` : 'Herold hledá cechovní listiny…'}</div>`;
      return;
    }
    el.innerHTML = data.guild ? guildHtml() : noGuildHtml();
    bind();
  }

  function bind() {
    const on = (selector, fn) => el.querySelectorAll(selector).forEach((b) => b.addEventListener('click', () => fn(b)));
    const submit = (selector, fn) =>
      el.querySelector(selector)?.addEventListener('submit', (e) => {
        e.preventDefault();
        fn(e.target);
      });

    on('[data-accept]', (b) => call('/guild/accept', { inviteId: Number(b.dataset.accept) }));
    on('[data-decline]', (b) => call('/guild/decline', { inviteId: Number(b.dataset.decline) }));
    on('[data-emblem]', (b) => {
      selectedEmblem = b.dataset.emblem;
      el.querySelectorAll('[data-emblem]').forEach((x) => x.classList.toggle('selected', x === b));
    });
    submit('.guild-create', (f) => {
      draft.name = f.name.value;
      draft.motto = f.motto.value;
      call('/guild/create', { name: draft.name, motto: draft.motto, emblem: selectedEmblem });
    });

    submit('.guild-donate', (f) => call('/guild/donate', { amount: Number(f.amount.value) }));
    on('[data-upgrade]', (b) => call('/guild/upgrade', { upgrade: b.dataset.upgrade }));
    on('[data-role]', (b) => call('/guild/role', { characterId: Number(b.dataset.id), role: b.dataset.role }));
    on('[data-transfer]', (b) =>
      call('/guild/transfer', { characterId: Number(b.dataset.transfer) }, `Opravdu předat vedení cechu hráči ${b.dataset.name}?`)
    );
    on('[data-kick]', (b) =>
      call('/guild/kick', { characterId: Number(b.dataset.kick) }, `Opravdu vyhodit hráče ${b.dataset.name} z cechu?`)
    );
    submit('.guild-invite', (f) => call('/guild/invite', { name: f.name.value.trim() }));
    on('[data-cancel-invite]', (b) => call('/guild/invite/cancel', { inviteId: Number(b.dataset.cancelInvite) }));
    submit('.guild-motto-form', (f) => call('/guild/motto', { motto: f.motto.value }));
    on('.leave-btn', () =>
      call(
        '/guild/leave',
        {},
        data.guild.members.length === 1
          ? 'Jsi poslední člen. Odchodem cech zanikne i se zlatem v pokladnici. Pokračovat?'
          : 'Opravdu chceš opustit cech?'
      )
    );
  }

  async function load() {
    try {
      data = await api('/guild');
      setCharacter(data.character);
      if (!data.guild) await loadLadder();
    } catch (err) {
      errorText = err.message;
    }
    render();
  }

  render();
  load();

  // Změna v cechu od někoho jiného (pozvánka, vyhození, povýšení…) – načíst znovu
  const unsubscribe = onChat((event) => {
    if (event.type === 'refresh' && !busy) load();
  });
  return unsubscribe;
}
