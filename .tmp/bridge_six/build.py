import json
from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT, WD_ROW_HEIGHT_RULE
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

ROOT = Path(r'C:\projects\cards-game')
DEALS = json.loads((ROOT / '.tmp/bridge_six/deals.json').read_text(encoding='utf-8'))
OUT = ROOT / 'artifacts' / 'Шест раздавания с DDS анализ.docx'

doc = Document()
sec = doc.sections[0]
sec.page_width, sec.page_height = Inches(8.2677), Inches(11.6929)
sec.top_margin = sec.bottom_margin = Inches(0.35)
sec.left_margin = sec.right_margin = Inches(0.42)
style = doc.styles['Normal']
style.font.name = 'Calibri'
style.font.size = Pt(10)
style.font.color.rgb = RGBColor(0, 0, 0)
style.paragraph_format.space_before = Pt(0)
style.paragraph_format.space_after = Pt(0)
style.paragraph_format.line_spacing = 1.0
for border in doc.styles.element.xpath('.//w:pBdr'):
    border.getparent().remove(border)

def border_and_padding(cell, padding, border_size=4):
    tcpr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement('w:tcBorders')
    margins = OxmlElement('w:tcMar')
    for edge in ['top', 'left', 'bottom', 'right']:
        b = OxmlElement('w:' + edge)
        for k,v in [('val','single'),('sz',str(border_size)),('color','D9D9D9')]:
            b.set(qn('w:' + k), v)
        borders.append(b)
        m = OxmlElement('w:' + edge)
        m.set(qn('w:w'), str(padding[0] if edge in ['top','bottom'] else padding[1]))
        m.set(qn('w:type'), 'dxa')
        margins.append(m)
    tcpr.append(borders)
    tcpr.append(margins)

def add_run(p, text, bold=False, size=10, color='000000', font='Calibri'):
    r = p.add_run(text)
    r.bold = bold
    r.font.name = font
    r.font.size = Pt(size)
    r.font.color.rgb = RGBColor.from_string(color)
    return r

def paragraph(cell, stops, first=False, after=0):
    p = cell.paragraphs[0] if first else cell.add_paragraph()
    pf = p.paragraph_format
    pf.space_after = Pt(after)
    pf.keep_with_next = True
    pf.line_spacing = Pt(11.5)
    for stop in stops:
        pf.tab_stops.add_tab_stop(Inches(stop))
    return p

def label(cell, direction, number=None, east=False):
    p = paragraph(cell, [0.10, 2.15] if east else [1.20], first=number is not None)
    if number is not None:
        add_run(p, str(number), bold=True, size=9)
    add_run(p, '\t' + direction, bold=True, size=9.5)
    if east:
        add_run(p, '\tE', bold=True, size=9.5)

def hands(cell, left, right=None, is_last=False):
    stops = [0.10, 0.32, 2.15, 2.37] if right else [1.20, 1.42]
    for i, sym in enumerate(['♠', '♥', '♦', '♣']):
        p = paragraph(cell, stops, after=3 if is_last and i == 3 else 0)
        color = 'B52B36' if i in [1,2] else '000000'
        add_run(p, '\t' + sym, color=color, font='Segoe UI Symbol')
        add_run(p, '\t' + (left[i].replace('T','10') or '—'))
        if right:
            add_run(p, '\t' + sym, color=color, font='Segoe UI Symbol')
            add_run(p, '\t' + (right[i].replace('T','10') or '—'))

def tiny_paragraph(p):
    p.paragraph_format.space_before = p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = Pt(1)
    p.paragraph_format.keep_with_next = False
    add_run(p, '', size=1)
    p.paragraph_format.widow_control = False

outer = doc.add_table(rows=3, cols=2)
outer.autofit = False
outer.alignment = WD_TABLE_ALIGNMENT.CENTER
cell_width = (8.2677 - 0.84) / 2
for col in outer.columns:
    col.width = Inches(cell_width)
for row in outer.rows:
    row.height = Inches(3.55)
    row.height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
    row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))

for item in DEALS:
    idx = item['number'] - 1
    cell = outer.cell(idx // 2, idx % 2)
    cell.width = Inches(cell_width)
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    border_and_padding(cell, (55, 120), 3)
    n, e, s, w = item['hands']
    label(cell, 'N', number=item['number'])
    hands(cell, n)
    label(cell, 'W', east=True)
    hands(cell, w, e)
    label(cell, 'S')
    hands(cell, s, is_last=True)

    table = cell.add_table(rows=5, cols=6)
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for col in table.columns:
        col.width = Inches(0.32)
    data = [['','C','D','H','S','NT']]
    for seat in ['N','S','E','W']:
        data.append([seat] + [item['dd'][strain][seat] for strain in ['C','D','H','S','N']])
    for ri, rowdata in enumerate(data):
        row = table.rows[ri]
        row._tr.get_or_add_trPr().append(OxmlElement('w:cantSplit'))
        for ci, value in enumerate(rowdata):
            tc = row.cells[ci]
            tc.width = Inches(0.32)
            tc.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            border_and_padding(tc, (16, 35), 4)
            fill = '183F54' if ri == 0 else ('F1F4F6' if ri % 2 == 0 else 'FFFFFF')
            shd = OxmlElement('w:shd')
            shd.set(qn('w:fill'), fill)
            tc._tc.get_or_add_tcPr().append(shd)
            p = tc.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.line_spacing = Pt(10.5)
            p.paragraph_format.keep_with_next = ri < 4
            add_run(p, str(value), bold=(ri == 0 or ci == 0), size=9,
                    color='FFFFFF' if ri == 0 else '000000')
    table.rows[0]._tr.get_or_add_trPr().append(OxmlElement('w:tblHeader'))
    tiny_paragraph(cell.paragraphs[-1])

tiny_paragraph(doc.add_paragraph())
doc.core_properties.title = ''
doc.core_properties.author = ''
doc.core_properties.subject = 'Шест бридж раздавания с DDS таблици'
doc.save(OUT)
print(OUT)
