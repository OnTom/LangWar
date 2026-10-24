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

  -- Předměty: location = inventory | equipped | shop_smith | shop_magic | quest
  CREATE TABLE IF NOT EXISTS items (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    location     TEXT    NOT NULL,
    quest_id     INTEGER REFERENCES quests(id) ON DELETE CASCADE, -- odměna za quest
    slot         TEXT    NOT NULL,
    class        TEXT,   -- jen u zbraní: pro jakou třídu
    name         TEXT    NOT NULL,
    icon         TEXT    NOT NULL,
    rarity       TEXT    NOT NULL,
    level        INTEGER NOT NULL,
    strength     INTEGER NOT NULL DEFAULT 0,
    dexterity    INTEGER NOT NULL DEFAULT 0,
    intelligence INTEGER NOT NULL DEFAULT 0,
    constitution INTEGER NOT NULL DEFAULT 0,
    luck         INTEGER NOT NULL DEFAULT 0,
    armor        INTEGER NOT NULL DEFAULT 0,
    damage_min   INTEGER NOT NULL DEFAULT 0,
    damage_max   INTEGER NOT NULL DEFAULT 0,
    value        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS items_character ON items(character_id, location);

  -- Historie soubojů v aréně (defender_id je NULL u NPC gladiátorů)
  CREATE TABLE IF NOT EXISTS arena_fights (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    attacker_id     INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    defender_id     INTEGER REFERENCES characters(id) ON DELETE CASCADE,
    defender_name   TEXT    NOT NULL,
    defender_avatar TEXT    NOT NULL,
    attacker_won    INTEGER NOT NULL,
    honor_change    INTEGER NOT NULL, -- kolik cti se přesunulo
    gold            INTEGER NOT NULL,
    created_at      INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS arena_attacker ON arena_fights(attacker_id, created_at);
  CREATE INDEX IF NOT EXISTS arena_defender ON arena_fights(defender_id, created_at);

  -- Denní úkoly: každý den 3 náhodné
  CREATE TABLE IF NOT EXISTS daily_tasks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    day          TEXT    NOT NULL,
    slot         INTEGER NOT NULL,
    task_key     TEXT    NOT NULL,
    target       INTEGER NOT NULL,
    progress     INTEGER NOT NULL DEFAULT 0,
    claimed      INTEGER NOT NULL DEFAULT 0,
    UNIQUE (character_id, day, slot)
  );
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
addColumn('characters', 'shop_day', "TEXT NOT NULL DEFAULT ''");
addColumn('characters', 'starter_given', 'INTEGER NOT NULL DEFAULT 0');
addColumn('characters', 'honor', 'INTEGER NOT NULL DEFAULT 100');
addColumn('characters', 'arena_ready_at', 'INTEGER NOT NULL DEFAULT 0');
addColumn('characters', 'arena_opponents', "TEXT NOT NULL DEFAULT ''");
addColumn('characters', 'daily_chest_day', "TEXT NOT NULL DEFAULT ''");
addColumn('characters', 'arena_xp_day', "TEXT NOT NULL DEFAULT ''");
addColumn('characters', 'arena_xp_wins', 'INTEGER NOT NULL DEFAULT 0');
db.exec('CREATE INDEX IF NOT EXISTS characters_honor ON characters(honor)');

export default db;
