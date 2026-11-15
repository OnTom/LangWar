// Výchozí stav: hráči si můžou zvolit jen mága, ostatní povolání jsou „připravujeme“
import './mage-only-env.js';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers.js';

const api = await startServer();
after(() => api.close());

test('zapnutý je jen mág; válečník a lovec se založit nedají', async () => {
  const reg = await api.post(null, '/auth/register', { username: 'Novacek', password: 'heslo123' });
  const token = reg.body.token;
  const options = await api.get(token, '/character/options');
  assert.equal(options.body.classes.mage.enabled, true);
  assert.equal(options.body.classes.warrior.enabled, false);
  assert.equal(options.body.classes.scout.enabled, false);

  for (const cls of ['warrior', 'scout']) {
    const r = await api.post(token, '/character', { class: cls, avatar: '🧔' });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /připravujeme/);
  }
  const ok = await api.post(token, '/character', { class: 'mage', avatar: '🧔' });
  assert.equal(ok.status, 201);
  assert.equal(ok.body.character.class, 'mage');
});
