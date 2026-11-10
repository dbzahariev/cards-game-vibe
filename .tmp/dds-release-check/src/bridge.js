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

export function generateDeal(condition = null, fixedHands = [[], [], [], []]) {
  if (Array.isArray(condition)) return generateDealWithRanges(condition, fixedHands);
  if (fixedHands.some((hand) => hand.length)) {
    const ranges = Array.from({ length: 4 }, () => ({ minPoints: 0, maxPoints: 37 }));
    if (condition) Object.assign(ranges[condition.playerIndex], condition);
    return generateDealWithRanges(ranges, fixedHands);
  }
  if (condition) return generateConstrainedDeal(condition);
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

// Count possible subsets so even rare point ranges can be generated directly.
export function generateConstrainedDeal({ playerIndex, minPoints, maxPoints }) {
  if (!Number.isInteger(playerIndex) || playerIndex < 0 || playerIndex > 3 ||
      !Number.isInteger(minPoints) || !Number.isInteger(maxPoints) ||
      minPoints < 0 || maxPoints > 37 || minPoints > maxPoints) {
    throw new Error('Задай цели точки от 0 до 37, с минимум не по-голям от максимума.');
  }
  const deck = suits.flatMap((suit) => suit.cards.map((card) => card.id));
  const values = deck.map((id) => pointsByRank[id.split('-')[1]] ?? 0);
  const memo = new Map();
  function count(index, cards, points) {
    if (cards === 0) return points === 0 ? 1 : 0;
    if (points < 0 || points > cards * 4 || deck.length - index < cards) return 0;
    const key = `${index},${cards},${points}`;
    if (!memo.has(key)) memo.set(key,
      count(index + 1, cards, points) + count(index + 1, cards - 1, points - values[index]));
    return memo.get(key);
  }
  const weights = Array.from({ length: maxPoints - minPoints + 1 }, (_, i) => count(0, 13, minPoints + i));
  let draw = Math.random() * weights.reduce((sum, weight) => sum + weight, 0);
  let points = minPoints;
  for (let i = 0; i < weights.length - 1; i += 1) {
    if (draw < weights[i]) break;
    draw -= weights[i];
    points += 1;
  }
  const hand = [];
  const rest = [];
  let cards = 13;
  deck.forEach((id, index) => {
    const included = count(index + 1, cards - 1, points - values[index]);
    const total = count(index, cards, points);
    if (cards > 0 && Math.random() * total < included) {
      hand.push(id);
      cards -= 1;
      points -= values[index];
    } else rest.push(id);
  });
  for (let i = rest.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  let offset = 0;
  return Array.from({ length: 4 }, (_, index) => {
    if (index === playerIndex) return hand;
    const other = rest.slice(offset, offset + handSize);
    offset += handSize;
    return other;
  });
}


// Solve remaining suit counts as a bounded transportation problem.
function fillSuits(counts, remaining, ranges) {
  const allocation = counts.map((row, p) => row.map((n, s) => Math.max(0, ranges[p].suits[s].min - n)));
  const rows = counts.map((row, p) => 13 - row.reduce((a, b) => a + b, 0) - allocation[p].reduce((a, b) => a + b, 0));
  const cols = remaining.map((n, s) => n - allocation.reduce((sum, row) => sum + row[s], 0));
  if ([...rows, ...cols].some((n) => n < 0)) return null;
  const edges = Array.from({ length: 10 }, () => []);
  function edge(a, b, cap) {
    const forward = { to: b, cap, reverse: edges[b].length };
    edges[a].push(forward);
    edges[b].push({ to: a, cap: 0, reverse: edges[a].length - 1 });
    return forward;
  }
  rows.forEach((n, p) => edge(0, p + 1, n));
  cols.forEach((n, s) => edge(s + 5, 9, n));
  const cells = allocation.map((row, p) => row.map((n, s) => {
    const cap = ranges[p].suits[s].max - counts[p][s] - n;
    return { cap, edge: edge(p + 1, s + 5, Math.max(0, cap)) };
  }));
  if (cells.some((row) => row.some((cell) => cell.cap < 0))) return null;
  let flow = 0;
  while (true) {
    const visited = new Set();
    function push(v, amount) {
      if (v === 9) return amount;
      visited.add(v);
      for (const e of edges[v]) {
        if (e.cap <= 0 || visited.has(e.to)) continue;
        const sent = push(e.to, Math.min(amount, e.cap));
        if (sent) {
          e.cap -= sent;
          edges[e.to][e.reverse].cap += sent;
          return sent;
        }
      }
      return 0;
    }
    const sent = push(0, 52);
    if (!sent) break;
    flow += sent;
  }
  if (flow !== rows.reduce((a, b) => a + b, 0)) return null;
  return allocation.map((row, p) => row.map((n, s) => n + cells[p][s].cap - cells[p][s].edge.cap));
}

export function generateDealWithRanges(input, fixedHands = [[], [], [], []]) {
  const valid = (min, max, limit) => Number.isInteger(min) && Number.isInteger(max) && min >= 0 && max <= limit && min <= max;
  if (input.length !== 4) throw new Error('Необходими са условия за четири ръце.');
  const ranges = input.map((range) => ({
    ...range,
    suits: suits.map((suit) => range.suits?.[suit.id] ?? { min: 0, max: 13 }),
  }));
  if (ranges.some((r) => !valid(r.minPoints, r.maxPoints, 37) || r.suits.some((r) => !valid(r.min, r.max, 13))))
    throw new Error('Провери диапазоните: цели точки от 0 до 37 и брой карти от 0 до 13; минимумът трябва да е до максимума.');
  const impossible = () => new Error('Няма раздаване с тези условия. Общо има 40 HCP, по 13 карти на ръка и по 13 от всяка боя.');
  const deck = new Set(suits.flatMap((suit) => suit.cards.map((card) => card.id)));
  if (!Array.isArray(fixedHands) || fixedHands.length !== 4 || fixedHands.some((hand) =>
    !Array.isArray(hand) || hand.length > 13 || hand.some((id) => !deck.has(id)))) {
    throw new Error('Задай до 13 валидни карти за всяка посока.');
  }
  const fixed = new Set(fixedHands.flat());
  if (fixed.size !== fixedHands.flat().length) throw new Error('Една карта не може да бъде зададена повече от веднъж.');
  if (ranges.reduce((sum, r) => sum + r.minPoints, 0) > 40 ||
      ranges.reduce((sum, r) => sum + r.maxPoints, 0) < 40) throw impossible();
  function shuffle(items) {
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
  const honors = shuffle(suits.flatMap((suit, s) => suit.cards.slice(0, 4).map((card) => ({
    id: card.id, suit: s, points: pointsByRank[card.rank],
  })))).filter((card) => !fixed.has(card.id)).sort((a, b) => b.points - a.points);
  const hands = fixedHands.map((hand) => [...hand]);
  const counts = hands.map((hand) => suits.map((suit) => hand.filter((id) => id.startsWith(suit.id + '-')).length));
  const scores = hands.map((hand) => summarizeHand(hand).points);
  const remaining = suits.map((_, s) => 13 - counts.reduce((sum, row) => sum + row[s], 0));
  if (!fillSuits(counts, remaining, ranges)) throw impossible();
  const failed = new Set();
  let solution;
  let nodes = 0;
  function assign(index) {
    if (++nodes > 300000) throw new Error('Търсенето достигна лимита си. Опитай отново или разшири диапазоните.');
    const rest = honors.slice(index);
    for (let p = 0; p < 4; p += 1) {
      const available = rest.filter((c) => counts[p][c.suit] < ranges[p].suits[c.suit].max)
        .slice(0, 13 - hands[p].length).reduce((sum, c) => sum + c.points, 0);
      if (scores[p] > ranges[p].maxPoints || scores[p] + available < ranges[p].minPoints) return false;
    }
    const key = index + ':' + scores.join(',') + ':' + counts.flat().join(',');
    if (failed.has(key)) return false;
    const allocation = fillSuits(counts, remaining, ranges);
    if (!allocation) return false;
    if (index === honors.length) { solution = allocation; return true; }
    const card = honors[index];
    remaining[card.suit] -= 1;
    for (const p of shuffle([0, 1, 2, 3])) {
      if (hands[p].length === 13 || counts[p][card.suit] >= ranges[p].suits[card.suit].max ||
          scores[p] + card.points > ranges[p].maxPoints) continue;
      hands[p].push(card.id);
      scores[p] += card.points;
      counts[p][card.suit] += 1;
      if (assign(index + 1)) return true;
      counts[p][card.suit] -= 1;
      scores[p] -= card.points;
      hands[p].pop();
    }
    remaining[card.suit] += 1;
    failed.add(key);
    return false;
  }
  if (!assign(0)) throw impossible();
  suits.forEach((suit, s) => {
    const low = shuffle(suit.cards.slice(4).map((c) => c.id).filter((id) => !fixed.has(id)));
    hands.forEach((hand, p) => {
      for (let i = 0; i < solution[p][s]; i += 1) hand.push(low.pop());
    });
  });
  return hands;
}
