import Database from 'better-sqlite3';
import { DB_FILE } from './config.js';

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tabulky se vytvoří při prvním spuštění
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    INTEGER NOT NULL
  );

  -- Každý hráč má jednu postavu
  CREATE TABLE IF NOT EXISTS characters (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    class        TEXT    NOT NULL,
    avatar       TEXT    NOT NULL,
    level        INTEGER NOT NULL DEFAULT 1,
    xp           INTEGER NOT NULL DEFAULT 0,
    gold         INTEGER NOT NULL DEFAULT 0,
    strength     INTEGER NOT NULL,
    dexterity    INTEGER NOT NULL,
    intelligence INTEGER NOT NULL,
    constitution INTEGER NOT NULL,
    luck         INTEGER NOT NULL,
    created_at   INTEGER NOT NULL
  );
`);

export default db;
