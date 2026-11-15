// Tahový souboj řízený hráčem – čistá logika bez databáze.
// Hráč zvolí útok nebo kouzlo, splní jazykový úkol (správně = zásah) a pak táhne nepřítel.
import {
  CLASSES,
  BATTLE_ACTIONS,
  BATTLE_HERO_HITS,
  BATTLE_ENEMY_HITS,
  BATTLE_CLASS,
  BATTLE_FACTOR_MIN,
  BATTLE_FACTOR_MAX,
  BATTLE_DAMAGE_SPREAD,
  BOSS_HP,
  BOSS_DAMAGE,
  BATTLE_CRIT_MULTIPLIER,
  ENEMY_SPELL_SUCCESS,
  MANA_REGEN,
  beginnerDamageScale,
  parHp,
  parHit,
  maxHp,
  maxMana,
  damageRange,
  critChance,
  blockChance,
  armorReduction,
} from './rules.js';
import { parProfile } from './monsters.js';
import {
  SPELL_POWER,
  BUFF_ATTACKS,
  POISON_TURNS,
  POISON_SHARE,
  POISON_BONUS,
  SPELL_FAIL_REFUND,
} from '../data/spells.js';

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function chance(percent) {
  return Math.random() * 100 < percent;
}

const average = (range) => (range.min + range.max) / 2;
const clampFactor = (x) => Math.min(BATTLE_FACTOR_MAX, Math.max(BATTLE_FACTOR_MIN, x));

/**
 * Bojové hodnoty v měřítku soubojů. Atributy a výbava se porovnají s průměrným bojovníkem
 * stejné třídy a úrovně a posunou průměrné životy a poškození (odmocnina tlumí extrémy).
 * side = 'hero' (hráč) nebo 'enemy' (monstrum, soupeř v aréně) – každá strana má své měřítko:
 * nepřítel vydrží BATTLE_HERO_HITS zásahů hrdiny, hrdina BATTLE_ENEMY_HITS zásahů nepřítele.
 */
export function battleStats(f, side = 'hero', opponentLevel = f.level) {
  const par = parProfile(f.class, f.level, Boolean(f.monster));
  const hpFactor = clampFactor(Math.sqrt(maxHp(f) / maxHp(par)));
  const damageFactor = clampFactor(Math.sqrt(average(damageRange(f)) / average(damageRange(par))));
  const cls = BATTLE_CLASS[f.class];
  const hp = side === 'hero' ? parHp(f.level) : BATTLE_HERO_HITS * parHit(f.level);
  const hit = side === 'hero' ? parHit(f.level) : parHp(f.level) / BATTLE_ENEMY_HITS;
  const averageHit = hit * cls.damage * damageFactor;
  return {
    maxHp: Math.max(1, Math.round(hp * cls.hp * hpFactor)),
    damage: {
      min: Math.max(1, Math.round(averageHit * (1 - BATTLE_DAMAGE_SPREAD))),
      max: Math.max(1, Math.round(averageHit * (1 + BATTLE_DAMAGE_SPREAD))),
    },
    maxMana: maxMana(f),
    crit: critChance(f, opponentLevel),
    block: blockChance(f),
    evade: CLASSES[f.class].evadeChance,
    armorReduction: armorReduction(f, opponentLevel),
  };
}

// Bojovník do tahového souboje (profil postavy nebo monstra proti danému soupeři)
function fighter(f, opponent, side) {
  const stats = battleStats(f, side, opponent.level);
  return {
    name: f.name,
    avatar: f.avatar,
    class: f.class,
    level: f.level,
    hp: stats.maxHp,
    mana: stats.maxMana,
    ...stats,
  };
}

/**
 * Nový souboj: hero = bojový profil postavy, monster = profil monstra nebo soupeře v aréně,
 * enemySpells = kouzla nepřítele (podle povolání a úrovně, u hráče v aréně jeho nasazená).
 */
export function createBattle(hero, monster, { boss = false, enemySpells = [] } = {}) {
  const h = fighter(hero, monster, 'hero');
  const e = fighter(monster, hero, 'enemy');
  if (boss) e.maxHp = e.hp = Math.round(e.maxHp * BOSS_HP);
  const damageScale = (boss ? BOSS_DAMAGE : 1) * beginnerDamageScale(h.level);
  e.damage = {
    min: Math.max(1, Math.round(e.damage.min * damageScale)),
    max: Math.max(1, Math.round(e.damage.max * damageScale)),
  };
  return { v: 2, hero: h, enemy: { ...e, boss, spells: enemySpells }, turn: 1, log: [] };
}

function rollDamage(att, def, power) {
  let damage = randomInt(att.damage.min, att.damage.max) * power;
  const crit = chance(att.crit);
  if (crit) damage *= BATTLE_CRIT_MULTIPLIER;
  damage = Math.round(damage * (1 - def.armorReduction / 100));
  return { damage: Math.max(1, damage), crit };
}

const rollRange = ([min, max]) => randomInt(min, max);

/** Nasazené kouzlo hrdiny pro akci 'spell:<druh>' (nebo null). */
export function spellOf(state, action) {
  return (state.spells ?? []).find((s) => s.key === action) ?? null;
}

/** Může hrdina použít útok nebo kouzlo? Vrací text chyby, nebo null. */
export function actionError(state, action) {
  if (action.startsWith('spell:')) {
    const spell = spellOf(state, action);
    if (!spell) return 'Tohle kouzlo nemáš nasazené.';
    if (state.hero.mana < spell.mana) return 'Na kouzlo ti chybí mana.';
    return null;
  }
  if (!Object.hasOwn(BATTLE_ACTIONS, action)) return 'Takový útok neznáme.';
  return null;
}

/** Zaplatí manu za kouzlo (hned při volbě, aby se cvičení nedalo „přehodit“ zdarma). */
export function payForAction(state, action) {
  const spell = spellOf(state, action);
  if (spell) state.hero.mana -= spell.mana;
}

// Posílení: bonus k dalším zásahům (útoky i útočná kouzla); spotřebuje se jen zásahem
function empowerBonus(fighter) {
  if (!fighter.empower?.attacks) return 0;
  const { bonus } = fighter.empower;
  fighter.empower.attacks--;
  if (fighter.empower.attacks === 0) fighter.empower = null;
  return bonus;
}

// Štít pohltí část poškození (z útoků i útočných kouzel; jed štítem projde)
function hitThroughShield(target, damage) {
  const absorbed = Math.min(target.shield ?? 0, damage);
  if (absorbed) target.shield -= absorbed;
  target.hp = Math.max(0, target.hp - (damage - absorbed));
  return { damage: damage - absorbed, absorbed };
}

const hp = (state) => ({ heroHp: state.hero.hp, enemyHp: state.enemy.hp });
const other = (side) => (side === 'hero' ? 'enemy' : 'hero');

// Útok hrdiny po vyhodnocení úkolu. Správná odpověď vždy zasáhne.
function heroAttack(state, action, correct) {
  const { hero, enemy } = state;
  const entry = { turn: state.turn, actor: 'hero', action, correct };
  if (!correct) return { ...entry, type: 'miss', damage: 0, hpLeft: enemy.hp, ...hp(state) };
  const { damage: rolled, crit } = rollDamage(hero, enemy, BATTLE_ACTIONS[action].power);
  const bonus = empowerBonus(hero);
  const { damage, absorbed } = hitThroughShield(enemy, rolled + bonus);
  return { ...entry, type: crit ? 'crit' : 'hit', damage, absorbed, bonus, hpLeft: enemy.hp, ...hp(state) };
}

/**
 * Kouzlo hrdiny nebo nepřítele: správně (u nepřítele podle šance) = účinek podle druhu a stupně
 * (absolutní síla), jinak selže a vrátí se část many. side = kdo kouzlí ('hero' | 'enemy').
 */
function castSpell(state, side, spell, success) {
  const caster = state[side];
  const target = state[other(side)];
  const entry = {
    turn: state.turn,
    actor: side,
    action: spell.key,
    spell: { kind: spell.kind, name: spell.name, icon: spell.icon, rankName: spell.rankName },
    correct: success,
  };
  if (!success) {
    const refund = Math.round(spell.mana * SPELL_FAIL_REFUND);
    caster.mana = Math.min(caster.maxMana, caster.mana + refund);
    return { ...entry, type: 'fizzle', refund, damage: 0, hpLeft: state.enemy.hp, ...hp(state) };
  }
  const power = SPELL_POWER[spell.kind][spell.rank];
  // Kouzla nepřátel bijí začínající hrdiny slaběji (stejně jako jejich útoky)
  const scale = side === 'enemy' ? beginnerDamageScale(state.hero.level) : 1;
  const done = (effect) => ({ ...entry, type: 'spell', ...effect, hpLeft: state.enemy.hp, ...hp(state) });

  switch (spell.kind) {
    case 'attack': {
      let damage = rollRange(power) * scale;
      let poison = null;
      if (caster.class === 'scout') {
        // Otrávený šíp: polovina hned, zbytek jedem v dalších kolech (jed dá celkem víc)
        const total = Math.round(damage * POISON_BONUS);
        damage = Math.round(total * (1 - POISON_SHARE));
        poison = { perTurn: Math.ceil((total - damage) / POISON_TURNS), turns: POISON_TURNS };
        target.poison = poison;
      } else if (caster.class === 'mage') {
        damage = damage * (1 - target.armorReduction / 100); // válečníkovi zbroj nevadí
      }
      const hit = hitThroughShield(target, Math.max(1, Math.round(damage) + empowerBonus(caster)));
      return done({ effect: 'damage', ...hit, poison });
    }
    case 'heal': {
      const heal = Math.min(rollRange(power), caster.maxHp - caster.hp);
      caster.hp += heal;
      return done({ effect: 'heal', heal, damage: 0 });
    }
    case 'defense': {
      const shield = rollRange(power);
      caster.shield = (caster.shield ?? 0) + shield;
      return done({ effect: 'shield', shield, damage: 0 });
    }
    case 'control': {
      // Hrdina omráčí nepřítele (vynechá tah); nepřítel hrdinu zmate (příští úkol má méně času)
      if (side === 'hero') target.stunned = true;
      else target.dazed = true;
      const hit = spell.rank > 1 ? hitThroughShield(target, Math.round(rollRange(power) * scale)) : { damage: 0, absorbed: 0 };
      return done({ effect: side === 'hero' ? 'stun' : 'daze', ...hit });
    }
    default: {
      const bonus = rollRange(power);
      caster.empower = { bonus, attacks: BUFF_ATTACKS[spell.rank] };
      return done({ effect: 'buff', bonus, attacks: BUFF_ATTACKS[spell.rank], damage: 0 });
    }
  }
}

// Rozhodnutí nepřítele, jestli kouzlit: léčí se při nízkých životech, jinak občas útočí kouzlem,
// zmate hrdinu, postaví štít nebo se posílí
function enemyChooseSpell(state) {
  const { enemy, hero } = state;
  const usable = (enemy.spells ?? []).filter((s) => s.mana <= enemy.mana);
  const find = (kind) => usable.find((s) => s.kind === kind);
  const heal = find('heal');
  if (heal && enemy.hp < enemy.maxHp * 0.4 && chance(80)) return heal;
  const options = [
    [find('attack'), 30],
    [!hero.dazed && find('control'), 15],
    [!enemy.shield && find('defense'), 15],
    [!enemy.empower && find('buff'), 15],
  ];
  for (const [spell, percent] of options) if (spell && chance(percent)) return spell;
  return null;
}

// Tah nepřítele: omráčený vynechá; jinak kouzlo (vyjde jen s určitou šancí), nebo útok.
// Útoku jde uhnout nebo ho vykrýt, kouzlu ne; štít hrdiny pohltí část poškození.
function enemyTurn(state) {
  const { hero, enemy } = state;
  if (enemy.stunned) {
    enemy.stunned = false;
    return { turn: state.turn, actor: 'enemy', action: 'stunned', type: 'stunned', damage: 0, hpLeft: hero.hp, ...hp(state) };
  }
  const spell = enemyChooseSpell(state);
  if (spell) {
    enemy.mana -= spell.mana;
    return castSpell(state, 'enemy', spell, chance(ENEMY_SPELL_SUCCESS));
  }
  const entry = { turn: state.turn, actor: 'enemy', action: 'attack' };
  if (chance(hero.evade)) return { ...entry, type: 'evade', damage: 0, hpLeft: hero.hp, ...hp(state) };
  if (chance(hero.block)) return { ...entry, type: 'block', damage: 0, hpLeft: hero.hp, ...hp(state) };
  const { damage: rolled, crit } = rollDamage(enemy, hero, 1);
  const { damage, absorbed } = hitThroughShield(hero, rolled + empowerBonus(enemy));
  return { ...entry, type: crit ? 'crit' : 'hit', damage, absorbed, hpLeft: hero.hp, ...hp(state) };
}

// Jed z Otráveného šípu působí na konci kola (side = kdo jed způsobil)
function poisonTick(state, side) {
  const target = state[other(side)];
  const damage = Math.min(target.poison.perTurn, target.hp);
  target.hp -= damage;
  target.poison.turns--;
  if (target.poison.turns <= 0) target.poison = null;
  return { turn: state.turn, actor: side, action: 'poison', type: 'poison', damage, hpLeft: state.enemy.hp, ...hp(state) };
}

function regenerate(f) {
  f.mana = Math.min(f.maxMana, f.mana + MANA_REGEN);
}

/**
 * Odehraje celé kolo: útok nebo kouzlo hrdiny podle výsledku úkolu, tah nepřítele a jed.
 * Mění state; vrací { events, outcome } – outcome je 'won', 'lost' nebo null (boj pokračuje).
 */
export function playRound(state, action, { correct, word = null }) {
  const spell = spellOf(state, action);
  const first = spell ? castSpell(state, 'hero', spell, correct) : heroAttack(state, action, correct);
  const events = [{ ...first, word }];
  let outcome = null;
  if (state.enemy.hp === 0) {
    outcome = 'won';
  } else {
    events.push(enemyTurn(state));
    if (state.hero.hp === 0) outcome = 'lost';
  }
  // Jed na konci kola: nejdřív ten na nepříteli, pak na hrdinovi
  if (!outcome && state.enemy.poison) {
    events.push(poisonTick(state, 'hero'));
    if (state.enemy.hp === 0) outcome = 'won';
  }
  if (!outcome && state.hero.poison) {
    events.push(poisonTick(state, 'enemy'));
    if (state.hero.hp === 0) outcome = 'lost';
  }
  if (!outcome) {
    regenerate(state.hero);
    regenerate(state.enemy);
    state.turn++;
  }
  state.log.push(...events);
  return { events, outcome };
}
