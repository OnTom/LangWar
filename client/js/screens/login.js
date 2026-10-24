import { api } from '../api.js';
import { setSession } from '../session.js';

// Přihlášení i registrace na jedné obrazovce, přepíná se záložkami
export default function login(el, { onLogin }) {
  let mode = 'login';

  el.innerHTML = `
    <div class="panel auth-panel">
      <h2>Vstup do říše LangWar</h2>
      <p class="intro">Hrdinové se nerodí. Registrují se.</p>

      <div class="tabs">
        <button type="button" data-mode="login" class="active">Přihlášení</button>
        <button type="button" data-mode="register">Registrace</button>
      </div>

      <form class="auth-form">
        <label>
          Jméno hrdiny
          <input name="username" autocomplete="username" required minlength="3" maxlength="20">
        </label>
        <label>
          Heslo
          <input name="password" type="password" autocomplete="current-password" required minlength="6" maxlength="72">
        </label>
        <label class="confirm" hidden>
          Heslo znovu
          <input name="confirm" type="password" autocomplete="new-password" maxlength="72">
        </label>
        <p class="error" role="alert"></p>
        <button type="submit" class="btn">Vstoupit</button>
      </form>
    </div>
  `;

  const form = el.querySelector('form');
  const errorEl = el.querySelector('.error');
  const confirmLabel = el.querySelector('.confirm');
  const submitBtn = form.querySelector('button[type="submit"]');

  el.querySelectorAll('.tabs button').forEach((btn) => {
    btn.addEventListener('click', () => {
      mode = btn.dataset.mode;
      el.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b === btn));
      const isRegister = mode === 'register';
      confirmLabel.hidden = !isRegister;
      form.confirm.required = isRegister;
      form.password.autocomplete = isRegister ? 'new-password' : 'current-password';
      submitBtn.textContent = isRegister ? 'Založit hrdinu' : 'Vstoupit';
      errorEl.textContent = '';
    });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEl.textContent = '';

    const username = form.username.value.trim();
    const password = form.password.value;

    if (mode === 'register' && password !== form.confirm.value) {
      errorEl.textContent = 'Hesla se neshodují. Zkus to střízlivý.';
      return;
    }

    submitBtn.disabled = true;
    try {
      const data = await api(`/auth/${mode}`, {
        method: 'POST',
        body: { username, password },
      });
      setSession(data.token, data.user);
      onLogin();
    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      submitBtn.disabled = false;
    }
  });
}
