import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PORT } from './config.js';
import authRoutes from './routes/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());

// Statické soubory klienta (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'client')));

// Testovací endpoint – ověří, že server žije
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Krčma je otevřená!', time: Date.now() });
});

app.use('/api/auth', authRoutes);

// Neznámé API cesty
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Tahle cesta vede do bažin. Neexistuje.' });
});

// Neočekávané chyby
app.use((err, req, res, next) => {
  // Chyby způsobené klientem (např. nevalidní JSON) nejsou chybou serveru
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Požadavek je špatně napsaný.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Na serveru vybuchl lektvar. Zkus to znovu.' });
});

app.listen(PORT, () => {
  console.log(`LangWar běží na http://localhost:${PORT}`);
});
