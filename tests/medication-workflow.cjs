const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict'),fs=require('fs');
const path=require('node:path');
const daily=(date,farm,lot,vaccine,vitamin)=>[date,farm,lot,7,null,null,null,null,null,null,null,null,null,null,null,vaccine,vitamin];
const headers=['Ngày','Trại','Lứa','Tuổi ngày'];
const issue=(lot,drug,code,farm='1C',qty=10,unit='GR')=>['10/01/2026','CT'+lot,'VẬN HÀNH - C - '+lot,code,drug,'WAREHOUSE',unit,qty,null,null,farm];
const live=process.env.MEDICATION_FIXTURE?JSON.parse(fs.readFileSync(process.env.MEDICATION_FIXTURE,'utf8')):{
 tn:[headers,daily('14-10-2026','TNC1','Lứa 1','IBD blend','C30%'),daily('06-11-2026','TNC1','Lứa 1','Amox','maxzym, đạm'),daily('06-11-2026','TNB7','Lứa 2','-','C30%')],
 bp:[headers,daily('05-11-2026','C1','Lứa 48','Amox','đạm'),daily('06-11-2026','C1','Lứa 48','Amox','đạm'),daily('06-11-2026','C2','Lứa 47','IBD blend','C30%')],
 fast:[['Chứng từ'],issue(1,'IBD blend','TEST_IBD'),issue(48,'Amox','TEST_AMOX'),issue(48,'Đạm tăng lực','TEST_DAM'),issue(48,'Không rõ','TEST_UNKNOWN','')]
};
const program=Array.from({length:20},(_,i)=>[i,'VC',null,'Sản phẩm '+i,1,'GR',20,'']);
let failBP=false;
(async()=>{
const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
try{
const page=await browser.newPage({viewport:{width:1800,height:1100},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{const NativeDate=Date;globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-11-07T04:00:00Z']))}static now(){return new NativeDate('2026-11-07T04:00:00Z').getTime()}};});
await page.route('https://sheets.googleapis.com/**',async route=>{
 const url=new URL(route.request().url()),id=url.pathname.split('/')[3];
 const key=id==='1e8ANAz9yHth2WYdWa099d1dywPO3woc0YVMGL9MFjcQ'?'tn':id==='1YT_fg_BZKHJZvQQx5jHjynTqeFKkg4wkQ0pR4oRm4yM'?'bp':id==='1YpY1fjz4h4YHvFK0mMThwCmm4uCVjkuhGCtc017nONI'?'fast':null;
 if(!key)return route.abort();if(key==='bp'&&failBP)return route.fulfill({status:403,json:{error:{message:'Fixture: BP denied'}}});
 if(url.pathname.endsWith('/values:batchGet'))return route.fulfill({json:{valueRanges:[{values:program},{values:live.fast}]}});
 if(url.pathname.includes('/values/'))return route.fulfill({json:{values:live[key]}});
 return route.fulfill({json:{properties:{title:'Fixture'},sheets:[{properties:{title:'NHẬP HẰNG NGÀY'}}]}});
});
await page.route('**/report-config.json*',r=>r.fulfill({status:404,body:'{}'}));
await page.goto(require('node:url').pathToFileURL(path.resolve(__dirname,'../HNG_Reporting_Center.html')).href);
await page.locator('[data-tab="vaccine"]').click();
await page.waitForFunction(()=>{const f=[...document.querySelectorAll('iframe')].find(f=>f.style.display!=='none');return !!f?.contentWindow.__HNG_MEDICATION__});
const frame=await (await page.locator('iframe:visible').elementHandle()).contentFrame();
await frame.waitForFunction(()=>Object.values(window.__HNG_MEDICATION__.sourceState).every(x=>x.mode==='live'),null,{timeout:20000});
console.log('live source counts',await frame.evaluate(()=>({daily:__actualKQCNRows.length,stock:state.data.issues.length,latest:state.asOf,branches:[...document.querySelector('#fBranch').options].map(x=>x.value)})));
assert.deepEqual(await frame.locator('#fBranch option').evaluateAll(os=>os.map(o=>o.value)),['all','Bình Phước','Chưa xác định','Tây Ninh']);
await page.locator('[data-sub="vaccine"]').click();
await frame.locator('#fBranch').selectOption('Tây Ninh');await frame.locator('#fArea').selectOption('C');await frame.locator('#fFarm').selectOption('1C');await frame.locator('#fBatch').selectOption('1');
await frame.locator('#fStart').fill('2026-10-01');await frame.locator('#fStart').dispatchEvent('change');
assert(await frame.locator('#view').textContent().then(s=>s.includes('Daily')));
assert(await frame.locator('.med-daily tbody').textContent().then(s=>s.includes('TNC1')));
assert(!(await frame.locator('.med-daily tbody').textContent()).includes('Bình Phước'));
const sourceText=await frame.evaluate(()=>__actualKQCNRows.find(r=>r.farm==='TNC1'&&r.date==='2026-10-14'));
assert(sourceText);assert.equal(sourceText.vaccine,'IBD blend');assert.equal(sourceText.vitamin,'C30%');
await frame.locator('#fBranch').selectOption('Bình Phước');
assert.equal(await frame.locator('#fArea').inputValue(),'all');assert.equal(await frame.locator('#fFarm').inputValue(),'all');assert.equal(await frame.locator('#fBatch').inputValue(),'all');
await frame.locator('#fArea').selectOption('C');await frame.locator('#fFarm').selectOption('1C');await frame.locator('#fBatch').selectOption('48');
await page.locator('[data-sub="reconcile"]').click();await frame.waitForFunction(()=>state.page==='reconcile');
assert(await frame.locator('#fStart').isDisabled());
const results=await frame.evaluate(()=>__HNG_MEDICATION__.reconciliation().map(r=>({branch:r.branch,house:r.barn,lot:r.batch,status:r.status,stock:r.stock.length,days:r.dates.size})));
assert(results.length>0);assert(results.every(r=>r.branch==='Bình Phước'&&r.house==='1C'&&r.lot==='48'));console.log('BP C1 lot48 comparison',results.length,results.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}));
// Full-flock view ignores unrelated date filters, but never crosses the lot identity.
const before=results.length;
await frame.evaluate(()=>{state.start='2099-01-01';state.end='2099-01-02';state.asOf='2099-01-02';render();});
assert.equal(await frame.evaluate(()=>__HNG_MEDICATION__.reconciliation().length),before);
await frame.locator('#medFullFlock').uncheck();assert.equal(await frame.evaluate(()=>__HNG_MEDICATION__.reconciliation().length),0);
await frame.locator('#medFullFlock').check();
// Confirm a user-approved map affects only its chosen material, then remove it.
await frame.locator('details').filter({has:frame.locator('#medDailyName')}).locator('summary').click();
const token=await frame.locator('#medDailyName option').nth(1).getAttribute('value');const code=await frame.locator('#medFastCode option').nth(1).getAttribute('value');
await frame.locator('#medDailyName').selectOption(token);await frame.locator('#medFastCode').selectOption(code);await frame.locator('#medSaveMap').click();
assert.equal(await frame.evaluate(key=>state.nameMap[key],token),code);
await frame.locator('[data-remove-med-map]').first().click();assert.equal(await frame.evaluate(key=>state.nameMap[key],token),undefined);
const downloadEvent=page.waitForEvent('download');await frame.locator('#exportReconciliation').click();const download=await downloadEvent;await download.saveAs('/tmp/hng-medication-reconciliation.csv');
assert(fs.readFileSync('/tmp/hng-medication-reconciliation.csv','utf8').includes('Lượng FAST theo mã / ĐVT'));
// Regression cases: ambiguous branch, exact name matching, duplicate days and incompatible units.
await frame.evaluate(()=>{
 const api=__HNG_MEDICATION__;
 if(api.dailyDate('14-10-2026')!=='2026-10-14'||api.dailyDate('31/02/2026')!==null)throw Error('Date parsing');
 if(api.houseParts('TNC1').barn!=='1C'||api.houseParts('C1').barn!=='1C'||api.lotKey('Lứa 48')!=='48')throw Error('House/lot normalization');
 const meds=api.medicineTokens({vaccine:'-',vitamin:'C30%, đạm; maxzym'});if(meds.length!==3)throw Error('Medicine token parsing');
 const originalIssues=state.data.issues;
 try{
  state.data.issues=[{date:'2026-10-01',farm:'1C',batch:'48',code:'UNIT_TEST',drug:'Amox',qty:10,unit:'GR',group:'Kháng sinh / điều trị'},{date:'2026-10-01',farm:'1C',batch:'48',code:'UNIT_TEST',drug:'Amox',qty:2,unit:'LÍT',group:'Kháng sinh / điều trị'}];
  const compared=api.reconciliation().find(r=>r.id==='CODE:UNIT_TEST');
  if(!compared||compared.status!=='Có ở hai nguồn'||!compared.dates.size)throw Error('Full-flock matching across different issue/use dates');
  if(compared.units.size!==2||![...compared.units.values()].some(u=>u.unit==='GR'&&u.qty===10)||![...compared.units.values()].some(u=>u.unit==='LÍT'&&u.qty===2))throw Error('Incompatible units combined');
 }finally{state.data.issues=originalIssues;}
});
await page.screenshot({path:'/tmp/hng-medication-reconcile.png'});
// Same house and lot in both branches must never be assigned to a branch by guesswork.
const savedTN=live.tn;
live.tn=[headers,daily('06-11-2026','TNC1','Lứa 48','Amox','đạm')];
await frame.evaluate(()=>__HNG_MEDICATION__.loadDaily(true));
assert((await frame.evaluate(()=>__HNG_MEDICATION__.stockRows().filter(r=>r.farm==='1C'&&r.batch==='48'))).every(r=>r.branch==='Chưa xác định'));
live.tn=savedTN;await frame.evaluate(()=>__HNG_MEDICATION__.loadDaily(true));
// A failed branch keeps its old data and visibly blocks a fresh reconciliation conclusion.
failBP=true;await frame.evaluate(()=>__HNG_MEDICATION__.loadDaily(true));
assert.equal(await frame.evaluate(()=>__HNG_MEDICATION__.sourceState.bp.mode),'error');
assert((await frame.evaluate(()=>__HNG_MEDICATION__.reconciliation().map(r=>r.status))).every(s=>s==='Nguồn chưa cập nhật'));
failBP=false;await frame.evaluate(()=>__HNG_MEDICATION__.loadDaily(true));
await frame.evaluate(()=>{state.dateManual=false;document.querySelector('#resetFilters').click();});
await page.locator('[data-sub="vaccine"]').click();await frame.waitForFunction(()=>state.page==='vaccine');
await page.screenshot({path:'/tmp/hng-medication-daily.png'});
assert.deepEqual(errors,[]);console.log('PASS fixtures: cascading filters, exact daily P/Q, full flock, name mapping, CSV, dates, no JS errors');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
