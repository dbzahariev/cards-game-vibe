import { generateDeal } from './bridge.js';

self.onmessage = ({ data: { count, condition, fixedHands } }) => {
  try {
    const deals = Array.from({ length: count }, () => generateDeal(condition, fixedHands));
    self.postMessage({ deals });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
