/* Shared motion for the five embedded reports. No data or calculation changes. */
(()=>{
'use strict';
if(window.__hngMotion)return;window.__hngMotion=true;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const view=document.getElementById('view');if(!view)return;
let frame=0,previous=new Map(),running=new Set();
const selector='.panel,.card,.kpi,.stat,.ministat,.empty,.empty-state';
function snapshot(animate){
 frame=0;const next=new Map();let count=0;
 // Only outer cards: never animate every row or nested chart point.
 for(const [index,el] of [...view.querySelectorAll(selector)].filter(el=>!el.parentElement.closest(selector)).entries()){
  const key=index+'|'+el.className;
  const signature=el.innerHTML;next.set(key,signature);
  const bounds=el.getBoundingClientRect();
  if(animate&&!reduced.matches&&previous.get(key)!==signature&&bounds.bottom>0&&bounds.top<innerHeight&&count<10){
   const animation=el.animate([{opacity:.72,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,delay:count*15,easing:'cubic-bezier(.2,.7,.2,1)'});
   running.add(animation);animation.onfinish=animation.oncancel=()=>running.delete(animation);count++;
  }
 }
 previous=next;
}
const observer=new MutationObserver(()=>{
 if(frame)cancelAnimationFrame(frame);
 for(const animation of running)animation.cancel();
 frame=requestAnimationFrame(()=>snapshot(true));
});
snapshot(false);observer.observe(view,{childList:true,subtree:true});
// Existing tooltips remain intact; focus adds the same information for keyboard users.
document.addEventListener('focusin',e=>{const el=e.target.closest('[data-tip]');if(el)el.dispatchEvent(new MouseEvent('mouseenter',{clientX:el.getBoundingClientRect().left,clientY:el.getBoundingClientRect().bottom}));});
document.addEventListener('focusout',e=>{const el=e.target.closest('[data-tip]');if(el)el.dispatchEvent(new MouseEvent('mouseleave'));});
function stop(){if(frame)cancelAnimationFrame(frame);frame=0;for(const animation of running)animation.cancel();}
reduced.addEventListener('change',()=>{if(reduced.matches)stop();});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
window.addEventListener('pagehide',()=>{stop();observer.disconnect();},{once:true});
})();
