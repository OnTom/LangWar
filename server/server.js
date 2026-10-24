import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT, TRUST_PROXY } from './config.js';
import { securityHeaders, apiLimiter } from './middleware/security.js';
import authRoutes from './routes/auth.js';
import characterRoutes from './routes/character.js';
import tavernRoutes from './routes/tavern.js';
import inventoryRoutes from './routes/inventory.js';
import shopRoutes from './routes/shop.js';
import arenaRoutes from './routes/arena.js';
import dailyRoutes from './routes/daily.js';
import { giveStarterGearToAll } from './game/inventory.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', TRUST_PROXY);
app.use(securityHeaders);
// Hra posílá jen malé JSONy; větší tělo požadavku nemá smysl přijímat
app.use(express.json({ limit: '10kb' }));
app.use('/api', apiLimiter);

// Statické soubory klienta (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'client')));

// Testovací endpoint – ověří, že server žije
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Krčma je otevřená!', time: Date.now() });
});

app.use('/api/auth', authRoutes);
app.use('/api/character', characterRoutes);
app.use('/api/tavern', tavernRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/arena', arenaRoutes);
app.use('/api/daily', dailyRoutes);

// Neznámé API cesty
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Tahle cesta vede do bažin. Neexistuje.' });
});

// Neočekávané chyby
app.use((err, req, res, next) => {
  // Chyby způsobené klientem (např. nevalidní JSON) nejsou chybou serveru
  if (err.status === 413) {
    return res.status(413).json({ error: 'Požadavek je moc velký.' });
  }
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Požadavek je špatně napsaný.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Na serveru vybuchl lektvar. Zkus to znovu.' });
});

// Postavy založené před zavedením předmětů dostanou startovní výbavu
giveStarterGearToAll();

app.listen(PORT, () => {
  console.log(`LangWar běží na http://localhost:${PORT}`);
});
