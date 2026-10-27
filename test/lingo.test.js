// Kontrola odpovědí a slovní zásoby
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.js';

const { WORDS, TOPICS, getWord, checkCzech, checkGerman, normalize } = await import('../server/game/lingo.js');

test('slovní zásoba je v pořádku', () => {
  assert.ok(WORDS.length >= 250, `slov je jen ${WORDS.length}`);
  assert.equal(new Set(WORDS.map((w) => w.id)).size, WORDS.length, 'ID slov se nesmí opakovat');
  for (const w of WORDS) {
    if (w.pos === 'n') assert.match(w.de, /^(der|die|das) /, `podstatné jméno bez členu: ${w.de}`);
    assert.ok(w.cz.length > 0 && w.cz.every((f) => f.trim() === f && f), `prázdný překlad: ${w.de}`);
  }
  for (const t of TOPICS) assert.ok(WORDS.filter((w) => w.topic === t.key).length >= 4, `málo slov v ${t.key}`);
});

test('normalizace: velikost písmen, mezery a interpunkce nevadí, diakritika zůstává', () => {
  assert.equal(normalize('  Pes!  '), 'pes');
  assert.equal(normalize('Hrát   si'), 'hrát si');
  assert.equal(normalize('„Kočka“'), 'kočka');
  assert.equal(normalize('ŽÁBA'), 'žába');
});

test('překlad do češtiny: synonyma ano, chybějící diakritika ne', () => {
  const hund = getWord('zvirata:der Hund');
  assert.ok(checkCzech(hund, 'pes'));
  assert.ok(checkCzech(hund, 'Pejsek'));
  assert.ok(!checkCzech(hund, 'kočka'));
  const katze = getWord('zvirata:die Katze');
  assert.ok(checkCzech(katze, 'kočka'));
  assert.ok(!checkCzech(katze, 'kocka'));
});

test('přídavná jména se uznají ve všech rodech', () => {
  const rot = getWord('barvy_cisla:rot');
  for (const f of ['červený', 'červená', 'červené']) assert.ok(checkCzech(rot, f), f);
  assert.ok(!checkCzech(rot, 'cerveny'));
});

test('překlad do němčiny: člen je nepovinný, ale musí sedět; přehlásky povinné', () => {
  const hund = getWord('zvirata:der Hund');
  assert.ok(checkGerman([hund], 'der Hund'));
  assert.ok(checkGerman([hund], 'Hund'));
  assert.ok(checkGerman([hund], 'DER HUND'));
  assert.ok(!checkGerman([hund], 'die Hund'));
  assert.ok(!checkGerman([hund], 'Hunde'));
  const loewe = getWord('zvirata:der Löwe');
  assert.ok(checkGerman([loewe], 'Löwe'));
  assert.ok(!checkGerman([loewe], 'Lowe'));
  const fuss = getWord('telo:der Fuß');
  assert.ok(!checkGerman([fuss], 'Fuss'));
  const gehen = getWord('slovesa:gehen');
  assert.ok(checkGerman([gehen], 'gehen'));
});
