// Nastavení serveru. Hodnoty jdou přepsat proměnnými prostředí.
const DEV_SECRET = 'dev-tajemstvi-zmen-me-na-produkci';

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

export const PORT = process.env.PORT || 3000;
export const DB_FILE = process.env.DB_FILE || 'langwar.db';
export const JWT_SECRET = process.env.JWT_SECRET || DEV_SECRET;
export const JWT_EXPIRES_IN = '7d';

// Časové pásmo, podle kterého se o půlnoci doplňuje žízeň
export const TIMEZONE = process.env.TIMEZONE || 'Europe/Prague';

// Zrychlení času pro vývoj: 0.05 = questy i pauzy v aréně trvají 5 % normální doby
export const QUEST_TIME_SCALE = Number(process.env.QUEST_TIME_SCALE) || 1;

// Za kolika proxy servery běžíme (např. 1 za nginx/hostingem), aby limity
// požadavků viděly skutečnou IP hráče. 0 = přímo bez proxy.
export const TRUST_PROXY = Number(process.env.TRUST_PROXY) || 0;

// Povolání, která si hráči můžou zvolit při zakládání postavy (ostatní jsou „připravujeme“).
// Např. ENABLED_CLASSES=mage,warrior,scout zapne všechna.
export const ENABLED_CLASSES = (process.env.ENABLED_CLASSES || 'mage')
  .split(',')
  .map((c) => c.trim())
  .filter(Boolean);

// Jména účtů s přístupem do administrace (oddělená čárkou), např. ADMIN_USERS=Tomas,Petra.
// Admina jde nastavit i příkazem npm run admin -- <jméno> (uloží se do databáze).
export const ADMIN_USERS = (process.env.ADMIN_USERS || '')
  .split(',')
  .map((name) => name.trim().toLowerCase())
  .filter(Boolean);

if (IS_PRODUCTION) {
  // V produkci server bez pořádného tajného klíče nespustíme – kdo ho zná, může vyrobit token za kohokoli
  if (JWT_SECRET === DEV_SECRET || JWT_SECRET.length < 32) {
    throw new Error('V produkci musí být nastavená proměnná JWT_SECRET (aspoň 32 náhodných znaků).');
  }
  if (QUEST_TIME_SCALE !== 1) {
    console.warn('⚠️  QUEST_TIME_SCALE je v produkci nastavené na', QUEST_TIME_SCALE);
  }
} else if (JWT_SECRET === DEV_SECRET) {
  console.warn('⚠️  Používám vývojový JWT_SECRET. Na produkci nastav proměnnou JWT_SECRET!');
}
