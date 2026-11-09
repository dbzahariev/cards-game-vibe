import assert from 'node:assert/strict';
import { generateDeal, summarizeHand, suits } from '../src/bridge.js';
const unrestricted = () => Array.from({ length: 4 }, () => ({ minPoints: 0, maxPoints: 37, suits: Object.fromEntries(suits.map(s => [s.id, { min: 0, max: 13 }])) }));
function check(ranges) {
  const deal = generateDeal(ranges);
  assert.equal(new Set(deal.flat()).size, 52);
  deal.forEach((hand, p) => {
    assert.equal(hand.length, 13);
    const summary = summarizeHand(hand);
    assert.ok(summary.points >= ranges[p].minPoints && summary.points <= ranges[p].maxPoints);
    summary.groups.forEach((s) => {
      const r = ranges[p].suits[s.id];
      assert.ok(s.cards.length >= r.min && s.cards.length <= r.max);
    });
  });
}
for (let n = 0; n < 100; n++) {
  const ranges = unrestricted();
  ranges[0].minPoints = 15; ranges[0].maxPoints = 17;
  ranges[0].suits.spades = { min: 5, max: 6 };
  ranges[1].suits.hearts = { min: 4, max: 5 };
  ranges[2].suits.diamonds = { min: 0, max: 0 };
  ranges[3].suits.clubs = { min: 4, max: 7 };
  check(ranges);
}
// Derive tight feasible conditions from random deals, across all hands and suits.
for (let n = 0; n < 100; n++) {
  const ranges = generateDeal().map(hand => {
    const { points, groups } = summarizeHand(hand);
    return { minPoints: points, maxPoints: points, suits: Object.fromEntries(groups.map(s => [s.id, { min: s.cards.length, max: s.cards.length }])) };
  });
  check(ranges);
}
const allSuit = unrestricted();
allSuit.forEach((r,p) => { r.minPoints = 10; r.maxPoints = 10; suits.forEach((s,i) => r.suits[s.id] = { min: i === p ? 13 : 0, max: i === p ? 13 : 0 }); });
check(allSuit);
const impossible = unrestricted();
impossible[0].suits.spades = { min: 7, max: 13 }; impossible[1].suits.spades = { min: 7, max: 13 };
assert.throws(() => generateDeal(impossible));
const tooMany = unrestricted();
tooMany[0].suits.spades = { min: 8, max: 13 }; tooMany[0].suits.hearts = { min: 8, max: 13 };
assert.throws(() => generateDeal(tooMany));
const conflict = structuredClone(allSuit); conflict[0].minPoints = 11; conflict[0].maxPoints = 11; conflict[1].minPoints = 9; conflict[1].maxPoints = 9;
assert.throws(() => generateDeal(conflict));
const invalid = unrestricted(); invalid[0].suits.clubs = { min: 5, max: 4 };
assert.throws(() => generateDeal(invalid));
console.log('PASS: mixed ranges, 100 exact deals, extreme shapes, and impossible conditions');
