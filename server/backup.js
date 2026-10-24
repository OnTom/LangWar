// Záloha databáze: npm run backup
// Vytvoří kopii databáze do složky záloh a staré zálohy promaže.
// Bezpečné i za běhu hry (SQLite backup API).
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DB_FILE = process.env.DB_FILE || 'langwar.db';
const BACKUP_DIR = process.env.BACKUP_DIR || 'backups';
const BACKUP_KEEP = Number(process.env.BACKUP_KEEP) || 14;

if (!fs.existsSync(DB_FILE)) {
  console.error(`Databáze ${DB_FILE} neexistuje, není co zálohovat.`);
  process.exit(1);
}

fs.mkdirSync(BACKUP_DIR, { recursive: true });
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
const target = path.join(BACKUP_DIR, `langwar-${stamp}.db`);

const db = new Database(DB_FILE, { readonly: true });
await db.backup(target);
db.close();

// Záloha má být jeden samostatný soubor (bez režimu WAL a pomocných souborů)
const copy = new Database(target);
copy.pragma('journal_mode = DELETE');
copy.close();
console.log(`Záloha uložena: ${target}`);

// Nechá jen posledních BACKUP_KEEP záloh
const old = fs
  .readdirSync(BACKUP_DIR)
  .filter((f) => /^langwar-.*\.db$/.test(f))
  .sort()
  .slice(0, -BACKUP_KEEP);
for (const f of old) {
  fs.unlinkSync(path.join(BACKUP_DIR, f));
  console.log(`Smazána stará záloha: ${f}`);
}
