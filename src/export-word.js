import {
  AlignmentType, BorderStyle, Document, Packer, Paragraph,
  Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
} from 'docx';
import { summarizeHand } from './bridge.js';

const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none };
const empty = () => new Paragraph({ spacing: { before: 0, after: 0, line: 1 }, children: [] });
const cellMargins = { top: 0, bottom: 0, left: 0, right: 0 };
const frameEdge = { style: BorderStyle.SINGLE, size: 6, color: '808080' };
const frameBorders = { ...noBorders, top: frameEdge, bottom: frameEdge, left: frameEdge, right: frameEdge };

function handBlock(label, hand) {
  const { groups } = summarizeHand(hand);
  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: 2300, type: WidthType.DXA },
    columnWidths: [400, 1900],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          margins: cellMargins,
          children: [new Paragraph({ text: `${label}:`, spacing: { before: 0, after: 0, line: 280 } })],
        }),
        new TableCell({
          margins: cellMargins,
          children: groups.map((suit, index) => new Paragraph({
            keepNext: index < groups.length - 1,
            spacing: { before: 0, after: 0, line: 280 },
            children: [
              new TextRun({ text: suit.symbol, font: 'Times New Roman', color: '000000' }),
              new TextRun({ text: suit.cards.map((card) => card.rank).join('') || '—', color: '000000' }),
            ],
          })),
        }),
      ],
    })],
  });
}

function dealTable(hands) {
  const fullRow = (label, hand) => new TableRow({
    cantSplit: true,
    children: [new TableCell({
      columnSpan: 2,
      margins: cellMargins,
      children: [handBlock(label, hand), empty()],
    })],
  });
  return new Table({
    alignment: AlignmentType.CENTER,
    width: { size: 4600, type: WidthType.DXA },
    columnWidths: [2300, 2300],
    layout: TableLayoutType.FIXED,
    borders: noBorders,
    rows: [
      fullRow('N', hands[0]),
      new TableRow({
        cantSplit: true,
        children: [1, 2].map((index) => new TableCell({
          margins: cellMargins,
          children: [handBlock(index === 1 ? 'W' : 'E', hands[index]), empty()],
        })),
      }),
      fullRow('S', hands[3]),
    ],
  });
}

export function createDealDocument(deals) {
  return new Document({
    styles: { default: { document: {
      run: { font: 'Times New Roman', size: 22, color: '000000' },
      paragraph: { spacing: { before: 0, after: 0 } },
    } } },
    sections: [{
      properties: { page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1200, bottom: 1000, left: 1000, right: 1000 },
      } },
      children: [new Table({
        alignment: AlignmentType.CENTER,
        width: { size: 9906, type: WidthType.DXA },
        columnWidths: [4800, 306, 4800],
        layout: TableLayoutType.FIXED,
        borders: noBorders,
        rows: Array.from({ length: Math.ceil(deals.length / 2) }, (_, rowIndex) => new TableRow({
          cantSplit: true,
          children: [0, null, 1].map((column) => {
            const index = rowIndex * 2 + (column ?? 0);
            const hands = column === null ? null : deals[index];
            return new TableCell({
              margins: { ...cellMargins, bottom: 240 },
              children: hands ? [
                new Table({
                  width: { size: 4800, type: WidthType.DXA },
                  columnWidths: [4800],
                  layout: TableLayoutType.FIXED,
                  borders: frameBorders,
                  rows: [new TableRow({
                    cantSplit: true,
                    children: [new TableCell({
                      margins: { top: 140, bottom: 140, left: 100, right: 100 },
                      children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  keepNext: true,
                  spacing: { before: 0, after: 100 },
                  children: [new TextRun({ text: `Раздаване ${index + 1}`, bold: true })],
                }),
                dealTable(hands),
                empty(),
                      ],
                    })],
                  })],
                }),
                empty(),
              ] : [empty()],
            });
          }),
        })),
      })],
    }],
  });
}

export async function downloadDealWord(deals) {
  const blob = await Packer.toBlob(createDealDocument(deals));
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'bridge-razdavania.docx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
