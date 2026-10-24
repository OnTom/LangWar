import { api } from '../api.js';
import { getCharacter } from '../state.js';
import { onChat, setActiveChannel, isOnline, getUnread } from '../chat.js';
import { escapeHtml } from '../format.js';

const MAX_LENGTH = 300;

function timeOf(timestamp) {
  return new Date(timestamp).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
}

// Hospoda: chat na návsi (všichni) a v cechu
export default function hospoda(el) {
  const me = getCharacter();
  let channel = 'global';

  el.innerHTML = `
    <div class="panel chat">
      <h2>💬 Hospoda</h2>
      <p class="intro">Tady se drbe, chlubí a domlouvá. Bard u krbu všechno zapisuje.</p>
      <div class="tabs chat-tabs">
        <button type="button" data-channel="global">🏘️ Náves <span class="badge" hidden></span></button>
        <button type="button" data-channel="guild" ${me.guild ? '' : 'disabled title="Nejsi v žádném cechu"'}>
          ${me.guild ? escapeHtml(me.guild.emblem) : '🏰'} Cech <span class="badge" hidden></span>
        </button>
      </div>
      <div class="chat-status"></div>
      <ol class="chat-messages" aria-live="polite"></ol>
      <form class="chat-form">
        <input name="text" maxlength="${MAX_LENGTH}" autocomplete="off" placeholder="Napiš zprávu…" aria-label="Zpráva">
        <button type="submit" class="btn btn-small">Odeslat</button>
      </form>
      <p class="error" role="alert"></p>
    </div>`;

  const list = el.querySelector('.chat-messages');
  const form = el.querySelector('.chat-form');
  const input = form.text;
  const errorEl = el.querySelector('.error');
  const statusEl = el.querySelector('.chat-status');

  function messageHtml(m) {
    if (m.system) {
      return `<li class="chat-system"><span class="chat-time">${timeOf(m.at)}</span> ${m.avatar} ${escapeHtml(m.text)}</li>`;
    }
    const guild = m.guildName ? ` <small class="chat-guild">[${escapeHtml(m.guildName)}]</small>` : '';
    return `
      <li class="${m.name === me.name ? 'chat-mine' : ''}">
        <span class="chat-time">${timeOf(m.at)}</span>
        ${m.avatar} <strong>${escapeHtml(m.name)}</strong>${guild}:
        <span class="chat-text">${escapeHtml(m.text)}</span>
      </li>`;
  }

  function scrollDown() {
    list.scrollTop = list.scrollHeight;
  }

  function append(m) {
    // Odscrolluje dolů jen tehdy, když hráč zrovna nečte starší zprávy
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 40;
    list.insertAdjacentHTML('beforeend', messageHtml(m));
    if (atBottom) scrollDown();
  }

  function renderStatus() {
    statusEl.textContent = isOnline() ? '🟢 Připojeno' : '🔴 Připojuji se…';
  }

  function renderBadges(unread) {
    el.querySelectorAll('.chat-tabs button').forEach((b) => {
      const badge = b.querySelector('.badge');
      const count = unread[b.dataset.channel];
      badge.hidden = !count;
      badge.textContent = count || '';
    });
  }

  async function switchTo(ch) {
    channel = ch;
    setActiveChannel(ch);
    el.querySelectorAll('.chat-tabs button').forEach((b) => b.classList.toggle('active', b.dataset.channel === ch));
    list.innerHTML = '<li class="chat-system">Načítám…</li>';
    try {
      const { messages } = await api(`/chat?channel=${ch}`);
      if (channel !== ch) return; // mezitím přepnuto jinam
      list.innerHTML = messages.length
        ? messages.map(messageHtml).join('')
        : '<li class="chat-system">Zatím tu nikdo nic nenapsal. Buď první!</li>';
      scrollDown();
    } catch (err) {
      list.innerHTML = `<li class="chat-system">${escapeHtml(err.message)}</li>`;
    }
    input.focus();
  }

  el.querySelectorAll('.chat-tabs button').forEach((b) =>
    b.addEventListener('click', () => !b.disabled && switchTo(b.dataset.channel))
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    errorEl.textContent = '';
    form.querySelector('button').disabled = true;
    try {
      await api('/chat', { method: 'POST', body: { channel, text } });
      input.value = '';
    } catch (err) {
      errorEl.textContent = err.message;
    }
    form.querySelector('button').disabled = false;
    input.focus();
  });

  // Nové zprávy chodí přes WebSocket (i ty vlastní)
  const unsubscribe = onChat((event) => {
    if (event.type === 'message' && event.channel === channel) append(event.message);
    if (event.type === 'status') renderStatus();
    if (event.type === 'unread') renderBadges(event.unread);
  });

  renderStatus();
  renderBadges(getUnread());
  switchTo('global');

  return () => {
    unsubscribe();
    setActiveChannel(null);
  };
}
