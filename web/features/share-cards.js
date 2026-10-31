/* Canvas is the preview AND the export: no screenshot services or remote uploads. */
(function(){'use strict';let model,canvas,options,exportFocus,previewObserver;
const presets=[['Current scheme',''],['Yellow','#c1cd12'],['Blue','#356bc7'],['Green','#25814e'],['Red','#b73d4c'],['Purple','#8754c2']];
function currentColor(){const probe=document.createElement('span');probe.style.color='var(--primary)';document.body.append(probe);const value=getComputedStyle(probe).color;probe.remove();return value||'#c1cd12'}
const DEFAULTS_KEY='brta-result-card-defaults-v1';
function savedDefaults(){try{const x=JSON.parse(localStorage.getItem(DEFAULTS_KEY)||'{}'),v={};if(Object.hasOwn(BRTARefinement.layouts,x.ratio))v.ratio=x.ratio;if(['Arial','Verdana','Georgia','Trebuchet MS','Courier New'].includes(x.font))v.font=x.font;if(['singles','doubles'].includes(x.order))v.order=x.order;if(x.colour===''||/^#[a-f\d]{6}$/i.test(x.colour))v.colour=x.colour;for(const k of ['dark','details','fullNames'])if(typeof x[k]==='boolean')v[k]=x[k];return v}catch{return {}}}
function modelFor(kind,name){if(kind!=='result')return null;const f=findMatch(name);return f?{kind:'result',title:f.home+' vs '+f.away,subtitle:(f.label||'Round '+f.round)+' · '+roundDate(f.date),fixture:f,rows:f.rubbers||[]}:null}

function draw(){
 if(!canvas||!model)return;const L=BRTARefinement.layouts[options.ratio],w=L.w,h=L.h;canvas.width=w;canvas.height=h;
 const c=canvas.getContext('2d'),accent=options.colour||currentColor(),dark=options.dark,bg=dark?'#101418':'#f5f3ee',ink=dark?'#f7f6f1':'#18252c',muted=dark?'#a0adb4':'#67767b',surface=dark?'#182027':'#fff',rule=dark?'#34424a':'#d7dedb',pad=Math.round(w*.052),font=options.font||'Arial',family=font.includes(' ')?'"'+font+'"':font,wide=options.ratio==='landscape';
 c.fillStyle=bg;c.fillRect(0,0,w,h);c.fillStyle=accent;c.fillRect(0,0,w,Math.max(8,h*.007));
 function txt(value,x,y,max,size,bold=false,align='left',colour=ink){let n=Math.max(14,size);c.textAlign=align;c.textBaseline='alphabetic';c.fillStyle=colour;while(n>14){c.font=(bold?'700 ':'400 ')+n+'px '+family;if(c.measureText(String(value??'')).width<=max)break;n--}c.fillText(String(value??''),x,y)}
 function line(x,y,width){c.strokeStyle=rule;c.lineWidth=1.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+width,y);c.stroke()}
 function panel(x,y,width,height){c.fillStyle=surface;c.fillRect(x,y,width,height);c.fillStyle=accent;c.fillRect(x,y,4,height)}
 function short(value){const p=String(value).trim().split(/\s+/);return options.fullNames||p.length<2?value:p[0]+' '+p.slice(1).map(s=>s[0]+'.').join('')}
 function personLines(value){return String(value).split(' / ').map(short)}
 txt('BRTA  /  POWER RATINGS',pad,h*.057,w*.65,w*.019,true,'left',accent);txt(model.kind==='result'?'MATCH RESULT':model.kind==='player'?'PLAYER CARD':'TEAM LINEUP',w-pad,h*.057,w*.36,w*.016,true,'right',muted);
 txt(model.subtitle,pad,h*.094,w-pad*2,w*.022,false,'left',muted);line(pad,h*.115,w-pad*2);
 let rows=model.rows.slice();if(model.kind!=='team')rows.sort((a,b)=>Number((a.type==='Singles'||a.label==='Singles')!==(options.order==='singles'))-Number((b.type==='Singles'||b.label==='Singles')!==(options.order==='singles')));
 let start;
 if(model.kind==='result'){
  const f=model.fixture,complete=f.status==='Completed',home=f.homeSets??f.homeRubbers,away=f.awaySets??f.awayRubbers;
  txt(f.home,pad,h*.184,w*.37,w*.043,true);txt(f.away,w-pad,h*.184,w*.37,w*.043,true,'right');
  txt(complete?home+' — '+away:f.status,w/2,h*.245,w-pad*2,w*.073,true,'center',accent);
  txt('HOME',pad,h*.235,w*.22,w*.014,true,'left',muted);txt('AWAY',w-pad,h*.235,w*.22,w*.014,true,'right',muted);
  if(options.details)txt((f.homePoints!=null?f.homePoints+'–'+f.awayPoints+' points':'')+(f.homeGames!=null?'   /   '+f.homeGames+'–'+f.awayGames+' games':''),w/2,h*.281,w-pad*2,w*.02,false,'center',muted);
  start=h*.322;
 }else{txt(model.title,pad,h*.202,w-pad*2,w*.062,true);txt(model.kind==='player'?'POWER  /  RECORD':'REGISTERED ORDER',pad,h*.252,w-pad*2,w*.016,true,'left',muted);start=h*.292}
 const bottom=h*.89,gap=wide?20:14,columns=wide?2:1,count=Math.max(1,Math.ceil(rows.length/columns)),width=(w-pad*2-gap*(columns-1))/columns,unit=(bottom-start-gap*(count-1))/count;
 rows.forEach((r,i)=>{const column=wide?Math.floor(i/count):0,index=wide?i%count:i,x=pad+column*(width+gap),y=start+index*(unit+gap);panel(x,y,width,unit);
  if(model.kind==='result'){
   txt((r.type==='Singles'?'S':'D')+String(r.position).replace('No. ',''),x+width*.035,y+unit*.22,width*.14,Math.min(w*.016,unit*.17),true,'left',muted);
   const names=(value,left,won)=>{const parts=personLines(value),xx=left?x+width*.045:x+width*.955,max=width*.35;parts.forEach((name,j)=>txt(name,xx,y+unit*(parts.length===1?.66:.48+j*.30),max,Math.min(wide?31:39,unit*(parts.length===1?.29:.24)),won,left?'left':'right'))};
   names(r.home,true,r.winner===r.home);names(r.away,false,r.winner===r.away);txt(r.score,x+width/2,y+unit*.65,width*.23,Math.min(wide?33:40,unit*.28),true,'center',accent);
  }else if(model.kind==='player'){
   txt(r.label,x+width*.045,y+unit*.22,width*.85,Math.min(w*.028,unit*.17),true,'left',muted);
   txt(r.rating,x+width*.045,y+unit*.64,width*.57,Math.min(w*.096,unit*.38),true,'left',ink);
   txt(r.rank?'#'+r.rank:'—',x+width*.95,y+unit*.52,width*.28,Math.min(w*.05,unit*.25),true,'right',accent);
   txt(r.record+' W–L',x+width*.95,y+unit*.78,width*.32,Math.min(w*.026,unit*.13),false,'right',muted);
  }else{
   txt(r.label,x+width*.04,y+unit*.60,width*.72,Math.min(wide?34:40,unit*.31),true);
   txt(r.value,x+width*.95,y+unit*.60,width*.18,Math.min(wide?35:42,unit*.34),true,'right',accent);
  }
 });
 line(pad,h*.927,w-pad*2);txt(D.meta.competition_label+' · '+D.meta.section_label,pad,h*.955,w*.73,w*.017,false,'left',muted);txt('UNOFFICIAL',w-pad,h*.955,w*.22,w*.014,true,'right',muted);
 const preview=canvas.parentElement,scale=Math.max(.001,Math.min((preview.clientWidth-32)/w,(preview.clientHeight-32)/h));canvas.style.width=w*scale+'px';canvas.style.height=h*scale+'px';
}

async function file(){const title=model.title,source=canvas;return new Promise((resolve,reject)=>source.toBlob(blob=>blob?resolve(new File([blob],(title||'BRTA').replace(/[^a-z0-9-]+/gi,'-')+'.png',{type:'image/png'})):reject(Error('Could not create image.')),'image/png'))}
function open(kind,name,round=null){exportFocus=document.activeElement;model=modelFor(kind,name,round);if(!model)return;options={ratio:'square',font:'Arial',dark:resolvedDark(),order:localStorage.getItem('brta-discipline-order')||'doubles',colour:'',details:true,fullNames:true,...savedDefaults(),round};let custom=[];try{custom=JSON.parse(localStorage.getItem('brta-personal-themes-v1')||'[]').filter(t=>t.kind==='scheme'&&/^#[a-f\d]{6}$/i.test(t.colour||t.color||''))}catch{}const palette=presets.concat(custom.map(t=>[t.name,t.colour||t.color]));const o=BRTA82.modal('Share card','<div class="share82-layout"><div class="share82-preview"><canvas id="share82Canvas" aria-label="Share card preview"></canvas></div><div class="share82-editor"><label><b>Aspect ratio</b><select id="share82Ratio"><option value="square">Square · 1:1</option><option value="portrait">Portrait · 3:4</option><option value="story">Story · 9:16</option><option value="landscape">Landscape · 8:5</option></select></label><label><b>Font</b><select id="share82Font"><option>Arial</option><option>Verdana</option><option>Georgia</option><option>Trebuchet MS</option><option>Courier New</option></select></label><label><b>Colour scheme</b><select id="share82Scheme">'+palette.map(([n,v])=>'<option value="'+esc(v)+'">'+esc(n)+'</option>').join('')+'</select></label><label><b>Custom accent</b><input id="share82Colour" type="color" value="#356bc7"></label><label><b>Match display order</b><select id="share82Order"><option value="singles">Singles above doubles</option><option value="doubles">Doubles above singles</option></select></label><label class="share82-check"><input type="checkbox" id="share82Dark" '+(options.dark?'checked':'')+'> Dark background</label>'+(kind==='result'?'<label class="share82-check"><input type="checkbox" id="share82Details" checked> Show points and games</label><label class="share82-check"><input type="checkbox" id="share82Names" checked> Full player names</label>':'')+'<div class="release82-actions"><button class="button secondary" id="share82SaveDefaults">Save as default</button><button class="button primary" id="share82Download">Download PNG</button><button class="button secondary" id="share82Send">Share…</button></div><p id="share82Status" class="share82-status" role="status">The preview is exactly what will be saved.</p></div></div>',true);canvas=$('#share82Canvas');previewObserver?.disconnect();const previewCanvas=canvas;const observer=previewObserver=new ResizeObserver(()=>{if(previewCanvas.isConnected&&canvas===previewCanvas)draw();else observer.disconnect()});observer.observe(canvas.parentElement);for(const [id,key] of [['Ratio','ratio'],['Font','font'],['Order','order'],['Scheme','colour']])$('#share82'+id).value=options[key];if(options.colour)$('#share82Colour').value=options.colour;for(const [id,key] of [['Dark','dark'],['Details','details'],['Names','fullNames']])$('#share82'+id).checked=options[key];for(const [id,key,check] of [['Font','font'],['Ratio','ratio'],['Scheme','colour'],['Colour','colour'],['Order','order'],['Dark','dark',true],['Details','details',true],['Names','fullNames',true]]){const input=$('#share82'+id);if(input)input.oninput=()=>{options[key]=check?input.checked:input.value;draw()}}draw();const status=$('#share82Status'),shareTitle=model.title;$('#share82SaveDefaults').onclick=()=>{try{const {round,...defaults}=options;localStorage.setItem(DEFAULTS_KEY,JSON.stringify(defaults));status.textContent='Saved as your default for future result cards.'}catch{status.textContent='This browser could not save your defaults.'}};$('#share82Download').onclick=async()=>{try{const f=await file(),url=URL.createObjectURL(f),a=document.createElement('a');a.href=url;a.download=f.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);status.textContent='Image downloaded.'}catch(e){status.textContent=e.message}};$('#share82Send').onclick=async()=>{try{const f=await file();if(navigator.canShare?.({files:[f]}))await navigator.share({files:[f],title:shareTitle});else status.textContent='File sharing is unavailable in this browser. Use Download PNG.'}catch(e){if(e.name!=='AbortError')status.textContent=e.message}}}
const detail=resultDetailHTML;resultDetailHTML=function(match,...args){if(!match||match.simulated)return detail(match,...args);return '<button class="share821-icon icon821" title="Share card" aria-label="Share result card" data-share82-result="'+esc(match.fixtureId)+'">↗</button>'+detail(match,...args)};
document.addEventListener('click',e=>{const b=e.target.closest('[data-share82-result]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();open('result',b.dataset.share82Result)},true);
window.BRTAShareCards={open};
})();


