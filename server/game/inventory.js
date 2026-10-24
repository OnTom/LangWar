import db from '../db.js';
import { ATTRIBUTE_KEYS } from './rules.js';
import { starterItems, INVENTORY_SIZE } from './items.js';

const COLUMNS = ['slot', 'class', 'name', 'icon', 'rarity', 'level', ...ATTRIBUTE_KEYS, 'armor', 'damage_min', 'damage_max', 'value'];

const insertStmt = db.prepare(
  `INSERT INTO items (character_id, location, quest_id, ${COLUMNS.join(', ')})
   VALUES (@characterId, @location, @questId, ${COLUMNS.map((c) => '@' + c).join(', ')})`
);

export function insertItem(characterId, location, item, questId = null) {
  const row = { characterId, location, questId };
  for (const c of COLUMNS) row[c] = item[c];
  return insertStmt.run(row).lastInsertRowid;
}

export function getItems(characterId, location) {
  return db.prepare('SELECT * FROM items WHERE character_id = ? AND location = ? ORDER BY id').all(characterId, location);
}

export function getItem(characterId, itemId) {
  return db.prepare('SELECT * FROM items WHERE character_id = ? AND id = ?').get(characterId, itemId);
}

export function inventoryFree(characterId) {
  const { n } = db
    .prepare("SELECT COUNT(*) AS n FROM items WHERE character_id = ? AND location = 'inventory'")
    .get(characterId);
  return INVENTORY_SIZE - n;
}

// Startovní výbavu dostane každá postava jednou (i ty založené před zavedením předmětů)
export const giveStarterGear = db.transaction((c) => {
  const marked = db.prepare('UPDATE characters SET starter_given = 1 WHERE id = ? AND starter_given = 0').run(c.id);
  if (marked.changes === 0) return;
  for (const item of starterItems(c.class)) {
    const taken = db
      .prepare("SELECT 1 FROM items WHERE character_id = ? AND location = 'equipped' AND slot = ?")
      .get(c.id, item.slot);
    insertItem(c.id, taken ? 'inventory' : 'equipped', item);
  }
});

export function giveStarterGearToAll() {
  const pending = db.prepare('SELECT id, class FROM characters WHERE starter_given = 0').all();
  pending.forEach(giveStarterGear);
}
