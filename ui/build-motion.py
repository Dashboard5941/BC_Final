"""Embed the shared motion files into each report, keeping the HTML standalone.
Run from any directory: python3 report/ui/build-motion.py
"""
from pathlib import Path
import base64
import gzip
import json
import re

root = Path(__file__).resolve().parent
page = root.parent / 'HNG_Reporting_Center.html'
text = page.read_text()
match = re.search(r'const BLOBS=(.*);', text)
blobs = json.loads(match[1])
for name, encoded in blobs.items():
    doc = gzip.decompress(base64.b64decode(encoded)).decode()
    for tag, identifier, filename, closing in (
        ('style', 'hng-report-motion', 'report-motion.css', '</head>'),
        ('script', 'hng-report-motion-script', 'report-motion.js', '</body>'),
    ):
        block = f'<{tag} id="{identifier}">' + (root / filename).read_text() + f'</{tag}>'
        pattern = rf'<{tag} id="{identifier}">[\s\S]*?</{tag}>'
        if re.search(pattern, doc):
            doc = re.sub(pattern, lambda _: block, doc, count=1)
        else:
            index = doc.rindex(closing) if tag == 'script' else doc.index(closing)
            doc = doc[:index] + block + doc[index:]
    blobs[name] = base64.b64encode(gzip.compress(doc.encode(), mtime=0)).decode()
text = text[:match.start(1)] + json.dumps(blobs, ensure_ascii=False, separators=(',', ':')) + text[match.end(1):]
page.write_text(text)
print('Updated shared motion in all five embedded reports.')
