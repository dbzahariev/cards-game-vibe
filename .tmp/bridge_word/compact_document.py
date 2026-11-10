from pathlib import Path
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn

root = Path(r'C:\projects\cards-game')
source = root / 'artifacts' / 'Бридж раздаване и DDS анализ.docx'
target = root / 'artifacts' / 'Бридж раздаване с компактна DDS таблица.docx'
doc = Document(source)

remove_prefixes = (
    'Произволно раздаване с точния брой',
    'Точен DDS анализ',
    'Общ брой взятки от 13',
    'Максимални изпълними договори',
    'E–W:',
    'N–S:',
)
for p in list(doc.paragraphs):
    if p.text.startswith(remove_prefixes):
        p._element.getparent().remove(p._element)

table = doc.tables[0]
headers = ['', 'C', 'D', 'H', 'S', 'NT']
for i, text in enumerate(headers):
    cell = table.cell(0, i)
    r = cell.paragraphs[0].runs[0]
    r.text = text
for col in table.columns:
    col.width = Inches(0.4)
for i, row in enumerate(table.rows):
    for cell in row.cells:
        cell.width = Inches(0.4)
        for edge in cell._tc.get_or_add_tcPr().findall('.//' + qn('w:tcMar') + '/*'):
            edge.set(qn('w:w'), '45' if edge.tag in [qn('w:top'), qn('w:bottom')] else '60')
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p.paragraph_format.keep_with_next = i < 4
            for run in p.runs:
                run.font.size = Pt(10)

# Keep the last diagram line and the compact table together.
doc.save(target)
print(target)
