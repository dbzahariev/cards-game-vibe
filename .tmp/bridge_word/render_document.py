import importlib.util
import os
import sys
from pathlib import Path

base = Path(r'C:\projects\cards-game')
render_dir = base / '.tmp' / 'bridge_word' / 'render'
pdf = render_dir / 'bridge_analysis.pdf'
helper = Path(r'C:\Users\ramsess\.codex\plugins\cache\openai-primary-runtime\documents\26.1105.12137\skills\documents\render_docx.py')
poppler = Path(r'C:\Users\ramsess\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin')
os.environ['PATH'] = str(poppler) + os.pathsep + os.environ.get('PATH', '')
spec = importlib.util.spec_from_file_location('packaged_docx_renderer', helper)
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

# Windows runtime has no bundled LibreOffice. Use the PDF exported by Microsoft
# Word, then keep the packaged renderer's sizing and PNG rasterization workflow.
def word_pdf_backend(*args, **kwargs):
    if not pdf.is_file():
        raise FileNotFoundError(pdf)
    return str(pdf), 'Rendered with Microsoft Word native PDF export'

renderer.convert_to_pdf = word_pdf_backend
sys.argv = [str(helper), str(base / 'artifacts' / 'Бридж раздаване и DDS анализ.docx'), '--output_dir', str(render_dir)]
renderer.main()
