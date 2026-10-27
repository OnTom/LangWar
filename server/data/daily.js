// Druhy denních úkolů. target = rozsah, ze kterého se náhodně vybere cíl.
export default {
  quest_win: { text: 'Vyhraj souboje na výpravě', icon: '🗺️', target: [3, 6] },
  correct_words: { text: 'Odpověz správně na slovíčka', icon: '📚', target: [15, 30] },
  bounty_done: { text: 'Splň zakázky z krčmy', icon: '📜', target: [1, 2] },
  arena_fight: { text: 'Utkej se v aréně', icon: '⚔️', target: [2, 3] },
  arena_win: { text: 'Vyhraj souboje v aréně', icon: '🏆', target: [1, 2] },
  upgrade: { text: 'Vylepši atributy', icon: '💪', target: [2, 4] },
  shop_buy: { text: 'Nakup u obchodníků', icon: '🛒', target: [1, 1] },
  item_sell: { text: 'Prodej předměty', icon: '💰', target: [1, 3] },
};
