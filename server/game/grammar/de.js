// Generátory gramatických cvičení pro němčinu.
// Každá lekce má generátor: dostane formát (choice | fill | order), zásobu podstatných jmen
// a funkci pick() (vybírá častěji to, v čem hráč chybuje) a vrátí cvičení:
// { item, instruction, prompt, hint, options?, answers, tiles?, solution, rule }
import GRAMMAR from '../../data/grammar/de.js';

const ARTICLE_GENDER = { der: 'm', die: 'f', das: 'n' };
const GENDER_OF = { m: 'mužského rodu', f: 'ženského rodu', n: 'středního rodu' };

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function randomOf(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Podstatné jméno ze slovní zásoby rozložené na člen, rod a slovo
export function parseNoun(word) {
  const [article, ...rest] = word.de.split(' ');
  return { id: word.id, topic: word.topic, de: word.de, article, noun: rest.join(' '), gender: ARTICLE_GENDER[article], cz: word.display };
}

// Možnosti pro výběr: správná odpověď + odlišné špatné, zamíchané
function choice(correct, wrong, count = 4) {
  const others = shuffle([...new Set(wrong)].filter((w) => w !== correct)).slice(0, count - 1);
  return shuffle([correct, ...others]);
}

// --- Časování pravidelných sloves ---------------------------------------------

const ENDINGS = { ich: 'e', du: 'st', er: 't', sie_sg: 't', wir: 'en', ihr: 't', sie_pl: 'en' };

/** Tvar pravidelného slovesa v přítomném čase (včetně kmenů na -t/-d a -s/-ß/-z). */
export function conjugate(infinitive, person) {
  const stem = infinitive.replace(/e?n$/, '');
  let ending = ENDINGS[person];
  // arbeiten → du arbeitest, er arbeitet (vložené -e-)
  if (/[td]$/.test(stem) && ['st', 't'].includes(ending)) ending = `e${ending}`;
  // tanzen → du tanzt (kmen končí sykavkou, -s- se nezdvojuje)
  else if (/(s|ß|z|x)$/.test(stem) && ending === 'st') ending = 't';
  return stem + ending;
}

function verbRule(infinitive, person) {
  const stem = infinitive.replace(/e?n$/, '');
  if (/[td]$/.test(stem) && ['du', 'er', 'sie_sg', 'ihr'].includes(person)) {
    return `Kmen „${stem}-“ končí na -t/-d, proto se vkládá -e-: du ${stem}est, er ${stem}et, ihr ${stem}et.`;
  }
  if (/(s|ß|z|x)$/.test(stem) && person === 'du') {
    return `Kmen „${stem}-“ končí na -s/-ß/-z, proto je u du jen -t: du ${stem}t.`;
  }
  return 'Koncovky: ich -e, du -st, er/sie/es -t, wir -en, ihr -t, sie/Sie -en.';
}

// --- Generátory lekcí -----------------------------------------------------------

const generators = {
  // Člen der/die/das
  artikel({ format, nouns, pick }) {
    const n = pick(nouns, (x) => x.id);
    return {
      item: n.id,
      instruction: format === 'fill' ? 'Napiš správný člen' : 'Vyber správný člen',
      prompt: `___ ${n.noun}`,
      hint: `${n.cz}`,
      ...(format === 'choice' ? { options: ['der', 'die', 'das'] } : {}),
      answers: [n.article],
      solution: n.de,
      rule: articleTip(n),
    };
  },

  // Přítomný čas pravidelných sloves
  praesens({ format, pick }) {
    const items = GRAMMAR.regularVerbs.flatMap(([inf, cz]) => GRAMMAR.persons.map((p) => ({ inf, cz, p })));
    const { inf, cz, p } = pick(items, (x) => `${x.inf}:${x.p.key}`);
    const form = conjugate(inf, p.key);
    const allForms = GRAMMAR.persons.map((x) => conjugate(inf, x.key));
    const stem = inf.replace(/e?n$/, '');
    return {
      item: `${inf}:${p.key}`,
      instruction: format === 'fill' ? 'Doplň sloveso ve správném tvaru' : 'Vyber správný tvar slovesa',
      prompt: `${p.de} ___ (${inf})`,
      hint: `${p.de} = ${p.cz} · ${inf} = ${cz}`,
      ...(format === 'choice' ? { options: choice(form, [...allForms, `${stem}est`, `${stem}et`, `${stem}t`]) } : {}),
      answers: [form],
      solution: `${p.de} ${form}`,
      rule: verbRule(inf, p.key),
    };
  },

  // Zápor nicht / kein
  negation({ format, nouns, adjectives, pick }) {
    if (format === 'order') {
      const verbs = GRAMMAR.regularVerbs;
      const items = verbs.flatMap(([inf, cz]) => ['ich', 'du', 'wir'].map((key) => ({ inf, cz, key })));
      const { inf, cz, key } = pick(items, (x) => `order:${x.inf}:${x.key}`);
      const person = GRAMMAR.persons.find((p) => p.key === key);
      const subject = person.de[0].toUpperCase() + person.de.slice(1);
      const words = [subject, conjugate(inf, key), 'nicht'];
      return {
        item: `order:${inf}:${key}`,
        instruction: 'Poskládej zápornou větu',
        prompt: `${subject} ${conjugate(inf, key)}. → zápor`,
        hint: `${inf} = ${cz} · ${person.de} = ${person.cz}`,
        tiles: shuffle(words),
        answers: [words.join(' ')],
        solution: `${words.join(' ')}.`,
        rule: 'Nicht stojí v jednoduché větě až za slovesem (na konci).',
      };
    }
    // Polovina úkolů: „Das ist kein/keine …“, polovina: „… ist nicht + přídavné jméno“
    if (Math.random() < 0.5) {
      const n = pick(nouns, (x) => `kein:${x.id}`);
      const answer = n.gender === 'f' ? 'keine' : 'kein';
      return {
        item: `kein:${n.id}`,
        instruction: format === 'fill' ? 'Doplň zápor' : 'Vyber správný zápor',
        prompt: `Das ist ___ ${n.noun}.`,
        hint: `To není ${n.cz}. (${n.de})`,
        ...(format === 'choice' ? { options: ['kein', 'keine', 'nicht', 'keinen'] } : {}),
        answers: [answer],
        solution: `Das ist ${answer} ${n.noun}.`,
        rule: `Podstatné jméno bez členu (ein/eine) se popírá slovem kein: ${n.gender === 'f' ? 'ženský rod → keine' : 'mužský a střední rod → kein'}.`,
      };
    }
    const n = pick(nouns, (x) => `nicht:${x.id}`);
    const adj = randomOf(adjectives);
    const subject = n.article[0].toUpperCase() + n.article.slice(1);
    return {
      item: `nicht:${n.id}`,
      instruction: format === 'fill' ? 'Doplň zápor' : 'Vyber správný zápor',
      prompt: `${subject} ${n.noun} ist ___ ${adj.de}.`,
      hint: `${n.de} = ${n.cz} · ${adj.de} = ${adj.display}`,
      ...(format === 'choice' ? { options: ['kein', 'keine', 'nicht', 'keinen'] } : {}),
      answers: ['nicht'],
      solution: `${subject} ${n.noun} ist nicht ${adj.de}.`,
      rule: 'Přídavné jméno, sloveso nebo celá věta se popírá slovem nicht (kein jen před podstatným jménem).',
    };
  },

  // Akuzativ (4. pád) u členu
  akkusativ({ format, nouns, pick }) {
    const definite = Math.random() < 0.6;
    const n = pick(nouns, (x) => `${definite ? 'def' : 'indef'}:${x.id}`);
    const verbs = GRAMMAR.accusativeVerbs.filter(([, , , topics]) => !topics || topics.includes(n.topic));
    const [form, inf, cz] = randomOf(verbs);
    const answer = definite
      ? { m: 'den', f: 'die', n: 'das' }[n.gender]
      : { m: 'einen', f: 'eine', n: 'ein' }[n.gender];
    const options = definite ? ['der', 'den', 'dem', 'das', 'die'] : ['ein', 'einen', 'eine', 'einem'];
    return {
      item: `${definite ? 'def' : 'indef'}:${n.id}`,
      instruction: format === 'fill' ? `Doplň ${definite ? 'člen určitý' : 'člen neurčitý'} ve 4. pádě` : 'Vyber člen ve 4. pádě',
      prompt: `Ich ${form} ___ ${n.noun}.`,
      hint: `${inf} = ${cz} · ${n.de} = ${n.cz}`,
      ...(format === 'choice' ? { options: choice(answer, options) } : {}),
      answers: [answer],
      solution: `Ich ${form} ${answer} ${n.noun}.`,
      rule:
        n.gender === 'm'
          ? `${n.de} je mužského rodu: ve 4. pádě se mění ${definite ? 'der → den' : 'ein → einen'}.`
          : `${n.de} je ${GENDER_OF[n.gender]}: ve 4. pádě se člen nemění (${answer}). Mění se jen mužský rod: den, einen.`,
    };
  },

  // Množné číslo
  plural({ format, nouns, pick }) {
    const pool = nouns.filter((n) => GRAMMAR.plurals[n.de]);
    const n = pick(pool, (x) => x.id);
    const answer = GRAMMAR.plurals[n.de];
    return {
      item: n.id,
      instruction: format === 'fill' ? 'Napiš množné číslo' : 'Vyber množné číslo',
      prompt: `${n.de} → die ___`,
      hint: n.cz,
      ...(format === 'choice' ? { options: choice(answer, pluralDistractors(n.noun)) } : {}),
      answers: [answer],
      solution: `die ${answer}`,
      rule: pluralRule(n, answer),
    };
  },
};

// --- Nápovědy k pravidlům ------------------------------------------------------

function articleTip(n) {
  const w = n.noun;
  if (/(chen|lein)$/.test(w)) return `Zdrobněliny na -chen a -lein jsou vždy středního rodu: das ${w}.`;
  if (/(ung|heit|keit|schaft|ion|in)$/.test(w) && n.gender === 'f') return `Slova na -ung, -heit, -keit, -schaft, -ion, -in jsou ženského rodu: die ${w}.`;
  if (/e$/.test(w) && n.gender === 'f') return `Většina slov na -e je ženského rodu: die ${w}.`;
  if (/e$/.test(w) && n.gender !== 'f') return `Pozor, výjimka: většina slov na -e je ženského rodu, ale ${n.de} ne.`;
  return `${n.de} je ${GENDER_OF[n.gender]}. Člen se vyplatí učit spolu se slovem.`;
}

// Přehláska v posledním a/o/u/au (Haus → Häus, Baum → Bäum)
function umlaut(word) {
  const m = word.match(/^(.*)(au|a|o|u)([^aeiouäöü]*)$/i);
  if (!m) return word;
  const map = { au: 'äu', a: 'ä', o: 'ö', u: 'ü', Au: 'Äu', A: 'Ä', O: 'Ö', U: 'Ü' };
  return m[1] + (map[m[2]] ?? m[2]) + m[3];
}

function pluralDistractors(noun) {
  const u = umlaut(noun);
  const base = noun.endsWith('e') ? noun.slice(0, -1) : noun;
  return [noun, `${noun}e`, `${noun}n`, `${noun}en`, `${noun}er`, `${noun}s`, `${u}e`, `${u}er`, u, `${base}en`];
}

function pluralRule(n, plural) {
  if (plural === n.noun) return `${n.de}: množné číslo je stejné (die ${plural}) – typické pro slova na -er, -el, -en.`;
  if (/en$|n$/.test(plural) && n.gender === 'f') return `Ženský rod má v množném čísle nejčastěji -n/-en: die ${plural}.`;
  if (/s$/.test(plural)) return `Slova z cizích jazyků a slova na samohlásku mají často -s: die ${plural}.`;
  if (/er$/.test(plural)) return `Mnoho slov středního rodu má -er, často s přehláskou: die ${plural}.`;
  return `Množné číslo je potřeba se naučit spolu se slovem: ${n.de} → die ${plural}.`;
}

// Formáty cvičení podle lekce
export const FORMATS = {
  artikel: ['choice', 'fill'],
  praesens: ['choice', 'fill'],
  negation: ['choice', 'fill', 'order'],
  akkusativ: ['choice', 'fill'],
  plural: ['choice', 'fill'],
};

export default generators;
