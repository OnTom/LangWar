// Texty lekcí němčiny pro knihovnu: úvod, tabulka, příklady a tipy.
// Klíče odpovídají lekcím v de.js. Lekce bez textu se v knihovně zobrazí jako „připravuje se“.
export default {
  artikel: {
    summary: 'Každé podstatné jméno má rod a s ním člen: der, die, nebo das.',
    intro: [
      'Každé německé podstatné jméno má rod: mužský (der), ženský (die), nebo střední (das). Rod se často liší od češtiny – das Mädchen (dívka) je střední rod, der Löffel (lžíce) mužský.',
      'Proto se člen vždy učíme spolu se slovem: ne „Hund“, ale „der Hund“.',
      'Podstatná jména se v němčině píšou vždy s velkým písmenem – i uprostřed věty.',
    ],
    table: {
      head: ['Rod', 'Člen určitý', 'Člen neurčitý', 'Příklad'],
      rows: [
        ['mužský', 'der', 'ein', 'der Hund – pes'],
        ['ženský', 'die', 'eine', 'die Katze – kočka'],
        ['střední', 'das', 'ein', 'das Pferd – kůň'],
      ],
    },
    examples: [
      ['Der Hund ist groß.', 'Pes je velký.'],
      ['Die Katze schläft.', 'Kočka spí.'],
      ['Das Kind spielt.', 'Dítě si hraje.'],
      ['Das ist ein Haus.', 'To je dům.'],
    ],
    tips: [
      'Slova na -e jsou většinou ženského rodu: die Blume, die Katze. Výjimky: der Löwe, der Hase, das Auge.',
      'Zdrobněliny na -chen a -lein jsou vždy středního rodu: das Kaninchen.',
      'Slova na -ung, -heit, -keit, -schaft a -in jsou vždy ženského rodu: die Freundin.',
      'Na češtinu se nespoléhej – rod si pamatuj se slovem.',
    ],
  },

  praesens: {
    summary: 'Sloveso se časuje podle osoby: ich spiele, du spielst, er spielt…',
    intro: [
      'V přítomném čase má sloveso pro každou osobu jinou koncovku. Od infinitivu odtrhneš -en (spielen → spiel-) a přidáš koncovku podle osoby.',
      'Malé „sie“ znamená ona i oni – pozná se podle tvaru slovesa (sie spielt = ona hraje, sie spielen = oni hrají). Velké „Sie“ je vykání.',
    ],
    table: {
      head: ['Osoba', 'Koncovka', 'spielen (hrát)', 'arbeiten (pracovat)'],
      rows: [
        ['ich (já)', '-e', 'spiele', 'arbeite'],
        ['du (ty)', '-st', 'spielst', 'arbeitest'],
        ['er / sie / es (on, ona, ono)', '-t', 'spielt', 'arbeitet'],
        ['wir (my)', '-en', 'spielen', 'arbeiten'],
        ['ihr (vy)', '-t', 'spielt', 'arbeitet'],
        ['sie / Sie (oni, vy – vykání)', '-en', 'spielen', 'arbeiten'],
      ],
    },
    examples: [
      ['Ich spiele Fußball.', 'Hraju fotbal.'],
      ['Du wohnst in Prag.', 'Bydlíš v Praze.'],
      ['Er arbeitet viel.', 'Hodně pracuje.'],
      ['Wir lernen Deutsch.', 'Učíme se německy.'],
    ],
    tips: [
      'Kmen končí na -t nebo -d (arbeiten, finden, warten)? Vlož -e-: du arbeitest, er findet, ihr wartet.',
      'Kmen končí na -s, -ß nebo -z (reisen, tanzen)? U du stačí -t: du reist, du tanzt.',
      'wir a sie/Sie mají stejný tvar jako infinitiv.',
      'Nepravidelná slovesa (du siehst, er liest) přijdou v pozdější lekci.',
    ],
  },

  negation: {
    summary: 'Zápor: kein před podstatným jménem, nicht u slovesa a přídavného jména.',
    intro: [
      'Němčina má dva hlavní zápory: nicht a kein.',
      'kein znamená „žádný“ a dává se místo členu ein/eine nebo před podstatné jméno bez členu.',
      'nicht popírá sloveso, přídavné jméno nebo celou větu. V jednoduché větě stojí na konci.',
    ],
    table: {
      head: ['Kladně', 'Záporně', 'Proč'],
      rows: [
        ['Das ist ein Hund.', 'Das ist kein Hund.', 'ein → kein'],
        ['Das ist eine Katze.', 'Das ist keine Katze.', 'eine → keine'],
        ['Der Hund ist groß.', 'Der Hund ist nicht groß.', 'přídavné jméno → nicht'],
        ['Ich spiele.', 'Ich spiele nicht.', 'sloveso → nicht na konci'],
      ],
    },
    examples: [
      ['Das ist keine Maus.', 'To není myš.'],
      ['Die Suppe ist nicht heiß.', 'Polévka není horká.'],
      ['Wir kommen nicht.', 'Nepřijdeme.'],
      ['Er schläft nicht.', 'Nespí.'],
    ],
    tips: [
      'kein se mění jako ein: kein (mužský a střední rod), keine (ženský rod).',
      'Před přídavným jménem: nicht gut, nicht schnell, nicht groß.',
      'Ve 4. pádě je u mužského rodu keinen – to přijde v lekci o akuzativu.',
    ],
  },

  akkusativ: {
    summary: 'Ve 4. pádě (koho, co) se mění jen mužský rod: der → den, ein → einen.',
    intro: [
      'Akuzativ (4. pád) je pád předmětu: koho nebo co vidím, hledám, kupuji.',
      'Dobrá zpráva: ve 4. pádě se mění jen člen mužského rodu. Ženský a střední rod zůstávají stejné.',
      'Předmět ve 4. pádě mají například slovesa sehen, suchen, finden, kaufen, brauchen, essen nebo haben.',
    ],
    table: {
      head: ['Rod', '1. pád (kdo, co)', '4. pád (koho, co)'],
      rows: [
        ['mužský', 'der / ein', 'den / einen'],
        ['ženský', 'die / eine', 'die / eine'],
        ['střední', 'das / ein', 'das / ein'],
      ],
    },
    examples: [
      ['Ich sehe den Wolf.', 'Vidím vlka.'],
      ['Ich suche einen Schlüssel.', 'Hledám klíč.'],
      ['Ich kaufe eine Banane.', 'Kupuji banán.'],
      ['Ich esse das Brot.', 'Jím chleba.'],
    ],
    tips: [
      'Stačí si pamatovat: der → den, ein → einen, kein → keinen. Všechno ostatní zůstává.',
      'Nejdřív si vybav rod slova (der Hund), pak teprve pád (den Hund).',
    ],
  },

  plural: {
    summary: 'V množném čísle je vždy člen die; koncovku je potřeba znát se slovem.',
    intro: [
      'V množném čísle mají všechna podstatná jména člen die – bez ohledu na rod.',
      'Koncovka množného čísla se ale liší a vyplatí se ji učit spolu se slovem: der Hund, die Hunde.',
      'Často se přidává i přehláska: der Baum → die Bäume, das Haus → die Häuser.',
    ],
    table: {
      head: ['Koncovka', 'Příklad', 'Typicky'],
      rows: [
        ['-e', 'der Hund → die Hunde', 'mužský rod'],
        ['¨-e', 'der Baum → die Bäume', 'mužský rod s přehláskou'],
        ['-n / -en', 'die Katze → die Katzen', 'většina ženského rodu'],
        ['-er / ¨-er', 'das Kind → die Kinder, das Haus → die Häuser', 'střední rod'],
        ['-s', 'das Auto → die Autos', 'cizí slova, slova na samohlásku'],
        ['beze změny / jen ¨', 'das Fenster → die Fenster, der Vater → die Väter', 'slova na -er, -el, -en'],
      ],
    },
    examples: [
      ['Die Kinder spielen.', 'Děti si hrají.'],
      ['Ich sehe zwei Hunde.', 'Vidím dva psy.'],
      ['Die Äpfel sind rot.', 'Jablka jsou červená.'],
    ],
    tips: [
      'Ženský rod má skoro vždy -n nebo -en: die Blume → die Blumen, die Frau → die Frauen.',
      'Slova na -in mají -innen: die Freundin → die Freundinnen.',
      'Zdrobněliny na -chen se nemění: das Kaninchen → die Kaninchen.',
    ],
  },
  unregelmaessig: {
    summary: 'Některá slovesa mění kmen u du a er/sie/es: du sprichst, er sieht, du fährst.',
    intro: [
      'Nepravidelná slovesa mají v přítomném čase stejné koncovky jako pravidelná, ale u du a er/sie/es se jim změní samohláska v kmeni.',
      'Ostatní osoby (ich, wir, ihr, sie) zůstávají pravidelné: ich spreche, wir sprechen – ale du sprichst, er spricht.',
      'Několik sloves je úplně nepravidelných a je potřeba se je naučit celá: sein, haben, werden, wissen.',
    ],
    table: {
      head: ['Změna', 'Infinitiv', 'du', 'er / sie / es'],
      rows: [
        ['e → i', 'sprechen (mluvit)', 'sprichst', 'spricht'],
        ['e → i', 'geben, helfen, nehmen, essen', 'gibst, hilfst, nimmst, isst', 'gibt, hilft, nimmt, isst'],
        ['e → ie', 'sehen (vidět), lesen (číst)', 'siehst, liest', 'sieht, liest'],
        ['a → ä', 'schlafen (spát), fahren (jet)', 'schläfst, fährst', 'schläft, fährt'],
        ['au → äu', 'laufen (běžet)', 'läufst', 'läuft'],
        ['celé jinak', 'sein (být)', 'bist', 'ist'],
        ['celé jinak', 'haben (mít)', 'hast', 'hat'],
      ],
    },
    examples: [
      ['Du sprichst gut Deutsch.', 'Mluvíš dobře německy.'],
      ['Er sieht den Drachen.', 'Vidí draka.'],
      ['Die Katze schläft.', 'Kočka spí.'],
      ['Ich bin müde, du bist hungrig.', 'Jsem unavený, ty jsi hladový.'],
    ],
    tips: [
      'Změna se týká jen du a er/sie/es – ich, wir, ihr a sie/Sie jsou pravidelné.',
      'sein: ich bin, du bist, er ist, wir sind, ihr seid, sie sind.',
      'haben: ich habe, du hast, er hat, wir haben, ihr habt, sie haben.',
      'U essen a lesen splývá du a er: du isst, er isst; du liest, er liest.',
    ],
  },

  perfekt_haben: {
    summary: 'Minulý čas v řeči: haben + příčestí na konci věty (Ich habe gespielt).',
    intro: [
      'V mluvené němčině se o minulosti nejčastěji mluví v perfektu. Skládá se ze dvou částí: tvaru slovesa haben a příčestí minulého.',
      'haben stojí na druhém místě ve větě a příčestí úplně na konci: Ich habe den Hund gesehen.',
      'Pravidelná slovesa tvoří příčestí ge- + kmen + -t (spielen → gespielt). Nepravidelná mají -en a často jinou samohlásku (trinken → getrunken).',
    ],
    table: {
      head: ['Infinitiv', 'Příčestí', 'Věta'],
      rows: [
        ['spielen (hrát)', 'gespielt', 'Ich habe gespielt.'],
        ['kaufen (koupit)', 'gekauft', 'Du hast Brot gekauft.'],
        ['arbeiten (pracovat)', 'gearbeitet', 'Er hat viel gearbeitet.'],
        ['verkaufen (prodat)', 'verkauft', 'Wir haben das Pferd verkauft.'],
        ['sehen (vidět)', 'gesehen', 'Ihr habt den Wolf gesehen.'],
        ['trinken (pít)', 'getrunken', 'Sie haben Bier getrunken.'],
      ],
    },
    examples: [
      ['Ich habe einen Apfel gegessen.', 'Snědl jsem jablko.'],
      ['Hast du gut geschlafen?', 'Spal jsi dobře?'],
      ['Wir haben den Schlüssel gefunden.', 'Našli jsme klíč.'],
      ['Er hat nichts gesagt.', 'Nic neřekl.'],
    ],
    tips: [
      'Kmen končí na -t nebo -d? Přidá se -et: gearbeitet, gewartet.',
      'Slovesa s předponou ver-, be- nebo er- nemají ge-: verkauft, bezahlt.',
      'Nepravidelná příčestí se učí spolu se slovesem: sehen – gesehen, finden – gefunden, nehmen – genommen.',
      'Slovesa pohybu (gehen, kommen, fahren) tvoří perfektum se sein – to přijde v pozdější lekci.',
    ],
  },

  dativ: {
    summary: 'Ve 3. pádě (komu, s kým, odkud) je člen dem, der, dem.',
    intro: [
      'Dativ (3. pád) odpovídá na otázky komu? čemu? – a používá se po některých předložkách a slovesech.',
      'Člen se ve 3. pádě mění u všech rodů: der → dem, die → der, das → dem (neurčitý: einem, einer, einem).',
      'Dativ chtějí předložky mit (s), aus (z), von (od), zu (k), bei (u), nach (po) a slovesa jako helfen (pomáhat), geben (dát komu), danken (děkovat).',
    ],
    table: {
      head: ['Rod', '1. pád', '3. pád', 'Příklad'],
      rows: [
        ['mužský', 'der / ein', 'dem / einem', 'Ich spiele mit dem Hund.'],
        ['ženský', 'die / eine', 'der / einer', 'Ich helfe der Oma.'],
        ['střední', 'das / ein', 'dem / einem', 'Ich komme aus dem Haus.'],
      ],
    },
    examples: [
      ['Ich gebe dem Kind einen Apfel.', 'Dám dítěti jablko.'],
      ['Er hilft der Mutter.', 'Pomáhá matce.'],
      ['Wir kommen aus dem Wald.', 'Jdeme z lesa.'],
      ['Sie spielt mit einer Katze.', 'Hraje si s kočkou.'],
    ],
    tips: [
      'Pozor: der je v 1. pádě mužský rod, ale ve 3. pádě ženský (der Mutter).',
      'zu dem se stahuje na zum, zu der na zur, von dem na vom, bei dem na beim: Ich gehe zur Schule.',
      'helfen má 3. pád stejně jako v češtině (pomáhat komu). Pozor ale: sehen, suchen a finden mají 4. pád – Ich sehe den Hund.',
    ],
  },
};
