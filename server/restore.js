// Obnova databáze ze zálohy: npm run restore -- cesta/k/zaloze.db
// Server musí být během obnovy vypnutý!
// Používá zálohovací rozhraní SQLite, takže si poradí i se zbytky po pádu
// (soubory -wal/-shm) a nic se nemusí mazat ručně.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';

const DB_FILE = process.env.DB_FILE || 'langwar.db';
const source = process.argv[2];

if (!source || !fs.existsSync(source)) {
  console.error('Použití: npm run restore -- cesta/k/zaloze.db');
  process.exit(1);
}

// Pracujeme s kopií v dočasné složce: originál může ležet na disku jen pro čtení
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'langwar-restore-'));
const tmpCopy = path.join(tmpDir, 'restore.db');
fs.copyFileSync(source, tmpCopy);

let backup;
try {
  backup = new Database(tmpCopy);
} catch {
  console.error(`Soubor ${source} není databáze SQLite. Obnovu jsem zrušil.`);
  process.exit(1);
}
let check;
try {
  check = backup.pragma('integrity_check', { simple: true });
} catch (err) {
  check = err.message;
}
if (check !== 'ok') {
  console.error(`Záloha ${source} je poškozená (${check}). Obnovu jsem zrušil.`);
  process.exit(1);
}

await backup.backup(DB_FILE);
backup.close();
fs.rmSync(tmpDir, { recursive: true });

// Ověření: obnovená databáze jde otevřít a obsahuje hráče
const db = new Database(DB_FILE);
const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get();
db.close();
console.log(`Obnoveno ze ${source} do ${DB_FILE} (hráčů: ${n}).`);
