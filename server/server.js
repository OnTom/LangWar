import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Statické soubory klienta (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'client')));

// Testovací endpoint – ověří, že server žije
app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Krčma je otevřená!', time: Date.now() });
});

// Neznámé API cesty
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Tahle cesta vede do bažin. Neexistuje.' });
});

app.listen(PORT, () => {
  console.log(`LangWar běží na http://localhost:${PORT}`);
});
