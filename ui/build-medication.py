"""Embed the daily/FAST medication workflow without changing other report modules."""
from pathlib import Path
import base64,gzip,json,re
root=Path(__file__).resolve().parent
page=root.parent/'HNG_Reporting_Center.html'
source=page.read_text()
match=re.search(r'const BLOBS=(.*);',source)
blobs=json.loads(match[1])
doc=gzip.decompress(base64.b64decode(blobs['vaccine'])).decode()
start=doc.find('/* HNG MEDICATION WORKFLOW START */')
if start<0:
    start=doc.index('window.__actualKQCNRows=null;')
    end=doc.index('\ninit();',start)
else:
    end=doc.index('/* HNG MEDICATION WORKFLOW END */',start)+len('/* HNG MEDICATION WORKFLOW END */')
while doc[end:end+1]=='\n': end+=1
block='/* HNG MEDICATION WORKFLOW START */\n'+(root/'medication.js').read_text()+'\n/* HNG MEDICATION WORKFLOW END */\n\n'
doc=doc[:start]+block+doc[end:]
if 'id="fBranch"' not in doc:
    doc=doc.replace('<div class="filters"><div class="field"><label>Trại / Khu</label>', '<div class="filters"><div class="field"><label>Chi nhánh</label><select id="fBranch"><option value="all">Tất cả chi nhánh</option></select></div><div class="field"><label>Khu</label>',1)
if 'id="medContext"' not in doc:
    doc=doc.replace('<div id="view"','<div id="medContext"></div><div id="view"',1)
css='''<style id="hng-medication-style">.med-sources{display:flex;flex-wrap:wrap;gap:8px 22px;margin-bottom:14px;font-size:11px;line-height:1.6}.med-text{white-space:normal!important;min-width:170px;max-width:340px;line-height:1.6;text-align:left!important;overflow-wrap:anywhere}.med-daily{min-width:1000px}.med-reconcile{min-width:1250px}.med-reconcile .subtxt{max-width:240px;white-space:normal;line-height:1.6}.med-map{flex-wrap:wrap;gap:10px}.med-map select{max-width:100%;min-width:220px;flex:1}.field select:disabled,.field input:disabled{opacity:.6;cursor:default}.med-map-list{margin-top:12px}</style>'''
if 'id="hng-medication-style"' not in doc:doc=doc.replace('</head>',css+'</head>',1)
doc=doc.replace("'Bảng kê xuất thuốc'!A1:K2500","'Bảng kê xuất thuốc'!A1:K")
doc=doc.replace('> Theo dõi vaccine</button>','> Thuốc theo daily</button>').replace('> Đối chiếu theo đàn</button>','> Đối chiếu cuối lứa</button>')
blobs['vaccine']=base64.b64encode(gzip.compress(doc.encode(),mtime=0)).decode()
source=source[:match.start(1)]+json.dumps(blobs,ensure_ascii=False,separators=(',',':'))+source[match.end(1):]
source=source.replace('Nhật ký thuốc/Vaccine thực tế','Thuốc theo daily').replace('Đối chiếu theo đàn','Đối chiếu cuối lứa')
page.write_text(source)
print('Medication workflow embedded; other four modules preserved.')
