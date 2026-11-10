import importlib.util
import os
import sys
from pathlib import Path

source = Path(sys.argv[1])
out = Path(sys.argv[2])
pdf = out / 'document.pdf'
helper = Path(r'C:\Users\ramsess\.codex\plugins\cache\openai-primary-runtime\documents\26.1105.12137\skills\documents\render_docx.py')
poppler = Path(r'C:\Users\ramsess\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin')
os.environ['PATH'] = str(poppler) + os.pathsep + os.environ.get('PATH', '')
spec = importlib.util.spec_from_file_location('packaged_docx_renderer', helper)
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)
def word_pdf_backend(*args, **kwargs):
    return str(pdf), 'Microsoft Word native PDF export'
renderer.convert_to_pdf = word_pdf_backend
sys.argv = [str(helper), str(source), '--output_dir', str(out)]
renderer.main()
