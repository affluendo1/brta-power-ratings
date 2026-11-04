/* 8.5.2.3 | Shift+Alt+U local console and unlocked methodology. */
(function(w){
'use strict';
const S=w.BRTASecretExtras,d=w.document;
let panel=null,openSerial=0;
function line(text,kind='line'){
 const out=panel?.querySelector('.brta-command-log');if(!out)return;
 const p=d.createElement('p');p.className='brta-command-'+kind;p.textContent=String(text);out.append(p);
 while(out.children.length>240)out.firstElementChild.remove();out.scrollTop=out.scrollHeight;
}
function close(){openSerial++;panel?.remove();panel=null}
function command(value){
 line('> '+value,'prompt');const c=value.trim().toLowerCase();
 if(c==='help'){line('help · log · unlog · prank · models · status · tabs · restore-tabs · vault · blueprint · clear · exit · echo [text]','info');return}
 if(c==='clear'){panel?.querySelector('.brta-command-log')?.replaceChildren();return}
 if(c==='exit'||c==='close'){close();return}
 if(c==='log'){S.logger=true;line('Live action logging enabled. Typed values and secrets are excluded.','info');return}
 if(c==='unlog'){S.logger=false;line('Live action logging disabled.','info');return}
 if(c==='models'){line('RM1 · RM2 · RM3 · RM3b · RM4a · RM4b · RM4.1 · RM4.2 · Foundation · Melody · Orchestra · Baton · RM1000','info');return}
 if(c==='tabs'){line('Visible: '+S.tabs.filter(x=>!S.removed.has(x)).join(', '),'info');return}
 if(c==='restore-tabs'){S.removed.clear();S.del('tabs');line('All five tabs will return after you reload.','info');return}
 if(c==='status'){line('Hidden tabs '+S.removed.size+'/5 · Chamber '+(S.opened?'unlocked':'locked')+' · Blueprint '+(S.blueprint?'unlocked':'hidden')+' · Log '+(S.logger?'on':'off'),'info');return}
 if(c==='vault'){close();if(S.extra())S.openVault();else S.notice('Unlock Extras first.');return}
 if(c==='blueprint'){line(S.blueprint?'The technical methodology has been unlocked.':'The blueprint is hidden in the model conference.','info');return}
 if(c==='prank'){
  const state=w.BRTAHiddenRelay?.inspect?.();if(!state){line('The RM1000 transmission has not been received on this launch.','info');return}
  line('RM1000 relay · '+(state.packet||'assembling')+' · transcript replay','info');
  const serial=openSerial;
  (state.transcript||[]).forEach((e,i)=>w.setTimeout(()=>{if(serial===openSerial&&panel)line(e.from+': '+(e.text||'[silent transmission]'),'trace')},i*320));
  return;
 }
 if(c.startsWith('echo ')){line(value.slice(5),'info');return}
 line('Unknown command. Type help.','warn');
}
function open(){
 if(panel){close();return}
 panel=d.createElement('div');panel.className='brta-command-shade';
 panel.innerHTML='<div class="brta-command-dim"></div><section class="brta-command-panel" role="dialog" aria-label="BRTA developer console"><header><strong>BRTA / LOCAL CONSOLE</strong><span>SHIFT + ALT + U</span><button type="button" data-close-console aria-label="Close console">×</button></header><div class="brta-command-log" role="log" aria-live="polite"></div><form><span>›</span><input type="text" autocomplete="off" spellcheck="false" aria-label="Console command" placeholder="help"></form></section>';
 d.body.append(panel);panel.querySelector('.brta-command-dim').onclick=close;
 panel.querySelector('[data-close-console]').onclick=close;
 panel.querySelector('form').onsubmit=e=>{e.preventDefault();const input=panel?.querySelector('input');if(!input)return;const v=input.value.trim();input.value='';if(v)command(v)};
 line('Console ready. Type help. All logs stay in this browser.','info');
 if(S.logger)S.events.slice(-20).forEach(e=>line('['+e.time+'] '+e.kind+' '+e.description,'trace'));
 panel.querySelector('input').focus();
}
S.api.consoleLine=line;S.api.openConsole=open;S.api.closeConsole=close;
function addBlueprint(){
 if(!S.blueprint)return;
 const host=d.querySelector('#layoutOverlay .reading-guide.model-guide');
 if(!host||host.querySelector('.brta-secret-formulas'))return;
 const section=d.createElement('section');section.className='guide-section brta-secret-formulas';
 section.innerHTML='<h3>Unlocked: Model blueprints</h3><p>Parameters, equations and routing details from the local model bundles.</p><div class="brta-secret-equations">Opening the blueprints...</div>';
 host.append(section);
 Promise.all(['web/models/orchestra-bundle.json','web/models/rm4-frozen.json'].map(path=>w.fetch(path).then(r=>r.ok?r.json():null)))
 .then(([bundle,frozen])=>{
  const out=section.querySelector('.brta-secret-equations');if(!out?.isConnected)return;out.replaceChildren();
  const add=(title,value)=>{const box=d.createElement('article'),h=d.createElement('h4'),pre=d.createElement('pre');
   box.className='brta-formula-card';h.textContent=title;pre.textContent=typeof value==='string'?value:JSON.stringify(value,null,2);box.append(h,pre);out.append(box)};
  add('Displayed rating','R = centre + scale × fitted strength');
  add('Win probability','p = sigmoid(temperature × logit(Σ weight × expert probability))');
  add('Historical prior','N/(N+4) × (historical skill + section adjustment) / √(current appearances + 1)');
  if(bundle){for(const [name,entry]of Object.entries(bundle.definitions||{}))add(name,entry);
   add('Singles and doubles recipes',bundle.ordinary||{});
   add('Specialist selection',bundle.formatRouting?.selection||{});
   add('Fallback routing',bundle.guard||{});
   add('Blend and calibration',bundle.advanced||{})}
  if(frozen)add('Earlier ensemble parameters',{baseAlpha:frozen.baseAlpha,ensemble:frozen.ensemble});
 }).catch(()=>{const out=section.querySelector('.brta-secret-equations');if(out)out.textContent='Blueprint data unavailable.'});
}
function initialize(){
 w.addEventListener('keydown',e=>{
  if(e.shiftKey&&e.altKey&&e.code==='KeyU'){e.preventDefault();e.stopImmediatePropagation();open();return}
  if(e.key==='Escape'){if(panel){e.preventDefault();e.stopImmediatePropagation();close()}else if(S.scene){e.preventDefault();e.stopImmediatePropagation();S.api.closeScene?.()}else if(S.vault){e.preventDefault();e.stopImmediatePropagation();S.closeVault()}}
 },true);
 d.addEventListener('click',e=>{if(!S.logger||e.target.closest('.brta-command-shade,.brta-vault-shade'))return;
  const b=e.target.closest('button,a,[role="button"]');if(!b)return;S.log('click',b.getAttribute('aria-label')||b.dataset.page||b.id||b.textContent?.trim().slice(0,55)||'control')},true);
 d.addEventListener('change',e=>{if(S.logger&&!e.target.closest('.brta-command-shade,.brta-vault-shade'))S.log('change',e.target.id||e.target.name||e.target.tagName)},true);
 w.addEventListener('brta-section-ready',()=>{if(S.logger)S.log('section','Section rendered')});
 const original=w.openLayoutOverlay;
 if(typeof original==='function')w.openLayoutOverlay=function(kind){const value=original.apply(this,arguments);if(kind==='methodology')addBlueprint();return value};
 d.addEventListener('click',e=>{if(e.target.closest('[data-layout-open="methodology"]'))w.setTimeout(addBlueprint,30)},true);
}
S.api.initialize=initialize;
})(window);
