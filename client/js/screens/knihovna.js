import { api } from '../api.js';
import { escapeHtml } from '../format.js';
import { setCharacter } from '../state.js';
import { renderTask, resultHtml } from '../lingo.js';

// Knihovna: knihy gramatiky, zkoušky, kniha kouzel a procvičování naučených lekcí
export default function knihovna(el) {
  let data = null; // stav knihovny ze serveru
  let view = 'list'; // list | lesson | exam | practice
  let lesson = null; // otevřená lekce (text)
  let exam = null;
  let practice = { lesson: null, format: '', correct: 0, total: 0 };
  let stopTask = null;
  let alive = true;
  let errorText = '';
  let message = '';
  let busy = false;

  function stop() {
    stopTask?.();
    stopTask = null;
  }

  function setState(res) {
    data = res;
    if (res.character) setCharacter(res.character);
  }

  const spellLine = (s) =>
    `<span class="spell-name">${s.icon} ${escapeHtml(s.name)} ${s.rankName}</span> <small>(${escapeHtml(s.kindName)})</small>`;

  // --- Přehled ---------------------------------------------------------------------

  function spellbookHtml() {
    const book = data.spellbook;
    if (!book.spells.length) {
      return '<p class="hint">Zatím neumíš žádné kouzlo. Kup si první knihu, přečti ji a slož zkoušku.</p>';
    }
    return `
      <div class="spell-list">
        ${book.spells
          .map(
            (s) => `
          <div class="spell-card ${s.equipped ? 'equipped' : ''}">
            <div class="spell-head">${spellLine(s)}</div>
            <div class="spell-effect">${escapeHtml(s.effect)}</div>
            <small>💧 ${s.mana} many · cvičení: ${escapeHtml(s.lesson)}</small>
            <button type="button" class="btn btn-small ${s.equipped ? 'btn-secondary' : ''}" data-toggle="${s.kind}"
              ${busy || (!s.equipped && book.slots.length >= book.max) ? 'disabled' : ''}>
              ${s.equipped ? 'Sundat' : 'Nasadit'}
            </button>
          </div>`
          )
          .join('')}
      </div>`;
  }

  const STATUS = {
    learned: '✔ Naučeno',
    bought: '📗 Koupeno – čeká zkouška',
    level: '🔒 Od úrovně',
    previous: '🔒 Nejdřív předchozí lekce',
    soon: '✍️ Připravuje se',
  };

  function lessonCardHtml(l) {
    const gold = data.character.gold;
    let actions = '';
    if (l.status === 'learned') {
      actions = `<button type="button" class="btn btn-small btn-secondary" data-read="${l.key}">Číst</button>
                 <button type="button" class="btn btn-small" data-practice="${l.key}">Procvičit</button>`;
    } else if (l.status === 'bought') {
      actions = `<button type="button" class="btn btn-small btn-secondary" data-read="${l.key}">Číst lekci</button>
                 <button type="button" class="btn btn-small" data-exam="${l.key}">Složit zkoušku</button>`;
    } else if (l.status === 'available') {
      actions = `<button type="button" class="btn btn-small" data-buy="${l.key}" ${busy || gold < l.price ? 'disabled' : ''}>Koupit za 💰 ${l.price}</button>`;
    }
    const state = l.status === 'available' ? '' : `${STATUS[l.status]}${l.status === 'level' ? ` ${l.level}` : ''}`;
    return `
      <div class="book-card book-${l.status}">
        <div class="book-head"><span class="book-order">${l.order}.</span> <strong>${escapeHtml(l.name)}</strong> <small>úr. ${l.level}</small></div>
        <div class="book-spell">${spellLine(l.spell)}</div>
        ${l.summary && ['available', 'bought', 'learned'].includes(l.status) ? `<p class="book-summary">${escapeHtml(l.summary)}</p>` : ''}
        ${state ? `<div class="book-state">${state}</div>` : ''}
        <div class="book-actions">${actions}</div>
      </div>`;
  }

  function renderList() {
    stop();
    const book = data.spellbook;
    el.innerHTML = `
      <div class="panel library">
        <h2>📖 Knihovna</h2>
        <p class="intro">Knihovník půjčuje knihy gramatiky. Přečti lekci, slož zkoušku (${data.examRules.pass} z ${data.examRules.questions} správně, bez časového limitu)
          a naučíš se kouzlo nebo jeho silnější stupeň. V souboji ho sešleš krátkým cvičením z téže gramatiky.</p>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>
        ${message ? `<p class="daily-message">${message}</p>` : ''}
        ${
          data.exam
            ? `<div class="exam-banner">📝 Rozpracovaná zkouška: <strong>${escapeHtml(data.exam.lessonName)}</strong> (otázka ${data.exam.asked + 1} z ${data.exam.total})
                <button type="button" class="btn btn-small" data-exam="${data.exam.lesson}">Pokračovat</button></div>`
            : ''
        }

        <h3 class="section-title">📕 Kniha kouzel <small>(do souboje ${book.slots.length} z ${book.max})</small></h3>
        ${spellbookHtml()}

        <h3 class="section-title">📚 Knihy gramatiky</h3>
        <div class="book-list">${data.lessons.map(lessonCardHtml).join('')}</div>
      </div>`;

    el.querySelectorAll('[data-buy]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.buy)));
    el.querySelectorAll('[data-read]').forEach((b) => b.addEventListener('click', () => openLesson(b.dataset.read)));
    el.querySelectorAll('[data-exam]').forEach((b) => b.addEventListener('click', () => beginExam(b.dataset.exam)));
    el.querySelectorAll('[data-practice]').forEach((b) => b.addEventListener('click', () => beginPractice(b.dataset.practice)));
    el.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => toggleSpell(b.dataset.toggle)));
  }

  async function post(path, body) {
    busy = true;
    errorText = '';
    message = '';
    try {
      return await api(path, { method: 'POST', body });
    } finally {
      busy = false;
    }
  }

  async function buy(key) {
    try {
      setState(await post('/library/buy', { lesson: key }));
      if (!alive) return;
      await openLesson(key, '📗 Kniha je tvoje. Přečti si ji a pak slož zkoušku.');
    } catch (err) {
      errorText = err.message;
      if (alive) renderList();
    }
  }

  async function toggleSpell(kind) {
    const slots = data.spellbook.slots;
    const next = slots.includes(kind) ? slots.filter((k) => k !== kind) : [...slots, kind];
    try {
      setState(await post('/library/slots', { kinds: next }));
    } catch (err) {
      errorText = err.message;
    }
    if (alive) renderList();
  }

  // --- Lekce -------------------------------------------------------------------------

  async function openLesson(key, note = '') {
    try {
      const res = await api(`/library/lesson/${key}`);
      if (!alive) return;
      lesson = res.lesson;
      view = 'lesson';
      renderLesson(note);
    } catch (err) {
      errorText = err.message;
      renderList();
    }
  }

  function renderLesson(note) {
    stop();
    const c = lesson.content;
    const status = data.lessons.find((l) => l.key === lesson.key)?.status;
    el.innerHTML = `
      <div class="panel library lesson">
        <button type="button" class="link-inline back-btn">← Zpět do knihovny</button>
        ${note ? `<p class="daily-message">${escapeHtml(note)}</p>` : ''}
        <h2>📗 ${lesson.order}. ${escapeHtml(lesson.name)}</h2>
        <div class="lesson-spell">Naučíš se: ${spellLine(lesson.spell)} – ${escapeHtml(lesson.spell.effect)}</div>
        ${
          c
            ? `
          ${c.intro.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
          <table class="ladder-table lesson-table">
            <thead><tr>${c.table.head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
            <tbody>${c.table.rows.map((r) => `<tr>${r.map((x) => `<td>${escapeHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
          <h3>Příklady</h3>
          <ul class="lesson-examples">${c.examples.map(([de, cz]) => `<li><strong>${escapeHtml(de)}</strong> – ${escapeHtml(cz)}</li>`).join('')}</ul>
          <h3>💡 Dobré vědět</h3>
          <ul class="lesson-tips">${c.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>`
            : '<p class="hint">Text lekce se ještě píše.</p>'
        }
        <div class="book-actions">
          ${status === 'bought' ? `<button type="button" class="btn" data-exam="${lesson.key}">📝 Složit zkoušku</button>` : ''}
          ${status === 'learned' ? `<button type="button" class="btn" data-practice="${lesson.key}">Procvičit</button>` : ''}
        </div>
      </div>`;
    el.querySelector('.back-btn').addEventListener('click', backToList);
    el.querySelector('[data-exam]')?.addEventListener('click', () => beginExam(lesson.key));
    el.querySelector('[data-practice]')?.addEventListener('click', () => beginPractice(lesson.key));
  }

  // --- Zkouška ------------------------------------------------------------------------

  async function beginExam(key) {
    try {
      const res = await post('/library/exam/start', { lesson: key });
      if (!alive) return;
      exam = res.exam;
      view = 'exam';
      renderExam();
    } catch (err) {
      errorText = err.message;
      renderList();
    }
  }

  function examProgress() {
    return `Otázka ${Math.min(exam.asked + 1, exam.total)} z ${exam.total} · správně ${exam.correct} · na složení ${exam.needed}`;
  }

  function renderExam() {
    stop();
    el.innerHTML = `
      <div class="panel library">
        <button type="button" class="link-inline back-btn">← Zpět do knihovny (zkouška počká)</button>
        <h2>📝 Zkouška: ${escapeHtml(exam.lessonName)}</h2>
        <div class="practice-score exam-progress">${examProgress()}</div>
        <div class="task-area"></div>
        <div class="task-feedback"></div>
        <p class="error" role="alert"></p>
      </div>`;
    el.querySelector('.back-btn').addEventListener('click', backToList);
    showExamTask();
  }

  function showExamTask() {
    const area = el.querySelector('.task-area');
    stopTask = renderTask(area, exam.task, {
      onAnswer: async (answer) => {
        try {
          const res = await post('/library/exam/answer', { answer });
          if (!alive) return;
          exam = res.exam;
          if (res.lessons) setState(res);
          el.querySelector('.exam-progress').textContent = examProgress();
          const feedback = el.querySelector('.task-feedback');
          if (exam.status === 'active') {
            feedback.innerHTML = `${resultHtml(res.result)}<button type="button" class="btn btn-small next-btn">Další otázka ↵</button>`;
            const next = feedback.querySelector('.next-btn');
            next.addEventListener('click', () => {
              feedback.innerHTML = '';
              stop();
              showExamTask();
            });
            next.focus();
            return;
          }
          feedback.innerHTML = `${resultHtml(res.result)}${examEndHtml(res.learnedSpell)}`;
          feedback.querySelector('.back-list')?.addEventListener('click', backToList);
          feedback.querySelector('.retry')?.addEventListener('click', () => beginExam(exam.lesson));
          feedback.querySelector('.reread')?.addEventListener('click', () => openLesson(exam.lesson));
        } catch (err) {
          el.querySelector('.error').textContent = err.message;
        }
      },
    });
  }

  function examEndHtml(spell) {
    if (exam.status === 'passed') {
      return `
        <div class="exam-end passed">
          <h3>🎉 Zkouška složena! (${exam.correct} z ${exam.asked})</h3>
          ${spell ? `<p>Nové kouzlo: ${spellLine(spell)}<br><small>${escapeHtml(spell.effect)} · 💧 ${spell.mana} many</small></p>` : ''}
          <button type="button" class="btn back-list">Do knihovny</button>
        </div>`;
    }
    return `
      <div class="exam-end failed">
        <h3>📕 Tentokrát to nevyšlo (${exam.correct} z ${exam.asked} správně).</h3>
        <p>Přečti si lekci ještě jednou a zkus to znovu – opakování je zdarma.</p>
        <button type="button" class="btn btn-secondary reread">Číst lekci</button>
        <button type="button" class="btn retry">Zkusit znovu</button>
      </div>`;
  }

  // --- Procvičování naučené lekce -------------------------------------------------

  async function beginPractice(key) {
    let info = data.lessons.find((l) => l.key === key);
    try {
      const res = await api(`/library/lesson/${key}`);
      info = res.lesson;
    } catch (err) {
      errorText = err.message;
      return renderList();
    }
    if (!alive) return;
    practice = { lesson: key, name: info.name, formats: info.formats, format: '', correct: 0, total: 0 };
    view = 'practice';
    renderPractice();
  }

  function renderPractice() {
    stop();
    el.innerHTML = `
      <div class="panel library">
        <button type="button" class="link-inline back-btn">← Zpět do knihovny</button>
        <h2>📖 ${escapeHtml(practice.name)}: procvičování</h2>
        <div class="tabs task-types">
          ${[{ key: '', name: 'Náhodně' }, ...practice.formats]
            .map((f) => `<button type="button" data-format="${f.key}" class="${f.key === practice.format ? 'active' : ''}">${escapeHtml(f.name)}</button>`)
            .join('')}
        </div>
        <div class="practice-score">Správně: <strong>${practice.correct}</strong> z ${practice.total}</div>
        <div class="task-area"></div>
        <div class="task-feedback"></div>
        <p class="error" role="alert"></p>
      </div>`;
    el.querySelector('.back-btn').addEventListener('click', backToList);
    el.querySelectorAll('[data-format]').forEach((b) =>
      b.addEventListener('click', () => {
        practice.format = b.dataset.format;
        el.querySelectorAll('[data-format]').forEach((x) => x.classList.toggle('active', x === b));
        nextPractice();
      })
    );
    nextPractice();
  }

  async function nextPractice() {
    stop();
    const area = el.querySelector('.task-area');
    const feedback = el.querySelector('.task-feedback');
    feedback.innerHTML = '';
    try {
      const { task } = await api('/grammar/task', {
        method: 'POST',
        body: { lesson: practice.lesson, format: practice.format || undefined },
      });
      if (!alive || view !== 'practice') return;
      stopTask = renderTask(area, task, {
        onAnswer: async (answer) => {
          try {
            const { result } = await api('/grammar/answer', { method: 'POST', body: { taskId: task.id, answer } });
            practice.total++;
            if (result.correct) practice.correct++;
            el.querySelector('.practice-score').innerHTML = `Správně: <strong>${practice.correct}</strong> z ${practice.total}`;
            feedback.innerHTML = `${resultHtml(result)}<button type="button" class="btn btn-small next-btn">Další cvičení ↵</button>`;
            const next = feedback.querySelector('.next-btn');
            next.addEventListener('click', nextPractice);
            next.focus();
          } catch (err) {
            el.querySelector('.error').textContent = err.message;
          }
        },
      });
    } catch (err) {
      el.querySelector('.error').textContent = err.message;
    }
  }

  // --- Načtení ------------------------------------------------------------------------

  async function backToList() {
    stop();
    view = 'list';
    await load();
  }

  async function load() {
    try {
      const res = await api('/library');
      if (!alive) return;
      setState(res);
    } catch (err) {
      errorText = err.message;
    }
    if (!alive) return;
    if (!data) {
      el.innerHTML = `<div class="panel"><p class="error">${escapeHtml(errorText)}</p></div>`;
      return;
    }
    renderList();
  }

  el.innerHTML = '<div class="panel">Knihovník hledá brýle…</div>';
  load();
  return () => {
    alive = false;
    stop();
  };
}
