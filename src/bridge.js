export const handSize = 13;

const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
const pointsByRank = { A: 4, K: 3, Q: 2, J: 1 };

export const suits = [
  { id: 'spades', symbol: '♠', name: 'Пики' },
  { id: 'hearts', symbol: '♥', name: 'Купи', red: true },
  { id: 'diamonds', symbol: '♦', name: 'Кари', red: true },
  { id: 'clubs', symbol: '♣', name: 'Спати' },
].map((suit) => ({
  ...suit,
  cards: ranks.map((rank) => ({ id: `${suit.id}-${rank}`, rank })),
}));

export function toggleCard(hand, cardId) {
  if (hand.includes(cardId)) {
    return hand.filter((id) => id !== cardId);
  }
  return hand.length < handSize ? [...hand, cardId] : hand;
}

export function generateHand() {
  return generateDeal()[0];
}

export function generateDeal() {
  const deck = suits.flatMap((suit) => suit.cards.map((card) => card.id));
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return Array.from({ length: 4 }, (_, index) => deck.slice(index * handSize, (index + 1) * handSize));
}

export function summarizeHand(hand) {
  const selected = new Set(hand);
  const groups = suits.map((suit) => ({
    ...suit,
    cards: suit.cards.filter((card) => selected.has(card.id)),
  }));
  const points = groups.flatMap((group) => group.cards)
    .reduce((total, card) => total + (pointsByRank[card.rank] ?? 0), 0);

  return { groups, points };
}
