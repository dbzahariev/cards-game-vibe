import dds from './vendor/dds/out.js';

const calculate = dds.cwrap('generateDDTable', 'string', ['string']);

self.onmessage = ({ data: { boards } }) => {
  try {
    const cache = new Map();
    boards.forEach((board, index) => {
      if (!cache.has(board)) cache.set(board, JSON.parse(calculate(board)));
      self.postMessage({ type: 'result', index, table: cache.get(board) });
    });
    self.postMessage({ type: 'complete' });
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : 'DDS анализът не успя да се изпълни. Опитай отново.' });
  }
};
