import assert from 'node:assert/strict';
import { generateDeal, summarizeHand, suits } from '../src/bridge.js';
const unrestricted = () => Array.from({ length: 4 }, () => ({ minPoints: 0, maxPoints: 37, suits: Object.fromEntries(suits.map(s => [s.id, { min: 0, max: 13 }])) }));
function check(ranges, fixedHands = [[], [], [], []]) {
  const deal = generateDeal(ranges, fixedHands);
  assert.equal(new Set(deal.flat()).size, 52);
  deal.forEach((hand, p) => {
    assert.equal(hand.length, 13);
    fixedHands[p].forEach((id) => assert.ok(hand.includes(id)));
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

// Full and partial fixed hands must survive the solver, including low cards.
for (let n = 0; n < 50; n++) {
  const original = generateDeal();
  const ranges = original.map((hand) => {
    const { points, groups } = summarizeHand(hand);
    return { minPoints: points, maxPoints: points, suits: Object.fromEntries(groups.map((s) => [s.id, { min: s.cards.length, max: s.cards.length }])) };
  });
  check(ranges, original.map((hand, p) => hand.slice(0, [13, 7, 3, 0][p])));
  check(ranges, original);
}
const fixed = [['spades-A', 'hearts-2'], [], [], []];
const freeDeal = generateDeal(null, fixed);
fixed[0].forEach((id) => assert.ok(freeDeal[0].includes(id)));
assert.equal(new Set(freeDeal.flat()).size, 52);
const fixedConflict = unrestricted();
fixedConflict[0].maxPoints = 3;
assert.throws(() => generateDeal(fixedConflict, fixed), /Няма раздаване/);
fixedConflict[0].maxPoints = 37;
fixedConflict[0].suits.hearts.max = 0;
assert.throws(() => generateDeal(fixedConflict, fixed), /Няма раздаване/);
assert.throws(() => generateDeal(unrestricted(), [['spades-A'], ['spades-A'], [], []]), /повече от веднъж/);
assert.throws(() => generateDeal(unrestricted(), [['invalid'], [], [], []]), /валидни карти/);
assert.throws(() => generateDeal(unrestricted(), [suits[0].cards.map((c) => c.id).concat('hearts-A'), [], [], []]), /до 13/);
console.log('PASS: fixed full and partial hands, automatic completion, duplicates, and conflicting ranges');

// Seeded distribution regression: a max-flow completion used to put nearly
// nine cards in the longest suit, even with entirely unrestricted ranges.
const originalRandom = Math.random;
let seed = 20261110;
Math.random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
try {
  let longestTotal = 0;
  let voids = 0;
  for (let n = 0; n < 200; n++) {
    const deal = generateDeal(unrestricted());
    assert.equal(new Set(deal.flat()).size, 52);
    for (const hand of deal) {
      assert.equal(hand.length, 13);
      const lengths = summarizeHand(hand).groups.map((group) => group.cards.length);
      longestTotal += Math.max(...lengths);
      if (lengths.includes(0)) voids++;
    }
  }
  assert.ok(longestTotal / 800 < 6, `Longest suit average: ${longestTotal / 800}`);
  assert.ok(voids < 160, `Hands with a void: ${voids}`);
  console.log(`PASS: low-card distribution (longest suit ${longestTotal / 800}, voids ${voids}/800)`);
} finally {
  Math.random = originalRandom;
}
