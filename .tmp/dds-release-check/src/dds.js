import { suits } from './bridge.js';

const pbnSeatOrder = [0, 2, 3, 1]; // The app stores N, W, E, S; PBN uses N, E, S, W.
const strains = ['C', 'D', 'H', 'S', 'N'];
const seats = ['N', 'S', 'E', 'W'];
const cardIds = new Set(suits.flatMap((suit) => suit.cards.map((card) => card.id)));

export function dealToPbn(deal) {
  if (!Array.isArray(deal) || deal.length !== 4 ||
      deal.some((hand) => !Array.isArray(hand) || hand.length !== 13 || hand.some((card) => !cardIds.has(card))) ||
      new Set(deal.flat()).size !== 52) {
    throw new Error('За DDS анализ са необходими 52 различни карти — по 13 за всяка посока.');
  }
  const hands = pbnSeatOrder.map((index) => {
    const selected = new Set(deal[index]);
    return suits.map((suit) => suit.cards
      .filter((card) => selected.has(card.id))
      .map((card) => card.rank === '10' ? 'T' : card.rank)
      .join('')).join('.');
  });
  return `N:${hands.join(' ')}`;
}

export function validateDdsTable(table) {
  if (!table || strains.some((strain) => seats.some((seat) =>
    !Number.isInteger(table[strain]?.[seat]) || table[strain][seat] < 0 || table[strain][seat] > 13))) {
    throw new Error('DDS върна невалиден резултат. Опитай отново.');
  }
  return Object.fromEntries(strains.map((strain) => [strain,
    Object.fromEntries(seats.map((seat) => [seat, table[strain][seat]])),
  ]));
}

// Run exact double-dummy analysis outside the UI thread. Terminating the worker
// also releases the native solver heap, including when a request is cancelled.
export async function analyzeDeals(deals, { onProgress, signal } = {}) {
  if (signal?.aborted) throw new DOMException('Анализът е отменен.', 'AbortError');
  if (!Array.isArray(deals)) throw new Error('Избери раздавания за DDS анализ.');
  const boards = deals.map(dealToPbn);
  if (boards.length === 0) return [];

  return new Promise((resolve, reject) => {
    let worker;
    let finished = false;
    let completed = 0;
    const tables = new Array(boards.length);
    const finish = (error) => {
      if (finished) return;
      finished = true;
      worker?.terminate();
      signal?.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(tables);
    };
    const abort = () => finish(new DOMException('Анализът е отменен.', 'AbortError'));

    try {
      worker = new Worker(new URL('./dds-worker.js', import.meta.url), { type: 'module', name: 'dds-analysis' });
      signal?.addEventListener('abort', abort, { once: true });
      // Cover an abort occurring between the initial check and listener setup.
      if (signal?.aborted) { abort(); return; }
      worker.onerror = () => finish(new Error('DDS анализът не успя да се изпълни. Опитай отново.'));
      worker.onmessageerror = () => finish(new Error('DDS резултатът не може да бъде прочетен. Опитай отново.'));
      worker.onmessage = ({ data }) => {
        if (finished) return;
        try {
          if (data.type === 'error') {
            finish(new Error(data.message || 'DDS анализът не успя да се изпълни.'));
          } else if (data.type === 'result') {
            if (!Number.isInteger(data.index) || data.index < 0 || data.index >= boards.length || tables[data.index]) {
              throw new Error('DDS върна невалидна последователност от резултати.');
            }
            tables[data.index] = validateDdsTable(data.table);
            completed += 1;
            onProgress?.({ completed, total: boards.length });
          } else if (data.type === 'complete') {
            if (completed !== boards.length) throw new Error('DDS анализът е непълен. Опитай отново.');
            finish();
          }
        } catch (error) { finish(error); }
      };
      onProgress?.({ completed: 0, total: boards.length });
      worker.postMessage({ boards });
    } catch (error) { finish(error); }
  });
}
