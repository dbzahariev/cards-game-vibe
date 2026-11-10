import { countDeals } from './count-deals.js';

self.onmessage = ({ data: { condition, fixedHands } }) => {
  try { self.postMessage({ result: countDeals(condition, fixedHands) }); }
  catch (error) { self.postMessage({ error: error.message }); }
};
