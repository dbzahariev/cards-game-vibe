import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { Packer } from 'docx';
import { createDdsDocument } from '../src/export-dds-word.js';

const { unzipSync, strFromU8 } = createRequire(import.meta.resolve('docx'))('fflate');
const suitIds = ['spades', 'hearts', 'diamonds', 'clubs'];
const pbn = 'KQ5.KQ82.T.JT765 J87.AT93.K743.32 942.765.AQ9.KQ84 AT63.J4.J8652.A9';
const pbnHands = pbn.split(' ').map((hand) => hand.split('.').flatMap((ranks, i) =>
  [...ranks].map((rank) => `${suitIds[i]}-${rank === 'T' ? '10' : rank}`)));
const deal = [pbnHands[0], pbnHands[3], pbnHands[1], pbnHands[2]];
const analysis = {
  C: { N: 9, S: 9, E: 4, W: 4 },
  D: { N: 5, S: 5, E: 7, W: 7 },
  H: { N: 7, S: 8, E: 5, W: 5 },
  S: { N: 6, S: 6, E: 7, W: 7 },
  N: { N: 7, S: 7, E: 4, W: 4 },
};
const expectedCells = ['', 'C', 'D', 'H', 'S', 'NT',
  'N', '9', '5', '7', '6', '7',
  'S', '9', '5', '8', '6', '7',
  'E', '4', '7', '5', '7', '4',
  'W', '4', '7', '5', '7', '4'];

function tableTree(xml) {
  const stack = [], tables = [];
  for (const token of xml.matchAll(/<\/?w:tbl(?:\s[^>]*)?>/g)) {
    if (token[0].startsWith('</')) {
      const table = stack.pop();
      table.xml = xml.slice(table.start, token.index + token[0].length);
      tables.push(table);
    } else {
      if (stack.length) stack.at(-1).children += 1;
      stack.push({ start: token.index, children: 0 });
    }
  }
  assert.equal(stack.length, 0);
  return tables;
}

for (const count of [1, 6, 7, 12, 13]) {
  const zip = unzipSync(await Packer.toBuffer(createDdsDocument(Array(count).fill(deal), Array(count).fill(analysis))));
  const xml = strFromU8(zip['word/document.xml']);
  const tables = tableTree(xml);
  const analyses = tables.filter((table) => table.children === 0);
  const pages = tables.filter((table) => table.children !== 0);
  assert.equal(analyses.length, count);
  assert.equal(pages.length, Math.ceil(count / 6));
  assert.equal((xml.match(/<w:pageBreakBefore\b/g) || []).length, Math.floor((count - 1) / 6));
  for (const table of analyses) {
    const cells = [...table.xml.matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)].map(([cell]) =>
      [...cell.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join(''));
    assert.deepEqual(cells, expectedCells);
  }
  assert.doesNotMatch(xml, /Бридж раздаване|DDS анализ|Разиграващ|без коз/);
  assert.ok(!zip['word/comments.xml']);
}
assert.throws(() => createDdsDocument([deal], []));
assert.throws(() => createDdsDocument([deal], [{ ...analysis, C: { ...analysis.C, N: 14 } }]));
assert.throws(() => createDdsDocument([deal], [{ ...analysis, H: { N: 7, E: 5, W: 5 } }]));
console.log('PASS: DDS Word table values and direction, six per page, odd counts, and invalid analyses');
