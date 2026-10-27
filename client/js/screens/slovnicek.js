import { api } from '../api.js';
import { escapeHtml } from '../format.js';
import { renderTask, resultHtml } from '../lingo.js';

// Slovníček: témata, pokrok a procvičování slovíček (bez odměn)
export default function slovnicek(el) {
  let overview = null;
  let mode = 'topics'; // topics | practice | words
  let topic = null;
  let taskType = 'choice';
  let score = { correct: 0, total: 0 };
  let stopTask = null;
  let errorText = '';

  function stop() {
    if (stopTask) stopTask();
    stopTask = null;
  }

  function topicName(key) {
    return overview.topics.find((t) => t.key === key);
  }

  function renderTopics() {
    const learned = overview.topics.reduce((s, t) => s + t.learned, 0);
    const total = overview.topics.reduce((s, t) => s + t.total, 0);
    el.innerHTML = `
      <div class="panel lingo">
        <h2>📚 Slovníček: ${escapeHtml(overview.language.name)}</h2>
        <p class="intro">Tady si můžeš slovíčka v klidu procvičit. Slovo je naučené, když ho aspoň 3× trefíš a trefuješ ho častěji, než se spleteš.</p>
        <div class="lingo-total">
          <div class="bar lingo-bar"><div class="bar-fill" style="width: ${(learned / total) * 100}%"></div><span>${learned} / ${total} naučených slov</span></div>
        </div>
        <p class="error" role="alert">${escapeHtml(errorText)}</p>
        <div class="topic-list">
          ${overview.topics
            .map(
              (t) => `
            <div class="topic-card">
              <div class="topic-head"><span class="topic-icon">${t.icon}</span><strong>${escapeHtml(t.name)}</strong><small>úr. ${t.level}</small></div>
              <div class="bar lingo-bar"><div class="bar-fill" style="width: ${(t.learned / t.total) * 100}%"></div><span>${t.learned} / ${t.total}</span></div>
              <div class="topic-actions">
                <button type="button" class="btn btn-small" data-practice="${t.key}">Procvičit</button>
                <button type="button" class="btn btn-small btn-secondary" data-words="${t.key}">Slova</button>
              </div>
            </div>`
            )
            .join('')}
        </div>
      </div>`;
    el.querySelectorAll('[data-practice]').forEach((b) =>
      b.addEventListener('click', () => {
        topic = b.dataset.practice;
        score = { correct: 0, total: 0 };
        mode = 'practice';
        render();
      })
    );
    el.querySelectorAll('[data-words]').forEach((b) =>
      b.addEventListener('click', () => {
        topic = b.dataset.words;
        mode = 'words';
        render();
      })
    );
  }

  async function renderWords() {
    const t = topicName(topic);
    el.innerHTML = `<div class="panel lingo"><h2>${t.icon} ${escapeHtml(t.name)}</h2><p>Načítám slova…</p></div>`;
    const { words } = await api(`/lingo/words?topic=${topic}`);
    if (mode !== 'words') return;
    el.innerHTML = `
      <div class="panel lingo">
        <button type="button" class="link-inline back-btn">← Zpět na témata</button>
        <h2>${t.icon} ${escapeHtml(t.name)}</h2>
        <table class="ladder-table word-table">
          <thead><tr><th>🇩🇪 Německy</th><th>🇨🇿 Česky</th><th class="num">✔</th><th class="num">✖</th><th></th></tr></thead>
          <tbody>
            ${words
              .map(
                (w) => `
              <tr class="${w.learned ? 'learned' : ''}">
                <td><strong>${escapeHtml(w.de)}</strong></td>
                <td>${escapeHtml(w.cz)}</td>
                <td class="num">${w.correct}</td>
                <td class="num">${w.wrong}</td>
                <td>${w.learned ? '⭐' : ''}</td>
              </tr>`
              )
              .join('')}
          </tbody>
        </table>
        <button type="button" class="btn practice-btn">Procvičit toto téma</button>
      </div>`;
    el.querySelector('.back-btn').addEventListener('click', backToTopics);
    el.querySelector('.practice-btn').addEventListener('click', () => {
      score = { correct: 0, total: 0 };
      mode = 'practice';
      render();
    });
  }

  function renderPractice() {
    const t = topicName(topic);
    el.innerHTML = `
      <div class="panel lingo">
        <button type="button" class="link-inline back-btn">← Zpět na témata</button>
        <h2>${t.icon} ${escapeHtml(t.name)}: procvičování</h2>
        <div class="tabs task-types">
          ${overview.taskTypes
            .map((tt) => `<button type="button" data-type="${tt.key}" class="${tt.key === taskType ? 'active' : ''}">${escapeHtml(tt.name)}</button>`)
            .join('')}
        </div>
        <div class="practice-score">Správně: <strong>${score.correct}</strong> z ${score.total}</div>
        <div class="task-area"></div>
        <div class="task-feedback"></div>
        <p class="error" role="alert"></p>
      </div>`;
    el.querySelector('.back-btn').addEventListener('click', backToTopics);
    el.querySelectorAll('[data-type]').forEach((b) =>
      b.addEventListener('click', () => {
        taskType = b.dataset.type;
        el.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('active', x === b));
        nextTask();
      })
    );
    nextTask();
  }

  async function nextTask() {
    stop();
    const area = el.querySelector('.task-area');
    const feedback = el.querySelector('.task-feedback');
    feedback.innerHTML = '';
    try {
      const { task } = await api('/lingo/task', { method: 'POST', body: { type: taskType, topic } });
      if (mode !== 'practice') return;
      stopTask = renderTask(area, task, {
        onAnswer: async (answer) => {
          try {
            const { result } = await api('/lingo/answer', { method: 'POST', body: { taskId: task.id, answer } });
            score.total++;
            if (result.correct) score.correct++;
            el.querySelector('.practice-score').innerHTML = `Správně: <strong>${score.correct}</strong> z ${score.total}`;
            feedback.innerHTML = `${resultHtml(result)}<button type="button" class="btn btn-small next-btn">Další slovo ↵</button>`;
            const next = feedback.querySelector('.next-btn');
            next.addEventListener('click', nextTask);
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

  async function backToTopics() {
    stop();
    mode = 'topics';
    await load();
  }

  function render() {
    stop();
    if (!overview) {
      el.innerHTML = `<div class="panel">${errorText ? `<p class="error">${escapeHtml(errorText)}</p>` : 'Listuji slovníkem…'}</div>`;
      return;
    }
    if (mode === 'practice') return renderPractice();
    if (mode === 'words') return renderWords();
    renderTopics();
  }

  async function load() {
    try {
      overview = await api('/lingo');
    } catch (err) {
      errorText = err.message;
    }
    render();
  }

  render();
  load();
  return stop;
}
