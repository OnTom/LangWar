// Tahový souboj řízený hráčem – čistá logika bez databáze.
// Hráč zvolí útok, splní jazykový úkol (správně = zásah) a pak útočí nepřítel.
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
  ENEMY_SPELL_POWER,
  ENEMY_SPELL_COST,
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

/** Nový souboj: hero = bojový profil postavy, monster = profil monstra nebo soupeře v aréně. */
export function createBattle(hero, monster, { boss = false } = {}) {
  const h = fighter(hero, monster, 'hero');
  const e = fighter(monster, hero, 'enemy');
  if (boss) e.maxHp = e.hp = Math.round(e.maxHp * BOSS_HP);
  const damageScale = (boss ? BOSS_DAMAGE : 1) * beginnerDamageScale(h.level);
  e.damage = {
    min: Math.max(1, Math.round(e.damage.min * damageScale)),
    max: Math.max(1, Math.round(e.damage.max * damageScale)),
  };
  return { v: 2, hero: h, enemy: { ...e, boss }, turn: 1, log: [] };
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

// Posílení: bonus k dalším zásahům hrdiny (útoky i útočná kouzla); spotřebuje se jen zásahem
function empowerBonus(hero) {
  if (!hero.empower?.attacks) return 0;
  const { bonus } = hero.empower;
  hero.empower.attacks--;
  if (hero.empower.attacks === 0) hero.empower = null;
  return bonus;
}

const hp = (state) => ({ heroHp: state.hero.hp, enemyHp: state.enemy.hp });

// Útok hrdiny po vyhodnocení úkolu. Správná odpověď vždy zasáhne.
function heroAttack(state, action, correct) {
  const { hero, enemy } = state;
  const entry = { turn: state.turn, actor: 'hero', action, correct };
  if (!correct) return { ...entry, type: 'miss', damage: 0, hpLeft: enemy.hp, ...hp(state) };
  const { damage: rolled, crit } = rollDamage(hero, enemy, BATTLE_ACTIONS[action].power);
  const bonus = empowerBonus(hero);
  const damage = rolled + bonus;
  enemy.hp = Math.max(0, enemy.hp - damage);
  return { ...entry, type: crit ? 'crit' : 'hit', damage, bonus, hpLeft: enemy.hp, ...hp(state) };
}

// Kouzlo hrdiny: správně = účinek podle druhu a stupně (absolutní síla), chyba = selže
function castSpell(state, spell, correct) {
  const { hero, enemy } = state;
  const entry = {
    turn: state.turn,
    actor: 'hero',
    action: spell.key,
    spell: { kind: spell.kind, name: spell.name, icon: spell.icon, rankName: spell.rankName },
    correct,
  };
  if (!correct) {
    const refund = Math.round(spell.mana * SPELL_FAIL_REFUND);
    hero.mana = Math.min(hero.maxMana, hero.mana + refund);
    return { ...entry, type: 'fizzle', refund, damage: 0, hpLeft: enemy.hp, ...hp(state) };
  }
  const power = SPELL_POWER[spell.kind][spell.rank];
  const done = (effect) => ({ ...entry, type: 'spell', ...effect, hpLeft: enemy.hp, ...hp(state) });

  switch (spell.kind) {
    case 'attack': {
      let damage = rollRange(power);
      let poison = null;
      if (hero.class === 'scout') {
        // Otrávený šíp: polovina hned, zbytek jedem v dalších kolech (jed dá celkem víc)
        const total = Math.round(damage * POISON_BONUS);
        damage = Math.round(total * (1 - POISON_SHARE));
        poison = { perTurn: Math.ceil((total - damage) / POISON_TURNS), turns: POISON_TURNS };
        enemy.poison = poison;
      } else if (hero.class === 'mage') {
        damage = Math.round(damage * (1 - enemy.armorReduction / 100)); // válečníkovi zbroj nevadí
      }
      damage = Math.max(1, damage + empowerBonus(hero));
      enemy.hp = Math.max(0, enemy.hp - damage);
      return done({ effect: 'damage', damage, poison });
    }
    case 'heal': {
      const heal = Math.min(rollRange(power), hero.maxHp - hero.hp);
      hero.hp += heal;
      return done({ effect: 'heal', heal, damage: 0 });
    }
    case 'defense': {
      const shield = rollRange(power);
      hero.shield = (hero.shield ?? 0) + shield;
      return done({ effect: 'shield', shield, damage: 0 });
    }
    case 'control': {
      const damage = spell.rank > 1 ? rollRange(power) : 0;
      enemy.stunned = true;
      enemy.hp = Math.max(0, enemy.hp - damage);
      return done({ effect: 'stun', damage });
    }
    default: {
      const bonus = rollRange(power);
      hero.empower = { bonus, attacks: BUFF_ATTACKS[spell.rank] };
      return done({ effect: 'buff', bonus, attacks: BUFF_ATTACKS[spell.rank], damage: 0 });
    }
  }
}

// Tah nepřítele: omráčený vynechá; jinak útočí, když má manu, občas sešle kouzlo
// (nedá se mu uhnout ani ho vykrýt). Štít hrdiny pohltí část poškození.
function enemyAttack(state) {
  const { hero, enemy } = state;
  if (enemy.stunned) {
    enemy.stunned = false;
    return { turn: state.turn, actor: 'enemy', action: 'stunned', type: 'stunned', damage: 0, hpLeft: hero.hp, ...hp(state) };
  }
  const cost = ENEMY_SPELL_COST;
  const spell = enemy.mana >= cost && chance(CLASSES[enemy.class].unblockable ? 60 : 30);
  const entry = { turn: state.turn, actor: 'enemy', action: spell ? 'spell' : 'attack' };
  if (spell) {
    enemy.mana -= cost;
  } else {
    if (chance(hero.evade)) return { ...entry, type: 'evade', damage: 0, hpLeft: hero.hp, ...hp(state) };
    if (chance(hero.block)) return { ...entry, type: 'block', damage: 0, hpLeft: hero.hp, ...hp(state) };
  }
  const { damage, crit } = rollDamage(enemy, hero, spell ? ENEMY_SPELL_POWER : 1);
  const absorbed = Math.min(hero.shield ?? 0, damage);
  if (absorbed) hero.shield -= absorbed;
  if (!hero.shield) hero.shield = 0;
  hero.hp = Math.max(0, hero.hp - (damage - absorbed));
  return { ...entry, type: crit ? 'crit' : 'hit', damage: damage - absorbed, absorbed, hpLeft: hero.hp, ...hp(state) };
}

// Jed z Otráveného šípu působí na konci kola
function poisonTick(state) {
  const { enemy } = state;
  const damage = Math.min(enemy.poison.perTurn, enemy.hp);
  enemy.hp -= damage;
  enemy.poison.turns--;
  if (enemy.poison.turns <= 0) enemy.poison = null;
  return { turn: state.turn, actor: 'hero', action: 'poison', type: 'poison', damage, hpLeft: enemy.hp, ...hp(state) };
}

function regenerate(f) {
  f.mana = Math.min(f.maxMana, f.mana + MANA_REGEN);
}

/**
 * Odehraje celé kolo: útok nebo kouzlo hrdiny podle výsledku úkolu, odpověď nepřítele a jed.
 * Mění state; vrací { events, outcome } – outcome je 'won', 'lost' nebo null (boj pokračuje).
 */
export function playRound(state, action, { correct, word = null }) {
  const spell = spellOf(state, action);
  const first = spell ? castSpell(state, spell, correct) : heroAttack(state, action, correct);
  const events = [{ ...first, word }];
  let outcome = null;
  if (state.enemy.hp === 0) {
    outcome = 'won';
  } else {
    events.push(enemyAttack(state));
    if (state.hero.hp === 0) outcome = 'lost';
    else if (state.enemy.poison) {
      events.push(poisonTick(state));
      if (state.enemy.hp === 0) outcome = 'won';
    }
  }
  if (!outcome) {
    regenerate(state.hero);
    regenerate(state.enemy);
    state.turn++;
  }
  state.log.push(...events);
  return { events, outcome };
}
