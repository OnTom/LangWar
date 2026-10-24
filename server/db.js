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

  -- Nabídky questů v krčmě (started_at = NULL) a právě běžící quest
  CREATE TABLE IF NOT EXISTS quests (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    slot         INTEGER NOT NULL,
    title        TEXT    NOT NULL,
    description  TEXT    NOT NULL,
    monster      TEXT    NOT NULL,
    duration     INTEGER NOT NULL, -- v sekundách, tolik stojí žízně
    xp           INTEGER NOT NULL,
    gold         INTEGER NOT NULL,
    started_at   INTEGER,
    ends_at      INTEGER
  );
  CREATE INDEX IF NOT EXISTS quests_character ON quests(character_id);
`);

// Jednoduché migrace: doplní sloupce, které ve starší databázi chybí
function addColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

addColumn('characters', 'thirst', 'INTEGER NOT NULL DEFAULT 0');
addColumn('characters', 'thirst_day', "TEXT NOT NULL DEFAULT ''");
addColumn('quests', 'monster_icon', "TEXT NOT NULL DEFAULT '👹'");
addColumn('quests', 'monster_class', "TEXT NOT NULL DEFAULT 'warrior'");

export default db;
