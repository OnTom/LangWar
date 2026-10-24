// Druhy denních úkolů. target = rozsah, ze kterého se náhodně vybere cíl.
export default {
  quest_win: { text: 'Úspěšně dokonči výpravy', icon: '🗺️', target: [2, 4] },
  thirst: { text: 'Strav minuty na výpravách', icon: '🍺', target: [10, 25] },
  arena_fight: { text: 'Utkej se v aréně', icon: '⚔️', target: [2, 3] },
  arena_win: { text: 'Vyhraj souboje v aréně', icon: '🏆', target: [1, 2] },
  upgrade: { text: 'Vylepši atributy', icon: '💪', target: [2, 4] },
  shop_buy: { text: 'Nakup u obchodníků', icon: '🛒', target: [1, 1] },
  item_sell: { text: 'Prodej předměty', icon: '💰', target: [1, 3] },
};
