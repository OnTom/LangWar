# Kouzla a gramatika – návrh

Dohodnutá pravidla pro kouzla s gramatikou. Čísla jsou výchozí a doladí se simulací.

## Princip

- Hráč se v **knihovně** učí gramatiku: přečte si lekci a složí zkoušku. Tím získá kouzlo nebo jeho vyšší stupeň.
- V souboji kouzlo sešle tak, že splní **krátké cvičení** na danou gramatiku.
  Chyba = kouzlo selže, správně = kouzlo se provede.
- Kouzla mají **absolutní sílu** (např. léčení 25–30 životů), ne relativní k úrovni.
  Protože životy a poškození s úrovní rostou, starší stupně kouzel postupně slábnou
  a hráč má důvod učit se dál.
- Všichni hráči se učí **stejnou gramatiku**, ale každé povolání má **vlastní kouzla**.
  Zatím je hratelný jen **mág**; válečník a lovec jsou připravení a zapnou se přepínačem `ENABLED_CLASSES`.
- Hra bude pro víc jazyků: **kouzla a jejich účinky jsou společné**, pod nimi je gramatika daného jazyka.

## Kouzla podle povolání

| Druh | 🛡️ Válečník | 🔮 Mág | 🏹 Lovec |
|---|---|---|---|
| Útok | Drtivý úder | Ohnivá koule | Otrávený šíp (poškození i v dalších kolech) |
| Léčení | Druhý dech | Léčivé světlo | Bylinný obklad |
| Obrana | Štítový val (zastaví úder) | Magický štít (pohltí poškození) | Kouřová clona (příští útok mine) |
| Kontrola | Omračující rána | Zmrazení | Síť |
| Posílení | Válečný pokřik (silnější útoky) | Soustředění (silnější další kouzlo) | Orlí oko (kritické zásahy) |

V souboji jsou nasazená **nejvýš 4 kouzla** (kniha kouzel).

## Gramatika pod kouzly (němčina)

Každý druh kouzla má vlastní oblast gramatiky; vyšší stupeň = těžší gramatika a silnější kouzlo.

| Druh | Stupeň I | Stupeň II | Stupeň III |
|---|---|---|---|
| Útok ↔ podstatné jméno | der/die/das | množné číslo | skloňování přídavných jmen |
| Léčení ↔ slovesa | přítomný čas, pravidelná | nepravidelná slovesa | způsobová slovesa |
| Obrana ↔ věta | zápor nicht/kein | slovosled a otázky | vedlejší věty (weil, dass) |
| Kontrola ↔ pády | akuzativ | dativ | předložky se 3./4. pádem |
| Posílení ↔ minulost | perfektum s haben | perfektum se sein | préteritum |

### Učební plán

Jedna řada lekcí; lekce se odemyká úrovní a další jde koupit až po složení předchozí:

| Úroveň | Lekce | Kouzlo |
|---|---|---|
| 2 | der/die/das | Útok I |
| 3 | přítomný čas | Léčení I |
| 5 | nicht/kein | Obrana I |
| 7 | akuzativ | Kontrola I |
| 9 | množné číslo | Útok II |
| 11 | nepravidelná slovesa | Léčení II |
| 13 | perfektum s haben | Posílení I |
| 15 | dativ | Kontrola II |
| 17 | slovosled a otázky | Obrana II |
| 19 | přídavná jména | Útok III |
| 21 | způsobová slovesa | Léčení III |
| 23 | perfektum se sein | Posílení II |
| 25 | předložky | Kontrola III |
| 27 | vedlejší věty | Obrana III |
| 30 | préteritum | Posílení III |

## Účinky (absolutní, náhodně v rozmezí)

| Druh | Stupeň I | Stupeň II | Stupeň III |
|---|---|---|---|
| Útok | 30–36 poškození | 60–70 | 100–115 |
| Léčení | 25–30 životů | 55–65 | 90–105 |
| Obrana | pohltí 20–25 poškození | 45–55 | 80–90 |
| Kontrola | nepřítel vynechá tah | vynechá tah a dostane 15–20 | vynechá tah a dostane 40–50 |
| Posílení | +8–10 k dalším 2 útokům | +15–18 ke 3 útokům | +25–30 ke 3 útokům |
| **Cena many** | 15 | 25 | 40 |

Pro srovnání (měřítko soubojů, běžná postava): životy hrdiny ~100 / ~200 / ~300
a těžký útok ~16 / ~30 / ~45 na 1. / 15. / 30. úrovni.

## Účinky v souboji (jak jsou naprogramované)

- **Útok:** mág – zásah (zbroj nepřítele ho sníží jako obvykle); válečník – zásah, který zbroj nesníží;
  lovec – polovina poškození hned, zbytek (o 20 % víc) jedem na konci tohoto a příštího kola.
- **Léčení:** doplní životy (nejvýš do maxima).
- **Obrana:** štít pohlcuje poškození z dalších útoků nepřítele, dokud se nevyčerpá.
- **Kontrola:** nepřítel vynechá tah v tomtéž kole; stupeň II a III přidá poškození.
- **Posílení:** bonus k dalším zásahům hrdiny (útoky i útočná kouzla); netrefa ho nespotřebuje.
- Léčení, obrana, kontrola a posílení mají u všech povolání stejný účinek, liší se názvem a popisem.
- Mana se platí hned při volbě kouzla, takže cvičení nejde „přehodit“. Zakázka v krčmě „Úspěšně sešli N kouzel“
  se nabízí jen tomu, kdo nějaké kouzlo umí.

## Mana a selhání

- Mana = 30 + Inteligence, každé kolo se doplní 3 body.
- **Selhání kouzla:** vrátí se 20 % many, 80 % propadne. Nepřítel normálně zaútočí.
  Ukáže se správná odpověď a krátké připomenutí pravidla.

## Knihovna

1. Knihu (lekci) hráč koupí za zlato – zhruba 10 výher na úrovni, kde se lekce odemyká.
2. Přečte si lekci: vysvětlení, tabulka, příklady.
3. Složí zkoušku bez časového limitu (4 z 5 správně); opakovat jde zdarma.
4. Kouzlo se přidá do knihy kouzel, lekce zůstane k dalšímu čtení.

## Cvičení

- Formáty: výběr z možností (15 s), doplnění tvaru (25 s), skládání slov do věty (30 s).
- Cvičení se skládají ze slovíček z odemčených lokací (chyba je pak v gramatice, ne ve slovíčku).
- **Velikost písmen se hlídá ve všech jazycích**, stejně jako diakritika a přehlásky.
- Gramatika, ve které hráč chybuje, se objevuje častěji.

## Nepřátelé a aréna

- Nepřátelé na mapě kouzlí podle svého povolání, stupně kouzel podle úrovně (stejně jako by je měl hráč):
  monstrum umí 2 kouzla, boss a gladiátor 3 (přednost má útok a léčení); kouzla jim vyjdou v 75 % případů.
- Počítač léčí při méně než 40 % životů, jinak občas útočí kouzlem, staví štít, posiluje se nebo hrdinu zmate.
- **Kontrola nepřítele hrdinu nezastaví** (hráč by ztratil tah), ale **zmate**: příští úkol má jen 60 % času;
  stupeň II a III přidá poškození. Štít nepřítele pohlcuje zásahy hrdiny, jed lovce působí i na hrdinu.
- Kouzla nepřátel bijí začínající hrdiny (1.–4. úroveň) slaběji, stejně jako jejich útoky.
- Boss má kvůli léčení a štítům jen 1,3× víc životů (dřív 1,5×).
- V aréně soupeř používá kouzla, která se skutečný hráč naučil a nasadil.
  Později přibudou souboje hráčů naživo.

## Základní útoky

- Lehký útok (výběr ze 4) a těžký útok (psaní) náhodně střídají směr překladu do češtiny a do cizího jazyka.
- Samostatné „Kouzlo“ (překlad do cizího jazyka) zaniklo – nahradí ho kouzla z knihovny.

## Postup

1. ✅ Nové měřítko soubojů, útoky oběma směry, velká písmena
2. ✅ Gramatický engine: učební plán po jazycích, generátory cvičení, kontrola, sledování chyb
3. ✅ Knihovna: lekce, nákup za zlato, zkouška, kniha kouzel se 4 sloty
4. ✅ Kouzla v boji: účinky, mana, selhání
5. ✅ Kouzlící nepřátelé a aréna
6. ✅ Obsah lekcí 1–8 (všech pět druhů kouzel, Útok/Léčení/Kontrola až do stupně II), testy, vyvážení

Administrace (menu 🛠️ Admin) umí naučit lekci bez zkoušky, naučit všechny hotové lekce a vše zapomenout.
