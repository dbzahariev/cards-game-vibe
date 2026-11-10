from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(r'C:\projects\cards-game')
OUTPUT = ROOT / 'artifacts' / 'Бридж раздаване и DDS анализ.docx'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.2677), Inches(11.6929)
sec.top_margin, sec.bottom_margin = Inches(0.7), Inches(0.7)
sec.left_margin, sec.right_margin = Inches(0.8), Inches(0.8)

for name in ['Normal', 'Title', 'Heading 1', 'Heading 2']:
    style = doc.styles[name]
    style.font.name = 'Calibri'
    style.font.color.rgb = RGBColor(0, 0, 0)
    style.element.get_or_add_rPr().append(OxmlElement('w:lang'))
    style.element.rPr[-1].set(qn('w:val'), 'bg-BG')
doc.styles['Normal'].font.size = Pt(11)
doc.styles['Normal'].paragraph_format.space_after = Pt(7)
doc.styles['Normal'].paragraph_format.line_spacing = 1.08
doc.styles['Title'].font.size = Pt(23)
doc.styles['Title'].paragraph_format.space_after = Pt(9)
doc.styles['Heading 1'].font.size = Pt(13)
doc.styles['Heading 1'].paragraph_format.space_before = Pt(13)
doc.styles['Heading 1'].paragraph_format.space_after = Pt(7)

title = doc.add_paragraph('Бридж раздаване и DDS анализ', 'Title')
doc.add_paragraph('Произволно раздаване с точния брой възможни взятки за всеки разиграващ.')

def run(p, text, bold=False, color=None, size=12):
    r = p.add_run(text)
    r.font.name = 'Calibri'
    r.font.size = Pt(size)
    r.bold = bold
    if color:
        r.font.color.rgb = RGBColor.from_string(color)
    return r

def diagram_p(stops, before=0, after=0):
    p = doc.add_paragraph()
    pf = p.paragraph_format
    pf.space_before, pf.space_after = Pt(before), Pt(after)
    pf.line_spacing = 1.0
    pf.keep_with_next = True
    for stop in stops:
        pf.tab_stops.add_tab_stop(Inches(stop))
    return p

def label(text, second=None, before=0):
    stops = [2.45] if second is None else [0.55, 4.3]
    p = diagram_p(stops, before=before, after=3)
    run(p, '\t' + text, bold=True, size=11)
    if second:
        run(p, '\t' + second, bold=True, size=11)

def cards(left, right=None):
    stops = [2.45, 2.74] if right is None else [0.55, 0.84, 4.3, 4.59]
    for s, sym in enumerate(['♠', '♥', '♦', '♣']):
        p = diagram_p(stops, after=2)
        color = 'B52B36' if s in (1, 2) else '000000'
        run(p, '\t' + sym, color=color)
        run(p, '\t' + left[s])
        if right:
            run(p, '\t' + sym, color=color)
            run(p, '\t' + right[s])

label('N  Север')
cards(['K J 6 3', 'A 2', 'J 7 5 3', '10 8 4'])
label('W  Запад', 'E  Изток', before=7)
cards(['A 8 4', 'Q J 9 8', '9 6 2', 'A Q J'],
      ['10 9 5', 'K 7 5', 'A K 8 4', 'K 6 5'])
label('S  Юг', before=7)
cards(['Q 7 2', '10 6 4 3', 'Q 10', '9 7 3 2'])

doc.add_paragraph('Точен DDS анализ', 'Heading 1')
p = doc.add_paragraph('Общ брой взятки от 13 при знание на всички карти и оптимална игра от двете страни.')
p.paragraph_format.keep_with_next = True

headers = ['Разиграващ', 'C  ♣', 'D  ♦', 'H  ♥', 'S  ♠', 'NT\nбез коз']
values = [
    ['N', 4, 4, 4, 5, 4],
    ['S', 4, 4, 4, 5, 4],
    ['E', 9, 9, 9, 8, 9],
    ['W', 9, 9, 9, 8, 9],
]
table = doc.add_table(rows=5, cols=6)
table.alignment = WD_TABLE_ALIGNMENT.CENTER
table.autofit = False
widths = [1.4, 0.88, 0.88, 0.88, 0.88, 1.12]
for col, width in zip(table.columns, widths):
    col.width = Inches(width)
for row in table.rows:
    for cell, width in zip(row.cells, widths):
        cell.width = Inches(width)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        tcpr = cell._tc.get_or_add_tcPr()
        margins = OxmlElement('w:tcMar')
        for edge in ['top', 'left', 'bottom', 'right']:
            node = OxmlElement('w:' + edge)
            node.set(qn('w:w'), '90' if edge in ['top', 'bottom'] else '100')
            node.set(qn('w:type'), 'dxa')
            margins.append(node)
        tcpr.append(margins)
        borders = OxmlElement('w:tcBorders')
        for edge in ['top', 'left', 'bottom', 'right']:
            node = OxmlElement('w:' + edge)
            for k, v in [('val', 'single'), ('sz', '5'), ('color', 'D9D9D9')]:
                node.set(qn('w:' + k), v)
            borders.append(node)
        tcpr.append(borders)

for i, data in enumerate([headers] + values):
    for j, value in enumerate(data):
        cell = table.cell(i, j)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.0
        p.paragraph_format.keep_with_next = i < 4
        r = run(p, str(value), bold=(i == 0 or j == 0), size=10.5)
        fill = '183F54' if i == 0 else ('F0F4F6' if i % 2 == 0 else 'FFFFFF')
        shade = OxmlElement('w:shd')
        shade.set(qn('w:fill'), fill)
        cell._tc.get_or_add_tcPr().append(shade)
        if i == 0:
            r.font.color.rgb = RGBColor(255, 255, 255)
    no_split = OxmlElement('w:cantSplit')
    table.rows[i]._tr.get_or_add_trPr().append(no_split)
header_repeat = OxmlElement('w:tblHeader')
table.rows[0]._tr.get_or_add_trPr().append(header_repeat)

p = doc.add_paragraph()
p.paragraph_format.space_before = Pt(10)
run(p, 'Максимални изпълними договори', bold=True, size=11)
p = doc.add_paragraph()
run(p, 'E–W: ', bold=True, size=11)
run(p, '3♣, 3♦, 3♥ и 3NT (9 взятки), както и 2♠ (8 взятки).', size=11)
p = doc.add_paragraph()
run(p, 'N–S: ', bold=True, size=11)
run(p, 'Няма изпълним договор на първо ниво срещу оптимална защита.', size=11)

doc.core_properties.title = 'Бридж раздаване и DDS анализ'
doc.core_properties.subject = 'Произволно раздаване и double dummy таблица'
doc.core_properties.author = ''
doc.core_properties.keywords = 'bridge, DDS, double dummy, бридж'
for root in [doc.element, doc.styles.element]:
    for border in root.xpath('.//w:pBdr'):
        border.getparent().remove(border)
doc.save(OUTPUT)
print(OUTPUT)
