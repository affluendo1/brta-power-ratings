/* 8.5.3 default-section export chooser and daily results-check information. */
(function(root){
'use strict';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const api=root.BRTAExport853;
let modal=null,returnFocus=null,busy=false;
const title=(meta)=>[meta.competition_label,meta.section_label].filter(Boolean).join(' · ');
const prefix=(meta)=>api.slug(title(meta));
const download=(text,name,type)=>{const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500)};
function selected(){
 const meta=(typeof D!=='undefined'&&D?.meta)||null;

 if(!meta)throw Error('Open a competition section first.');
 return meta;
}
async function source(meta){
 const code=meta.section_code;
 if(typeof D!=='undefined'&&D?.meta?.section_code===code)return {data:meta.is_custom?root.CustomSections.payload(code):D,saved:meta.is_custom?JSON.parse(localStorage.getItem('brta-custom-sections-v1')||'[]').find(s=>s.id===code):null};
 if(meta.is_custom){
  const actual=JSON.parse(localStorage.getItem('brta-custom-sections-v1')||'[]').find(s=>s.id===code);
  if(!actual)throw Error('The saved custom section cannot be found.');
  return {data:root.CustomSections.payload(code),saved:actual};
 }
 const path=meta.data_path||('data/site/sections/'+encodeURIComponent(code)+'.json');
 const response=await fetch(path,{cache:'no-store'});
 if(!response.ok)throw Error('The selected section could not be loaded.');
 return {data:await response.json(),saved:null};
}
async function run(mode){
 if(busy)return;busy=true;
 const buttons=[...modal.querySelectorAll('[data-export-853]')];
 buttons.forEach(b=>b.disabled=true);
 const status=modal.querySelector('#export853Status');
 try{
  const meta=selected();
  status.textContent='Preparing '+title(meta)+'…';
  const {data,saved}=await source(meta),base=prefix(meta);
  if(mode==='csv'||mode==='technical'){
   download(api.csv(data,mode==='technical'),base+(mode==='technical'?'-technical':'-results')+'.csv','text/csv;charset=utf-8');
  }else if(mode==='json'){
   const backup=saved?{format:'brta-custom-sections',version:1,sections:[saved]}:api.toBackup(data);
   root.CustomSectionModel.validate(backup.sections[0]);
    download(JSON.stringify(backup,null,2),base+'-editable-backup.json','application/json;charset=utf-8');
    promptCreator(backup);
  }else if(mode==='markdown'){
   download(api.markdown(data),base+'-results.md','text/markdown;charset=utf-8');
  }else if(mode==='complete'){
   const processed=await layoutApplyModel(data,selectedRatingModel());
   download(BRTALayoutModel.report(processed,BRTAHistory),base+'-complete-section.html','text/html;charset=utf-8');
  }else if(mode==='comparison'){
   if(!auxiliaryEnabled())throw Error('Enable Extras to export a model comparison.');
   if(!root.BRTAModelComparison?.export)throw Error('Comparison export is unavailable.');
   const processed=await layoutApplyModel(data,selectedRatingModel());
   await root.BRTAModelComparison.export(processed);
  }else throw Error('This export format is unavailable. Choose an option from the export panel.');
  status.textContent='Export ready. Your current section was not changed.';
 }catch(err){status.textContent=err.message||'Could not prepare this export.';}
 finally{busy=false;buttons.forEach(b=>b.disabled=false)}
}
let creatorPrompt=null;
function promptCreator(backup){
 if(creatorPrompt)creatorPrompt.remove();
 creatorPrompt=document.createElement('div');creatorPrompt.className='overlay export853-import-prompt';creatorPrompt.id='export853ImportPrompt';
 creatorPrompt.innerHTML='<div class="overlay-backdrop" data-creator-no></div><section class="settings-sheet export853-prompt-sheet" role="dialog" aria-modal="true" aria-labelledby="export853ImportTitle"><h2 id="export853ImportTitle">Open in Custom Competitions?</h2><p>Your editable JSON was downloaded. You can also load it directly into the editor.</p><div class="export853-prompt-actions"><button type="button" class="button secondary" data-creator-no>Not now</button><button type="button" class="button primary" data-creator-yes>Open in Custom Competitions</button></div><p role="status" id="export853ImportError"></p></section>';
 const previousFocus=document.activeElement;
 const prompt=creatorPrompt;
 document.body.append(prompt);
 const dismiss=()=>{
  if(creatorPrompt!==prompt)return;
  root.BRTAOverlays?.unlock?.(prompt);
  prompt.remove();creatorPrompt=null;
  if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
 };
 root.BRTAOverlays?.register?.(prompt.id,dismiss);
 root.BRTAOverlays?.lock?.(prompt);
 prompt.querySelectorAll('[data-creator-no]').forEach(b=>b.onclick=dismiss);
 creatorPrompt.querySelector('[data-creator-yes]').onclick=()=>{try{if(!root.CustomSections?.openBackup)throw Error('Custom Competitions is unavailable.');if(root.CustomSections.openBackup(backup)){dismiss();close();}}catch(e){creatorPrompt.querySelector('#export853ImportError').textContent=e.message;}};
 creatorPrompt.querySelector('[data-creator-yes]').focus();
}
function close(){
 if(!modal||modal.classList.contains('hidden')||busy)return;
 modal.classList.add('hidden');
 root.BRTAOverlays?.unlock?.(modal);
 if(!document.querySelector('.overlay:not(.hidden)'))document.body.classList.remove('modal-open');
 returnFocus?.focus?.({preventScroll:true});
}
function open(){
 returnFocus=document.activeElement;
 if(!modal){
  modal=document.createElement('div');modal.id='export853Overlay';modal.className='overlay hidden export853-overlay';
  document.body.append(modal);
  root.BRTAOverlays?.register?.('export853Overlay',close);
 }
 let description='Open a section to export it.';
 try{description=title(selected())}catch(_){}
 const choices=[
  ['csv','CSV','Original results table, without extra technical columns.'],
  ['complete','Complete Section','Full section report with ratings, fixtures and results.'],
  ['technical','Technical CSV','CSV plus source match and fixture IDs.'],
  ['json','Editable JSON','A Section Creator backup you can import and edit.'],
  ['markdown','Markdown','A clean, portable round-by-round match report.'],
  ...(auxiliaryEnabled()?[['comparison','Rating model comparison','All enabled rating models and round histories.']]:[])
 ];
 modal.innerHTML='<div class="overlay-backdrop" data-export-close></div><section class="settings-sheet export853-sheet" role="dialog" aria-modal="true" aria-labelledby="export853Title"><button type="button" class="close-btn" data-export-close aria-label="Close export chooser">×</button><div class="overlay-title"><div class="kicker">CURRENT SECTION</div><h2 id="export853Title">Export section</h2><p>'+esc(description)+'</p></div><div class="export853-choices">'+choices.map(([code,name,desc])=>'<button type="button" data-export-853="'+code+'"><b>'+name+'</b><span>'+desc+'</span></button>').join('')+'</div><p id="export853Status" role="status" aria-live="polite">Choose a format to download a copy.</p></section>';
 modal.querySelectorAll('[data-export-close]').forEach(b=>b.onclick=close);
 modal.querySelectorAll('[data-export-853]').forEach(b=>b.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();run(b.getAttribute('data-export-853'));}));
 modal.classList.remove('hidden');root.BRTAOverlays?.lock?.(modal);
 modal.querySelector('[data-export-853]')?.focus();
}
function bind(){
 return; // Export lives beneath the currently viewed section.
 if(!group)return;
 let row=$('#export853SettingsRow');
 if(!row){
  row=document.createElement('div');row.id='export853SettingsRow';row.className='export853-settings-row';
  row.innerHTML='<p class="settings-help">Download your default section, including an editable Section Creator backup.</p><button type="button" id="export853Open" class="button secondary">Export default section</button>';
  section.insertAdjacentElement('afterend',row);
  row.querySelector('button').onclick=open;
 }
 const set=()=>{
  const b=row.querySelector('button');
  b.disabled=!$('#defaultCompetition')?.value||!$('#defaultSection')?.value;
  b.title=b.disabled?'Choose both default fields to enable exports.':'';
 };
 set();
 for(const id of ['defaultCompetition','defaultSection'])$('#'+id)?.addEventListener('change',()=>set());
}
function showSchedule(){
 let o=$('#checkSchedule853');
 if(!o){
  o=document.createElement('div');o.id='checkSchedule853';o.className='overlay hidden schedule853-overlay';document.body.append(o);
  o.innerHTML='<div class="overlay-backdrop" data-check853-close></div><section class="settings-sheet schedule853-sheet" role="dialog" aria-modal="true" aria-labelledby="check853Title"><button type="button" class="close-btn" data-check853-close aria-label="Close">×</button><div class="overlay-title"><div class="kicker">RESULTS SYNC</div><h2 id="check853Title">Results checking</h2><p>BRTA automatically checks official results around <b>3 pm Melbourne time each day</b>. Publishing may finish later.</p></div><div class="schedule853-sync-grid"><article class="schedule853-sync-card"><h3>Most recent check</h3><div id="check853Latest" role="status">Loading the latest check…</div></article><article class="schedule853-sync-card"><h3>Last check that found results</h3><div id="check853Positive" role="status">Loading the last successful discovery…</div></article></div></section>';
  const close=()=>{o.classList.add('hidden');root.BRTAOverlays?.unlock?.(o);$('#statusStrip [data-check-schedule]')?.focus({preventScroll:true})};
  root.BRTAOverlays?.register?.(o.id,close);
  o.querySelectorAll('[data-check853-close]').forEach(b=>b.onclick=close);
 }
 o.classList.remove('hidden');root.BRTAOverlays?.lock?.(o);o.querySelector('.close-btn').focus();
 const stamp=iso=>{if(!iso)return 'Not recorded';const d=new Date(iso);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Melbourne',dateStyle:'medium',timeStyle:'short'}).format(d):'Not recorded';};
 const humanLabel=label=>String(label||'').replace(/\bMens\s+S\/D\b/i,"Men's singles & doubles").replace(/\bWomens\s+S\/D\b/i,"Women's singles & doubles").replace(/\bS\/D\b/gi,'singles & doubles');
 const sectionGroups=(codes,catalog)=>{
  const known=[...(root.DATA?.catalog||[]),...(catalog?.sections||[])],meta=new Map(known.map(s=>[s.section_code,s]));
  const types={AP:'Saturday PM',HA:'Thursday AM',AA:'Saturday AM',UA:'Sunday AM',TA:'Tuesday AM',TN:'Tuesday Night',WA:'Wednesday AM'};
  const groups=new Map();
  for(const code of codes){
   const sectionCode=String(code).replace(/\.json$/i,''),record=meta.get(sectionCode),competition=record?.competition_label||types[sectionCode.slice(0,2)]||'Other competition';
   const name=record?.section_label||('Section '+(Number(String(code).slice(2))||'name unavailable'));
   if(!groups.has(competition))groups.set(competition,[]);
   groups.get(competition).push(humanLabel(name));
  }
  return '<ul class="check853-friendly-list">'+[...groups].map(([comp,items])=>'<li><b>'+esc(comp)+'</b><span>'+items.map(esc).join(', ')+'</span></li>').join('')+'</ul>';
 };
 const detail=(x,latest,catalog)=>{if(!x)return '<p>No discovery has been recorded by the new tracker yet.</p>';const found=latest?!!x.new_results:true,n=Number(x.changed_sections?.length||0);return '<p><b>'+esc(stamp(x.checked_at_utc))+'</b></p><p>'+esc(found?'New or corrected official results were detected.':'No new results were detected.')+'</p>'+(found?'<p>'+esc(n?n+' section'+(n===1?'':'s')+' updated:':'Results changed; section names were not recorded.')+'</p>'+(n?sectionGroups(x.changed_sections,catalog):''):'')+(x.validation&&latest?'<p>Source validation: '+esc(x.validation==='source discrepancies'?'Some source results need reviewing.':x.validation)+'</p>':'')};
 const json=path=>fetch(path+'?stamp='+Date.now(),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Check data unavailable.');return r.json()});
 Promise.all([json('data/current/last_check.json'),json('data/current/catalog.json').catch(()=>null)]).then(([data,catalog])=>{
  if(!o.isConnected||o.classList.contains('hidden'))return;
  o.querySelector('#check853Latest').innerHTML=detail(data,true,catalog);
  o.querySelector('#check853Positive').innerHTML=detail(data.last_positive,false,catalog);
 }).catch(()=>{if(o.isConnected){o.querySelector('#check853Latest').textContent='The latest check could not be loaded.';o.querySelector('#check853Positive').textContent='The historical discovery log is unavailable.';}});

}
document.addEventListener('click',e=>{if(e.target.closest?.('#export853Open,#exportSectionBtn')){e.preventDefault();open()}else if(e.target.closest?.('[data-check-schedule]')){e.preventDefault();showSchedule()}});
const observer=new MutationObserver(()=>{if($('#defaultSection')&&!$('#export853SettingsRow'))bind()});
function start(){const host=$('#settingsContent');if(host){observer.observe(host,{childList:true,subtree:true});bind()}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.BRTAExportUI853={open,run,selected,showSchedule};
})(window);
