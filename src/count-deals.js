import { suits } from './bridge.js';

const factorial = [1n];
for (let n = 1; n <= 52; n++) factorial[n] = factorial[n - 1] * BigInt(n);
const multinomial = (sizes) => sizes.reduce((value, n) => value / factorial[n], factorial[sizes.reduce((a, b) => a + b, 0)]);

// Count labeled directions; card order within a hand does not matter.
export function countDeals(condition = null, fixedHands = [[], [], [], []], options = {}) {
  const ranges = condition ?? Array.from({ length: 4 }, () => ({ minPoints: 0, maxPoints: 37 }));
  const valid = (a, b, max) => Number.isInteger(a) && Number.isInteger(b) && a >= 0 && a <= b && b <= max;
  if (ranges.length !== 4 || ranges.some((r) => !valid(r.minPoints, r.maxPoints, 37) ||
    suits.some((s) => r.suits?.[s.id] && !valid(r.suits[s.id].min, r.suits[s.id].max, 13)))) {
    throw new Error('Провери диапазоните за точки и бои.');
  }
  const deck = suits.flatMap((suit, s) => suit.cards.map((card, i) => ({ id: card.id, s, points: [4, 3, 2, 1][i] ?? 0 })));
  const byId = new Map(deck.map((c) => [c.id, c]));
  if (fixedHands.length !== 4 || fixedHands.some((h) => h.length > 13 || h.some((id) => !byId.has(id))) ||
    new Set(fixedHands.flat()).size !== fixedHands.flat().length) throw new Error('Провери зададените карти за повторения и валидност.');
  const fixed = new Set(fixedHands.flat());
  const rest = deck.filter((c) => !fixed.has(c.id));
  const bounds = ranges.map((r) => suits.map((s) => r.suits?.[s.id] ?? { min: 0, max: 13 }));
  const counts = fixedHands.map((h) => suits.map((_, s) => h.filter((id) => byId.get(id).s === s).length));
  const scores = fixedHands.map((h) => h.reduce((sum, id) => sum + byId.get(id).points, 0));
  const sizes = fixedHands.map((h) => h.length);
  const total = multinomial(sizes.map((n) => 13 - n));
  const exact = (value) => ({ exact: true, value: value.toString() });
  const pointFree = ranges.every((r) => r.minPoints === 0 && r.maxPoints === 37);
  if (pointFree && bounds.every((row) => row.every((b) => b.min === 0 && b.max === 13))) return exact(total);
  // A single constrained direction can be counted by subset DP, then the
  // remaining distinct cards can be distributed freely among the other three.
  const constrained = ranges.map((r, p) => r.minPoints !== 0 || r.maxPoints !== 37 || bounds[p].some((b) => b.min !== 0 || b.max !== 13));
  if (constrained.filter(Boolean).length === 1) {
    const p = constrained.indexOf(true), needed = 13 - sizes[p];
    let combined = new Map([['0,0', 1n]]);
    for (let s = 0; s < 4; s++) {
      let subsets = new Map([['0,0', 1n]]);
      for (const card of rest.filter((c) => c.s === s)) {
        const next = new Map(subsets);
        for (const [key, ways] of subsets) {
          const [n, points] = key.split(',').map(Number);
          if (n < needed) {
            const added = `${n + 1},${points + card.points}`;
            next.set(added, (next.get(added) ?? 0n) + ways);
          }
        }
        subsets = next;
      }
      const next = new Map();
      for (const [key, ways] of combined) {
        const [n, points] = key.split(',').map(Number);
        for (const [suitKey, suitWays] of subsets) {
          const [sn, sp] = suitKey.split(',').map(Number);
          if (sn + counts[p][s] < bounds[p][s].min || sn + counts[p][s] > bounds[p][s].max || n + sn > needed || points + sp + scores[p] > ranges[p].maxPoints) continue;
          const added = `${n + sn},${points + sp}`;
          next.set(added, (next.get(added) ?? 0n) + ways * suitWays);
        }
      }
      combined = next;
    }
    let ways = 0n;
    for (const [key, count] of combined) {
      const [n, points] = key.split(',').map(Number);
      if (n === needed && points + scores[p] >= ranges[p].minPoints) ways += count;
    }
    return exact(ways * multinomial(sizes.filter((_, q) => q !== p).map((n) => 13 - n)));
  }
  const groups = [];
  for (const card of rest) {
    const points = pointFree ? 0 : card.points;
    let group = groups.find((g) => g.s === card.s && g.points === points);
    if (!group) { group = { s: card.s, points, n: 0 }; groups.push(group); }
    group.n++;
  }
  groups.sort((a, b) => b.points - a.points);
  const suffix = Array.from({ length: groups.length + 1 }, () => ({ suits: [0, 0, 0, 0], points: 0 }));
  for (let i = groups.length - 1; i >= 0; i--) {
    suffix[i] = { suits: [...suffix[i + 1].suits], points: suffix[i + 1].points + groups[i].n * groups[i].points };
    suffix[i].suits[groups[i].s] += groups[i].n;
  }
  function feasible(i) {
    const remaining = suffix[i];
    for (let p = 0; p < 4; p++) {
      if (scores[p] > ranges[p].maxPoints || scores[p] + remaining.points < ranges[p].minPoints || sizes[p] > 13) return false;
      let need = 0, capacity = 0;
      for (let s = 0; s < 4; s++) {
        const b = bounds[p][s], n = counts[p][s];
        if (n > b.max || n + remaining.suits[s] < b.min) return false;
        need += Math.max(0, b.min - n);
        capacity += Math.min(remaining.suits[s], b.max - n);
      }
      if (need > 13 - sizes[p] || capacity < 13 - sizes[p]) return false;
    }
    for (let s = 0; s < 4; s++) {
      if (bounds.reduce((sum, row, p) => sum + Math.max(0, row[s].min - counts[p][s]), 0) > remaining.suits[s] ||
        bounds.reduce((sum, row, p) => sum + row[s].max - counts[p][s], 0) < remaining.suits[s]) return false;
    }
    return true;
  }
  if (ranges.reduce((sum, r) => sum + r.minPoints, 0) > 40 || ranges.reduce((sum, r) => sum + r.maxPoints, 0) < 40 || !feasible(0)) return exact(0n);
  const deadline = performance.now() + (options.exactMs ?? 1200);
  const memo = new Map();
  const limit = Symbol('count limit');
  let nodes = 0;
  function visit(i) {
    if (++nodes > (options.maxNodes ?? 100000) || performance.now() > deadline) throw limit;
    if (!feasible(i)) return 0n;
    if (i === groups.length) return sizes.every((n) => n === 13) ? 1n : 0n;
    const key = `${i}:${counts.flat()}:${pointFree ? '' : scores}`;
    if (memo.has(key)) return memo.get(key);
    const g = groups[i], allocation = [0, 0, 0, 0];
    let result = 0n;
    function distribute(p, left) {
      if (p === 4) {
        if (left) return;
        for (let q = 0; q < 4; q++) {
          counts[q][g.s] += allocation[q]; sizes[q] += allocation[q]; scores[q] += allocation[q] * g.points;
        }
        try { result += multinomial(allocation) * visit(i + 1); }
        finally {
          for (let q = 0; q < 4; q++) {
            counts[q][g.s] -= allocation[q]; sizes[q] -= allocation[q]; scores[q] -= allocation[q] * g.points;
          }
        }
        return;
      }
      const cap = Math.min(left, 13 - sizes[p], bounds[p][g.s].max - counts[p][g.s],
        g.points ? Math.floor((ranges[p].maxPoints - scores[p]) / g.points) : left);
      for (let n = p === 3 ? left : 0; n <= cap; n++) { allocation[p] = n; distribute(p + 1, left - n); }
    }
    distribute(0, g.n);
    memo.set(key, result);
    return result;
  }
  try { return exact(visit(0)); } catch (error) { if (error !== limit) throw error; }

  // Uniformly shuffle the remaining distinct cards. The generator itself is
  // deliberately not used for sampling because it is not uniform over deals.
  const samples = options.samples ?? 30000;
  let hits = 0;
  for (let sample = 0; sample < samples; sample++) {
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    let offset = 0, match = true;
    for (let p = 0; p < 4; p++) {
      const suitCounts = [...counts[p]];
      let points = scores[p];
      for (let n = sizes[p]; n < 13; n++) { const c = rest[offset++]; suitCounts[c.s]++; points += c.points; }
      if (points < ranges[p].minPoints || points > ranges[p].maxPoints || suitCounts.some((n, s) => n < bounds[p][s].min || n > bounds[p][s].max)) match = false;
    }
    if (match) hits++;
  }
  const rate = hits / samples, z2 = 1.96 ** 2, denominator = 1 + z2 / samples;
  const center = (rate + z2 / (2 * samples)) / denominator;
  const margin = 1.96 * Math.sqrt(rate * (1 - rate) / samples + z2 / (4 * samples ** 2)) / denominator;
  return { exact: false, value: Number(total) * rate, lower: Number(total) * Math.max(0, center - margin),
    upper: Number(total) * Math.min(1, center + margin), samples, hits };
}
