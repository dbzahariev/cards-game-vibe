import importlib.util
import os
import sys
from pathlib import Path

root = Path(r'C:\projects\cards-game')
render_dir = root / '.tmp' / 'bridge_word' / 'compact_render'
pdf = render_dir / 'compact.pdf'
helper = Path(r'C:\Users\ramsess\.codex\plugins\cache\openai-primary-runtime\documents\26.1105.12137\skills\documents\render_docx.py')
poppler = Path(r'C:\Users\ramsess\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin')
os.environ['PATH'] = str(poppler) + os.pathsep + os.environ.get('PATH', '')
spec = importlib.util.spec_from_file_location('packaged_docx_renderer', helper)
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
def word_pdf_backend(*args, **kwargs):
    if not pdf.is_file():
        raise FileNotFoundError(pdf)
    return str(pdf), 'Microsoft Word native PDF export'
renderer.convert_to_pdf = word_pdf_backend
sys.argv = [str(helper), str(root / 'artifacts' / 'Бридж раздаване с компактна DDS таблица.docx'), '--output_dir', str(render_dir)]
renderer.main()
