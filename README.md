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
| `TIMEZONE`   | `Europe/Prague`  | Časové pásmo pro půlnoční doplnění žízně               |
| `QUEST_TIME_SCALE` | `1`        | Zrychlení questů pro vývoj (`0.05` = 5 % normální doby) |

Tip pro vývoj – questy trvající pár sekund místo minut:

```bash
QUEST_TIME_SCALE=0.05 npm run dev
```

Ve Windows (PowerShell): `$env:QUEST_TIME_SCALE=0.05; npm run dev`

## API

| Metoda | Cesta                | Popis                             |
|--------|----------------------|-----------------------------------|
| GET    | `/api/health`        | Stav serveru                      |
| POST   | `/api/auth/register` | Registrace `{username, password}` |
| POST   | `/api/auth/login`    | Přihlášení `{username, password}` |
| GET    | `/api/auth/me`       | Přihlášený hráč (vyžaduje token)  |
| GET    | `/api/character/options` | Třídy, vzhledy a atributy pro tvorbu postavy |
| GET    | `/api/character`     | Postava přihlášeného hráče (nebo `null`) |
| POST   | `/api/character`     | Vytvoření postavy `{class, avatar}` |
| POST   | `/api/character/upgrade` | Vylepšení atributu za zlato `{attribute}` |
| GET    | `/api/tavern`        | Krčma: žízeň, nabídky questů nebo běžící výprava |
| POST   | `/api/tavern/start`  | Vyrazit na quest `{slot}`         |
| POST   | `/api/tavern/complete` | Vyzvednout odměnu po skončení výpravy |
| POST   | `/api/tavern/cancel` | Vzdát výpravu (žízeň se vrátí)    |

Všechny cesty `/api/character` a `/api/tavern` vyžadují token v hlavičce `Authorization: Bearer <token>`.

## Herní pravidla

Třídy, atributy a vzorce (životy, poškození, kritický zásah, ceny vylepšení)
jsou na jednom místě v `server/game/rules.js`. Texty questů jsou v `server/data/quests.js`.

## Struktura

- `server/` – Node.js + Express, veškerá herní logika
- `client/` – HTML/CSS/JS (ES moduly), jen zobrazuje stav
