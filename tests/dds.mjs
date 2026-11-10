import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { analyzeDeals, dealToPbn, validateDdsTable } from '../src/dds.js';

const strains = ['C', 'D', 'H', 'S', 'N'];
const seats = ['N', 'S', 'E', 'W'];
const fixtures = [
  {
    pbn: 'N:AT.J854.AJ.K9874 943.KQT2.872.Q63 KJ7.973.KT963.A5 Q8652.A6.Q54.JT2',
    rows: [[8, 8, 4, 4], [9, 9, 1, 1], [9, 9, 4, 4], [7, 7, 4, 4], [9, 9, 4, 4]],
  },
  {
    pbn: 'N:KJ63.A2.J753.T84 T95.K75.AK84.K65 Q72.T643.QT.9732 A84.QJ98.962.AQJ',
    rows: [[4, 4, 9, 9], [4, 4, 9, 9], [4, 4, 9, 9], [5, 5, 8, 8], [4, 4, 9, 9]],
  },
  {
    // Declarer direction matters: North makes seven hearts, South eight.
    pbn: 'N:KQ5.KQ82.T.JT765 J87.AT93.K743.32 942.765.AQ9.KQ84 AT63.J4.J8652.A9',
    rows: [[9, 9, 4, 4], [5, 5, 7, 7], [7, 8, 5, 5], [6, 6, 7, 7], [7, 7, 4, 4]],
  },
  {
    // Includes a void, zero-trick and thirteen-trick results.
    pbn: 'N:97652.T4.JT6.T73 .AJ63.K84.AJ9652 AQJ843.Q9852.2.Q KT.K7.AQ9753.K84',
    rows: [[0, 0, 13, 13], [0, 0, 13, 13], [3, 3, 9, 9], [7, 7, 5, 5], [0, 0, 12, 12]],
  },
];

function fixtureDeal(pbn) {
  const pbnHands = pbn.slice(2).split(' ').map((hand) => hand.split('.').flatMap((ranks, suit) =>
    [...ranks].map((rank) => `${['spades', 'hearts', 'diamonds', 'clubs'][suit]}-${rank === 'T' ? '10' : rank}`)));
  return [pbnHands[0], pbnHands[3], pbnHands[1], pbnHands[2]];
}
function expectedTable(fixture) {
  return Object.fromEntries(strains.map((strain, index) => [strain,
    Object.fromEntries(seats.map((seat, seatIndex) => [seat, fixture.rows[index][seatIndex]])),
  ]));
}

const engineSource = readFileSync(new URL('../src/vendor/dds/out.js', import.meta.url), 'utf8')
  .replace('export default ddsRuntime;', 'globalThis.dds = ddsRuntime;');
const workerSource = readFileSync(new URL('../src/dds-worker.js', import.meta.url), 'utf8')
  .replace("import dds from './vendor/dds/out.js';", 'const dds = globalThis.dds;');
const workers = [];
let failNext = false;

// Execute the actual worker and native solver in an isolated worker-like global.
// No result values are mocked: the adapter only supplies the browser lifecycle.
class SolverWorker {
  constructor(url, options) {
    assert.equal(options.type, 'module');
    assert.ok(url.pathname.endsWith('/dds-worker.js'));
    this.terminated = false;
    workers.push(this);
    const self = { postMessage: (data) => {
      if (!this.terminated) this.onmessage?.({ data });
    } };
    this.context = vm.createContext({ console, importScripts() {}, setTimeout, self });
    vm.runInContext(engineSource, this.context, { filename: 'vendor/dds/out.js' });
    vm.runInContext(workerSource, this.context, { filename: 'dds-worker.js' });
  }
  postMessage(data) {
    queueMicrotask(() => {
      if (this.terminated) return;
      if (failNext) {
        failNext = false;
        this.onmessage({ data: { type: 'error', message: 'Fixture failure' } });
      } else this.context.self.onmessage({ data });
    });
  }
  terminate() { this.terminated = true; }
}
globalThis.Worker = SolverWorker;

const deals = fixtures.map(({ pbn }) => fixtureDeal(pbn));
deals.forEach((deal, i) => assert.equal(dealToPbn(deal), fixtures[i].pbn));
const invalidDeal = deals[0].map((hand) => [...hand]);
invalidDeal[1][0] = invalidDeal[0][0];
assert.throws(() => dealToPbn(invalidDeal), /52/);
assert.throws(() => dealToPbn(deals[0].map((hand) => hand.slice(1))), /52/);
assert.throws(() => validateDdsTable({ C: { N: 14 } }), /невалиден/);
assert.throws(() => validateDdsTable(null), /невалиден/);
await assert.rejects(analyzeDeals([invalidDeal]), /52/);
assert.equal(workers.length, 0, 'Invalid input must not start the solver');
assert.deepEqual(await analyzeDeals([]), []);

const progress = [];
const tables = await analyzeDeals([...deals, deals[0]], { onProgress: (value) => progress.push(value) });
assert.deepEqual(tables, [...fixtures.map(expectedTable), expectedTable(fixtures[0])]);
assert.deepEqual(progress, Array.from({ length: 6 }, (_, completed) => ({ completed, total: 5 })));
assert.equal(workers.at(-1).terminated, true, 'Completed solver releases its worker/heap');

const aborted = new AbortController();
aborted.abort();
const workersBeforeAbort = workers.length;
await assert.rejects(analyzeDeals(deals, { signal: aborted.signal }), { name: 'AbortError' });
assert.equal(workers.length, workersBeforeAbort, 'Already cancelled work must not allocate a heap');
const cancel = new AbortController();
const pending = analyzeDeals(deals, { signal: cancel.signal });
cancel.abort();
await assert.rejects(pending, { name: 'AbortError' });
assert.equal(workers.at(-1).terminated, true, 'Cancellation terminates the running worker');

failNext = true;
await assert.rejects(analyzeDeals(deals), /Fixture failure/);
assert.equal(workers.at(-1).terminated, true, 'Solver failures release the worker');
console.log('DDS: exact tables, seat/strain mapping, voids, validation, progress, cancellation and cleanup passed.');
