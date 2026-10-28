(function(root){
  'use strict';
  const M=root.AmbientParameters,E=root.AmbientPresentation,$=s=>document.querySelector(s);
  const KEY='brta-more-settings-v1',reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const defaults={black:false,pressure:1,language:false,inverted:false,narrator:false,moreBands:false};
  let prefs;try{prefs={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{prefs={...defaults}}
  prefs.pressure=M.pressure(prefs.pressure);
  let overlay,phase='closed',dodges=0,left=false,busy=false,serial=0,returnFocus,inert=[],pressureTimer,pressureTarget=prefs.pressure,slider=false,step=0;
  let narratorFrame,narratorTimer,voiceTimeout,currentVoice,voiceBusy=false,voiceEpoch=0,voiceLevel=0,lastSpoken='',lastSpokenAt=0;
  let panelHidden=false,crownTimer,pressureModeRevealed=false,crownCount=0;
  const speechQueue=[];
  const animations=new Set(),enabled=()=>!!root.AuxiliaryPortal?.isUnlocked?.();
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const save=()=>localStorage.setItem(KEY,JSON.stringify(prefs));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const alive=id=>id===serial&&enabled();
  function animate(element,frames,options){const animation=element.animate(frames,{fill:'both',...options});animations.add(animation);return animation.finished.catch(()=>{}).finally(()=>animations.delete(animation))}
  function clearScene(){serial++;for(const a of animations)a.cancel();animations.clear();clearInterval(pressureTimer);pressureTimer=null;pressureTarget=prefs.pressure;clearTimeout(crownTimer);panelHidden=false;overlay?.classList.remove('ms-panel-hidden','ms-crown-visible');busy=false;}
  function panel(title,body,close=false){return '<section class="settings-sheet ms-sheet" role="dialog" aria-modal="true" aria-labelledby="msTitle">'+(close?'<button class="close-btn" type="button" data-ms="close" aria-label="Close">×</button>':'')+'<div class="overlay-title"><div class="kicker">MORE SETTINGS</div><h2 id="msTitle">'+title+'</h2></div>'+body+'</section>'}
  function ensure(){if(overlay)return;overlay=document.createElement('div');overlay.id='moreSettingsOverlay';overlay.className='overlay hidden ms-overlay';overlay.setAttribute('data-ms-cutscene','');document.body.append(overlay);overlay.addEventListener('pointerover',event=>{if(event.target.closest('[data-ms="dodge"]'))dodge();if(event.target.closest('[data-ms="confirm-no"]')&&step===7)swapConfirmation()});overlay.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'&&event.target.closest('[data-ms="dodge"]')){event.preventDefault();dodge()}});overlay.addEventListener('click',click);overlay.addEventListener('change',change);overlay.addEventListener('input',input);}
  function show(){ensure();if(phase==='closed'){returnFocus=document.activeElement;inert=[...document.body.children].filter(e=>e!==overlay&&e.id!=='modeSwitchOverlay'&&e.id!=='msNarrator').map(e=>[e,e.inert]);for(const[e]of inert)e.inert=true;}overlay.classList.remove('hidden');document.body.classList.add('modal-open');}
  function close(){clearScene();phase='closed';overlay?.classList.add('hidden');document.documentElement.removeAttribute('data-ms-void');for(const[e,value]of inert)e.inert=value;inert=[];if(!document.querySelector('.overlay:not(.hidden)'))document.body.classList.remove('modal-open');if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
  function gate(){if(localStorage.getItem('brta-ambient-access')==='1'){show();phase='transition';transition(voidSettings,{title:'More Settings',message:'Opening the remaining settings…',variant:'void'});return}clearScene();show();phase='gate';overlay.setAttribute('data-ms-cutscene','');overlay.innerHTML='<div class="overlay-backdrop"></div>'+panel('More Settings','<div class="ms-gate-body '+(dodges>=5?'ms-gate-expanded':'')+'"><div class="ms-dodge-track"><button class="ms-circle ms-dodger '+(left?'ms-left':'')+'" type="button" data-ms="dodge" aria-label="Open more settings">↗</button></div><div class="ms-gate-reward '+(dodges>=5?'ms-reward-visible':'')+'"><button class="button primary" type="button" data-ms="try">Try me.</button></div></div>',true);$('.ms-dodger').focus({preventScroll:true});}
  function dodge(){if(phase!=='gate'||busy)return;busy=true;left=!left;dodges++;$('.ms-dodger').classList.toggle('ms-left',left);if(dodges>=5){$('.ms-gate-body').classList.add('ms-gate-expanded');$('.ms-gate-reward').classList.add('ms-reward-visible')}setTimeout(()=>{busy=false},260);}
  function transition(done,options={}){if(root.runBRTAInterfaceTransition)root.runBRTAInterfaceTransition(done,options);else done();}
  async function shuffle(){
    clearScene();phase='shuffle';overlay.setAttribute('data-ms-cutscene','');const id=serial;
    overlay.innerHTML='<div class="ms-game" role="dialog" aria-modal="true" aria-labelledby="msTitle"><h2 id="msTitle">Keep your eye on it.</h2><p class="ms-game-status" aria-live="polite">Just one button.</p><div class="ms-cup-table"></div><button class="ms-game-exit close-btn hidden" data-ms="back" type="button" aria-label="Return">×</button></div>';
    const table=$('.ms-cup-table'),cups=[];const size=Math.max(24,Math.min(72,Math.min(table.clientWidth*.42,table.clientHeight*.35)*2*Math.sin(Math.PI/15)*.66));table.style.setProperty('--cup-size',size+'px');let slots=[8,11,14,...Array.from({length:15},(_,i)=>i).filter(i=>![8,11,14].includes(i))];
    function place(cup,slot){const point=M.cupPoint(slot,100,100);cup.style.left=point.x+'%';cup.style.top=point.y+'%';const angle=slot/15*Math.PI*2;cup.style.setProperty('--lift-x',Math.cos(angle)*75+'px');cup.style.setProperty('--lift-y',Math.sin(angle)*75+'px');}
    function makeCup(i){const cup=document.createElement('div');cup.className='ms-cup';cup.dataset.cup=String(i);cup.setAttribute('role','button');cup.setAttribute('aria-label','Cup '+(i+1));cup.tabIndex=-1;place(cup,slots[i]);cup.innerHTML='<span class="ms-cover"></span>';cup.style.opacity='0';table.append(cup);cups.push(cup);return cup;}
    for(let i=0;i<3;i++)makeCup(i);
    const large=Math.min(140,table.clientWidth*.22),starts=cups.map((cup,i)=>({x:table.clientWidth/2+(i-1)*large*1.6,y:table.clientHeight*.5-large/2}));
    cups.forEach((cup,i)=>{cup.style.width=large+'px';cup.style.height=large+'px';cup.style.left=starts[i].x+'px';cup.style.top=starts[i].y+'px';cup.style.opacity='1';cup.style.setProperty('--lift-x','0px');cup.style.setProperty('--lift-y',-large+'px');});
    const prize=document.createElement('button');prize.className='ms-circle ms-prize';prize.textContent='↗';prize.disabled=true;prize.type='button';prize.dataset.ms='prize';prize.setAttribute('aria-label','Open more settings');cups[1].append(prize);cups[1].classList.add('ms-lifted');
    await wait(reduced.matches?150:1100);if(!alive(id))return;cups[1].classList.remove('ms-lifted');$('.ms-game-status').textContent='Under this one. Obviously.';
    await wait(reduced.matches?100:750);if(!alive(id))return;
    await Promise.all(cups.map((cup,i)=>{const start=starts[i];place(cup,slots[i]);cup.style.width=size+'px';cup.style.height=size+'px';const end=M.cupPoint(slots[i],table.clientWidth,table.clientHeight);return animate(cup,[{transform:'translate('+(start.x-end.x)+'px,'+(start.y-end.y)+'px)',width:large+'px',height:large+'px'},{transform:'translate(0,0)',width:size+'px',height:size+'px'}],{duration:reduced.matches?1:1800,easing:'cubic-bezier(.4,0,.2,1)'})}));if(!alive(id))return;
    const extra=Array.from({length:12},(_,i)=>makeCup(i+3));
    await Promise.all(extra.map((cup,i)=>{const point=M.cupPoint(slots[i+3],table.clientWidth,table.clientHeight);return animate(cup,[{opacity:0,transform:'translate('+((point.x-table.clientWidth/2)*1.8)+'px,'+((point.y-table.clientHeight/2)*1.8)+'px)'},{opacity:1,transform:'translate(0,0)'}],{duration:reduced.matches?1:1100,delay:reduced.matches?0:i*55,easing:'cubic-bezier(.22,.65,.25,1)'})}));if(!alive(id))return;
    $('.ms-game-status').textContent='A few more won’t hurt.';await wait(reduced.matches?100:650);if(!alive(id))return;
    // One continuous compositor animation: no per-move promise gap or collision-prone crossings.
    if(!reduced.matches){
      const rotation=Math.random()*15,remask=setTimeout(()=>{if(alive(id))M.shuffled(cups)[0].append(prize)},20160);
      await Promise.all(cups.map((cup,i)=>animate(cup,M.cupOrbit(slots[i],table.clientWidth,table.clientHeight,rotation),{duration:28000,easing:'linear'})));clearTimeout(remask);
      slots=slots.map(slot=>slot+rotation);cups.forEach((cup,i)=>place(cup,slots[i]));
    }
    if(!alive(id))return;cups.forEach(cup=>{cup.style.opacity='1';cup.getAnimations().forEach(a=>a.cancel());});
    if(!alive(id))return;phase='choose';$('.ms-game-status').textContent='Which one?';cups.forEach(cup=>cup.tabIndex=0);cups[0].focus();
    table.addEventListener('click',event=>{const cup=event.target.closest('.ms-cup');if(cup&&phase==='choose')choose(cup,cups,prize,id)});
    table.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.ms-cup')&&phase==='choose'){event.preventDefault();choose(event.target,cups,prize,id)}});
  }
  async function choose(cup,cups,prize,id){
    if(phase!=='choose')return;phase='reveal';cups.forEach(c=>c.tabIndex=-1);
    const won=M.cupWin();
    if(won)cup.append(prize);
    else if(cup.contains(prize))M.shuffled(cups.filter(other=>other!==cup))[0].append(prize);
    cup.classList.add('ms-lifted');
    if(won){
      $('.ms-game-status').textContent='Well. That was inconvenient.';await celebrate(id);if(!alive(id))return;phase='won';localStorage.setItem('brta-ambient-access','1');prize.disabled=false;prize.focus();$('.ms-game-status').textContent='Go on, then.';
    }else{
      $('.ms-game-status').textContent='Nothing.';await wait(1100);if(!alive(id))return;const correct=prize.parentElement;correct.classList.add('ms-cup-red');await wait(650);if(!alive(id))return;correct.classList.add('ms-lifted');$('.ms-game-status').textContent='It was here.';await wait(800);if(!alive(id))return;phase='lost';$('.ms-game-exit').classList.remove('hidden');$('.ms-game-exit').focus();
    }
  }
  async function celebrate(id){
    const gong=new Audio('assets/gong.mp3');gong.playbackRate=.58;gong.preservesPitch=false;gong.webkitPreservesPitch=false;gong.volume=.75;gong.play().catch(()=>{});
    await root.BRTAConfetti.cups(overlay,{reduced:reduced.matches,isActive:()=>alive(id)});
  }

  function voidBackground(){return '<div class="ms-void-background" aria-hidden="true"><div class="ms-void-glow"></div><div class="ms-void-sea"><svg viewBox="0 0 1200 400" preserveAspectRatio="none"><path d="M-600 110 Q-450 30 -300 110 T0 110 T300 110 T600 110 T900 110 T1200 110 T1500 110 T1800 110 V500 H-600Z"/><path d="M-600 150 Q-450 80 -300 150 T0 150 T300 150 T600 150 T900 150 T1200 150 T1500 150 T1800 150 V500 H-600Z"/><path d="M-600 200 Q-450 140 -300 200 T0 200 T300 200 T600 200 T900 200 T1200 200 T1500 200 T1800 200 V500 H-600Z"/></svg></div><svg class="ms-void-crown" role="button" tabindex="0" aria-label="Crown" viewBox="0 0 100 70"><path d="M12 15 31 36 50 7 69 36 88 15 78 58H22Z"/><path d="M23 64H77"/><circle cx="50" cy="7" r="3"/><circle cx="12" cy="15" r="3"/><circle cx="88" cy="15" r="3"/></svg></div>';}
  async function hidePanel(){
    if(phase!=='void'||panelHidden)return;panelHidden=true;crownCount=0;overlay.classList.add('ms-panel-hidden');const sheet=overlay.querySelector('.ms-sheet');sheet.inert=true;$('.ms-show-panel').classList.remove('hidden');$('.ms-show-panel').focus();const id=serial;
    crownTimer=setTimeout(()=>{if(alive(id)&&phase==='void'&&panelHidden)overlay.classList.add('ms-crown-visible')},5850);
  }
  function showPanel(){if(phase!=='void')return;panelHidden=false;clearTimeout(crownTimer);overlay.classList.remove('ms-panel-hidden','ms-crown-visible');overlay.querySelector('.ms-sheet').inert=false;$('.ms-show-panel').classList.add('hidden');$('[data-ms="hide-panel"]').focus({preventScroll:true});}
  function voidSettings(){
    clearScene();phase='void';overlay.removeAttribute('data-ms-cutscene');document.documentElement.setAttribute('data-ms-void','');
    overlay.innerHTML=voidBackground()+'<button class="button secondary ms-show-panel hidden" data-ms="show-panel" type="button">Show panel ↓</button>'+'<button class="button secondary ms-hide-panel" data-ms="hide-panel" type="button">Hide panel ↑</button>'+panel('More Settings',
      '<div class="settings-group"><h3>Extra theme</h3><label class="accent-choice ms-black-swatch '+(prefs.black?'selected':'')+'"><i></i><span>Black +</span><input type="checkbox" data-ms-pref="black" '+(prefs.black?'checked':'')+' aria-label="Add Black + theme"></label></div>'+
      '<div class="settings-group ms-pressure" data-ms-pressure><h3>Change Atmospheric Pressure</h3><div class="ms-pressure-controls"></div><button class="ms-pressure-secret" data-ms="hint" type="button">There must be another way.</button><button class="button secondary '+(pressureModeRevealed?'':'hidden')+'" data-ms="slider" type="button">'+(slider?'Display as dropdown':'Display as slider')+'</button></div>'+
      '<div class="settings-group"><label class="setting-row"><span><b>Kâvąc</b><small>Translate the entire website.</small></span><input type="checkbox" data-ms-pref="language" '+(prefs.language?'checked':'')+'></label></div>'+
      '<div class="settings-group"><button class="button secondary" data-ms="admin" type="button">Gain Administrative Powers</button></div>'+
      '<div class="settings-group"><label class="setting-row"><span><b>Reverse Orientation</b></span><select data-ms-pref="inverted"><option value="normal" '+(!prefs.inverted?'selected':'')+'>Right side up</option><option value="inverted" '+(prefs.inverted?'selected':'')+'>Upside down</option></select></label></div>'+
      '<div class="settings-group"><label class="setting-row"><span><b>Enable Narrator</b></span><input class="ms-switch" role="switch" type="checkbox" data-ms-pref="narrator" '+(prefs.narrator?'checked':'')+'></label></div>'+
      '<div class="settings-group"><label class="setting-row"><span><b>Enable More Bands</b><small>A less conventional scale.</small></span><input class="ms-switch" type="checkbox" data-ms-pref="moreBands" '+(prefs.moreBands?'checked':'')+'></label></div>'+
      '<button class="button primary ms-return" data-ms="return" type="button">Return</button>');
    pressureControls();overlay.querySelector('input').focus();E.refresh();
  }
  function pressureControls(){
    const host=$('.ms-pressure-controls');if(!host)return;
    if(slider)host.innerHTML='<input type="range" min="1" max="201" step="1" value="'+Math.round(prefs.pressure*100)+'" data-ms-range aria-label="Atmospheric pressure"><output data-ms-pressure-value>x'+prefs.pressure.toFixed(2)+'</output>';
    else{host.innerHTML='<button class="ms-pressure-select" data-ms="pressure-list" type="button" role="combobox" aria-expanded="false" aria-controls="msPressureList"><span data-ms-pressure-value>x'+prefs.pressure.toFixed(2)+'</span><span aria-hidden="true">⌄</span></button><div id="msPressureList" class="ms-pressure-list hidden" role="listbox" tabindex="0" aria-label="Atmospheric pressure">'+Array.from({length:201},(_,i)=>'<button role="option" aria-selected="'+(i+1===Math.round(prefs.pressure*100))+'" type="button" data-ms-pressure-option="'+(i+1)+'">x'+((i+1)/100).toFixed(2)+'</button>').join('')+'</div>';const list=$('#msPressureList');list.addEventListener('wheel',event=>{event.preventDefault();setPressureTarget(pressureTarget+(event.deltaY>0?.01:-.01))},{passive:false});list.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End'].includes(event.key)){event.preventDefault();setPressureTarget(event.key==='Home'?.01:event.key==='End'?2.01:pressureTarget+(['ArrowDown','PageDown'].includes(event.key)?.01:-.01));}});}
  }
  function setPressureTarget(value){
    pressureTarget=M.pressure(value);if(pressureTimer)return;
    pressureTimer=setInterval(()=>{
      if(Math.abs(pressureTarget-prefs.pressure)<.005){clearInterval(pressureTimer);pressureTimer=null;return;}
      prefs.pressure=M.pressure(prefs.pressure+Math.sign(pressureTarget-prefs.pressure)*.01);save();E.atmosphere(prefs.pressure);
      const output=$('[data-ms-pressure-value]');if(output)output.textContent='x'+prefs.pressure.toFixed(2);
      const range=$('[data-ms-range]');if(range)range.value=String(Math.round(prefs.pressure*100));
      const list=$('#msPressureList');if(list){list.querySelectorAll('[role="option"]').forEach(option=>option.setAttribute('aria-selected',String(Number(option.dataset.msPressureOption)===Math.round(prefs.pressure*100))));list.scrollTop=(Math.round(prefs.pressure*100)-1)*36-list.clientHeight/2+18;}
    },100);
  }
  async function confirmation(){
    clearScene();phase='confirm-loading';const id=serial,item=M.confirmations[step],old=overlay.querySelector('.ms-sheet');
    if(old)await animate(old,[{opacity:1,translate:'0 0'},{opacity:0,translate:'0 -18px'}],{duration:reduced.matches?1:220,easing:'ease-in'});if(!alive(id))return;
    overlay.innerHTML=voidBackground()+'<div class="ms-confirm-loading" role="status" data-ms-cutscene><span class="ms-loading-ring" aria-hidden="true"></span><p>Checking confirmation…</p></div>';
    await wait(900+Math.random()*700);if(!alive(id))return;
    overlay.innerHTML=voidBackground()+panel('Confirmation',
      '<div class="ms-confirmation '+(step===7?'ms-confirmation-wide':'')+'"><p>'+esc(item.text)+'</p>'+(item.phrase?'<input class="ms-confirm-input" type="text" autocomplete="off" spellcheck="false" data-ms-confirm aria-label="Confirmation phrase">':'')+'<div class="ms-confirm-actions"><button class="button primary" type="button" data-ms="confirm-yes" disabled>'+esc(item.yes)+'</button>'+(item.no?'<button class="button secondary" type="button" data-ms="confirm-no" disabled>'+esc(item.no)+'</button>':'')+'</div></div>');
    const arriving=overlay.querySelector('.ms-sheet');arriving.style.opacity='0';
    await animate(arriving,[{opacity:0,translate:'0 18px'},{opacity:1,translate:'0 0'}],{duration:reduced.matches?1:320,easing:'ease-out'});await wait(350);if(!alive(id))return;
    phase='confirm';$('[data-ms="confirm-yes"]').disabled=!!item.phrase&&$('[data-ms-confirm]').value!==item.phrase;const no=$('[data-ms="confirm-no"]');if(no)no.disabled=false;overlay.querySelector('input,button').focus();E.refresh();
  }
  function swapConfirmation(){if(phase!=='confirm'||step!==7||busy)return;busy=true;$('.ms-confirm-actions').classList.toggle('ms-confirm-swapped');setTimeout(()=>busy=false,100);}
  function longReturn(){
    clearScene();phase='returning';const id=serial;
    transition(()=>{if(alive(id)){document.documentElement.removeAttribute('data-ms-void');close();syncThemeOptions();}},
      {title:'Returning',message:'Re-implementing mechanics…',variant:'void',duration:40000+Math.random()*20000,randomProgress:true,
       statuses:['Re-implementing mechanics…','Re-attaching the settings…','Adjusting the remaining atmosphere…','Looking for the normal amount of black…','Reticulating tennis balls…','Reconsidering the return journey…','Putting the website back where it was…'],
       quotes:['Did you know? This website calculates ratings.','The Settings button opens Settings. Usually.','No administrative powers were gained today.','The void has excellent contrast.','Your cursor has remained a cursor throughout.','Please remain approximately where you are.','A watched progress wheel still takes its time.']});
  }
  function click(event){
    if(event.target.closest('.ms-void-crown')&&phase==='void'&&panelHidden&&overlay.classList.contains('ms-crown-visible')){crownCount++;root.BRTASequence?.prime();const crown=event.target.closest('.ms-void-crown');crown.style.setProperty('--crown-jolt',(1+crownCount*.9)+'px');crown.classList.remove('ms-crown-jolt');void crown.getBoundingClientRect();crown.classList.add('ms-crown-jolt');if(crownCount===11){phase='sequence';root.BRTASequence?.start(overlay)}return;}
    const option=event.target.closest('[data-ms-pressure-option]');if(option){setPressureTarget(Number(option.dataset.msPressureOption)/100);return;}
    const action=event.target.closest('[data-ms]')?.dataset.ms;if(!action||!enabled())return;
    if(action==='close'&&phase==='gate')close();
    if(action==='back'&&phase==='lost')gate();
    if(action==='try'&&phase==='gate'&&dodges>=5){phase='transition';transition(shuffle,{title:'More Settings',message:'Preparing a perfectly reasonable interface…',variant:'void'});}
    if(action==='prize'&&phase==='won'){phase='transition';transition(voidSettings,{title:'More Settings',message:'Opening the remaining settings…',variant:'void'});}
    if(action==='hint'){pressureModeRevealed=true;$('[data-ms="slider"]').classList.remove('hidden');}
    if(action==='slider'){slider=!slider;pressureControls();event.target.textContent=slider?'Display as dropdown':'Display as slider';}
    if(action==='pressure-list'){const list=$('#msPressureList'),open=list.classList.contains('hidden');list.classList.toggle('hidden',!open);event.target.closest('button').setAttribute('aria-expanded',String(open));if(open){list.scrollTop=(Math.round(prefs.pressure*100)-1)*36-list.clientHeight/2+18;list.focus();}}
    if(action==='hide-panel')hidePanel();
    if(action==='show-panel')showPanel();
    if(action==='admin'&&phase==='void'){step=0;confirmation();}
    if(action==='confirm-yes'&&phase==='confirm'){if(M.confirmations[step].phrase&&$('[data-ms-confirm]').value!==M.confirmations[step].phrase)return;if(step===8)voidSettings();else{step++;confirmation();}}
    if(action==='confirm-no'&&phase==='confirm'){if(step===7){step=8;confirmation()}else voidSettings();}
    if(action==='return'&&phase==='void')longReturn();
  }
  function input(event){if(event.target.matches('[data-ms-confirm]')){$('[data-ms="confirm-yes"]').disabled=phase!=='confirm'||event.target.value!==M.confirmations[step].phrase;return;}if(event.target.matches('[data-ms-range]')){const target=Number(event.target.value)/100;event.target.value=String(Math.round(prefs.pressure*100));setPressureTarget(target);}}
  function change(event){const key=event.target.dataset.msPref;if(!key)return;if(key==='black')event.target.closest('.ms-black-swatch')?.classList.toggle('selected',event.target.checked);prefs[key]=key==='inverted'?event.target.value==='inverted':event.target.checked;save();applyPreferences();if(key==='moreBands')root.dispatchEvent(new Event('brta-bands-toggle'));if(key==='narrator'&&prefs.narrator)speak('Narrator enabled.',true);}
  function syncThemeOptions(){
    const available=enabled()&&prefs.black;if(!available&&root.BRTASitePreferences?.getTheme()==='black-plus')root.BRTASitePreferences.setTheme('dark');
    const select=$('#themeSelect');if(!select)return;
    let option=select.querySelector('[value="black-plus"]');if(available&&!option){option=document.createElement('option');option.value='black-plus';option.textContent='Black +';select.append(option);}else if(!available)option?.remove();
    if(root.BRTASitePreferences?.getTheme()==='black-plus'){if(available)select.value='black-plus';else root.BRTASitePreferences.setTheme('dark');}
  }
  function bindSettings(){
    let host=$('#moreSettingsEntry');if(!host&&$('#customAdminSettings')){$('#customAdminSettings').insertAdjacentHTML('afterend','<div id="moreSettingsEntry" class="settings-group settings-wide hidden"><button class="button secondary" type="button" data-more-settings>More Settings</button></div>');host=$('#moreSettingsEntry');}
    host?.classList.toggle('hidden',!enabled());syncThemeOptions();
  }
  function applyPreferences(){const on=enabled();E.language(on&&prefs.language);E.atmosphere(on?prefs.pressure:1);document.documentElement.toggleAttribute('data-ms-inverted',on&&prefs.inverted);syncThemeOptions();narrator(on&&prefs.narrator);}
  function narrator(on){
    let orb=$('#msNarrator');
    if(on&&(!root.speechSynthesis||!root.SpeechSynthesisUtterance)){prefs.narrator=false;save();const control=$('[data-ms-pref="narrator"]');if(control){control.checked=false;control.closest('.settings-group').insertAdjacentHTML('beforeend','<small class="ms-voice-status" role="status">Voice narration is unavailable in this browser.</small>');}return;}
    if(on&&!orb){
      orb=document.createElement('div');orb.id='msNarrator';orb.innerHTML='<button class="ms-narrator-orb" type="button" data-ms-narrator-mute aria-label="Mute narrator" title="Mute narrator">◉</button><canvas width="180" height="65" aria-hidden="true"></canvas>';document.body.append(orb);root.speechSynthesis.getVoices();drawNarrator();
    }
    if(!on){voiceEpoch++;clearTimeout(narratorTimer);clearTimeout(voiceTimeout);speechQueue.length=0;if(voiceBusy||currentVoice)root.speechSynthesis?.cancel();currentVoice=null;voiceBusy=false;voiceLevel=0;orb?.remove();cancelAnimationFrame(narratorFrame);}
  }
  function drainSpeech(){
    if(voiceBusy||!enabled()||!prefs.narrator)return;
    if(['transition','shuffle','reveal','returning','confirm-loading'].includes(phase)){speechQueue.length=0;return;}
    const text=speechQueue.shift();if(!text)return;
    const epoch=voiceEpoch;let ended=false;
    const finish=()=>{if(ended||epoch!==voiceEpoch)return;ended=true;clearTimeout(voiceTimeout);voiceBusy=false;currentVoice=null;$('#msNarrator')?.classList.remove('ms-narrating');setTimeout(drainSpeech,80);};
    try{
      const utterance=new root.SpeechSynthesisUtterance(text),voices=root.speechSynthesis.getVoices();
      utterance.voice=voices.find(v=>/Google.*English|Google US English/i.test(v.name))||voices.find(v=>/^en/.test(v.lang))||voices[0]||null;utterance.rate=1.05;
      utterance.onstart=()=>{if(epoch===voiceEpoch){$('#msNarrator')?.classList.add('ms-narrating');voiceLevel=1;}};
      utterance.onboundary=()=>{if(epoch===voiceEpoch)voiceLevel=1};utterance.onend=finish;utterance.onerror=finish;
      currentVoice=utterance;voiceBusy=true;
      // Some speech engines fail to emit an end/error event. Recover without building a stuck queue.
      voiceTimeout=setTimeout(()=>{if(currentVoice===utterance&&epoch===voiceEpoch){root.speechSynthesis.cancel();finish();}},Math.max(8000,text.length*140));
      root.speechSynthesis.resume();root.speechSynthesis.speak(utterance);
    }catch{finish();}
  }
  function speak(text,priority=false){
    if(!enabled()||!prefs.narrator||['transition','shuffle','reveal','returning','confirm-loading'].includes(phase))return;
    text=String(text).replace(/\s+/g,' ').trim().slice(0,160);const now=performance.now();if(!text||(text===lastSpoken&&now-lastSpokenAt<2200))return;
    lastSpoken=text;lastSpokenAt=now;
    if(priority)speechQueue.length=0;
    if(!speechQueue.includes(text)){if(speechQueue.length>=2)speechQueue.shift();speechQueue.push(text);}drainSpeech();
  }
  function drawNarrator(){
    const orb=$('#msNarrator');if(!orb)return;const canvas=orb.querySelector('canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,180,65);
    const active=voiceBusy?Math.max(.15,voiceLevel):0,t=performance.now()/180;voiceLevel*=.97;
    for(let i=0;i<40;i++){const h=2+active*(8+Math.abs(Math.sin(t+i*.6))*24)*Math.sin((i+1)/41*Math.PI);ctx.fillStyle='rgba(180,170,255,.7)';ctx.fillRect(i*4.5,32-h/2,2,h);}
    narratorFrame=requestAnimationFrame(drawNarrator);
  }
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-ms-narrator-mute]')){prefs.narrator=false;save();const toggle=$('[data-ms-pref="narrator"]');if(toggle)toggle.checked=false;narrator(false);return;}
    if(event.target.closest('[data-more-settings]')&&enabled())gate();
    clearTimeout(narratorTimer);const el=event.target.closest('button,a,summary,[role="tab"]');if(el&&!el.closest('#msNarrator'))speak(el.innerText||el.getAttribute('aria-label')||'',true);
  });
  document.addEventListener('pointerover',event=>{
    const el=event.target.closest('button,a,summary,label,h1,h2,h3,p,td,th,li,[role="tab"]');if(!el||el.contains(event.relatedTarget)||el.closest('#msNarrator'))return;
    clearTimeout(narratorTimer);narratorTimer=setTimeout(()=>{if(el.isConnected)speak(el.innerText||el.getAttribute('aria-label')||'')},450);
  });
  document.addEventListener('pointerout',event=>{if(!event.target.contains(event.relatedTarget))clearTimeout(narratorTimer);});
  document.addEventListener('keydown',event=>{

    if(phase==='closed'||event.target.closest('#msNarrator,.wg-game'))return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(phase==='gate')close();else if(phase==='lost')gate();return;}
    if(['transition','shuffle','reveal','returning','confirm-loading'].includes(phase)&&['Tab','Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();return;}
    if(event.key==='Enter'&&event.target.matches('[data-ms="dodge"]')){event.preventDefault();dodge();}
    if(event.key==='Tab'){const focusable=[...overlay.querySelectorAll('button,input,select,[tabindex="0"]'),...document.querySelectorAll('#msNarrator button')].filter(e=>!e.disabled&&!e.closest('.hidden,[inert]')&&e.getClientRects().length);if(!focusable.length){event.preventDefault();return;}const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){event.preventDefault();first.focus()}}
  },true);
  root.addEventListener('brta-module-toggle',()=>{if(!enabled()&&phase!=='closed')close();bindSettings();applyPreferences();});
  root.AmbientPanel=Object.freeze({bindSettings});bindSettings();applyPreferences();
})(window);
