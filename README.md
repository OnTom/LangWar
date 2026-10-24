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
| POST   | `/api/inventory/equip` | Nasadit předmět `{itemId}`      |
| POST   | `/api/inventory/unequip` | Sundat předmět `{itemId}`     |
| POST   | `/api/inventory/sell` | Prodat předmět z inventáře `{itemId}` |
| GET    | `/api/shop`          | Zboží zbrojíře a kouzelnice       |
| POST   | `/api/shop/buy`      | Koupit předmět `{itemId}`         |
| POST   | `/api/shop/refresh`  | Nové zboží za poplatek `{shop}`   |

Všechny cesty kromě `/api/health` a `/api/auth/register|login` vyžadují token v hlavičce `Authorization: Bearer <token>`.

## Herní pravidla

Třídy, atributy a vzorce (životy, poškození, kritický zásah, ceny vylepšení)
jsou na jednom místě v `server/game/rules.js`. Texty questů a monster jsou v `server/data/quests.js`.

### Souboje

Souboj počítá server (`server/game/combat.js`) a klient ho jen přehraje ze záznamu.
Bojovníci se střídají v útocích (kdo začne, je náhoda):

- **Poškození** = náhodně v rozsahu podle úrovně, třídy a hlavního atributu
- **Kritický zásah** (dvojnásobné poškození) podle Štěstí
- **Válečník** vykryje 20 % úderů, **Lovec** uhne 35 % útoků,
  **Mágova** kouzla nejde vykrýt ani jim uhnout
- Monstrum má úroveň hrdiny a atributy podle své třídy (`monsterScale` v pravidlech)
- **Zbraň** přidává poškození k základu podle úrovně, **zbroj** snižuje přijaté poškození
  (válečník nejvýš o 50 %, lovec 25 %, mág 10 %), válečník vykrývá jen se **štítem**
- Za prohraný souboj není odměna

### Předměty

- 8 slotů: hlava, tělo, ruce, nohy, zbraň, štít (jen válečník), prsten, amulet; inventář má 10 míst
- Rarity: obyčejný (70 %), vzácný (22 %), epický (7 %), legendární (1 %) – vzácnější mají víc a silnější bonusy
- Zdroje: startovní výbava, obchody (nové zboží každý den o půlnoci nebo za poplatek)
  a odměny z questů (asi čtvrtina questů nabízí předmět)
- Generátor je v `server/game/items.js`, názvy a ikony v `server/data/items.js`

## Struktura

- `server/` – Node.js + Express, veškerá herní logika
- `client/` – HTML/CSS/JS (ES moduly), jen zobrazuje stav
