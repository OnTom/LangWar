// Gramatika němčiny: učební plán a data pro generátory cvičení.
// Lekce jdou v pořadí; každá odemyká stupeň jednoho druhu kouzla (viz docs/kouzla.md).
// ready = lekce už má generátor cvičení (ostatní přibudou postupně).
export default {
  language: 'de',

  lessons: [
    { key: 'artikel', name: 'Člen der/die/das', level: 2, spell: { kind: 'attack', rank: 1 }, ready: true },
    { key: 'praesens', name: 'Přítomný čas pravidelných sloves', level: 3, spell: { kind: 'heal', rank: 1 }, ready: true },
    { key: 'negation', name: 'Zápor nicht/kein', level: 5, spell: { kind: 'defense', rank: 1 }, ready: true },
    { key: 'akkusativ', name: 'Akuzativ', level: 7, spell: { kind: 'control', rank: 1 }, ready: true },
    { key: 'plural', name: 'Množné číslo', level: 9, spell: { kind: 'attack', rank: 2 }, ready: true },
    { key: 'unregelmaessig', name: 'Nepravidelná slovesa', level: 11, spell: { kind: 'heal', rank: 2 } },
    { key: 'perfekt_haben', name: 'Perfektum s haben', level: 13, spell: { kind: 'buff', rank: 1 } },
    { key: 'dativ', name: 'Dativ', level: 15, spell: { kind: 'control', rank: 2 } },
    { key: 'wortstellung', name: 'Slovosled a otázky', level: 17, spell: { kind: 'defense', rank: 2 } },
    { key: 'adjektive', name: 'Skloňování přídavných jmen', level: 19, spell: { kind: 'attack', rank: 3 } },
    { key: 'modalverben', name: 'Způsobová slovesa', level: 21, spell: { kind: 'heal', rank: 3 } },
    { key: 'perfekt_sein', name: 'Perfektum se sein', level: 23, spell: { kind: 'buff', rank: 2 } },
    { key: 'praepositionen', name: 'Předložky se 3. a 4. pádem', level: 25, spell: { kind: 'control', rank: 3 } },
    { key: 'nebensaetze', name: 'Vedlejší věty (weil, dass)', level: 27, spell: { kind: 'defense', rank: 3 } },
    { key: 'praeteritum', name: 'Préteritum', level: 30, spell: { kind: 'buff', rank: 3 } },
  ],

  // Osobní zájmena pro časování (sie = ona / oni rozlišuje český překlad)
  persons: [
    { key: 'ich', de: 'ich', cz: 'já' },
    { key: 'du', de: 'du', cz: 'ty' },
    { key: 'er', de: 'er', cz: 'on' },
    { key: 'sie_sg', de: 'sie', cz: 'ona' },
    { key: 'wir', de: 'wir', cz: 'my' },
    { key: 'ihr', de: 'ihr', cz: 'vy (vás několik)' },
    { key: 'sie_pl', de: 'sie', cz: 'oni' },
  ],

  // Pravidelná slovesa (v přítomném čase) s českým významem
  regularVerbs: [
    ['spielen', 'hrát'],
    ['kaufen', 'koupit'],
    ['verkaufen', 'prodat'],
    ['suchen', 'hledat'],
    ['wohnen', 'bydlet'],
    ['lernen', 'učit se'],
    ['hören', 'slyšet'],
    ['sagen', 'říct'],
    ['arbeiten', 'pracovat'],
    ['kämpfen', 'bojovat'],
    ['singen', 'zpívat'],
    ['schwimmen', 'plavat'],
    ['fliegen', 'létat'],
    ['trinken', 'pít'],
    ['finden', 'najít'],
    ['schreiben', 'psát'],
    ['gehen', 'jít'],
    ['kommen', 'přijít'],
    ['machen', 'dělat'],
    ['kochen', 'vařit'],
    ['fragen', 'ptát se'],
    ['tanzen', 'tančit'],
    ['reisen', 'cestovat'],
    ['malen', 'malovat'],
    ['bauen', 'stavět'],
    ['warten', 'čekat'],
    ['lachen', 'smát se'],
    ['zahlen', 'platit'],
  ],

  // Slovesa s předmětem ve 4. pádě pro věty v akuzativu: [tvar pro „ich“, infinitiv, význam, témata podstatných jmen]
  // Bez témat = hodí se ke všemu.
  accusativeVerbs: [
    ['sehe', 'sehen', 'vidět', null],
    ['suche', 'suchen', 'hledat', null],
    ['finde', 'finden', 'najít', null],
    ['kaufe', 'kaufen', 'koupit', ['jidlo', 'mesto']],
    ['brauche', 'brauchen', 'potřebovat', ['jidlo', 'mesto', 'rodina']],
    ['esse', 'essen', 'jíst', ['jidlo']],
    ['male', 'malen', 'malovat', ['zvirata', 'priroda', 'rodina', 'mesto']],
  ],

  // Množné číslo podstatných jmen ze slovní zásoby (bez členu; v množném čísle je vždy „die“).
  // Nepočitatelná a v množném čísle neobvyklá slova chybí – v lekci se nepoužijí.
  plurals: {
    'die Mutter': 'Mütter', 'der Vater': 'Väter', 'die Schwester': 'Schwestern', 'der Bruder': 'Brüder',
    'das Kind': 'Kinder', 'die Familie': 'Familien', 'der Sohn': 'Söhne', 'die Tochter': 'Töchter',
    'die Oma': 'Omas', 'der Opa': 'Opas', 'das Haus': 'Häuser', 'die Tür': 'Türen', 'das Fenster': 'Fenster',
    'der Tisch': 'Tische', 'der Stuhl': 'Stühle', 'das Bett': 'Betten', 'die Küche': 'Küchen',
    'das Zimmer': 'Zimmer', 'der Schlüssel': 'Schlüssel', 'die Lampe': 'Lampen', 'das Dach': 'Dächer',
    'der Garten': 'Gärten', 'der Freund': 'Freunde', 'die Freundin': 'Freundinnen', 'der Mann': 'Männer',
    'die Frau': 'Frauen', 'das Baby': 'Babys',

    'der Hund': 'Hunde', 'die Katze': 'Katzen', 'das Pferd': 'Pferde', 'die Kuh': 'Kühe',
    'das Schwein': 'Schweine', 'das Schaf': 'Schafe', 'die Ziege': 'Ziegen', 'das Huhn': 'Hühner',
    'der Hahn': 'Hähne', 'die Maus': 'Mäuse', 'der Vogel': 'Vögel', 'der Fisch': 'Fische', 'der Wolf': 'Wölfe',
    'der Bär': 'Bären', 'der Fuchs': 'Füchse', 'der Hase': 'Hasen', 'das Kaninchen': 'Kaninchen',
    'die Ente': 'Enten', 'die Gans': 'Gänse', 'der Frosch': 'Frösche', 'die Schlange': 'Schlangen',
    'die Spinne': 'Spinnen', 'die Biene': 'Bienen', 'der Löwe': 'Löwen', 'der Drache': 'Drachen',
    'die Eule': 'Eulen', 'die Fledermaus': 'Fledermäuse',

    'der Baum': 'Bäume', 'der Wald': 'Wälder', 'die Blume': 'Blumen', 'der Berg': 'Berge', 'der Fluss': 'Flüsse',
    'der See': 'Seen', 'das Meer': 'Meere', 'der Stein': 'Steine', 'die Wiese': 'Wiesen', 'das Feld': 'Felder',
    'der Stern': 'Sterne', 'der Weg': 'Wege', 'die Insel': 'Inseln', 'die Höhle': 'Höhlen', 'der Sumpf': 'Sümpfe',
    'das Blatt': 'Blätter', 'der Pilz': 'Pilze',

    'das Brot': 'Brote', 'das Ei': 'Eier', 'die Wurst': 'Würste', 'der Apfel': 'Äpfel', 'die Birne': 'Birnen',
    'die Banane': 'Bananen', 'die Kartoffel': 'Kartoffeln', 'die Tomate': 'Tomaten', 'die Suppe': 'Suppen',
    'der Kuchen': 'Kuchen', 'der Saft': 'Säfte', 'die Zwiebel': 'Zwiebeln',

    'der Kopf': 'Köpfe', 'das Auge': 'Augen', 'das Ohr': 'Ohren', 'die Nase': 'Nasen', 'der Mund': 'Münder',
    'der Zahn': 'Zähne', 'das Haar': 'Haare', 'die Hand': 'Hände', 'der Arm': 'Arme', 'das Bein': 'Beine',
    'der Fuß': 'Füße', 'der Finger': 'Finger', 'der Bauch': 'Bäuche', 'das Herz': 'Herzen', 'der Hals': 'Hälse',
    'das Knie': 'Knie', 'die Schulter': 'Schultern', 'das Gesicht': 'Gesichter', 'die Zunge': 'Zungen',

    'der Wind': 'Winde', 'die Wolke': 'Wolken', 'das Gewitter': 'Gewitter', 'der Tag': 'Tage', 'die Nacht': 'Nächte',
    'der Morgen': 'Morgen', 'der Abend': 'Abende', 'die Woche': 'Wochen', 'der Monat': 'Monate', 'das Jahr': 'Jahre',
    'der Winter': 'Winter', 'der Sommer': 'Sommer', 'die Stunde': 'Stunden', 'die Minute': 'Minuten',

    'die Stadt': 'Städte', 'das Dorf': 'Dörfer', 'die Straße': 'Straßen', 'die Brücke': 'Brücken', 'der Markt': 'Märkte',
    'die Kirche': 'Kirchen', 'die Schule': 'Schulen', 'das Geschäft': 'Geschäfte', 'der Bahnhof': 'Bahnhöfe',
    'der Zug': 'Züge', 'das Auto': 'Autos', 'der Bus': 'Busse', 'das Schiff': 'Schiffe', 'das Fahrrad': 'Fahrräder',
    'die Burg': 'Burgen', 'der Turm': 'Türme', 'das Gasthaus': 'Gasthäuser', 'die Karte': 'Karten', 'der Hafen': 'Häfen',
    'die Bank': 'Banken', 'das Krankenhaus': 'Krankenhäuser',

    'der König': 'Könige', 'die Königin': 'Königinnen', 'der Ritter': 'Ritter', 'der Prinz': 'Prinzen',
    'die Prinzessin': 'Prinzessinnen', 'der Bauer': 'Bauern', 'der Lehrer': 'Lehrer', 'der Arzt': 'Ärzte',
    'der Koch': 'Köche', 'der Bäcker': 'Bäcker', 'der Schmied': 'Schmiede', 'der Händler': 'Händler',
    'der Dieb': 'Diebe', 'der Soldat': 'Soldaten', 'der Zauberer': 'Zauberer', 'die Hexe': 'Hexen', 'der Wirt': 'Wirte',
    'der Jäger': 'Jäger', 'der Held': 'Helden', 'der Feind': 'Feinde', 'der Gast': 'Gäste', 'der Nachbar': 'Nachbarn',
  },
};
