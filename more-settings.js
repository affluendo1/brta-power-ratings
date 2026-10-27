(function(root){
  'use strict';
  const M=root.MoreSettingsModel,E=root.MoreSettingsEffects,$=s=>document.querySelector(s);
  const KEY='brta-more-settings-v1',reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const defaults={black:false,pressure:1,language:false,inverted:false,narrator:false};
  let prefs;try{prefs={...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{prefs={...defaults}}
  prefs.pressure=M.pressure(prefs.pressure);
  let overlay,phase='closed',dodges=0,left=false,busy=false,serial=0,returnFocus,inert=[],pressureTimer,pressureTarget=prefs.pressure,slider=false,step=0;
  let voiceContext,analyser,narratorFrame,voiceFrames=[],voiceIndex=0,lastSpoken='',lastSpokenAt=0;
  const animations=new Set(),enabled=()=>!!root.AuxiliaryPortal?.isUnlocked?.();
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const save=()=>localStorage.setItem(KEY,JSON.stringify(prefs));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const alive=id=>id===serial&&enabled();
  function animate(element,frames,options){const animation=element.animate(frames,{fill:'forwards',...options});animations.add(animation);return animation.finished.catch(()=>{}).finally(()=>animations.delete(animation))}
  function clearScene(){serial++;for(const a of animations)a.cancel();animations.clear();clearInterval(pressureTimer);pressureTimer=null;pressureTarget=prefs.pressure;busy=false;}
  function panel(title,body,close=false){return '<section class="settings-sheet ms-sheet" role="dialog" aria-modal="true" aria-labelledby="msTitle">'+(close?'<button class="close-btn" type="button" data-ms="close" aria-label="Close">×</button>':'')+'<div class="overlay-title"><div class="kicker">MORE SETTINGS</div><h2 id="msTitle">'+title+'</h2></div>'+body+'</section>'}
  function ensure(){if(overlay)return;overlay=document.createElement('div');overlay.id='moreSettingsOverlay';overlay.className='overlay hidden ms-overlay';overlay.setAttribute('data-ms-cutscene','');document.body.append(overlay);overlay.addEventListener('pointerover',event=>{if(event.target.closest('[data-ms="dodge"]'))dodge();if(event.target.closest('[data-ms="confirm-no"]')&&step===7)swapConfirmation()});overlay.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'&&event.target.closest('[data-ms="dodge"]')){event.preventDefault();dodge()}});overlay.addEventListener('click',click);overlay.addEventListener('change',change);overlay.addEventListener('input',input);}
  function show(){ensure();if(phase==='closed'){returnFocus=document.activeElement;inert=[...document.body.children].filter(e=>e!==overlay&&e.id!=='modeSwitchOverlay').map(e=>[e,e.inert]);for(const[e]of inert)e.inert=true;}overlay.classList.remove('hidden');document.body.classList.add('modal-open');}
  function close(){clearScene();phase='closed';overlay?.classList.add('hidden');document.documentElement.removeAttribute('data-ms-void');for(const[e,value]of inert)e.inert=value;inert=[];if(!document.querySelector('.overlay:not(.hidden)'))document.body.classList.remove('modal-open');if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});}
  function gate(){clearScene();show();phase='gate';overlay.setAttribute('data-ms-cutscene','');overlay.innerHTML='<div class="overlay-backdrop"></div>'+panel('More Settings','<div class="ms-gate-body '+(dodges>=10?'ms-gate-expanded':'')+'"><div class="ms-dodge-track"><button class="ms-circle ms-dodger '+(left?'ms-left':'')+'" type="button" data-ms="dodge" aria-label="Open more settings">↗</button></div><div class="ms-gate-reward '+(dodges>=10?'ms-reward-visible':'')+'"><button class="button primary" type="button" data-ms="try">Try me.</button></div></div>',true);$('.ms-dodger').focus({preventScroll:true});}
  function dodge(){if(phase!=='gate'||busy)return;busy=true;left=!left;dodges++;$('.ms-dodger').classList.toggle('ms-left',left);if(dodges>=10){$('.ms-gate-body').classList.add('ms-gate-expanded');$('.ms-gate-reward').classList.add('ms-reward-visible')}setTimeout(()=>{busy=false},95);}
  function transition(done,options={}){if(root.runBRTAInterfaceTransition)root.runBRTAInterfaceTransition(done,options);else done();}
  async function shuffle(){
    clearScene();phase='shuffle';const id=serial;
    overlay.innerHTML='<div class="ms-game" role="dialog" aria-modal="true" aria-labelledby="msTitle"><h2 id="msTitle">Keep your eye on it.</h2><p class="ms-game-status" aria-live="polite">Just one button.</p><div class="ms-cup-table"></div><button class="ms-game-exit close-btn hidden" data-ms="back" type="button" aria-label="Return">×</button></div>';
    const table=$('.ms-cup-table'),cups=[];let slots=[0,1,2,3,4];
    for(let i=0;i<5;i++){const cup=document.createElement('div');cup.className='ms-cup';cup.dataset.cup=String(i);cup.setAttribute('role','button');cup.setAttribute('aria-label','Cup '+(i+1));cup.tabIndex=-1;cup.style.left=(i*20+10)+'%';cup.innerHTML='<span class="ms-cover"></span>';table.append(cup);cups.push(cup);}
    const prize=document.createElement('button');prize.className='ms-circle ms-prize';prize.textContent='↗';prize.disabled=true;prize.type='button';prize.dataset.ms='prize';prize.setAttribute('aria-label','Open more settings');cups[2].append(prize);
    cups.forEach((cup,i)=>{cup.style.opacity=i===2?'1':'0';if(i===2)cup.classList.add('ms-lifted')});
    await wait(reduced.matches?250:1100);if(!alive(id))return;cups[2].classList.remove('ms-lifted');$('.ms-game-status').textContent='Under this one. Obviously.';
    await wait(reduced.matches?150:650);if(!alive(id))return;
    await Promise.all(cups.map((cup,i)=>animate(cup,[{opacity:i===2?1:0,transform:'translateX('+((i-2)*140)+'px)'},{opacity:1,transform:'translateX(0)'}],{duration:reduced.matches?1:600,easing:'ease-out'})));if(!alive(id))return;
    $('.ms-game-status').textContent='Easy. Still easy. Probably.';
    const speeds=[1300,1100,850,650,450,300,180,100,65,40,28,25,25,25,25,28,40,65,110,200,380,650,950];
    if(!reduced.matches)for(let round=0;round<speeds.length;round++){
      let next;if(round<6||round>18){next=slots.slice();const a=Math.floor(Math.random()*5);let b=(a+1+Math.floor(Math.random()*4))%5;[next[a],next[b]]=[next[b],next[a]];}else next=M.shuffled(slots);
      await Promise.all(cups.map((cup,i)=>{const delta=(slots[i]-next[i])*table.clientWidth/5;cup.style.left=(next[i]*20+10)+'%';return animate(cup,[{transform:'translate('+delta+'px,0)'},{transform:'translate('+(delta/2)+'px,'+((i%2?1:-1)*Math.min(70,table.clientHeight/4))+'px)'},{transform:'translate(0,0)'}],{duration:speeds[round],easing:round<6||round>18?'ease-in-out':'linear'})}));slots=next;if(!alive(id))return;
    }else{slots=M.shuffled(slots);cups.forEach((cup,i)=>cup.style.left=(slots[i]*20+10)+'%');}
    if(!alive(id))return;phase='choose';$('.ms-game-status').textContent='Which one?';cups.forEach(cup=>cup.tabIndex=0);cups[slots.indexOf(0)].focus();
    table.addEventListener('click',event=>{const cup=event.target.closest('.ms-cup');if(cup&&phase==='choose')choose(cup,cups,prize,id)});
    table.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&event.target.matches('.ms-cup')&&phase==='choose'){event.preventDefault();choose(event.target,cups,prize,id)}});
  }
  async function choose(cup,cups,prize,id){
    phase='reveal';cups.forEach(c=>c.tabIndex=-1);cup.classList.add('ms-lifted');
    if(cup.contains(prize)){
      $('.ms-game-status').textContent='Well. That was inconvenient.';celebrate();await wait(reduced.matches?700:7000);if(!alive(id))return;phase='won';prize.disabled=false;prize.focus();$('.ms-game-status').textContent='Go on, then.';
    }else{
      $('.ms-game-status').textContent='Nothing.';await wait(1100);if(!alive(id))return;const correct=prize.parentElement;correct.classList.add('ms-cup-red');await wait(650);if(!alive(id))return;correct.classList.add('ms-lifted');$('.ms-game-status').textContent='It was here.';await wait(800);if(!alive(id))return;phase='lost';$('.ms-game-exit').classList.remove('hidden');$('.ms-game-exit').focus();
    }
  }
  function celebrate(){
    const gong=new Audio('assets/gong.mp3');gong.playbackRate=.58;gong.preservesPitch=false;gong.webkitPreservesPitch=false;gong.volume=.75;gong.play().catch(()=>{});
    const storm=document.createElement('div');storm.className='ms-confetti-storm';storm.setAttribute('aria-hidden','true');overlay.append(storm);
    for(let i=0;i<500;i++){const piece=document.createElement('i');piece.className='ms-confetti';piece.style.cssText='--x:'+Math.random()*100+'vw;--drift:'+(Math.random()-.5)*70+'vw;--spin:'+(Math.random()-.5)*1800+'deg;--delay:'+Math.random()*2+'s;--duration:'+(9+Math.random()*7)+'s;--colour:'+['#ddd','#9b8eff','#5ee6d3','#fff','#a89cdb'][i%5];storm.append(piece)}
    setTimeout(()=>storm.remove(),19000);
  }
  function voidSettings(){
    clearScene();phase='void';overlay.removeAttribute('data-ms-cutscene');document.documentElement.setAttribute('data-ms-void','');
    overlay.innerHTML='<div class="ms-void-background" aria-hidden="true"><i></i><i></i><i></i></div>'+panel('More Settings',
      '<div class="settings-group"><label class="setting-row"><span><b>Black +</b><small>Add this theme to the normal theme selection.</small></span><input type="checkbox" data-ms-pref="black" '+(prefs.black?'checked':'')+'></label></div>'+
      '<div class="settings-group ms-pressure" data-ms-pressure><h3>Change Atmospheric Pressure</h3><div class="ms-pressure-controls"></div><button class="ms-pressure-secret" data-ms="hint" type="button">There must be another way.</button><button class="button secondary hidden" data-ms="slider" type="button">Display as slider</button></div>'+
      '<div class="settings-group"><label class="setting-row"><span><b>Kâvąc</b><small>Translate the entire website.</small></span><input type="checkbox" data-ms-pref="language" '+(prefs.language?'checked':'')+'></label></div>'+
      '<div class="settings-group"><button class="button secondary" data-ms="admin" type="button">Gain Administrative Powers</button></div>'+
      '<div class="settings-group"><label class="setting-row"><span><b>Reverse Orientation</b></span><select data-ms-pref="inverted"><option value="normal" '+(!prefs.inverted?'selected':'')+'>Right side up</option><option value="inverted" '+(prefs.inverted?'selected':'')+'>Upside down</option></select></label></div>'+
      '<div class="settings-group"><label class="setting-row"><span><b>Enable Narrator</b></span><input class="ms-switch" role="switch" type="checkbox" data-ms-pref="narrator" '+(prefs.narrator?'checked':'')+'></label></div>'+
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
  function confirmation(){
    const item=M.confirmations[step];phase='confirm';overlay.innerHTML='<div class="ms-void-background" aria-hidden="true"></div>'+panel('Confirmation',
      '<div class="ms-confirmation '+(step===7?'ms-confirmation-wide':'')+'"><p>'+esc(item.text)+'</p>'+(item.phrase?'<input class="ms-confirm-input" type="text" autocomplete="off" spellcheck="false" data-ms-confirm aria-label="Confirmation phrase">':'')+'<div class="ms-confirm-actions"><button class="button primary" type="button" data-ms="confirm-yes" '+(item.phrase?'disabled':'')+'>'+esc(item.yes)+'</button>'+(item.no?'<button class="button secondary" type="button" data-ms="confirm-no">'+esc(item.no)+'</button>':'')+'</div></div>');overlay.querySelector('input,button').focus();E.refresh();
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
    const option=event.target.closest('[data-ms-pressure-option]');if(option){setPressureTarget(Number(option.dataset.msPressureOption)/100);return;}
    const action=event.target.closest('[data-ms]')?.dataset.ms;if(!action||!enabled())return;
    if(action==='close'&&phase==='gate')close();
    if(action==='back'&&phase==='lost')gate();
    if(action==='try'&&phase==='gate'&&dodges>=10){phase='transition';transition(shuffle,{title:'More Settings',message:'Preparing a perfectly reasonable interface…',variant:'void'});}
    if(action==='prize'&&phase==='won'){phase='transition';transition(voidSettings,{title:'More Settings',message:'Opening the remaining settings…',variant:'void'});}
    if(action==='hint')$('[data-ms="slider"]').classList.remove('hidden');
    if(action==='slider'){slider=true;pressureControls();event.target.classList.add('hidden');}
    if(action==='pressure-list'){const list=$('#msPressureList'),open=list.classList.contains('hidden');list.classList.toggle('hidden',!open);event.target.closest('button').setAttribute('aria-expanded',String(open));if(open){list.scrollTop=(Math.round(prefs.pressure*100)-1)*36-list.clientHeight/2+18;list.focus();}}
    if(action==='admin'){step=0;confirmation();}
    if(action==='confirm-yes'){if(M.confirmations[step].phrase&&$('[data-ms-confirm]').value!==M.confirmations[step].phrase)return;if(step===8)voidSettings();else{step++;confirmation();}}
    if(action==='confirm-no'){if(step===7){step=8;confirmation()}else voidSettings();}
    if(action==='return'&&phase==='void')longReturn();
  }
  function input(event){if(event.target.matches('[data-ms-confirm]')){$('[data-ms="confirm-yes"]').disabled=event.target.value!==M.confirmations[step].phrase;return;}if(event.target.matches('[data-ms-range]')){const target=Number(event.target.value)/100;event.target.value=String(Math.round(prefs.pressure*100));setPressureTarget(target);}}
  function change(event){const key=event.target.dataset.msPref;if(!key)return;prefs[key]=key==='inverted'?event.target.value==='inverted':event.target.checked;save();applyPreferences();}
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
  function audio(){if(!voiceContext){const Context=root.AudioContext||root.webkitAudioContext;if(Context){voiceContext=new Context();analyser=voiceContext.createAnalyser();analyser.fftSize=128;analyser.connect(voiceContext.destination);}}voiceContext?.resume().catch(()=>{});}
  function narrator(on){
    let orb=$('#msNarrator');if(on&&!orb){orb=document.createElement('div');orb.id='msNarrator';orb.innerHTML='<div class="ms-narrator-orb"><span>◉</span></div><canvas width="180" height="65" aria-hidden="true"></canvas>';orb.setAttribute('aria-label','Narrator');document.body.append(orb);drawNarrator();}
    if(!on){orb?.remove();cancelAnimationFrame(narratorFrame);voiceFrames.forEach(frame=>{frame.contentWindow?.speechSynthesis?.cancel();frame.remove()});voiceFrames=[];voiceContext?.suspend().catch(()=>{});}
  }
  function speak(text){
    if(!enabled()||!prefs.narrator||!text.trim())return;const now=performance.now();if(text===lastSpoken&&now-lastSpokenAt<350)return;lastSpoken=text;lastSpokenAt=now;audio();
    // Independent speech queues allow overlapping voices on engines that support it.
    if(voiceFrames.length<8){const frame=document.createElement('iframe');frame.hidden=true;frame.title='';frame.setAttribute('aria-hidden','true');document.body.append(frame);voiceFrames.push(frame);}
    const frame=voiceFrames[voiceIndex++%voiceFrames.length],win=frame.contentWindow;
    try{const utterance=new win.SpeechSynthesisUtterance(text.slice(0,180)),voices=win.speechSynthesis.getVoices();utterance.voice=voices.find(v=>/Google.*English|Google US English/i.test(v.name))||voices.find(v=>/^en/.test(v.lang))||voices[0]||null;utterance.rate=1.1;win.speechSynthesis.speak(utterance);}catch{}
    if(voiceContext&&analyser){const oscillator=voiceContext.createOscillator(),gain=voiceContext.createGain(),start=voiceContext.currentTime;oscillator.type='sine';oscillator.frequency.value=105+Math.random()*95;gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.013,start+.06);gain.gain.exponentialRampToValueAtTime(.0001,start+Math.min(2.8,.35+text.length/50));oscillator.connect(gain);gain.connect(analyser);oscillator.start();oscillator.stop(start+3);}
    const orb=$('#msNarrator');if(orb){orb.classList.remove('ms-narrating');void orb.offsetWidth;orb.classList.add('ms-narrating');}
  }
  function drawNarrator(){const orb=$('#msNarrator');if(!orb)return;const canvas=orb.querySelector('canvas'),ctx=canvas.getContext('2d'),samples=new Uint8Array(64);ctx.clearRect(0,0,180,65);if(analyser)analyser.getByteFrequencyData(samples);for(let i=0;i<40;i++){const h=Math.max(2,(samples[i]||0)/4);ctx.fillStyle='rgba(180,170,255,.7)';ctx.fillRect(i*4.5,32-h/2,2,h);}narratorFrame=requestAnimationFrame(drawNarrator);}
  document.addEventListener('click',event=>{if(event.target.closest('[data-more-settings]')&&enabled())gate();const el=event.target.closest('button,a,summary,[role="tab"]');if(el&&!el.closest('#msNarrator'))speak(el.innerText||el.getAttribute('aria-label')||'');});
  document.addEventListener('pointerover',event=>{const el=event.target.closest('button,a,summary,label,h1,h2,h3,td,[role="tab"]');if(el&&!el.contains(event.relatedTarget)&&!el.closest('#msNarrator'))speak(el.innerText||el.getAttribute('aria-label')||'');});
  document.addEventListener('keydown',event=>{
    if(phase==='closed')return;
    if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(phase==='gate')close();else if(phase==='lost')gate();return;}
    if(['transition','shuffle','reveal','returning'].includes(phase)&&['Tab','Enter',' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();event.stopImmediatePropagation();return;}
    if(event.key==='Enter'&&event.target.matches('[data-ms="dodge"]')){event.preventDefault();dodge();}
    if(event.key==='Tab'){const focusable=[...overlay.querySelectorAll('button,input,select,[tabindex="0"]')].filter(e=>!e.disabled&&!e.closest('.hidden')&&e.getClientRects().length);if(!focusable.length){event.preventDefault();return;}const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&(document.activeElement===first||!overlay.contains(document.activeElement))){event.preventDefault();last.focus()}else if(!event.shiftKey&&(document.activeElement===last||!overlay.contains(document.activeElement))){event.preventDefault();first.focus()}}
  },true);
  root.addEventListener('brta-module-toggle',()=>{if(!enabled()&&phase!=='closed')close();bindSettings();applyPreferences();});
  root.MoreSettings=Object.freeze({bindSettings});bindSettings();applyPreferences();
})(window);
