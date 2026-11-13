/* Small conveniences for BRTA Power Ratings 8.5.2.3. */
(function(root,factory){
'use strict';
const util=factory();
if(typeof module==='object'&&module.exports)module.exports=util;
if(!root.document)return;
const document=root.document;
const $=selector=>document.querySelector(selector);
function updateCheck(){
 const card=$('#statusStrip > [data-check-schedule]');
 const original=card?.querySelector('span');
 if(!card||!original)return;
 const iso=(typeof D!=='undefined'&&D?.sync?.checkedAt)||null;
 const date=iso?new Date(iso):null;
 const valid=date&&Number.isFinite(date.getTime());
 let relative=card.querySelector('.mini-check-relative');
 let absolute=card.querySelector('.mini-check-absolute');
 if(!relative){
   relative=document.createElement('span');
   relative.className='mini-check-relative';
   original.replaceWith(relative);
 }
 if(!absolute){
   absolute=document.createElement('small');
   absolute.className='mini-check-absolute';
   card.append(absolute);
 }
 relative.textContent=util.relativeTime(iso);
 absolute.textContent=valid?new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'long',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true}).format(date):'';
 const full=valid?date.toLocaleString('en-AU'):'Time not available';
 relative.title=full;
}
function decorateProfile(){
 const host=$('#profileContent');
 if(!host||host.querySelector('.mini-copy-name'))return;
 const name=host.querySelector('.profile-head h2');
 if(!name||!name.textContent.trim())return;
 const button=document.createElement('button');
 button.type='button';
 button.className='mini-copy-name';
 button.setAttribute('aria-label','Copy player name');
 button.innerHTML='<span aria-hidden="true">⧉</span> Copy name';
 button.dataset.name=name.textContent.trim();
 name.insertAdjacentElement('afterend',button);
}
async function copyName(button){
 const name=button.dataset.name;
 if(!name)return;
 try{
  if(root.navigator.clipboard?.writeText){
   await root.navigator.clipboard.writeText(name);
  }else{
   const field=document.createElement('textarea');
   field.value=name;field.setAttribute('readonly','');
   field.style.cssText='position:fixed;top:-10000px;left:-10000px;opacity:0';
   document.body.append(field);field.select();
   let successful=false;
   try{successful=!!document.execCommand?.('copy');}finally{field.remove();}
   if(!successful)throw Error('Clipboard access unavailable');
  }
  button.textContent='✓ Copied!';
  root.setTimeout(()=>{if(button.isConnected)button.innerHTML='<span aria-hidden="true">⧉</span> Copy name';},1700);
 }catch(error){
  button.textContent='Could not copy';
  root.setTimeout(()=>{if(button.isConnected)button.textContent='⧉ Copy name';},2100);
 }
}
function closeLogo(){
 const overlay=$('#logoSecretOverlay');
 if(!overlay||overlay.classList.contains('hidden'))return;
 overlay.classList.add('hidden');
 if(!document.querySelector('.overlay:not(.hidden)'))document.body.classList.remove('modal-open');
 $('#brandLogoSecret')?.focus({preventScroll:true});
}
function openLogo(){
 window.BRTARouteUI?.secret();
 const overlay=$('#logoSecretOverlay');
 if(!overlay)return;
 overlay.classList.remove('hidden');
 document.body.classList.add('modal-open');
 $('#logoSecretClose')?.focus({preventScroll:true});
}
function canFocusSearch(event){
 if(event.key!=='/'||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey||event.isComposing)return false;
 const target=event.target;
 if(target?.isContentEditable||target?.closest?.('[contenteditable="true"],input,textarea,select,[role="textbox"]'))return false;
 if(document.querySelector('.overlay:not(.hidden),.mode-switch:not(.hidden)'))return false;
 return !!$('#search');
}
function setup(){
 root.addEventListener('brta-section-ready',updateCheck);
 updateCheck();
 root.setInterval(updateCheck,30000);
 const content=$('#profileContent');
 if(content){
  new root.MutationObserver(decorateProfile).observe(content,{childList:true,subtree:true});
  decorateProfile();
 }
 document.addEventListener('click',event=>{
  const copy=event.target.closest?.('.mini-copy-name');
  if(copy){event.preventDefault();event.stopPropagation();void copyName(copy);return;}
  if(event.target.closest?.('#brandLogoSecret')){openLogo();return;}
  if(event.target.closest?.('#logoSecretClose,[data-logo-secret-close]')){closeLogo();}
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!$('#logoSecretOverlay')?.classList.contains('hidden')){
   event.preventDefault();event.stopImmediatePropagation();closeLogo();return;
  }
  if(!canFocusSearch(event))return;
  const tab=$('.main-tab[data-page="ratings"]');
  const field=$('#search');
  if(!tab||!field)return;
  event.preventDefault();
  if(!tab.classList.contains('active'))tab.click();
  field.focus();
  field.select();
 },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
function relativeTime(iso,now=Date.now()){
 const at=Date.parse(iso);
 if(!Number.isFinite(at))return'Not available';
 const minutes=Math.max(0,Math.floor((now-at)/60000));
 if(minutes<1)return'Just now';
 if(minutes<60)return minutes+' minute'+(minutes===1?'':'s')+' ago';
 const hours=Math.floor(minutes/60);
 if(hours<24)return hours+' hour'+(hours===1?'':'s')+' ago';
 const days=Math.floor(hours/24);
 if(days<7)return days+' day'+(days===1?'':'s')+' ago';
 return new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric'}).format(new Date(at));
}
return{relativeTime};
});
