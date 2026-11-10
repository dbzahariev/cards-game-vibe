import assert from 'node:assert/strict';
import { countDeals } from '../src/count-deals.js';
import { suits, summarizeHand } from '../src/bridge.js';

const free = () => Array.from({ length: 4 }, () => ({ minPoints: 0, maxPoints: 37 }));
const deck = suits.flatMap((s) => s.cards.map((c) => c.id));
assert.deepEqual(countDeals(), { exact: true, value: '53644737765488792839237440000' });
const full = Array.from({ length: 4 }, (_, p) => deck.slice(13 * p, 13 * (p + 1)));
assert.equal(countDeals(null, full).value, '1');
const oneSuit = free();
oneSuit.forEach((r, p) => { r.suits = Object.fromEntries(suits.map((s, i) => [s.id, { min: p === i ? 13 : 0, max: p === i ? 13 : 0 }])); });
assert.equal(countDeals(oneSuit).value, '1');
const impossible = free(); impossible[0].minPoints = 30; impossible[1].minPoints = 30;
assert.equal(countDeals(impossible).value, '0');
assert.throws(() => countDeals(null, [['spades-A'], ['spades-A'], [], []]));

// Compare against exhaustive enumeration of eight distinct remaining cards.
const fixed = full.map((h) => h.slice(2));
const rest = full.flatMap((h) => h.slice(0, 2));
for (const withPoints of [false, true]) {
  const ranges = free();
  ranges[0].suits = { spades: { min: 12, max: 13 } };
  if (withPoints) { ranges[1].minPoints = 6; ranges[1].maxPoints = 12; }
  let expected = 0;
  const hands = fixed.map((h) => [...h]);
  function enumerate(i) {
    if (i === rest.length) {
      if (hands.every((h, p) => {
        const summary = summarizeHand(h);
        return summary.points >= ranges[p].minPoints && summary.points <= ranges[p].maxPoints &&
          summary.groups.every((s) => !ranges[p].suits?.[s.id] || s.cards.length >= ranges[p].suits[s.id].min && s.cards.length <= ranges[p].suits[s.id].max);
      })) expected++;
      return;
    }
    for (const h of hands) if (h.length < 13) { h.push(rest[i]); enumerate(i + 1); h.pop(); }
  }
  enumerate(0);
  const result = countDeals(ranges, fixed);
  assert.equal(result.exact, true);
  assert.equal(result.value, String(expected));
}
const several = free();
several[0].minPoints = 10; several[1].minPoints = 10;
const estimate = countDeals(several, undefined, { maxNodes: 0, samples: 100 });
assert.equal(estimate.exact, false);
assert.equal(estimate.samples, 100);
assert.ok(estimate.upper > 0);
assert.ok(estimate.lower <= estimate.upper);
console.log('PASS: exact total, fixed hands, suit constraints, impossible conditions, brute-force comparison, and estimation fallback');
