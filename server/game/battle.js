// Tahový souboj řízený hráčem – čistá logika bez databáze.
// Hráč zvolí útok, splní jazykový úkol (správně = zásah) a pak útočí nepřítel.
import {
  CLASSES,
  BATTLE_ACTIONS,
  BATTLE_HERO_HITS,
  BATTLE_ENEMY_HITS,
  BATTLE_STRENGTH_LIMIT,
  BOSS_HP,
  BOSS_DAMAGE,
  BATTLE_CRIT_MULTIPLIER,
  ENEMY_SPELL_POWER,
  MANA_REGEN,
  maxHp,
  maxMana,
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

// Bojovník do tahového souboje (profil postavy nebo monstra proti danému soupeři)
function fighter(f, opponent) {
  const hp = maxHp(f);
  const mana = maxMana(f);
  return {
    name: f.name,
    avatar: f.avatar,
    class: f.class,
    level: f.level,
    hp,
    maxHp: hp,
    mana,
    maxMana: mana,
    damage: damageRange(f),
    crit: critChance(f, opponent.level),
    block: blockChance(f),
    evade: CLASSES[f.class].evadeChance,
    armorReduction: armorReduction(f, opponent.level),
  };
}

// Průměrné poškození útoku po započtení zbroje, kritických zásahů a obrany
function averageHit(att, def, { dodge = true } = {}) {
  const roll = (att.damage.min + att.damage.max) / 2;
  const crit = 1 + (att.crit / 100) * (BATTLE_CRIT_MULTIPLIER - 1);
  const defense = dodge ? (1 - def.evade / 100) * (1 - def.block / 100) : 1;
  return roll * crit * (1 - def.armorReduction / 100) * defense;
}

/**
 * Nový souboj: hero = bojový profil postavy, monster = profil monstra.
 * Životy a poškození nepřítele se přepočítají tak, aby souboj trval pár kol,
 * ale síla obou stran (atributy, výbava, úroveň) pořád rozhodovala.
 */
export function createBattle(hero, monster, { boss = false } = {}) {
  const h = fighter(hero, monster);
  const e = fighter(monster, hero);

  // Kolik útoků by každá strana potřebovala podle běžných pravidel
  const heroHit = averageHit(h, e, { dodge: false }); // správná odpověď vždy zasáhne
  const enemyHit = averageHit(e, h);
  const ratio = e.maxHp / heroHit / (h.maxHp / enemyHit); // < 1 = hrdina je silnější
  const strength = Math.min(BATTLE_STRENGTH_LIMIT, Math.max(1 / BATTLE_STRENGTH_LIMIT, Math.sqrt(ratio)));

  e.maxHp = e.hp = Math.max(1, Math.round(BATTLE_HERO_HITS * strength * heroHit * (boss ? BOSS_HP : 1)));
  const damageScale = (h.maxHp / (BATTLE_ENEMY_HITS / strength) / enemyHit) * (boss ? BOSS_DAMAGE : 1);
  e.damage = {
    min: Math.max(1, Math.round(e.damage.min * damageScale)),
    max: Math.max(1, Math.round(e.damage.max * damageScale)),
  };
  return { hero: h, enemy: { ...e, boss }, turn: 1, log: [] };
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
  if (state.hero.mana < BATTLE_ACTIONS[action].mana) return 'Na kouzlo ti chybí mana.';
  return null;
}

/** Zaplatí manu za útok (hned při volbě, aby se úkol nedal „přehodit“ zdarma). */
export function payForAction(state, action) {
  state.hero.mana -= BATTLE_ACTIONS[action].mana;
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
  const cost = BATTLE_ACTIONS.spell.mana;
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
