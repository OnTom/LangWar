# Nasazení hry LangWar na internet

Hra je jeden Node.js server a databáze SQLite v jednom souboru. Hosting proto musí splnit dvě věci:

1. **Trvalý disk** pro databázi – jinak se po každém restartu nebo nasazení nové verze smažou všichni hráči.
   (Pozor na bezplatné tarify typu Render Free: nemají trvalý disk.)
2. **Jen jedna běžící instance** – SQLite neumí sdílet data mezi více kopiemi serveru.

Níže jsou dvě cesty. **Railway** je nejjednodušší (žádná práce se serverem), **vlastní VPS** je levnější
a máš nad vším plnou kontrolu.

Obě používají přiložený `Dockerfile`, takže hra poběží všude stejně.

---

## Tajný klíč (potřeba v obou případech)

Vygeneruj si náhodný klíč pro přihlašovací tokeny a nikomu ho neukazuj:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Bez něj server v produkci nenastartuje. Když ho později změníš, všichni hráči se budou muset znovu přihlásit
(účty ani postavy se tím nesmažou).

---

## Varianta A: Railway (nejjednodušší)

[Railway](https://railway.com) sestaví hru přímo z GitHubu a po každém `git push` ji sám nasadí znovu.
Je to placená služba (aktuální ceník najdeš na jejich webu).

1. Zaregistruj se na railway.com přes svůj GitHub účet.
2. **New Project → Deploy from GitHub repo** → vyber `OnTom/LangWar`.
   Railway najde `Dockerfile` a začne sestavovat.
3. V nastavení služby (**Settings**) přidej **Volume** s cestou připojení **`/data`**.
   Tady bude ležet databáze – bez toho by se data při každém nasazení ztratila.
4. V záložce **Variables** přidej:

   | Proměnná      | Hodnota                         |
   |---------------|---------------------------------|
   | `JWT_SECRET`  | klíč vygenerovaný výše          |
   | `TRUST_PROXY` | `1`                             |
   | `TIMEZONE`    | `Europe/Prague`                 |

   (`NODE_ENV`, `PORT` a `DB_FILE` už nastavuje Dockerfile.)
5. **Settings → Networking → Generate Domain** – dostaneš adresu typu `langwar-production.up.railway.app`.
   Můžeš tam připojit i vlastní doménu; HTTPS zařídí Railway.
6. Otevři adresu a zaregistruj se. Hotovo!

**Kontrola:** na adrese `/api/health` musí být `{"ok":true,…}`.

**Zálohy:** Railway umí zálohovat Volume v nastavení služby (Backups). Případně můžeš spustit
`npm run backup` přes jejich konzoli – zálohy se uloží do `/data/backups`.

---

## Varianta B: Vlastní server (VPS) s Dockerem

Hodí se libovolný levný virtuální server s Linuxem (Ubuntu/Debian), stačí 1 GB RAM.
Přiložený `docker-compose.yml` spustí hru a před ni [Caddy](https://caddyserver.com),
který sám zařídí HTTPS certifikát.

### 1. Doména

U správce domény vytvoř **záznam A** (např. `hra.mojedomena.cz`) s IP adresou serveru.
Chvíli trvá, než se změna projeví.

### 2. Instalace na serveru

Přihlas se na server (`ssh root@IP_SERVERU`) a nainstaluj Docker:

```bash
curl -fsSL https://get.docker.com | sh
```

Stáhni hru a vytvoř konfiguraci:

```bash
git clone https://github.com/OnTom/LangWar.git langwar
cd langwar
cp .env.example .env
nano .env        # vyplň JWT_SECRET a DOMAIN
```

### 3. Spuštění

```bash
docker compose up -d --build
```

Za chvíli běží hra na `https://tvoje-domena`. Stav zjistíš příkazem `docker compose ps`
(u hry má být `healthy`) a výpis serveru `docker compose logs -f game`.

Porty 80 a 443 musí být na serveru otevřené (u některých poskytovatelů se nastavuje firewall v jejich administraci).

### 4. Nová verze hry

```bash
cd langwar
git pull
docker compose up -d --build
```

Databáze je v Docker svazku `game-data`, takže nové nasazení ji nesmaže.
Před větší aktualizací je dobré udělat zálohu (viz níže). Úpravy databáze (nové tabulky a sloupce)
provede server sám při startu – hráči, postavy i předměty zůstanou.

> **Aktualizace na verzi se souboji se slovíčky:** staré questy na čas a žízeň zmizely.
> Rozběhnuté questy a jejich nevyzvednuté odměny se při prvním startu smažou,
> denní úkol „strav minuty na výpravách“ se změní na úkol se slovíčky. Nic dalšího není potřeba.

### 5. Zálohy

Ruční záloha (uloží se do svazku do `/data/backups`, drží se posledních 14):

```bash
docker compose exec game npm run -s backup
```

Automatická noční záloha – přidej přes `crontab -e` řádek:

```
0 4 * * * cd /root/langwar && docker compose exec -T game npm run -s backup
```

Záloha na stejném serveru nepomůže, když server odejde. Občas si zálohu stáhni k sobě:

```bash
docker compose cp game:/data/backups ./zalohy
scp -r root@IP_SERVERU:~/langwar/zalohy .   # spusť na svém počítači
```

**Obnova ze zálohy** (záloha ve složce `zalohy` vedle `docker-compose.yml`):

```bash
docker compose stop game
docker compose run --rm --no-deps -v "$PWD/zalohy:/restore:ro" game npm run -s restore -- /restore/langwar-DATUM.db
docker compose start game
```

Skript zálohu nejdřív zkontroluje a pak ji přes SQLite zapíše do databáze. Poradí si i se zbytky
po pádu serveru, takže nic nemaž ručně.

---

## Nastavení (proměnné prostředí)

| Proměnná           | Výchozí v Dockeru   | Popis |
|--------------------|---------------------|-------|
| `JWT_SECRET`       | –                   | **Povinné.** Tajný klíč, aspoň 32 znaků |
| `TRUST_PROXY`      | `0` (v compose `1`) | Počet proxy před hrou; za Caddy/Railway `1`, aby limity viděly skutečnou IP hráčů |
| `TIMEZONE`         | `Europe/Prague`     | Kdy je „půlnoc“ pro žízeň, obchody a denní úkoly |
| `DB_FILE`          | `/data/langwar.db`  | Cesta k databázi |
| `BACKUP_DIR`       | `/data/backups`     | Kam ukládat zálohy |
| `BACKUP_KEEP`      | `14`                | Kolik posledních záloh držet |
| `PORT`             | `3000`              | Port serveru uvnitř kontejneru |

`QUEST_TIME_SCALE` na produkci nenastavuj – je jen pro testování.

---

## Chat (WebSocket)

Chat používá WebSocket na adrese `/ws` na stejném portu jako hra. Caddy i Railway ho přeposílají
automaticky, nic dalšího se nastavovat nemusí. Když hra poběží za jinou proxy (např. nginx), musí
mít zapnuté přeposílání WebSocketů (hlavičky `Upgrade` a `Connection`).

Hra musí běžet jako **jedna instance** – chat posílá zprávy jen hráčům připojeným ke stejnému serveru
(a SQLite to stejně vyžaduje).

## Když něco nejde

- **Při `npm start` se vypíše „Chybí nainstalované balíčky“ nebo `Cannot find package 'express'`** – ve složce hry
  chybí `npm install` (ve Windows PowerShellu `npm.cmd install`). Je potřeba po prvním stažení a po aktualizaci,
  která přidá balíčky.

- **Server nenastartuje a v logu je „V produkci musí být nastavená proměnná JWT_SECRET“** – chybí nebo je krátký tajný klíč.
- **Po nasazení zmizeli hráči** – databáze není na trvalém disku (zkontroluj Volume `/data`).
- **Caddy nezíská certifikát** – doména ještě neukazuje na server, nebo jsou zavřené porty 80/443.
- **V Hospodě svítí „Připojuji se…“** – proxy nepřeposílá WebSockety (viz sekce Chat).
- **Všem hráčům hlásí „Příliš mnoho pokusů“** – chybí `TRUST_PROXY=1`, server pak vidí všechny hráče jako jednu IP adresu proxy.
