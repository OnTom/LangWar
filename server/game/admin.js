// Administrace: kdo je admin a pomůcky pro testování hry.
// Práva se ověřují při každém požadavku z databáze (ne z tokenu), takže odebrání platí hned.
import db from '../db.js';
import { ADMIN_USERS } from '../config.js';
import { taskSolution } from './lingo.js';

export function isAdmin(userId) {
  const user = db.prepare('SELECT username, is_admin FROM users WHERE id = ?').get(userId);
  if (!user) return false;
  return Boolean(user.is_admin) || ADMIN_USERS.includes(user.username.toLowerCase());
}

export function showsAnswers(userId) {
  if (!isAdmin(userId)) return false;
  return Boolean(db.prepare('SELECT admin_show_answers FROM users WHERE id = ?').get(userId)?.admin_show_answers);
}

/** Adminovi s režimem „ukazovat odpovědi“ přidá k úkolu správnou odpověď. */
export function withSolution(userId, task) {
  if (!task || !showsAnswers(userId)) return task;
  return { ...task, adminSolution: taskSolution(task.id) };
}

/** Totéž pro pohled na souboj (úkol je v battle.task). */
export function battleWithSolution(userId, battle) {
  if (!battle?.task) return battle;
  return { ...battle, task: withSolution(userId, battle.task) };
}

export function logAction(userId, action, details = '') {
  db.prepare('INSERT INTO admin_log (user_id, action, details, created_at) VALUES (?, ?, ?, ?)').run(
    userId,
    action,
    String(details),
    Date.now()
  );
}

export function recentLog(limit = 20) {
  return db
    .prepare(
      `SELECT l.action, l.details, l.created_at AS at, u.username AS admin
       FROM admin_log l LEFT JOIN users u ON u.id = l.user_id
       ORDER BY l.id DESC LIMIT ?`
    )
    .all(limit);
}
