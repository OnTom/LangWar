// Spuštění hry: HTTP server + chat přes WebSocket
import { PORT } from './config.js';
import app from './app.js';
import db from './db.js';
import { attachChat } from './ws.js';
import { giveStarterGearToAll } from './game/inventory.js';

// Postavy založené před zavedením předmětů dostanou startovní výbavu
giveStarterGearToAll();

const server = app.listen(PORT, () => {
  console.log(`LangWar běží na http://localhost:${PORT}`);
});

// Chat v reálném čase na stejném portu (cesta /ws)
const chatServer = attachChat(server);

// Korektní vypnutí (hosting posílá SIGTERM při restartu nebo nasazení nové verze):
// dokončí rozjeté požadavky a zavře databázi, aby se nic neztratilo
function shutdown(signal) {
  console.log(`${signal}: zavírám krčmu…`);
  chatServer.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  // Kdyby některé spojení viselo, po 10 s to utneme
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
