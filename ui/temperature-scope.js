/* Distinguish a range with historical measurements from an empty selected day. */
(()=>{
'use strict';
state.measureScope='range';
const today=()=>{const d=new Date(),pad=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
function periodRows(){return filtered(true).filter(r=>r.date<=today());}
function overviewRows(){return state.measureScope==='day'?selectedDate():periodRows();}
function scopedExpected(){
 const end=state.measureScope==='day'?state.day:state.end||today();
 const out=[];for(const source of sources()){if(state.branch!=='all'&&source.id!==state.branch)continue;for(const row of state.cache[source.id]?.catalog||[]){if(row.arrival&&row.arrival>end)continue;if(state.zone!=='all'&&row.zone!==state.zone||state.house!=='all'&&row.house!==state.house||state.lot!=='all'&&row.lot!==state.lot)continue;out.push({...row,sourceId:source.id,branch:source.name});}}
 return out;
}
function info(){
 const rows=filtered(false).filter(r=>r.date<=today()),latest=rows.map(r=>r.date).sort().at(-1),dayRows=rows.filter(r=>r.date===state.day),period=periodRows();
 const sourceNotes=sources().filter(s=>state.branch==='all'||s.id===state.branch).map(s=>{const status=state.sourceStatus[s.id];return s.name+': '+(status?.mode==='online'?'đã tải Google Sheets':status?.mode==='error'?'lỗi tải · '+status.error:'dữ liệu mẫu, chưa kết nối');}).join(' · ');
 return `<div class="panel temp-scope-panel" style="margin-bottom:16px"><div class="panelhead"><div><h3>Phạm vi tổng hợp số đo</h3><p class="note">${esc(sourceNotes)}</p></div><select id="temperatureScope" class="secondary" aria-label="Phạm vi tổng hợp"><option value="range" ${state.measureScope==='range'?'selected':''}>Khoảng ngày đang lọc</option><option value="day" ${state.measureScope==='day'?'selected':''}>Riêng ngày xem</option></select></div><p class="note"><b>${state.measureScope==='range'?'Đang tổng hợp '+int(period.length)+' ca trong khoảng '+dateVN(state.start)+' – '+dateVN(state.end):'Đang xem '+int(dayRows.length)+' ca của ngày '+dateVN(state.day)}.</b> ${latest?'Số đo gần nhất của đúng chi nhánh/khu/chuồng/lứa đang lọc: <b>'+dateVN(latest)+'</b>.':'Nguồn đang tải chưa có số đo cho bộ lọc này.'}</p>${!dayRows.length?`<div class="temp-missing" role="status">Ngày ${dateVN(state.day)} chưa có ca đo cho bộ lọc này. ${period.length?'Biểu đồ và số liệu trong khoảng lọc là các ca đã ghi nhận ở ngày khác.':'Không tự thay số đo ngày khác vào ngày đang xem.'}${latest?` <button id="temperatureLatest" class="outline">Xem ngày có số đo gần nhất · ${dateVN(latest)}</button>`:''}</div>`:''}</div>`;
}
const oldOverview=renderOverview;
renderOverview=function(){let html=oldOverview();if(state.measureScope==='range')html=html.replaceAll('lượt đo ngày xem','lượt đo trong khoảng lọc').replaceAll('chuồng đã khai báo trước ngày xem','chuồng đã khai báo đến cuối khoảng lọc');return info()+html;};
const oldAttach=attachView;
attachView=function(){oldAttach();const select=$('#temperatureScope');if(select)select.onchange=e=>{state.measureScope=e.target.value;render();};const latest=$('#temperatureLatest');if(latest)latest.onclick=()=>{const dates=filtered(false).map(r=>r.date).filter(d=>d<=today()).sort();if(dates.length){state.day=dates.at(-1);if(state.end&&state.end<state.day)state.end=state.day;if(state.start&&state.start>state.day)state.start=state.day;state.measureScope='day';render();}};};
const oldBind=bindStatic;
bindStatic=function(){oldBind();for(const [id,field]of [['startFilter','start'],['endFilter','end'],['dayFilter','day']])$('#'+id).onchange=e=>{state[field]=e.target.value;state.measureScope=field==='day'?'day':'range';state.pageNo=0;render();};};
const oldFilters=updateFilters;
updateFilters=function(){oldFilters();$('#dayFilter').disabled=state.page==='overview'&&state.measureScope==='range';$('#dayFilter').title=$('#dayFilter').disabled?'Chọn Riêng ngày xem để xem KPI theo một ngày cụ thể.':'';};
window.__HNG_TEMPERATURE__={periodRows,overviewRows,scopedExpected};
})();
