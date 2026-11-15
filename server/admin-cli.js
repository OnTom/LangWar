// Nastavení správce hry: npm run admin -- <jméno>      (přidá práva)
//                       npm run admin -- <jméno> --remove  (odebere práva)
//                       npm run admin                 (vypíše adminy)
// Funguje i za běhu serveru; změna platí hned.
import db from './db.js';

const args = process.argv.slice(2);
const remove = args.includes('--remove');
const name = args.find((a) => !a.startsWith('--'));

if (!name) {
  const admins = db.prepare('SELECT username FROM users WHERE is_admin = 1 ORDER BY username').all();
  console.log(admins.length ? `Admini: ${admins.map((a) => a.username).join(', ')}` : 'Zatím tu není žádný admin.');
  console.log('Použití: npm run admin -- <jméno>  (nebo s --remove pro odebrání)');
  process.exit(0);
}

const user = db.prepare('SELECT id, username FROM users WHERE username = ?').get(name);
if (!user) {
  console.error(`Účet „${name}“ neexistuje. Nejdřív se ve hře zaregistruj.`);
  process.exit(1);
}
db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(remove ? 0 : 1, user.id);
console.log(remove ? `„${user.username}“ už není admin.` : `„${user.username}“ je teď admin. V menu uvidí 🛠️ Admin.`);
