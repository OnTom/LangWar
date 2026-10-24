import {
  CLASSES,
  CRIT_MULTIPLIER,
  MAX_FIGHT_ATTACKS,
  maxHp,
  damageRange,
  critChance,
  blockChance,
  armorReduction,
} from './rules.js';

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function chance(percent) {
  return Math.random() * 100 < percent;
}

// Připraví bojovníka z bojového profilu postavy nebo monstra
function prepare(f, opponent) {
  return {
    cls: CLASSES[f.class],
    hp: maxHp(f),
    damage: damageRange(f),
    crit: critChance(f, opponent.level),
    block: blockChance(f),
    armorReduction: armorReduction(f, opponent.level),
  };
}

// Jeden útok: útočník zkusí zasáhnout obránce
function attack(att, def) {
  if (!att.cls.unblockable) {
    if (chance(def.cls.evadeChance)) return { type: 'evade', damage: 0 };
    if (chance(def.block)) return { type: 'block', damage: 0 };
  }
  let damage = randomInt(att.damage.min, att.damage.max);
  const isCrit = chance(att.crit);
  if (isCrit) damage *= CRIT_MULTIPLIER;
  damage = Math.round(damage * (1 - def.armorReduction / 100));
  return { type: isCrit ? 'crit' : 'hit', damage: Math.max(1, damage) };
}

// Odsimuluje celý souboj dvou bojových profilů. Vrací vítěze ('a' nebo 'b') a záznam pro přehrání v klientovi.
export function fight(a, b) {
  const fighters = { a: prepare(a, b), b: prepare(b, a) };
  const maxHpOf = { a: fighters.a.hp, b: fighters.b.hp };
  const log = [];

  let attacker = Math.random() < 0.5 ? 'a' : 'b';
  for (let i = 0; i < MAX_FIGHT_ATTACKS; i++) {
    const defender = attacker === 'a' ? 'b' : 'a';
    const result = attack(fighters[attacker], fighters[defender]);
    fighters[defender].hp = Math.max(0, fighters[defender].hp - result.damage);
    log.push({ attacker, ...result, hpLeft: fighters[defender].hp });

    if (fighters[defender].hp === 0) {
      return { winner: attacker, log, maxHp: maxHpOf };
    }
    attacker = defender;
  }

  // Nikdo nepadl: vyhrává ten, komu zbylo víc procent života
  const ratio = (k) => fighters[k].hp / maxHpOf[k];
  return { winner: ratio('a') >= ratio('b') ? 'a' : 'b', log, maxHp: maxHpOf };
}
