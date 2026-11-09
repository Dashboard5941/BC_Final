const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('node:assert/strict');
const summaryRow=(farm,area,lot,feed=79530,weight=49720)=>[farm,'Khu '+area,lot,'2025-11-06','2025-12-18',43,20000,19320,2.78,4.48,feed,weight,weight/19320,feed/weight,(100-2.78)*(weight/19320)*100/(43*(feed/weight))];
const table=rows=>[['Tổng kết'],[],[],['NGÀY XEM DỮ LIỆU',null,null,'2026-11-08'],[],['Chuồng','Khu','Lứa','Ngày nhập'],...rows];
const bpRows=[summaryRow('A1','A','Lứa 44'),summaryRow('B1','B','Lứa 44'),summaryRow('C7','C','Lứa 44')],tnRows=[summaryRow('TNC1','C','Lứa 1')];
const catalog=rows=>[['Mã','Lứa'],...rows.map(r=>[r[0],r[2],'','','','Mix',r[3],r[6],43,'Đã xuất bán','',r[1],r[0]])];
const sales=rows=>[['Ngày'],...rows.map(r=>['2025-12-18',r[0],r[2],r[0],null,null,r[7],null,null,r[11]])];
const zone=process.env.ZONE_FIXTURE?JSON.parse(fs.readFileSync(process.env.ZONE_FIXTURE,'utf8')):{bpSummary:table(bpRows),tnSummary:table(tnRows),bpCatalog:catalog(bpRows),tnCatalog:catalog(tnRows),bpSales:sales(bpRows),tnSales:sales(tnRows)};
const temp=process.env.TEMP_FIXTURE?JSON.parse(fs.readFileSync(process.env.TEMP_FIXTURE,'utf8')):{input:[['Ngày','Chuồng','Lứa'],['08/10/2026','2C',48,15,29.1,80,28,1.5],['19/10/2026','2C',48,26,26.2,89.7,27.9,1.6]],web:[['Ngày','Chi nhánh','Chuồng']]};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1800,height:1100},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://sheets.googleapis.com/**',route=>route.fulfill({status:403,json:{error:{message:'Offline test'}}}));
 await page.goto(require('node:url').pathToFileURL(require('node:path').resolve(__dirname,'../HNG_Reporting_Center.html')).href);
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].some(f=>f.contentWindow.__HNG_ZONE_PERFORMANCE__));
 let frame=await (await page.locator('iframe:visible').elementHandle()).contentFrame();
 await page.waitForTimeout(350);
 // Exercise the actual source loader, including the first journal row and the new summary/sales reads.
const sourceId='1YT_fg_BZKHJZvQQx5jHjynTqeFKkg4wkQ0pR4oRm4yM';
const required=['NHẬP HẰNG NGÀY','STD','DANH MỤC TRẠI','NHẬP CÁM','TỔNG QUAN','XUẤT BÁN'];
const dailyRow=['2025-11-06','C7','Lứa 44',1,'Mix',20000,0,0,0,0.14,0,20000,0,0.14,'','','',100];
const values={'NHẬP HẰNG NGÀY':[['Ngày'],dailyRow],STD:[['Khóa','Nhóm','Tuổi'],['Mix|1','Mix',1,.14,13,62,.2,100]],'DANH MỤC TRẠI':zone.bpCatalog,'NHẬP CÁM':[[]],'TỔNG QUAN':zone.bpSummary,'XUẤT BÁN':zone.bpSales};
await page.route('https://sheets.googleapis.com/v4/spreadsheets/'+sourceId+'**',route=>{
 const url=new URL(route.request().url());
 return route.fulfill({json:url.pathname.endsWith('values:batchGet')?{valueRanges:url.searchParams.getAll('ranges').map(range=>({range,values:values[range.split('!')[0].replaceAll("'",'')]||[]}))}:{sheets:required.map(title=>({properties:{title}}))}});
});
const loaded=await frame.evaluate(async id=>{const d=await pullBranch('Bình Phước',id,'fixture');return {rows:d.rows.length,first:d.rows[0]?.date,summary:d.wholeSummary?.records.length,sales:d.sales.length}},sourceId);
assert.equal(loaded.first,'2025-11-06');assert(loaded.summary>0&&loaded.sales>0);console.log('PASS source loader',loaded);
const result=await frame.evaluate(data=>{
  const api=__HNG_ZONE_PERFORMANCE__;
  for(const [branch,key] of [['Bình Phước','bp'],['Tây Ninh','tn']]){
   const wholeSummary=api.parseSummary(data[key+'Summary']);
   state.cache[branch]={...state.cache[branch],wholeSummary,sales:api.parseSales(data[key+'Sales']),catalog:parseCatalog(data[key+'Catalog']).filter(r=>r.arrival),rows:wholeSummary.records.map(r=>({date:r.lastDay,farm:r.farm,lot:r.lot,start:r.initial,live:0,age:r.saleAge,lossPct:r.lossPct,lossStd:r.lossStd}))};
  }
  Object.assign(state,{animal:'broiler',page:'zones',branch:'Bình Phước',site:'all',zone:'all',farm:'all',lot:'Lứa 44',lotStatus:'all',asOf:'2026-11-08',age:'all',zoneSite:'BP_GT'});render();$('#fLot').value='Lứa 44';state.lot='Lứa 44';render();
  const output=api.zoneData(),c7=output.rows.find(r=>r.farm==='C7'&&r.lot==='Lứa 44');
  if(!c7||c7.source!=='TỔNG QUAN'||Math.abs(c7.soldWeight-49720)>0.01||Math.abs(c7.feedTotal-79530)>0.01)throw Error('C7 summary differs from source');
  const ag=api.zoneStats([{initial:100,soldTotal:50,soldWeight:100,feedTotal:200,saleAge:20,lossPct:10},{initial:300,soldTotal:150,soldWeight:450,feedTotal:450,saleAge:40,lossPct:20}]);
  if(Math.abs(ag.bwExport-2.75)>1e-9||Math.abs(ag.fcrLot-650/550)>1e-9||ag.saleAge!==35||ag.lossPct!==17.5)throw Error('Area aggregation not weighted correctly');
  const missing=api.zoneStats([{initial:100,soldTotal:50,soldWeight:100,feedTotal:null,saleAge:20,lossPct:10}]);if(missing.fcrLot!==null||missing.feedTotal!==null)throw Error('Missing values coerced to zero');
  // A historical selected date must never use future final-cohort totals.
  const src=state.cache['Bình Phước'],saved=src.rows;
  state.asOf='2025-12-01';src.rows=[...saved,{date:'2025-12-01',farm:'C7',lot:'Lứa 44',start:20000,loss:20,feedKg:400}];
  const historic=api.cohortResult({branch:'Bình Phước',farm:'C7',lot:'Lứa 44',zone:'C',site:'BP_GT'});
  if(historic.source==='TỔNG QUAN'||historic.feedTotal!==400)throw Error('Historical summary cutoff leaked');
  src.rows=saved;state.asOf='2026-11-08';render();
  return {c7:{age:c7.saleAge,loss:c7.lossPct,feed:c7.feedTotal,weight:c7.soldWeight,bw:c7.bwExport,fcr:c7.fcrLot,bpi:c7.bpiLot},areas:output.zones.map(z=>({zone:z.zone,count:z.rows.length,bpi:z.stats.bpiLot}))};
 },zone);
 console.log('PASS area metrics / source / weighted ratios / missing values / historical cutoff',result);
 assert.equal(await frame.locator('#zoneMetricSel option').count(),7);
 await frame.locator('#zoneMetricSel').selectOption('fcrLot');assert((await frame.locator('#view').textContent()).includes('FCR cả lứa'));
 await page.screenshot({path:'/tmp/hng-zone-performance.png'});
 const downloadEvent=page.waitForEvent('download');await frame.locator('#exportZonePerformance').click();await (await downloadEvent).saveAs('/tmp/hng-zone-performance.csv');
 assert(fs.readFileSync('/tmp/hng-zone-performance.csv','utf8').includes('BPI cả lứa'));
 await page.locator('[data-tab="nhietdo"]').click();
 await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].find(f=>f.style.display!=='none')?.contentWindow.__HNG_TEMPERATURE__);
 frame=await (await page.locator('iframe:visible').elementHandle()).contentFrame();await page.waitForTimeout(350);
 const measured=await frame.evaluate(data=>{
  const catalog=state.cache.bp.catalog,std=state.cache.bp.std;
  const records=mergeMeasurementRows(normalizeRecords(data.web,catalog,std,'Bình Phước'),normalizeRecords(dailyInputRows(data.input,'Bình Phước'),catalog,std,'Bình Phước'));
  state.cache.bp={...state.cache.bp,records};state.sourceStatus.bp={mode:'online',date:new Date};
  Object.assign(state,{page:'overview',branch:'bp',zone:'all',house:'2C',lot:'48',start:'2026-10-01',end:'2026-11-08',day:'2026-11-08',measureScope:'range'});render();
  return {range:__HNG_TEMPERATURE__.overviewRows().length,day:selectedDate().length,last:records.filter(r=>r.house==='2C').map(r=>r.date).sort().at(-1)};
 },temp);
 assert(measured.range>0);assert.equal(measured.day,0);assert.equal(measured.last,'2026-10-19');
 assert((await frame.locator('#view').textContent()).includes('Ngày 08/11/2026 chưa có ca đo'));
 await frame.locator('#temperatureScope').selectOption('day');
 assert.equal(await frame.evaluate(()=>__HNG_TEMPERATURE__.overviewRows().length),0);
 await frame.locator('#temperatureLatest').click();assert.equal(await frame.locator('#dayFilter').inputValue(),'2026-10-19');
 assert((await frame.evaluate(()=>__HNG_TEMPERATURE__.overviewRows().length))>0);
 await frame.locator('#temperatureScope').selectOption('range');
 await frame.locator('#endFilter').fill('2026-10-10');await frame.locator('#endFilter').dispatchEvent('change');
 assert(await frame.evaluate(()=>__HNG_TEMPERATURE__.overviewRows().every(r=>r.date<='2026-10-10')));
 assert(await frame.locator('#dayFilter').isDisabled());
 assert((await frame.locator('.stats').textContent()).includes('lượt đo trong khoảng lọc'));
 await frame.locator('#endFilter').fill('2026-11-08');await frame.locator('#endFilter').dispatchEvent('change');
 await page.screenshot({path:'/tmp/hng-temperature-scope.png'});
 assert.deepEqual(errors,[]);console.log('PASS BP 2C live source range/day, latest-day action, date filters, no JavaScript errors',measured);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
