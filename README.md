# LangWar

Webové fantasy RPG (parodie) ve stylu Shakes and Fidget.

## Spuštění

```bash
npm install
npm start        # nebo: npm run dev (automatický restart při změně)
```

Pak otevři http://localhost:3000

**Automatické testy:** `npm test`

**Nasazení na internet:** viz [DEPLOY.md](DEPLOY.md) (Railway nebo vlastní server s Dockerem a automatickým HTTPS).

Záloha databáze: `npm run backup` (do složky `backups/`, drží se posledních 14),
obnova: `npm run restore -- backups/soubor.db` (při vypnutém serveru).

## Nastavení (proměnné prostředí)

| Proměnná     | Výchozí hodnota  | Popis                                                  |
|--------------|------------------|--------------------------------------------------------|
| `PORT`       | `3000`           | Port serveru                                           |
| `DB_FILE`    | `langwar.db`     | Soubor SQLite databáze                                 |
| `NODE_ENV`   | –                | `production` zapne produkční kontroly (viz Zabezpečení) |
| `JWT_SECRET` | vývojový řetězec | Tajný klíč pro tokeny – **v produkci povinný, aspoň 32 znaků** |
| `TRUST_PROXY` | `0`             | Počet proxy před serverem (např. `1` za nginx/hostingem), aby limity viděly skutečnou IP |
| `TIMEZONE`   | `Europe/Prague`  | Časové pásmo pro půlnoční doplnění žízně               |
| `QUEST_TIME_SCALE` | `1`        | Zrychlení času pro vývoj – questy i čekání v aréně (`0.05` = 5 % normální doby) |

Tip pro vývoj – questy trvající pár sekund místo minut:

```bash
QUEST_TIME_SCALE=0.05 npm run dev
```

Ve Windows (PowerShell): `$env:QUEST_TIME_SCALE=0.05; npm run dev`

## Zabezpečení

- Hesla jsou uložená jen jako hash (bcrypt), tokeny jsou podepsané (JWT, HS256)
- V produkci (`NODE_ENV=production`) server odmítne startovat bez `JWT_SECRET` o délce aspoň 32 znaků.
  Vygenerovat ho jde třeba příkazem `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- Limity požadavků z jedné IP: 10 neúspěšných přihlášení za 15 min, 5 registrací za hodinu,
  300 požadavků na API za minutu
- Bezpečnostní hlavičky (helmet) včetně Content-Security-Policy, která povolí jen vlastní skripty
- Tělo požadavku nejvýš 10 kB; jména hráčů a chybové zprávy se v klientovi escapují
- Veškerá herní logika (souboje, odměny, ceny, časovače) běží na serveru

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
| GET    | `/api/arena`         | Aréna: čest, pořadí, soupeři, čekací doba, historie |
| POST   | `/api/arena/fight`   | Vyzvat soupeře `{index}`          |
| GET    | `/api/arena/ladder`  | Síň slávy (prvních 50 + vlastní pořadí) |
| GET    | `/api/daily`         | Dnešní úkoly a stav truhly        |
| POST   | `/api/daily/claim`   | Vyzvednout odměnu za úkol `{slot}` |
| POST   | `/api/daily/chest`   | Otevřít truhlu za všechny úkoly   |
| GET    | `/api/guild`         | Můj cech (nebo pozvánky a možnosti založení) |
| GET    | `/api/guild/ladder`  | Žebříček cechů                    |
| POST   | `/api/guild/create`  | Založit cech `{name, emblem, motto}` |
| POST   | `/api/guild/invite`  | Pozvat hráče `{name}` (vůdce, důstojník) |
| POST   | `/api/guild/invite/cancel` | Zrušit pozvánku `{inviteId}` |
| POST   | `/api/guild/accept`, `/decline` | Přijmout / odmítnout pozvánku `{inviteId}` |
| POST   | `/api/guild/leave`   | Opustit cech (poslední člen ho rozpustí) |
| POST   | `/api/guild/kick`    | Vyhodit člena `{characterId}`     |
| POST   | `/api/guild/role`    | Povýšit/degradovat `{characterId, role}` (vůdce) |
| POST   | `/api/guild/transfer` | Předat vedení `{characterId}` (vůdce) |
| POST   | `/api/guild/donate`  | Přispět do pokladnice `{amount}`  |
| POST   | `/api/guild/upgrade` | Koupit vylepšení `{upgrade: 'xp' \| 'gold'}` |
| POST   | `/api/guild/motto`   | Změnit motto `{motto}` (vůdce)    |
| GET    | `/api/lingo`         | Slovníček: jazyk, typy úkolů, témata a pokrok |
| GET    | `/api/lingo/words?topic=…` | Slova tématu se statistikou |
| POST   | `/api/lingo/task`    | Nový úkol na procvičení `{type, topic?}` |
| POST   | `/api/lingo/answer`  | Odpověď na úkol `{taskId, answer}` |
| GET    | `/api/battle`        | Probíhající tahový souboj (nebo `null`) a energie |
| GET    | `/api/battle/map`    | Mapa Výpravy: lokace, odemčení, nepřátelé, postup a boss |
| POST   | `/api/battle/start`  | Začít souboj (stojí 1 energii) `{location, enemy?}` – `enemy` = pořadí nepřítele, `'boss'` nebo nic (náhodný) |
| POST   | `/api/battle/action` | Zvolit útok `{action: 'light' \| 'heavy' \| 'spell'}` → úkol |
| POST   | `/api/battle/answer` | Odpověď na úkol útoku `{answer}` → průběh kola |
| POST   | `/api/battle/flee`   | Utéct ze souboje (bez odměny)     |
| GET    | `/api/chat?channel=global\|guild` | Posledních 50 zpráv  |
| POST   | `/api/chat`          | Poslat zprávu `{channel, text}`   |
| WS     | `/ws`                | Zprávy chatu v reálném čase (viz `server/ws.js`) |

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

### Tahový souboj (Výprava)

Souboj řídí hráč (`server/game/battle.js`, ukládání a odměny v `server/game/expedition.js`):

- Hráč zvolí útok a splní úkol se slovíčkem – **správná odpověď vždy zasáhne, špatná nebo pozdní mine**
  - 🗡️ **Lehký útok**: výběr ze 4 překladů (DE → CZ, 10 s), síla ×0,6, zdarma
  - 🪓 **Těžký útok**: psaný překlad do češtiny (15 s), síla ×1, zdarma
  - ✨ **Kouzlo**: psaný překlad do němčiny (15 s), síla ×1,5, stojí 10 many
- Pak útočí nepřítel; hrdinova obrana (štít válečníka, úhyb lovce) i zbroj platí.
  Nepřítel s manou občas sešle kouzlo, kterému se nedá uhnout.
- **Mana** = 5 + 2 × Inteligence, každé kolo se doplní 2 body
- Životy a poškození nepřítele se přepočítají tak, aby souboj trval zhruba 3–6 kol;
  silnější hrdina (atributy, výbava) potřebuje méně zásahů a vydrží víc (`BATTLE_*` v pravidlech)
- Zvolený útok nejde vyměnit a po obnovení stránky úkol pokračuje; když hráč nechá čas vypršet, kolo je netrefa
- **Energie**: 50 soubojů denně (doplní se o půlnoci); výhra dá XP, zlato a s 10% šancí předmět

**Mapa** (`server/data/locations.js`): 11 lokací, každá má svá témata slovíček, 3 nepřátele a bosse.

- Lokace se odemyká úrovní postavy; nepřátelé mají úroveň lokace, ale nikdy nižší než hrdina
- Hráč klikne na lokaci, hrdina tam dojde (bez čekání) a může hned bojovat s vybraným nebo náhodným nepřítelem
- Po 5 výhrách v lokaci se ukáže **boss**: o úroveň výš, víc životů a silnější útok,
  ale trojnásobná odměna a vždy předmět (s vyšší šancí na vzácnost); pak se musí znovu „nabít“
- Novou lokaci přidáš úpravou `locations.js` (témata musí existovat ve slovní zásobě)

### Předměty

- 8 slotů: hlava, tělo, ruce, nohy, zbraň, štít (jen válečník), prsten, amulet; inventář má 10 míst
- Rarity: obyčejný (70 %), vzácný (22 %), epický (7 %), legendární (1 %) – vzácnější mají víc a silnější bonusy
- Zdroje: startovní výbava, obchody (nové zboží každý den o půlnoci nebo za poplatek)
  a odměny z questů (asi čtvrtina questů nabízí předmět)
- Generátor je v `server/game/items.js`, názvy a ikony v `server/data/items.js`

### Aréna

- Hráč vybírá ze 3 soupeřů: skuteční hráči s podobnou ctí, chybějící místa doplní NPC gladiátoři
  (`server/data/arena.js`)
- Souboj počítá server z aktuální výbavy obou hráčů; obránce nemusí být online
- Vítěz vezme poraženému čest (víc za výhru nad silnějším) a útočník dostane zlato;
  NPC gladiátor dá polovinu zlata a žádnou čest
- Mezi souboji je 10 minut pauza a během výpravy do arény nejde
- Prvních 5 výher v aréně každý den dá navíc XP
- Síň slávy řadí hráče podle cti

### Denní úkoly

- Každý den 3 náhodné úkoly (výpravy, aréna, obchod, vylepšování…), odměna zlato + XP
- Po vyzvednutí všech tří jde otevřít truhla s předmětem (vyšší šance na vzácnost)
- Druhy úkolů jsou v `server/data/daily.js`, počítadla se volají přes `progressDaily()`

### Slovíčka (čeština – němčina)

- Slovní zásoba je v `server/data/words/de.js`: témata s úrovní, německá podstatná jména se členem,
  české překlady oddělené `|` (první je hlavní, další jsou uznávaná synonyma)
- Typy úkolů: **výběr** ze 4 možností (10 s), **překlad do češtiny** (15 s), **překlad do němčiny** (15 s)
- Kontrola odpovědí: velikost písmen a interpunkce nevadí, synonyma se uznávají,
  **diakritika a přehlásky musí být správně**; u podstatných jmen je člen nepovinný, ale napsaný musí sedět
- Správnou odpověď zná jen server; každý úkol jde zodpovědět jednou a po vypršení času se nepočítá
- Hra si pamatuje úspěšnost u každého slova a chybná slova dává častěji

### Cechy

- Založení za 100 zlaťáků, nejvýš 20 členů, noví členové jen na pozvánku
- Role: vůdce (vše), důstojník (zve, vyhazuje řadové členy, kupuje vylepšení), člen
- Pokladnice: členové přispívají zlatem, vedení kupuje vylepšení
  (Síň učenců = víc XP, Zlatá komora = víc zlata z výprav; +2 % za úroveň, max. 10 úrovní)
- Žebříček cechů podle součtu cti členů

### Chat

- Náves (všichni) a cechovní chat; zprávy se posílají přes REST (limity proti spamu:
  5 zpráv za 10 s, max. 300 znaků) a doručují přes WebSocket na `/ws`
- Cechovní kronika: systémové zprávy o dění v cechu
- Ukládá se posledních 500 zpráv v každém kanálu

## Struktura

- `server/` – Node.js + Express, veškerá herní logika
- `client/` – HTML/CSS/JS (ES moduly), jen zobrazuje stav
