import { generateDeal } from './bridge.js';

self.onmessage = ({ data: { count, condition } }) => {
  try {
    const deals = Array.from({ length: count }, () => generateDeal(condition));
    self.postMessage({ deals });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
