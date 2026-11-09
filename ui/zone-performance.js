/* Whole-flock area comparisons: the same seven measures and formulas as TỔNG QUAN. */
(()=>{
'use strict';
const fields=[['saleAge','Ngày tuổi gà xuất','ngày',1],['lossPct','Hao hụt thực tế','%',2],['feedTotal','Tổng cám ăn','kg',0],['soldWeight','Tổng trọng lượng xuất','kg',0],['bwExport','BW xuất bình quân','kg/con',2],['fcrLot','FCR cả lứa','',2],['bpiLot','BPI cả lứa','',0]];
const norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase().trim();
function parseSummary(values){
 const header=values.findIndex(r=>norm(r[0])==='chuong'&&norm(r[2])==='lua');
 if(header<0)throw Error('TỔNG QUAN chưa có bảng tổng kết Chuồng / Khu / Lứa');
 const control=values.slice(0,header).find(r=>norm(r[0]).includes('ngay xem du lieu'));
 const cutoff=control?control.slice(1).map(fixDate).find(Boolean)||null:null;
 const records=values.slice(header+1).filter(r=>r[0]&&r[2]&&fixDate(r[3])).map(r=>({farm:String(r[0]).trim(),lot:String(r[2]).trim(),zone:String(r[1]||'').replace(/^Khu\s*/i,'').trim().toUpperCase(),arrival:fixDate(r[3]),lastDay:fixDate(r[4]),saleAge:asNum(r[5]),initial:asNum(r[6]),soldTotal:asNum(r[7]),lossPct:asNum(r[8]),lossStd:asNum(r[9]),feedTotal:asNum(r[10]),soldWeight:asNum(r[11]),bwExport:asNum(r[12]),fcrLot:asNum(r[13]),bpiLot:asNum(r[14])}));
 return {cutoff,records};
}
function parseSales(values){return values.map(r=>({date:fixDate(r[0]),farm:String(r[1]||'').trim(),lot:String(r[2]||'').trim(),birds:asNum(r[6]),weight:asNum(r[9])})).filter(r=>r.date&&r.farm&&r.lot&&isN(r.birds)&&r.birds>0);}
const oldPull=pullBranch;
pullBranch=async function(branch,url,key){
 const data=await oldPull(branch,url,key),id=getSheetID(url);
 data.catalog=(data.catalog||[]).filter(row=>row.arrival||isN(row.start));
 try{
  const meta=await sheetMeta(id,key),names=(meta.sheets||[]).map(s=>s.properties?.title),requested=['TỔNG QUAN','XUẤT BÁN'].filter(name=>names.includes(name));
  if(!requested.length){data.summaryError='Nguồn chưa có TỔNG QUAN / XUẤT BÁN';return data;}
  const ranges=await sheetsGet(id,key,requested.map(name=>quoted(name)+(name==='TỔNG QUAN'?'!A1:O':'!A1:M')));
  for(let i=0;i<requested.length;i++){try{if(requested[i]==='TỔNG QUAN')data.wholeSummary=parseSummary(ranges[i]?.values||[]);else data.sales=parseSales(ranges[i]?.values||[]);}catch(error){data.summaryError=error.message;}}
 }catch(error){data.summaryError='Chưa đọc được nguồn tổng kết: '+error.message;}
 return data;
};
function cohortResult(row){
 const src=state.cache[row.branch]||{},match=r=>r.farm===row.farm&&r.lot===row.lot;
 const history=(src.rows||[]).filter(match),salesAll=(src.sales||[]).filter(match),historyToDate=history.filter(r=>r.date<=state.asOf);
 const summary=src.wholeSummary,found=(summary?.records||[]).filter(match);
 const dates=[...history,...salesAll].map(r=>r.date).filter(Boolean),lastKnown=dates.sort().at(-1);
 const stable=lastKnown&&lastKnown<=state.asOf&&(!summary?.cutoff||lastKnown<=summary.cutoff);
 // A summary filtered to a different date is only reusable when the entire flock is unchanged at both dates.
 if(found.length===1&&found[0].lastDay&&found[0].lastDay<=state.asOf&&(summary.cutoff===state.asOf||stable))return {...row,...found[0],zone:row.zone,site:row.site,house:row.house,source:'TỔNG QUAN',sourceDate:summary.cutoff,provisional:flockStatusAt(row.branch,row.farm,row.lot,state.asOf)!=='completed'};
 const last=historyToDate.slice().sort((a,b)=>a.date.localeCompare(b.date)).at(-1)||row;
 const cat=(src.catalog||[]).find(match)||{},arrival=cat.arrival||null,initial=isN(cat.start)?cat.start:last.start;
 const sales=salesAll.filter(r=>r.date<=state.asOf),soldTotal=sales.length?sales.reduce((sum,r)=>sum+r.birds,0):null;
 const soldWeight=sales.length&&sales.every(r=>isN(r.weight)&&r.weight>0)?sales.reduce((sum,r)=>sum+r.weight,0):null;
 const saleDate=sales.map(r=>r.date).sort().at(-1),saleAge=saleDate&&arrival?dayDiff(saleDate,arrival)+1:null;
 const lossRows=historyToDate.filter(r=>isN(r.loss)),lossPct=lossRows.length&&initial>0?lossRows.reduce((sum,r)=>sum+r.loss,0)/initial*100:null;
 // TỔNG QUAN sums column R in NHẬP HẰNG NGÀY, not the stock movement sheet NHẬP CÁM.
 const feedRows=historyToDate.filter(r=>isN(r.feedKg)),feedTotal=feedRows.some(r=>r.feedKg>0)?feedRows.reduce((sum,r)=>sum+r.feedKg,0):null;
 const bwExport=soldTotal>0&&soldWeight>0?soldWeight/soldTotal:null,fcrLot=isN(feedTotal)&&soldWeight>0?feedTotal/soldWeight:null;
 const bpiLot=isN(lossPct)&&lossPct>=0&&lossPct<100&&saleAge>0&&fcrLot>0?(100-lossPct)*bwExport*100/(saleAge*fcrLot):null;
 return {...row,arrival,initial,lastDay:last.date,saleAge,soldTotal,soldWeight,lossPct,lossStd:last.lossStd,feedTotal,bwExport,fcrLot,bpiLot,source:'Nhật ký + XUẤT BÁN',sourceDate:state.asOf,provisional:flockStatusAt(row.branch,row.farm,row.lot,state.asOf)!=='completed'};
}
function zoneStats(rows){
 const sum=key=>rows.length&&rows.every(r=>isN(r[key]))?rows.reduce((s,r)=>s+r[key],0):null;
 const out={count:rows.length,initial:sum('initial'),soldTotal:sum('soldTotal'),feedTotal:sum('feedTotal'),soldWeight:sum('soldWeight')};
 out.lossPct=out.initial>0&&rows.every(r=>isN(r.lossPct)&&r.initial>0)?rows.reduce((s,r)=>s+r.lossPct*r.initial,0)/out.initial:null;
 out.saleAge=out.soldTotal>0&&rows.every(r=>isN(r.saleAge)&&r.soldTotal>0)?rows.reduce((s,r)=>s+r.saleAge*r.soldTotal,0)/out.soldTotal:null;
 out.bwExport=out.soldTotal>0&&isN(out.soldWeight)?out.soldWeight/out.soldTotal:null;
 out.fcrLot=isN(out.feedTotal)&&out.soldWeight>0?out.feedTotal/out.soldWeight:null;
 out.bpiLot=out.fcrLot>0&&out.saleAge>0&&isN(out.lossPct)?(100-out.lossPct)*out.bwExport*100/(out.saleAge*out.fcrLot):null;
 return out;
}
const format=(key,value)=>{const field=fields.find(f=>f[0]===key);return isN(value)?calc(value,field?.[3]??2):'—';};
function zoneData(){const age=state.age;let input;try{state.age='all';input=snapshot();}finally{state.age=age;}
 const sites=[...new Set(input.map(r=>r.site).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi',{numeric:true}));
 const site=sites.includes(state.zoneSite)?state.zoneSite:sites.includes(state.site)?state.site:sites[0];
 state.zoneSite=site||'all';
 const selected=input.filter(r=>r.site===site),mapped=selected.filter(r=>r.dimMapped),rows=mapped.map(cohortResult);
 return {input,sites,site,rows,missing:selected.length-mapped.length,zones:['A','B','C'].map(zone=>{const list=rows.filter(r=>r.zone===zone);return {zone,rows:list,stats:zoneStats(list)};})};
}
function comparisonChart(zones,metric){
 const values=zones.map(z=>z.stats[metric]).filter(isN);if(!values.length)return empty('Chưa đủ dữ liệu cho chỉ tiêu này. Không thay số thiếu bằng 0.');
 const W=700,H=260,L=70,T=22,B=48,max=Math.max(...values,1)*1.15,y=v=>T+(max-v)/max*(H-T-B),colors=['#139a7f','#3186bd','#926ab5'];
 let svg=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="So sánh hiệu quả cả lứa các khu">`;
 for(let i=0;i<=4;i++){const v=max*i/4,cy=y(v);svg+=`<line x1="${L}" x2="680" y1="${cy}" y2="${cy}" stroke="#e3ecef"/><text x="${L-10}" y="${cy+4}" text-anchor="end" fill="#78909b" font-size="11">${format(metric,v)}</text>`;}
 zones.forEach((z,i)=>{const v=z.stats[metric],x=155+i*195;if(isN(v)){svg+=`<rect x="${x-40}" y="${y(v)}" width="80" height="${H-B-y(v)}" rx="5" fill="${colors[i]}" data-tip="${esc('Khu '+z.zone+' · '+format(metric,v)+' '+fields.find(f=>f[0]===metric)[2])}"/><text x="${x}" y="${y(v)-8}" text-anchor="middle" font-size="13" font-weight="700" fill="#304552">${format(metric,v)}</text>`;}else svg+=`<text x="${x}" y="${H-B-10}" text-anchor="middle" font-size="12" fill="#78909b">Thiếu dữ liệu</text>`;svg+=`<text x="${x}" y="${H-15}" text-anchor="middle" font-size="13" fill="#647988">Khu ${z.zone}</text>`;});return svg+'</svg>';
}
renderZones=function(){
 const data=zoneData(),{site,sites,zones,rows}=data;
 if(!fields.some(f=>f[0]===state.zoneMetric))state.zoneMetric='bpiLot';
 const metric=fields.find(f=>f[0]===state.zoneMetric);
 let h=heading('So sánh hiệu quả chăn nuôi Khu A / B / C','Tổng kết theo chuồng – lứa đến Ngày xem KQCN; dùng 7 chỉ tiêu trong bảng TỔNG QUAN.');
 h+=`<div class="panel" style="margin-bottom:16px"><div class="scrollhead"><div><b>Trại quản lý và chỉ tiêu so sánh</b><p class="note">Đến ${shortDate(state.asOf)} · ${rows.length} chuồng/lứa có DIM · ${data.missing} chưa gán khu</p></div><div class="toolbar-row"><select id="zoneSiteSel" class="zone-filter-inline">${sites.map(v=>`<option value="${esc(v)}" ${site===v?'selected':''}>${esc(v)}</option>`).join('')}</select><select id="zoneMetricSel" class="zone-filter-inline">${fields.map(f=>`<option value="${f[0]}" ${state.zoneMetric===f[0]?'selected':''}>${f[1]}${f[2]?' ('+f[2]+')':''}</option>`).join('')}</select><button id="editZoneDim" class="secondary">⚙ Khai báo DIM</button><button id="exportZonePerformance" class="secondary">↓ Xuất CSV</button></div></div><p class="note">Ưu tiên bảng TỔNG QUAN đúng thời điểm. Khi ngày lọc khác ngày tổng kết nguồn, tính lại từ NHẬP HẰNG NGÀY và XUẤT BÁN đến ngày chọn. Không dùng BW cân cuối ngày thay cho BW xuất bình quân; không lấy trung bình đơn giản FCR/BPI.</p></div>`;
 if(!rows.length)return h+empty('Chưa có chuồng/lứa được gán DIM trong phạm vi đang lọc.');
 const colors=['#139a7f','#3186bd','#926ab5'];
 h+=`<div class="area-triplet">${zones.map((z,i)=>`<div class="area-card" style="border-top:4px solid ${colors[i]}"><h4>KHU ${z.zone} <span class="badge">${z.rows.length} chuồng/lứa</span></h4><div class="big">${format(state.zoneMetric,z.stats[state.zoneMetric])} <small>${metric[2]}</small></div><div class="highlightline">Đã có số liệu chỉ tiêu <b>${z.rows.filter(r=>isN(r[state.zoneMetric])).length}/${z.rows.length}</b></div><div class="highlightline">Lứa tạm tính <b>${z.rows.filter(r=>r.provisional).length}</b></div><p class="note">${z.rows.length?'Tổng khu chỉ hiển thị khi đủ số liệu các chuồng/lứa tham gia.':'Không có chuồng/lứa trong phạm vi này.'}</p></div>`).join('')}</div>`;
 h+=`<div class="layout2"><div class="panel"><div class="panelhead"><h3>${metric[1]} theo khu ${metric[2]?'('+metric[2]+')':''}</h3><span class="badge">${esc(site)}</span></div><div class="chart">${comparisonChart(zones,state.zoneMetric)}</div></div><div class="panel"><div class="panelhead"><h3>Đủ 7 chỉ tiêu hiệu quả cả lứa</h3></div><div class="tablewrap"><table class="datatable" style="min-width:0;width:100%">${tableHeader(['Chỉ tiêu','Khu A','Khu B','Khu C'])}<tbody>${fields.map(([key,label,unit])=>`<tr><td style="text-align:left">${label}${unit?' ('+unit+')':''}</td>${zones.map(z=>`<td>${format(key,z.stats[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="note">Tuổi xuất khu: bình quân theo số gà xuất. Hao hụt: trọng số gà đầu lứa. BW = tổng kg xuất / tổng con xuất. FCR = tổng cám / tổng kg xuất. BPI tính lại từ tỷ lệ sống, BW, tuổi xuất và FCR của khu.</p></div></div>`;
 h+=heading('Chi tiết từ bảng tổng kết theo chuồng – lứa','Giữ riêng từng chi nhánh, chuồng và lứa; — là thiếu dữ liệu, không phải 0.');
 h+=`<div class="panel"><div class="tablewrap"><table class="datatable" style="min-width:1500px">${tableHeader(['Khu','Chuồng / Chi nhánh','Lứa',...fields.map(f=>f[1]+(f[2]?' ('+f[2]+')':'')),'Nguồn / Thời điểm'])}<tbody>${rows.sort((a,b)=>a.zone.localeCompare(b.zone)||a.farm.localeCompare(b.farm,'vi',{numeric:true})).map(r=>`<tr class="clickable" data-detail="${esc(r.branch+'|'+r.farm+'|'+r.lot)}"><td>${esc(r.zone)}</td><td><b>${esc(r.farm)}</b><div class="mini">${esc(r.branch)}</div></td><td>${esc(r.lot)}${r.provisional?'<div class="mini">Tạm tính</div>':''}</td>${fields.map(f=>`<td>${format(f[0],r[f[0]])}</td>`).join('')}<td>${esc(r.source)}<div class="mini">${r.sourceDate?shortDate(r.sourceDate):'Toàn lịch sử nguồn'}</div></td></tr>`).join('')}</tbody></table></div></div>`;
 return h;
};
const oldSync=syncFilterOptions;
syncFilterOptions=function(){if($('#fAge'))$('#fAge').disabled=false;oldSync();if(state.animal==='broiler'&&state.page==='zones'){state.age='all';$('#fAge').value='all';$('#fAge').disabled=true;$('#fAge').title='So sánh cả lứa không lọc một ngày tuổi riêng lẻ.';}};
const oldBind=bindView;
bindView=function(){oldBind();const button=$('#exportZonePerformance');if(button)button.onclick=()=>{const data=zoneData(),q=v=>'"'+String(v??'').replaceAll('"','""')+'"',rows=[['Chi nhánh','Trại','Khu','Chuồng','Lứa',...fields.map(f=>f[1]),'Nguồn','Ngày nguồn','Tạm tính'],...data.rows.map(r=>[r.branch,r.site,r.zone,r.farm,r.lot,...fields.map(f=>isN(r[f[0]])?r[f[0]]:''),r.source,r.sourceDate||'',r.provisional?'Có':'Không'])];const blob=new Blob(['\ufeff'+rows.map(r=>r.map(q).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='HNG_So_sanh_hieu_qua_cac_khu.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};};
window.__HNG_ZONE_PERFORMANCE__={fields,parseSummary,parseSales,cohortResult,zoneStats,zoneData};
})();
