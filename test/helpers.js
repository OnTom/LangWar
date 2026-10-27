// Společné pomůcky pro testy: vlastní dočasná databáze a server na náhodném portu.
// Každý testovací soubor běží v samostatném procesu, takže má i vlastní databázi.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'testovaci-tajemstvi-jen-pro-automaticke-testy';
const dbFile = path.join(os.tmpdir(), `langwar-test-${process.pid}-${Date.now()}.db`);
process.env.DB_FILE = dbFile;

const { default: app } = await import('../server/app.js');
const { default: db } = await import('../server/db.js');

export { db };

export async function startServer() {
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}/api`;

  async function call(token, method, url, body) {
    const res = await fetch(base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  }

  return {
    get: (token, url) => call(token, 'GET', url),
    post: (token, url, body = {}) => call(token, 'POST', url, body),
    // Nový hráč s postavou; vrací token
    async player(name, cls = 'warrior') {
      const reg = await call(null, 'POST', '/auth/register', { username: name, password: 'heslo123' });
      await call(reg.body.token, 'POST', '/character', { class: cls, avatar: '🧔' });
      return reg.body.token;
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
      db.close();
      for (const suffix of ['', '-wal', '-shm']) fs.rmSync(dbFile + suffix, { force: true });
    },
  };
}
