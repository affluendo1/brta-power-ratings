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
 const comp=localStorage.getItem('brta-default-competition'),code=localStorage.getItem('brta-default-section');
 const meta=(typeof currentCatalog==='function'?currentCatalog():[]).find(x=>x.section_code===code&&x.competition_code===comp);
 if(!meta)throw Error('Choose a Default Competition and Default Section in Settings first.');
 return meta;
}
async function source(meta){
 const code=meta.section_code;
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
  }else throw Error('Unknown export option.');
  status.textContent='Export ready. Your default section was not changed.';
 }catch(err){status.textContent=err.message||'Could not prepare this export.';}
 finally{busy=false;buttons.forEach(b=>b.disabled=false)}
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
 let description='Choose a default section in Settings.';
 try{description=title(selected())}catch(_){}
 const choices=[
  ['csv','CSV','Original results table, without extra technical columns.'],
  ['complete','Complete Section','Full section report with ratings, fixtures and results.'],
  ['technical','Technical CSV','CSV plus source match and fixture IDs.'],
  ['json','Editable JSON','A Section Creator backup you can import and edit.'],
  ['markdown','Markdown','A clean, portable round-by-round match report.'],
  ...(auxiliaryEnabled()?[['comparison','Rating model comparison','All enabled rating models and round histories.']]:[])
 ];
 modal.innerHTML='<div class="overlay-backdrop" data-export-close></div><section class="settings-sheet export853-sheet" role="dialog" aria-modal="true" aria-labelledby="export853Title"><button type="button" class="close-btn" data-export-close aria-label="Close export chooser">×</button><div class="overlay-title"><div class="kicker">DEFAULT SECTION</div><h2 id="export853Title">Export section</h2><p>'+esc(description)+'</p></div><div class="export853-choices">'+choices.map(([code,name,desc])=>'<button type="button" data-export-853="'+code+'"><b>'+name+'</b><span>'+desc+'</span></button>').join('')+'</div><p id="export853Status" role="status" aria-live="polite">Choose a format to download a copy.</p></section>';
 modal.querySelectorAll('[data-export-close]').forEach(b=>b.onclick=close);
 modal.querySelectorAll('[data-export-853]').forEach(b=>b.onclick=()=>run(b.dataset.export853));
 modal.classList.remove('hidden');root.BRTAOverlays?.lock?.(modal);
 modal.querySelector('[data-export-853]')?.focus();
}
function bind(){
 const section=$('#defaultSection')?.closest('.default-field'),group=section?.parentElement;
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
  o.innerHTML='<div class="overlay-backdrop" data-check853-close></div><section class="settings-sheet schedule853-sheet" role="dialog" aria-modal="true" aria-labelledby="check853Title"><button type="button" class="close-btn" data-check853-close aria-label="Close">×</button><div class="overlay-title"><div class="kicker">RESULTS SYNC</div><h2 id="check853Title">When are results checked?</h2><p>BRTA Power Ratings automatically looks for new official results at approximately <b>3 pm Melbourne time each day</b>.</p><p>Checks and GitHub publishing may finish later. Results change only when new official scores have been published.</p></div></section>';
  const close=()=>{o.classList.add('hidden');root.BRTAOverlays?.unlock?.(o);$('#statusStrip [data-check-schedule]')?.focus({preventScroll:true})};
  root.BRTAOverlays?.register?.(o.id,close);
  o.querySelectorAll('[data-check853-close]').forEach(b=>b.onclick=close);
 }
 o.classList.remove('hidden');root.BRTAOverlays?.lock?.(o);o.querySelector('.close-btn').focus();
}
document.addEventListener('click',e=>{if(e.target.closest?.('#export853Open')){e.preventDefault();open()}else if(e.target.closest?.('[data-check-schedule]')){e.preventDefault();showSchedule()}});
const observer=new MutationObserver(()=>{if($('#defaultSection')&&!$('#export853SettingsRow'))bind()});
function start(){const host=$('#settingsContent');if(host){observer.observe(host,{childList:true,subtree:true});bind()}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.BRTAExportUI853={open,run,selected,showSchedule};
})(window);
