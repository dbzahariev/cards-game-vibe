import {
  AlignmentType, BorderStyle, Document, HeightRule, LineRuleType, Packer,
  Paragraph, Table, TableCell, TableLayoutType, TableRow, TabStopType,
  TextRun, VerticalAlignTable, WidthType,
} from 'docx';
import { summarizeHand } from './bridge.js';

const PAGE_WIDTH = 11906;
const PAGE_HEIGHT = 16838;
const SIDE_MARGIN = 605;
const CELL_WIDTH = (PAGE_WIDTH - SIDE_MARGIN * 2) / 2;
const STRAINS = ['C', 'D', 'H', 'S', 'N'];
const DECLARERS = ['N', 'S', 'E', 'W'];
const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = {
  top: none, bottom: none, left: none, right: none,
  insideHorizontal: none, insideVertical: none,
};
const gridEdge = { style: BorderStyle.SINGLE, size: 3, color: 'D9D9D9' };
const gridBorders = {
  top: gridEdge, bottom: gridEdge, left: gridEdge, right: gridEdge,
  insideHorizontal: gridEdge, insideVertical: gridEdge,
};

const tinyParagraph = (options = {}) => new Paragraph({
  ...options,
  keepNext: false,
  widowControl: false,
  spacing: { before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT },
  children: [new TextRun({ text: '', size: 2 })],
});

function handParagraph(tabPositions, children, after = 0) {
  return new Paragraph({
    keepNext: true,
    tabStops: tabPositions.map((position) => ({ type: TabStopType.LEFT, position })),
    spacing: { before: 0, after, line: 230, lineRule: LineRuleType.EXACT },
    children,
  });
}

function directionLine(direction, { number, east = false } = {}) {
  const children = [];
  if (number !== undefined) children.push(new TextRun({ text: String(number), bold: true, size: 18 }));
  children.push(new TextRun({ text: `\t${direction}`, bold: true, size: 19 }));
  if (east) children.push(new TextRun({ text: '\tE', bold: true, size: 19 }));
  return handParagraph(east ? [144, 3096] : [1728], children);
}

function handLines(leftHand, rightHand = null, last = false) {
  const left = summarizeHand(leftHand).groups;
  const right = rightHand ? summarizeHand(rightHand).groups : null;
  return left.map((suit, index) => {
    const suitRun = (group) => new TextRun({
      text: `\t${group.symbol}`,
      font: 'Segoe UI Symbol',
      color: group.red ? 'B52B36' : '000000',
    });
    const cardsRun = (group) => new TextRun({
      text: `\t${group.cards.map((card) => card.rank === 'T' ? '10' : card.rank).join('') || '—'}`,
    });
    return handParagraph(
      right ? [144, 461, 3096, 3413] : [1728, 2045],
      [suitRun(suit), cardsRun(suit), ...(right ? [suitRun(right[index]), cardsRun(right[index])] : [])],
      last && index === 3 ? 60 : 0,
    );
  });
}

function analysisTable(analysis) {
  const values = [
    ['', 'C', 'D', 'H', 'S', 'NT'],
    ...DECLARERS.map((seat) => [seat, ...STRAINS.map((strain) => analysis[strain][seat])]),
  ];
  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: 2766, type: WidthType.DXA },
    columnWidths: Array(6).fill(461),
    layout: TableLayoutType.FIXED,
    borders: gridBorders,
    rows: values.map((row, rowIndex) => new TableRow({
      cantSplit: true,
      tableHeader: rowIndex === 0,
      children: row.map((value, columnIndex) => new TableCell({
        width: { size: 461, type: WidthType.DXA },
        margins: { top: 16, bottom: 16, left: 35, right: 35 },
        verticalAlign: VerticalAlignTable.CENTER,
        shading: { fill: rowIndex === 0 ? '183F54' : rowIndex % 2 === 0 ? 'F1F4F6' : 'FFFFFF' },
        borders: gridBorders,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          keepNext: rowIndex < values.length - 1,
          spacing: { before: 0, after: 0, line: 210, lineRule: LineRuleType.EXACT },
          children: [new TextRun({
            text: String(value),
            size: 18,
            bold: rowIndex === 0 || columnIndex === 0,
            color: rowIndex === 0 ? 'FFFFFF' : '000000',
          })],
        })],
      })),
    })),
  });
}

function dealCell(hands, analysis, number) {
  return new TableCell({
    width: { size: CELL_WIDTH, type: WidthType.DXA },
    margins: { top: 55, bottom: 55, left: 120, right: 120 },
    verticalAlign: VerticalAlignTable.CENTER,
    borders: hands ? gridBorders : noBorders,
    children: hands ? [
      directionLine('N', { number }),
      ...handLines(hands[0]),
      directionLine('W', { east: true }),
      ...handLines(hands[1], hands[2]),
      directionLine('S'),
      ...handLines(hands[3], null, true),
      analysisTable(analysis),
      tinyParagraph(),
    ] : [tinyParagraph()],
  });
}

function pageTable(deals, analyses, startIndex) {
  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: CELL_WIDTH * 2, type: WidthType.DXA },
    columnWidths: [CELL_WIDTH, CELL_WIDTH],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: Array.from({ length: Math.ceil(deals.length / 2) }, (_, rowIndex) => new TableRow({
      cantSplit: true,
      height: { value: 5112, rule: HeightRule.ATLEAST },
      children: [0, 1].map((columnIndex) => {
        const index = rowIndex * 2 + columnIndex;
        return dealCell(deals[index], analyses[index], startIndex + index + 1);
      }),
    })),
  });
}

/** The application's hands are ordered N, W, E, S; analysis is strain -> declarer. */
export function createDdsDocument(deals, analyses) {
  if (!Array.isArray(deals) || !deals.length || !Array.isArray(analyses) || deals.length !== analyses.length) {
    throw new Error('Необходими са раздавания и DDS анализ за всяко от тях.');
  }
  if (analyses.some((analysis) => STRAINS.some((strain) => DECLARERS.some((seat) => {
    const tricks = analysis?.[strain]?.[seat];
    return !Number.isInteger(tricks) || tricks < 0 || tricks > 13;
  })))) {
    throw new Error('DDS анализът трябва да съдържа от 0 до 13 взятки за всяка посока и боя.');
  }
  const children = [];
  for (let index = 0; index < deals.length; index += 6) {
    if (index > 0) children.push(tinyParagraph({ pageBreakBefore: true }));
    children.push(pageTable(deals.slice(index, index + 6), analyses.slice(index, index + 6), index));
  }
  children.push(tinyParagraph());
  return new Document({
    title: '',
    creator: '',
    styles: { default: { document: {
      run: { font: 'Calibri', size: 20, color: '000000' },
      paragraph: { spacing: { before: 0, after: 0 } },
    } } },
    sections: [{
      properties: { page: {
        size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
        margin: { top: 504, bottom: 504, left: SIDE_MARGIN, right: SIDE_MARGIN },
      } },
      children,
    }],
  });
}

export async function downloadDdsWord(deals, analyses) {
  const blob = await Packer.toBlob(createDdsDocument(deals, analyses));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bridge-razdavania-dds.docx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
