# LangWar

Webové fantasy RPG (parodie) ve stylu Shakes and Fidget.

## Spuštění

```bash
npm install
npm start        # nebo: npm run dev (automatický restart při změně)
```

Pak otevři http://localhost:3000

## Nastavení (proměnné prostředí)

| Proměnná     | Výchozí hodnota  | Popis                                                  |
|--------------|------------------|--------------------------------------------------------|
| `PORT`       | `3000`           | Port serveru                                           |
| `DB_FILE`    | `langwar.db`     | Soubor SQLite databáze                                 |
| `JWT_SECRET` | vývojový řetězec | Tajný klíč pro tokeny – **na produkci povinně změnit** |

## API

| Metoda | Cesta                | Popis                             |
|--------|----------------------|-----------------------------------|
| GET    | `/api/health`        | Stav serveru                      |
| POST   | `/api/auth/register` | Registrace `{username, password}` |
| POST   | `/api/auth/login`    | Přihlášení `{username, password}` |
| GET    | `/api/auth/me`       | Přihlášený hráč (vyžaduje token)  |

## Struktura

- `server/` – Node.js + Express, veškerá herní logika
- `client/` – HTML/CSS/JS (ES moduly), jen zobrazuje stav
