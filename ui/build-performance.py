"""Embed area performance and explicit temperature scopes; preserve other modules."""
from pathlib import Path
import re,json,gzip,base64
root=Path(__file__).resolve().parent
p=root.parent/'HNG_Reporting_Center.html'
s=p.read_text();match=re.search(r'const BLOBS=(.*);',s);blobs=json.loads(match[1])
for module,filename,marker in [('kqcn','zone-performance.js','ZONE PERFORMANCE'),('nhietdo','temperature-scope.js','TEMPERATURE SCOPE')]:
 doc=gzip.decompress(base64.b64decode(blobs[module])).decode()
 block='/* HNG '+marker+' START */\n'+(root/filename).read_text()+'\n/* HNG '+marker+' END */'
 pattern=r'/\* HNG '+marker+r' START \*/[\s\S]*?/\* HNG '+marker+r' END \*/'
 if re.search(pattern,doc):doc=re.sub(pattern,lambda _:block,doc,count=1)
 else:
  index=doc.rfind('init();',0,doc.index('window.__HNG_GET_LIVE_SOURCE_CONFIG__'))
  if index<0:raise ValueError('Missing init: '+module)
  doc=doc[:index]+block+'\n'+doc[index:]
 if module=='nhietdo':
  a=doc.index('function renderOverview(){');b=doc.index('function renderBranches()',a);part=doc[a:b]
  part=part.replace('const rr=selectedDate()', 'const rr=window.__HNG_TEMPERATURE__.overviewRows()').replace('expected=expectedHouses()', 'expected=window.__HNG_TEMPERATURE__.scopedExpected()')
  part=part.replace('const dates=filtered(true).filter(r=>r.date<=state.day)', 'const dates=window.__HNG_TEMPERATURE__.periodRows()')
  part=part.replace('standardTable(rr)', "standardTable(rr.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,200))")
  part=part.replace("mainTitle('Chi tiết theo chuồng','Nhấn một dòng để xem thông số và lịch sử cùng lứa')", "mainTitle('Chi tiết theo chuồng','Hiển thị tối đa 200 ca gần nhất; xem toàn bộ tại Dữ liệu chi tiết. Nhấn dòng để xem lịch sử cùng lứa.')")
  doc=doc[:a]+part+doc[b:]
 else:
  doc=doc.replace("names.map((n,i)=>quoted(n)+'!A6:'", "names.map((n,i)=>quoted(n)+'!A1:'")
 blobs[module]=base64.b64encode(gzip.compress(doc.encode(),mtime=0)).decode()
s=s[:match.start(1)]+json.dumps(blobs,ensure_ascii=False,separators=(',',':'))+s[match.end(1):];p.write_text(s)
print('Updated area performance and temperature scopes.')
