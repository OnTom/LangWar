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

/** Může hrdina použít útok? Vrací text chyby, nebo null. */
export function actionError(state, action) {
  if (!Object.hasOwn(BATTLE_ACTIONS, action)) return 'Takový útok neznáme.';
  return null;
}

// Útok hrdiny po vyhodnocení úkolu. Správná odpověď vždy zasáhne.
function heroAttack(state, action, correct) {
  const { hero, enemy } = state;
  const entry = { turn: state.turn, actor: 'hero', action, correct };
  if (!correct) return { ...entry, type: 'miss', damage: 0, hpLeft: enemy.hp };
  const { damage, crit } = rollDamage(hero, enemy, BATTLE_ACTIONS[action].power);
  enemy.hp = Math.max(0, enemy.hp - damage);
  return { ...entry, type: crit ? 'crit' : 'hit', damage, hpLeft: enemy.hp };
}

// Tah nepřítele: když má manu, občas sešle kouzlo (nedá se mu uhnout ani ho vykrýt)
function enemyAttack(state) {
  const { hero, enemy } = state;
  const cost = ENEMY_SPELL_COST;
  const spell = enemy.mana >= cost && chance(CLASSES[enemy.class].unblockable ? 60 : 30);
  const entry = { turn: state.turn, actor: 'enemy', action: spell ? 'spell' : 'attack' };
  if (spell) {
    enemy.mana -= cost;
  } else {
    if (chance(hero.evade)) return { ...entry, type: 'evade', damage: 0, hpLeft: hero.hp };
    if (chance(hero.block)) return { ...entry, type: 'block', damage: 0, hpLeft: hero.hp };
  }
  const { damage, crit } = rollDamage(enemy, hero, spell ? ENEMY_SPELL_POWER : 1);
  hero.hp = Math.max(0, hero.hp - damage);
  return { ...entry, type: crit ? 'crit' : 'hit', damage, hpLeft: hero.hp };
}

function regenerate(f) {
  f.mana = Math.min(f.maxMana, f.mana + MANA_REGEN);
}

/**
 * Odehraje celé kolo: útok hrdiny podle výsledku úkolu a odpověď nepřítele.
 * Mění state; vrací { events, outcome } – outcome je 'won', 'lost' nebo null (boj pokračuje).
 */
export function playRound(state, action, { correct, word = null }) {
  const events = [{ ...heroAttack(state, action, correct), word }];
  let outcome = null;
  if (state.enemy.hp === 0) {
    outcome = 'won';
  } else {
    events.push(enemyAttack(state));
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
