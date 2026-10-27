// Zobrazení jazykového úkolu (Slovníček i souboj).
// Úkol zná jen zadání – správnost vyhodnotí server.
import { escapeHtml } from './format.js';

const FLAGS = { de: '🇩🇪', cz: '🇨🇿' };
const GERMAN_LETTERS = ['ä', 'ö', 'ü', 'ß'];

/**
 * Vykreslí úkol do el a zavolá onAnswer(odpověď) – při odeslání nebo po vypršení času
 * (pak s odpovědí null). Vrací funkci pro úklid (zastaví odpočet).
 */
export function renderTask(el, task, { onAnswer }) {
  const clockOffset = task.serverNow - Date.now();
  const total = task.timeLimit * 1000;
  let done = false;

  const answerArea =
    task.type === 'choice'
      ? `<div class="task-options">
          ${task.options
            .map((o, i) => `<button type="button" class="btn task-option" data-index="${i}">${escapeHtml(o)}</button>`)
            .join('')}
        </div>`
      : `<form class="task-form">
          <input name="answer" autocomplete="off" autocapitalize="off" spellcheck="false"
            placeholder="${task.to === 'de' ? 'Napiš německy…' : 'Napiš česky…'}" aria-label="Odpověď">
          <button type="submit" class="btn btn-small">Odpovědět</button>
          ${
            task.to === 'de'
              ? `<div class="task-letters">${GERMAN_LETTERS.map((l) => `<button type="button" class="link-btn task-letter" data-letter="${l}">${l}</button>`).join('')}</div>`
              : ''
          }
        </form>`;

  el.innerHTML = `
    <div class="task">
      <div class="task-type">${escapeHtml(task.typeName)} ${FLAGS[task.from]} → ${FLAGS[task.to]}</div>
      <div class="task-prompt">${escapeHtml(task.prompt)}</div>
      <div class="bar task-timer"><div class="bar-fill" style="width: 100%"></div><span></span></div>
      ${answerArea}
    </div>`;

  const fill = el.querySelector('.task-timer .bar-fill');
  const label = el.querySelector('.task-timer span');

  function finish(answer) {
    if (done) return;
    done = true;
    clearInterval(timer);
    el.querySelectorAll('button, input').forEach((x) => (x.disabled = true));
    onAnswer(answer);
  }

  function tick() {
    const left = task.expiresAt - (Date.now() + clockOffset);
    fill.style.width = `${Math.max(0, (left / total) * 100)}%`;
    fill.classList.toggle('hurry', left < 4000);
    label.textContent = `${Math.max(0, Math.ceil(left / 1000))} s`;
    if (left <= 0) finish(null);
  }

  el.querySelectorAll('.task-option').forEach((b) => b.addEventListener('click', () => finish(Number(b.dataset.index))));

  const form = el.querySelector('.task-form');
  if (form) {
    const input = form.answer;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value.trim()) finish(input.value);
    });
    // Tlačítka s německými znaky vloží písmeno na místo kurzoru
    el.querySelectorAll('.task-letter').forEach((b) =>
      b.addEventListener('click', () => {
        const pos = input.selectionStart ?? input.value.length;
        input.value = input.value.slice(0, pos) + b.dataset.letter + input.value.slice(input.selectionEnd ?? pos);
        input.focus();
        input.setSelectionRange(pos + 1, pos + 1);
      })
    );
    input.focus();
  }

  // Klávesy 1–4 pro výběr z možností
  function onKey(e) {
    if (task.type === 'choice' && /^[1-4]$/.test(e.key)) finish(Number(e.key) - 1);
  }
  document.addEventListener('keydown', onKey);

  const timer = setInterval(tick, 100);
  tick();

  return () => {
    done = true;
    clearInterval(timer);
    document.removeEventListener('keydown', onKey);
  };
}

// Výsledek odpovědi (správně / špatně + správný překlad)
export function resultHtml(result) {
  if (result.correct) {
    return `<div class="task-result ok">✅ Správně! <strong>${escapeHtml(result.word.de)}</strong> = ${escapeHtml(result.word.cz)}</div>`;
  }
  return `
    <div class="task-result bad">
      ${result.timedOut ? '⏰ Čas vypršel.' : '❌ Špatně.'}
      Správně: <strong>${escapeHtml(result.expected)}</strong>
      <small>(${escapeHtml(result.word.de)} = ${escapeHtml(result.word.cz)})</small>
    </div>`;
}
