// Nastavení serveru. Hodnoty jdou přepsat proměnnými prostředí.
const DEV_SECRET = 'dev-tajemstvi-zmen-me-na-produkci';

export const PORT = process.env.PORT || 3000;
export const DB_FILE = process.env.DB_FILE || 'langwar.db';
export const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;
export const JWT_EXPIRES_IN = '7d';

if (JWT_SECRET === DEV_SECRET) {
  console.warn('⚠️  Používám vývojový JWT_SECRET. Na produkci nastav proměnnou JWT_SECRET!');
}
