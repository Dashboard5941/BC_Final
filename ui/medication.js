/* Daily P/Q are reported use; FAST rows are warehouse issues. Keep both sources auditable. */
(()=>{
'use strict';
const UNKNOWN='Chưa xác định';
const BRANCHES={tn:'Tây Ninh',bp:'Bình Phước'};
const sourceState={tn:{mode:'sample'},bp:{mode:'sample'},fast:{mode:'sample'}};
let dailyRows=[],flockBranches=new Map(),loadVersion=0,activeLoad=null;
state.branch='all';state.batch='all';state.fullFlock=true;state.actualType='all';state.reconcileStatus='all';
state.nameMap={};try{state.nameMap=JSON.parse(localStorage.getItem('hng.medication.names.v1')||'{}')}catch{}
function normalized(value){return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').trim().toLowerCase();}
function nameKey(value){return normalized(value).replace(/[^a-z0-9]/g,'');}
function lotKey(value){const s=String(value??'').trim(),m=s.match(/^(?:lứa\s*)?(\d+)(?:\.0+)?$/i);return m?String(Number(m[1])):s;}
function branchName(value){const v=nameKey(value);return /^(tn|tayninh)$/.test(v)?BRANCHES.tn:/^(bp|binhphuoc)$/.test(v)?BRANCHES.bp:'';}
function houseParts(value){
 const raw=String(value??'').trim().toUpperCase().replace(/^(?:TN|BP)[\s_-]*/,''),s=raw.replace(/[\s_-]/g,'');
 const m=s.match(/^([A-Z])(\d+)$/)||s.match(/^(\d+)([A-Z])$/);
 if(!m)return {area:UNKNOWN,barn:raw||UNKNOWN};
 const area=/^\d/.test(m[1])?m[2]:m[1],number=/^\d/.test(m[1])?m[1]:m[2];
 return {area,barn:String(Number(number))+area};
}
function hasTreatment(value){return !!String(value??'').trim()&&!/^(?:[-–—.]+|0|không|khong|none|n\/a)$/i.test(String(value).trim());}
function dailyDate(value){
 if(typeof value==='number')return parseDate(value);
 const s=String(value??'').trim();if(/^\d{4}-\d{2}-\d{2}/.test(s))return s.slice(0,10);
 const m=s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);if(!m)return null;
 const d=new Date(Date.UTC(+m[3],+m[2]-1,+m[1]));
 return d.getUTCDate()===+m[1]&&d.getUTCMonth()===+m[2]-1?d.toISOString().slice(0,10):null;
}
function normalizeDaily(row){const parts=houseParts(row.farm);return {...row,branch:branchName(row.branch)||UNKNOWN,...parts,lot:lotKey(row.lot),batch:lotKey(row.lot),vaccine:String(row.vaccine||'').trim(),vitamin:String(row.vitamin||'').trim()};}
function parseDaily(values,branch){
 const out=[],seen=new Set();
 for(let i=0;i<values.length;i++){
  const r=values[i],date=dailyDate(r[0]);if(!date||!String(r[1]||'').trim())continue;
  const row=normalizeDaily({date,branch,farm:String(r[1]).trim(),lot:r[2],age:parseNum(r[3]),vaccine:r[15],vitamin:r[16],originRow:i+1});
  // Exact duplicates do not inflate medicine days; conflicting entries stay visible.
  const key=[date,row.branch,row.barn,row.lot,row.vaccine,row.vitamin].join('|');if(seen.has(key))continue;seen.add(key);out.push(row);
 }
 return out;
}
function installDaily(rows){
 dailyRows=rows.map(normalizeDaily);window.__actualKQCNRows=dailyRows;
 flockBranches=new Map();
 for(const row of dailyRows){const key=row.barn+'|'+row.lot;if(!flockBranches.has(key))flockBranches.set(key,new Set());flockBranches.get(key).add(row.branch);}
}
installDaily(ACTUAL_KQCN_TREATMENTS);
function stockBranch(row){
 const explicit=branchName(row.branch)||(/^(?:TN)/i.test(row.farm||'')?BRANCHES.tn:/^(?:BP)/i.test(row.farm||'')?BRANCHES.bp:'');if(explicit)return explicit;
 // FAST's 1C and daily's TNC1/C1 share a house key, but a branch is inferred only for a unique house + lot.
 const choices=flockBranches.get(houseParts(row.farm).barn+'|'+lotKey(row.batch));return choices?.size===1?[...choices][0]:UNKNOWN;
}
function stockRows(){return (state.data.issues||[]).map(row=>({...row,...houseParts(row.farm),branch:stockBranch(row),batch:lotKey(row.batch),_original:row}));}
function identityMatch(row,ignore={}){return (ignore.branch||state.branch==='all'||row.branch===state.branch)&&(ignore.area||state.area==='all'||row.area===state.area)&&(ignore.farm||state.farm==='all'||row.barn===state.farm)&&(ignore.batch||state.batch==='all'||row.batch===state.batch);}
function inDates(row,full=false){return row.date<=currentLocalDate()&&(full||((!state.start||row.date>=state.start)&&(!state.end||row.date<=state.end)&&(!state.asOf||row.date<=state.asOf)));}
function dailyScope(full=false){return dailyRows.filter(row=>identityMatch(row)&&inDates(row,full));}
function stockScope(full=false){return stockRows().filter(row=>identityMatch(row)&&inDates(row,full)&&(state.group==='all'||row.group===state.group));}
function flockKey(row){return [row.branch,row.barn,row.batch].join('|');}
function sortedUnique(rows,key){return [...new Set(rows.map(r=>r[key]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'vi',{numeric:true}));}
areaOf=row=>houseParts(row?.farm).area;
barnOf=row=>houseParts(row?.farm).barn;
enrichRow=row=>row; // Source records remain untouched for audit and existing detail drawers.
refreshFilters=function(){
 let rows=[...dailyRows,...stockRows()];
 state.branch=setOptions($('#fBranch'),sortedUnique(rows,'branch'),'Tất cả chi nhánh',state.branch);
 rows=rows.filter(r=>state.branch==='all'||r.branch===state.branch);
 state.area=setOptions($('#fArea'),sortedUnique(rows,'area'),'Tất cả khu',state.area);
 rows=rows.filter(r=>state.area==='all'||r.area===state.area);
 state.farm=setOptions($('#fFarm'),sortedUnique(rows,'barn'),'Tất cả chuồng',state.farm);
 rows=rows.filter(r=>state.farm==='all'||r.barn===state.farm);
 state.batch=setOptions($('#fBatch'),sortedUnique(rows,'batch'),'Tất cả lứa',state.batch);
 const onlyDaily=['vaccine','reconcile'].includes(state.page);if(onlyDaily)state.group='all';
 const groupRows=stockRows().filter(r=>identityMatch(r));
 state.group=setOptions($('#fGroup'),sortedUnique(groupRows,'group'),'Tất cả nhóm',state.group);$('#fGroup').disabled=onlyDaily;
 $('#fGroup').title=onlyDaily?'Nhóm vật tư dành cho dữ liệu kho FAST. Nhật ký dùng hai cột gốc của daily.':'';
 for(const [id,key] of [['fStart','start'],['fEnd','end'],['fAsOf','asOf']]){$('#'+id).value=state[key];$('#'+id).disabled=state.page==='reconcile'&&state.fullFlock;}
};
rowsInScope=function(useDate=true){return stockRows().filter(r=>identityMatch(r)&&(state.group==='all'||r.group===state.group)&&(!useDate||((!state.start||r.date>=state.start)&&(!state.end||r.date<=state.end)&&(!state.asOf||r.date<=state.asOf)))).map(r=>r._original);};
// Unlike the original parser, keep every lot number rather than hardcoding lots 1 and 48.
const originalParseIssues=parseIssues;
parseIssues=function(values){return originalParseIssues(values).map(r=>{const m=String(r.desc).match(/(?:lứa\s*[-:]?\s*|\b[ABC]\s*-\s*)(\d+)\b/i);return {...r,batch:m?lotKey(m[1]):''};});};
function dailyConfig(){
 let stored={},kqcn={};try{stored=JSON.parse(localStorage.getItem('hng.vaccine.kqcn.actual')||'{}');kqcn=JSON.parse(localStorage.getItem('hng.kqcn.sheets')||'{}')}catch{}
 const configured=state.config.actual||{};
 return {tn:stored.tn||configured.tn||kqcn.tn||'',bp:stored.bp||configured.bp||kqcn.bp||'',key:stored.key||configured.key||state.config.key||kqcn.key||''};
}
function statusLine(){
 return `<div class="notice med-sources" role="status">${['tn','bp','fast'].map(id=>{const s=sourceState[id],name=id==='fast'?'Kho FAST':'Daily '+BRANCHES[id];return `<span><b>${esc(name)}:</b> ${esc(s.mode==='live'?'Đã cập nhật '+s.at.toLocaleTimeString('vi-VN'):s.mode==='error'?'Lỗi tải · '+s.error:s.mode==='loading'?'Đang tải…':'Dữ liệu mẫu, chưa cập nhật')}${s.mode==='error'?'<small> · Đang giữ bản đọc gần nhất</small>':''}</span>`}).join('')}</div>`;
}
async function loadDaily(force=false,config){
 if(activeLoad&&!force)return activeLoad;
 const version=++loadVersion,cfg=config||dailyConfig(),jobs=['tn','bp'].filter(k=>cfg[k]);
 if(!cfg.key||!jobs.length){if(force)setToast('Cần link daily và API key để tải dữ liệu.');return;}
 for(const key of jobs)sourceState[key]={...sourceState[key],mode:'loading'};
 render();
 const promise=(async()=>{
 const results=await Promise.all(jobs.map(async key=>{
  try{
   const id=sheetID(cfg[key]),base='https://sheets.googleapis.com/v4/spreadsheets/'+encodeURIComponent(id);
   const meta=await googleFetch(base+'?fields='+encodeURIComponent('sheets(properties(title))')+'&key='+encodeURIComponent(cfg.key));
   if(!meta.sheets?.some(s=>s.properties?.title==='NHẬP HẰNG NGÀY'))throw Error('Không tìm thấy tab NHẬP HẰNG NGÀY');
   const data=await googleFetch(base+'/values/'+encodeURIComponent("'NHẬP HẰNG NGÀY'!A1:Q")+'?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER&key='+encodeURIComponent(cfg.key));
   const rows=parseDaily(data.values||[],BRANCHES[key]);if(!rows.length)throw Error('Daily không có dòng ngày/chuồng hợp lệ');return {key,rows};
  }catch(error){return {key,error:error.message};}
 }));
 if(version!==loadVersion)return;
 let combined=dailyRows;
 for(const result of results){if(result.rows){combined=combined.filter(r=>r.branch!==BRANCHES[result.key]).concat(result.rows);sourceState[result.key]={mode:'live',at:new Date(),rows:result.rows.length};}else sourceState[result.key]={...sourceState[result.key],mode:'error',error:result.error};}
 installDaily(combined);syncDateRange();render();
 if(force)setToast(results.map(r=>BRANCHES[r.key]+': '+(r.error?r.error:r.rows.length+' dòng daily')).join(' · '));
 })();
 activeLoad=promise;try{await promise}finally{if(activeLoad===promise)activeLoad=null;}
}
function syncDateRange(){
 if(state.dateManual)return;
 const dates=[...dailyRows,...stockRows()].map(r=>r.date).filter(d=>d&&d<=currentLocalDate()).sort();if(dates.length){state.asOf=dates.at(-1);state.end=state.asOf;state.start=state.asOf.slice(0,7)+'-01';}
}
const originalConnect=connect;
connect=async function(background=false){
 const before=state.lastSync;sourceState.fast={...sourceState.fast,mode:'loading'};
 await Promise.all([originalConnect(background),loadDaily()]);
 sourceState.fast=state.lastSync!==before?{mode:'live',at:state.lastSync}:{mode:'error',error:'Chưa tải được nguồn xuất kho; kiểm tra kết nối FAST'};
 syncDateRange();render();
};
function dailySettings(){const cfg=dailyConfig();return `<details class="panel" style="margin-top:14px"><summary>Nguồn daily Tây Ninh / Bình Phước</summary><div class="formgrid" style="margin-top:12px"><label class="field"><span>Daily Tây Ninh</span><input id="kqcnActualTN" value="${esc(cfg.tn)}" placeholder="Link Google Sheets daily Tây Ninh"></label><label class="field"><span>Daily Bình Phước</span><input id="kqcnActualBP" value="${esc(cfg.bp)}" placeholder="Link Google Sheets daily Bình Phước"></label><label class="field"><span>API key</span><input id="kqcnActualKey" type="password" value="${esc(cfg.key)}" autocomplete="off"></label><button id="loadActualKQCN" class="primary">Tải lại daily</button></div><p class="note">Tự dùng hai nguồn daily đã cấu hình cho KQCN. Dữ liệu thuốc đọc từ cột P (Vaccine / Antibiotic) và Q (Vitamin / Premix).</p></details>`;}
renderVaccine=function(){
 const selected=state.actualType||'all';
 const rows=dailyScope().filter(r=>selected==='vaccine'?hasTreatment(r.vaccine):selected==='vitamin'?hasTreatment(r.vitamin):hasTreatment(r.vaccine)||hasTreatment(r.vitamin));
 let h=statusLine()+`<div class="kpis">${card('Daily có ghi thuốc',nf(rows.length),'bản ghi','Đúng nội dung hai cột P / Q','',true)}${card('Ngày có ghi nhận',nf(new Set(rows.map(r=>r.date)).size),'ngày','Trong khoảng đang lọc','blue')}${card('Chuồng / lứa có ghi nhận',nf(new Set(rows.map(flockKey)).size),'chuồng/lứa','Tách riêng chi nhánh và lứa','green')}${card('Nguồn thuốc thực tế','Daily','','Admin trại ghi nhận','orange')}</div>`;
 h+=`<div class="row between" style="margin:15px 0"><h3>Thuốc sử dụng theo chuồng / lứa — daily</h3><div class="row"><select id="actualTypeFilter" class="secondary"><option value="all">Cả hai cột</option><option value="vaccine">Vaccine / Antibiotic</option><option value="vitamin">Vitamin / Premix</option></select><button id="exportDailyMedicine" class="secondary">↓ Xuất CSV</button></div></div><p class="note">Giữ nguyên tên và ghi chú admin nhập. Số dòng daily không phải số liều hay số lượng thuốc dùng.</p>`;
 const sorted=rows.slice().sort((a,b)=>b.date.localeCompare(a.date)||a.branch.localeCompare(b.branch)||a.barn.localeCompare(b.barn,'vi',{numeric:true}));
 const offset=state.pageNo*state.limit;
 h+=`<div class="panel"><div class="tablewrap"><table class="table med-daily">${head(['Ngày','Chi nhánh','Khu','Chuồng','Lứa','Tuổi ngày','Vaccine / Antibiotic','Vitamin / Premix'])}<tbody>${sorted.slice(offset,offset+state.limit).map(r=>`<tr><td>${fmtDate(r.date)}</td><td>${esc(r.branch)}</td><td>${esc(r.area)}</td><td><b>${esc(r.farm)}</b><div class="subtxt">Mã đối chiếu ${esc(r.barn)}</div></td><td>${esc(r.lot)}</td><td>${nf(r.age)}</td><td class="med-text">${esc(r.vaccine||'—')}</td><td class="med-text">${esc(r.vitamin||'—')}</td></tr>`).join('')||'<tr><td colspan="8">Không có ghi nhận daily trong phạm vi đang lọc.</td></tr>'}</tbody></table></div><div class="pag"><span>${rows.length?offset+1:0}–${Math.min(offset+state.limit,rows.length)} / ${rows.length}</span><button id="prev" class="secondary" ${offset===0?'disabled':''}>← Trước</button><button id="next" class="secondary" ${offset+state.limit>=rows.length?'disabled':''}>Sau →</button></div></div>`;
 return h+dailySettings();
};
function medicineTokens(row){return ['vaccine','vitamin'].flatMap(column=>hasTreatment(row[column])?String(row[column]).split(/[,;\n+]+/).map(name=>name.trim()).filter(hasTreatment).map(name=>({name,key:nameKey(name),column})):[]);}
function stockNameIndex(){const names=new Map();for(const r of state.data.issues||[]){const key=nameKey(r.drug);if(!names.has(key))names.set(key,new Set());names.get(key).add(r.code||'NAME:'+key);}return names;}
function tokenIdentity(token,index){
 const mapped=state.nameMap[token.key];if(mapped)return {id:'CODE:'+mapped,match:'Ánh xạ đã lưu'};
 const exact=index.get(token.key);return exact?.size===1?{id:'CODE:'+[...exact][0],match:'Tên chuẩn hóa trùng'}:{id:'DAILY:'+token.key,match:'Chưa ghép mã FAST'};
}
function reconciliation(){
 const full=state.fullFlock,daily=dailyScope(full),stock=stockScope(full),names=stockNameIndex(),result=new Map();
 const dailyFlocks=new Set(daily.map(flockKey)),stockFlocks=new Set(stock.map(flockKey));
 function entry(row,id){const key=flockKey(row)+'|'+id;if(!result.has(key))result.set(key,{branch:row.branch,area:row.area,barn:row.barn,batch:row.batch,id,dailyNames:new Set(),stockNames:new Set(),dates:new Set(),stock:[],units:new Map(),match:''});return result.get(key);}
 for(const row of daily)for(const token of medicineTokens(row)){const ident=tokenIdentity(token,names),r=entry(row,ident.id);r.dailyNames.add(token.name);r.dates.add(row.date);r.match=ident.match;}
 for(const row of stock){const id='CODE:'+(row.code||'NAME:'+nameKey(row.drug)),r=entry(row,id);r.stockNames.add(row.drug);r.stock.push(row);const unit=row.unit||'Chưa rõ ĐVT',key=(row.code||row.drug)+'|'+unit;let group=r.units.get(key)||{code:row.code,unit,qty:0};group.qty+=row.qty;r.units.set(key,group);}
 for(const row of result.values()){
  const key=[row.branch,row.barn,row.batch].join('|');
  const branchID=Object.keys(BRANCHES).find(id=>BRANCHES[id]===row.branch),ready=sourceState.fast.mode==='live'&&sourceState[branchID]?.mode==='live';
  row.status=row.branch===UNKNOWN||!row.batch?'Thiếu khóa đối chiếu':!ready?'Nguồn chưa cập nhật':row.dates.size&&row.stock.length?'Có ở hai nguồn':row.dates.size?(!stockFlocks.has(key)?'Chưa có FAST cho chuồng/lứa':row.id.startsWith('DAILY:')?'Cần ghép tên daily ↔ FAST':'Daily chưa thấy FAST'):!dailyFlocks.has(key)?'Chưa có daily cho chuồng/lứa':'FAST chưa thấy daily';
 }
 return [...result.values()].sort((a,b)=>a.branch.localeCompare(b.branch)||a.barn.localeCompare(b.barn,'vi',{numeric:true})||a.batch.localeCompare(b.batch,'vi',{numeric:true})||a.status.localeCompare(b.status));
}
function unitSummary(row){return [...row.units.values()].map(u=>`${u.code||''}: ${nf(u.qty,2)} ${u.unit}`).join('; ');}
function renderMapping(){
 const tokens=new Map();for(const r of dailyScope(state.fullFlock))for(const token of medicineTokens(r))tokens.set(token.key,token.name);
 const materials=new Map((state.data.issues||[]).filter(r=>r.code).map(r=>[r.code,r.drug]));
 return `<details class="panel" style="margin-top:15px"><summary>Ghép tên viết tắt trên daily với mã vật tư FAST</summary><p class="note">Chỉ ghép sau khi xác nhận đúng sản phẩm. Không tự coi tên gần giống là cùng thuốc. Ánh xạ này được lưu trên trình duyệt hiện tại.</p><div class="row med-map"><select id="medDailyName" class="secondary" aria-label="Tên thuốc daily"><option value="">Chọn tên daily</option>${[...tokens].sort((a,b)=>a[1].localeCompare(b[1])).map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('')}</select><select id="medFastCode" class="secondary" aria-label="Mã thuốc FAST"><option value="">Chọn mã FAST</option>${[...materials].map(([code,name])=>`<option value="${esc(code)}">${esc(code+' · '+name)}</option>`).join('')}</select><button id="medSaveMap" class="primary">Lưu ghép tên</button></div><div class="med-map-list">${Object.entries(state.nameMap).map(([key,code])=>`<div class="kv"><span>${esc(tokens.get(key)||key)} → ${esc(code+' · '+(materials.get(code)||''))}</span><button class="secondary" data-remove-med-map="${esc(key)}">Xóa</button></div>`).join('')}</div></details>`;
}
renderReconcile=function(){
 const all=reconciliation(),filtered=state.reconcileStatus==='all'?all:all.filter(r=>r.status===state.reconcileStatus),offset=state.pageNo*state.limit;
 const both=all.filter(r=>r.status==='Có ở hai nguồn').length;
 let h=statusLine()+`<div class="panel" style="margin-bottom:16px"><div class="row between"><div><h4>Đối chiếu cuối lứa: daily ↔ kho FAST</h4><p class="note">Ghép theo chi nhánh + chuồng + lứa + mã vật tư/tên đã xác nhận. Không yêu cầu xuất kho trùng ngày sử dụng. Chi nhánh FAST chỉ được suy ra khi chuồng + lứa xuất hiện duy nhất ở một chi nhánh daily.</p></div><label class="check"><input id="medFullFlock" type="checkbox" ${state.fullFlock?'checked':''}> Toàn lứa (bỏ giới hạn ngày lọc)</label></div><p class="note">${state.fullFlock?'Đang đối chiếu toàn bộ lịch sử đã có đến hôm nay cho các chuồng/lứa được chọn. Chọn một lứa cụ thể để kiểm tra cuối lứa.':'Đang đối chiếu trong khoảng ngày đang lọc.'} “Có ở hai nguồn” chỉ xác nhận có tên/mã tương ứng; daily P/Q chưa có lượng và đơn vị để tính chênh lệch số lượng. Chưa có dữ liệu nguồn không được coi là lệch thuốc.</p></div>`;
 h+=`<div class="kpis">${card('Mục thuốc cần đối chiếu',nf(all.length),'mục','Tách từng chuồng và lứa','',true)}${card('Có ở hai nguồn',nf(both),'mục','Đã có tên/mã tương ứng','green')}${card('Cần ghép tên daily',nf(all.filter(r=>r.status==='Cần ghép tên daily ↔ FAST').length),'mục','Tên viết tắt chưa xác nhận mã','orange')}${card('Cần kiểm tra thêm',nf(all.length-both),'mục','Gồm thiếu nguồn, thiếu khóa và chưa ghép tên','blue')}</div>`;
 h+=`<div class="panel"><div class="row between"><select id="medReconcileStatus" class="secondary" aria-label="Trạng thái đối chiếu"><option value="all">Tất cả trạng thái</option>${sortedUnique(all,'status').map(status=>`<option value="${esc(status)}">${esc(status)}</option>`).join('')}</select><button id="exportReconciliation" class="secondary">↓ Xuất đối chiếu CSV</button></div><div class="tablewrap"><table class="table med-reconcile">${head(['Chi nhánh / Khu','Chuồng / Lứa','Tên ghi trên daily','Vật tư FAST','Ngày daily có ghi','Dòng FAST','Lượng xuất theo mã / ĐVT','Kết quả'])}<tbody>${filtered.slice(offset,offset+state.limit).map(r=>`<tr><td>${esc(r.branch)}<div class="subtxt">Khu ${esc(r.area)}</div></td><td><b>${esc(r.barn)}</b><div class="subtxt">Lứa ${esc(r.batch||'Chưa rõ')}</div></td><td class="med-text">${esc([...r.dailyNames].join('; ')||'—')}<div class="subtxt">${esc(r.match)}</div></td><td class="med-text">${esc([...r.stockNames].join('; ')||'—')}</td><td>${nf(r.dates.size)}<div class="subtxt">${esc([...r.dates].sort().map(fmtDate).join(', '))}</div></td><td>${nf(r.stock.length)}</td><td class="med-text">${esc(unitSummary(r)||'—')}</td><td>${tag(r.status,r.status==='Có ở hai nguồn'?'green':'orange')}</td></tr>`).join('')||'<tr><td colspan="8">Không có dữ liệu để đối chiếu trong phạm vi này.</td></tr>'}</tbody></table></div><div class="pag"><span>${filtered.length?offset+1:0}–${Math.min(offset+state.limit,filtered.length)} / ${filtered.length}</span><button id="prev" class="secondary" ${offset===0?'disabled':''}>← Trước</button><button id="next" class="secondary" ${offset+state.limit>=filtered.length?'disabled':''}>Sau →</button></div></div>`;
 return h+renderMapping()+dailySettings();
};
function csvDownload(name,headers,rows){const csv='\ufeff'+[headers,...rows].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const baseQualityFacts=qualityFacts;
qualityFacts=function(){if(state.page!=='quality')return baseQualityFacts();const x=rowsInScope(false),today=currentLocalDate();return {all:x.length,future:x.filter(r=>r.date>today),unknown:x.filter(r=>!r.farm),unmatched:x.filter(r=>!r.stdMatch),units:x.filter(r=>r.unit==='KG'&&r.qty>=1000),missingBatch:x.filter(r=>!r.batch),nonStdVaccine:x.filter(r=>r.group==='Vaccine'&&!r.stdMatch)};};
const baseStats=stats;
stats=function(rows){const result=baseStats(rows);result.farms=new Set(rows.filter(r=>r.farm).map(r=>stockBranch(r)+'|'+houseParts(r.farm).barn)).size;return result;};
const baseOverview=renderOverview;
renderOverview=function(){return baseOverview().replace('Trại nhận cấp phát','Chuồng nhận cấp phát').replace('Trong '+nf(state.data.farms.length)+' trại định danh','Định danh riêng theo chi nhánh và chuồng');};
const baseMedicineNote=medicineNote;
medicineNote=function(row){return 'Chi nhánh '+stockBranch(row)+' · '+baseMedicineNote(row);};
const baseRender=render;
render=function(){
 const mapWasOpen=$('#medDailyName')?.closest('details')?.open;
 baseRender();
 if(mapWasOpen&&$('#medDailyName'))$('#medDailyName').closest('details').open=true;
 const type=$('#actualTypeFilter');if(type){type.value=state.actualType;type.onchange=e=>{state.actualType=e.target.value;state.pageNo=0;render();};}
 const full=$('#medFullFlock');if(full)full.onchange=e=>{state.fullFlock=e.target.checked;state.pageNo=0;render();};
 const filter=$('#medReconcileStatus');if(filter){filter.value=state.reconcileStatus;filter.onchange=e=>{state.reconcileStatus=e.target.value;state.pageNo=0;render();};}
 const load=$('#loadActualKQCN');if(load)load.onclick=()=>{const cfg={tn:$('#kqcnActualTN').value.trim(),bp:$('#kqcnActualBP').value.trim(),key:$('#kqcnActualKey').value.trim()};try{localStorage.setItem('hng.vaccine.kqcn.actual',JSON.stringify(cfg))}catch{}state.config.actual=cfg;loadDaily(true,cfg);};
 const save=$('#medSaveMap');if(save)save.onclick=()=>{const name=$('#medDailyName').value,code=$('#medFastCode').value;if(!name||!code){setToast('Chọn tên daily và mã vật tư FAST.');return}state.nameMap[name]=code;try{localStorage.setItem('hng.medication.names.v1',JSON.stringify(state.nameMap))}catch{}render();setToast('Đã lưu ghép tên trên trình duyệt này.');};
 $$('[data-remove-med-map]').forEach(button=>button.onclick=()=>{delete state.nameMap[button.dataset.removeMedMap];try{localStorage.setItem('hng.medication.names.v1',JSON.stringify(state.nameMap))}catch{}render();});
 const dailyExport=$('#exportDailyMedicine');if(dailyExport)dailyExport.onclick=()=>{const rows=dailyScope().filter(r=>state.actualType==='vaccine'?hasTreatment(r.vaccine):state.actualType==='vitamin'?hasTreatment(r.vitamin):hasTreatment(r.vaccine)||hasTreatment(r.vitamin));csvDownload('HNG_Thuoc_Daily.csv',['Ngày','Chi nhánh','Khu','Chuồng gốc','Chuồng đối chiếu','Lứa','Tuổi ngày','Vaccine / Antibiotic','Vitamin / Premix'],rows.map(r=>[r.date,r.branch,r.area,r.farm,r.barn,r.batch,r.age,r.vaccine,r.vitamin]));};
 const recExport=$('#exportReconciliation');if(recExport)recExport.onclick=()=>csvDownload('HNG_Doi_chieu_Daily_FAST.csv',['Chi nhánh','Khu','Chuồng','Lứa','Tên daily','Tên FAST','Ngày daily','Dòng FAST','Lượng FAST theo mã / ĐVT','Kết quả'],reconciliation().filter(r=>state.reconcileStatus==='all'||r.status===state.reconcileStatus).map(r=>[r.branch,r.area,r.barn,r.batch,[...r.dailyNames].join('; '),[...r.stockNames].join('; '),[...r.dates].sort().join('; '),r.stock.length,unitSummary(r),r.status]));
 const context=$('#medContext');if(context)context.innerHTML=state.page==='vaccine'||state.page==='reconcile'?'':statusLine();
};
titles.overview=['Tổng quan kho FAST','Kho FAST — cấp phát thuốc / vaccine','Lượng xuất cấp từ kho vật tư; xem thuốc trại báo dùng tại mục Thuốc theo daily'];
titles.vaccine=['Thuốc theo daily','Thuốc thực tế theo chuồng / lứa','Đúng hai cột Vaccine / Antibiotic và Vitamin / Premix admin trại nhập'];
titles.reconcile=['Đối chiếu cuối lứa','Daily sử dụng ↔ kho FAST','Kiểm tra có ghi nhận thuốc ở hai nguồn theo chi nhánh, chuồng và lứa'];
const originalInit=init;
init=async function(){
 $('#fBranch').onchange=e=>{state.branch=e.target.value;state.area=state.farm=state.batch='all';state.reconcileStatus='all';state.pageNo=0;render();};
 await originalInit();
 // Reset to all available history's latest date rather than a hardcoded sample month/lot.
 $('#resetFilters').onclick=()=>{state.branch=state.area=state.farm=state.batch=state.group='all';state.actualType=state.reconcileStatus='all';state.term='';state.pageNo=0;state.dateManual=false;syncDateRange();render();};
 if(!state.config.url||!state.config.key)loadDaily();
};
// Small read-only test surface: no credentials or source mutations.
window.__HNG_MEDICATION__={parseDaily,dailyDate,houseParts,lotKey,nameKey,medicineTokens,reconciliation,sourceState,loadDaily,stockRows};
})();
