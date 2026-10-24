import QUEST_TEMPLATES from '../data/quests.js';
import { QUEST_OFFERS, QUEST_TYPES, questDurationRange, xpPerMinute, goldPerMinute } from './rules.js';

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomFactor() {
  return 0.85 + Math.random() * 0.3;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Vygeneruje nabídky questů v krčmě pro danou úroveň
export function generateOffers(level) {
  const templates = shuffle(QUEST_TEMPLATES).slice(0, QUEST_OFFERS);
  const types = shuffle(QUEST_TYPES);
  const range = questDurationRange(level);

  return templates.map((t, slot) => {
    const minutes = randomInt(range.min, range.max);
    const type = types[slot % types.length];
    return {
      slot,
      title: t.title,
      description: t.description,
      monster: t.monster,
      monsterIcon: t.monsterIcon,
      monsterClass: t.monsterClass,
      duration: minutes * 60,
      xp: Math.max(1, Math.round(minutes * xpPerMinute(level) * type.xp * randomFactor())),
      gold: Math.max(1, Math.round(minutes * goldPerMinute(level) * type.gold * randomFactor())),
    };
  });
}
