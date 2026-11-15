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
};
