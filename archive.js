(()=>{
  const UNLOCK_KEY='brta-extras-unlocked',INTRO_KEY='brta-archive-intro-seen',VISION_KEY='brta-archive-vision',ROUTE='#archive';
  const archive=document.querySelector('#royalArchive'),entry=document.querySelector('#sidPortalEntry'),homeEntry=document.querySelector('#sidPortalHomeEntry'),homeButton=document.querySelector('#sidPortalHomeButton'),extras=document.querySelector('#extrasOverlay'),password=document.querySelector('#extrasPassword'),extrasForm=document.querySelector('#extrasForm'),extrasState=document.querySelector('#extrasState');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const tracks=[
    {title:'Hypnotize · The Notorious B.I.G.',src:'assets/hypnotize.mp3'},
    {title:"Gangsta’s Paradise · Coolio",src:'assets/gangstas-paradise.mp3'}
  ];
  const wins=[
    {event:'ROYAL COURT',name:'S. BASA def. J. BONE',score:'6–0  6–0',src:'assets/sid-vs-jayden-6-0-6-0.png',alt:'Sid Basa defeats Jayden Bone 6–0, 6–0 in the royal court.'},
    {event:'AUSTRALIAN OPEN · 2027',name:'S. BASA def. J. SINNER',score:'6–2  6–0  7–6(4)',src:'assets/sid-ao-2027-vs-sinner.png',alt:'Sid Basa defeats Jannik Sinner in the 2027 Australian Open final.'},
    {event:'ROLAND-GARROS · 2027',name:'S. BASA def. C. ALCARAZ',score:'4–6  6–2  6–3  6–1',src:'assets/sid-rg-2027-vs-alcaraz.png',alt:'Sid Basa defeats Carlos Alcaraz in the 2027 Roland-Garros final.'},
    {event:'WIMBLEDON · 2027',name:'S. BASA def. J. SINNER',score:'6–2  6–4  6–4',src:'assets/sid-wimbledon-2027-vs-sinner.png',alt:'Sid Basa defeats Jannik Sinner in the 2027 Wimbledon final.'},
    {event:'US OPEN · 2027',name:'S. BASA def. N. DJOKOVIC',score:'2–6  6–7(6)  6–3  6–0  6–1',src:'assets/sid-us-open-2027-vs-djokovic.png',alt:'Sid Basa defeats Novak Djokovic in the 2027 US Open final.'}
  ];
  let portalOpen=false,slide=0,track=0,audioContext=null,analyser=null,sourceNode=null,animationFrame=0,quoteTimer=0,sidBusy=false,returnFocus=null,touchStart=0;
  const music=new Audio(),gong=new Audio('assets/gong.mp3');music.loop=true;music.preload='metadata';music.volume=.55;gong.preload='auto';

  const unlocked=()=>sessionStorage.getItem(UNLOCK_KEY)==='1';
  const updateEntry=()=>{const visible=unlocked();entry.classList.toggle('hidden',!visible);homeEntry.classList.toggle('hidden',!visible)};
  const setHash=(value)=>history.replaceState(null,'',location.pathname+location.search+value);
  const transition=(done,copy)=>{
    if(typeof window.runBRTAInterfaceTransition==='function')window.runBRTAInterfaceTransition(done,copy);
    else done();
  };
  function bindSettings(){
    const show=document.querySelector('#showExtrasBtn'),hide=document.querySelector('#hideExtrasBtn');
    if(show)show.onclick=openExtras;
    if(hide)hide.onclick=revokeExtras;
  }
  function openExtras(){
    returnFocus=document.activeElement;extras.classList.remove('hidden');document.body.classList.add('modal-open');password.value='';extrasState.textContent='';extrasState.className='extras-state';setTimeout(()=>password.focus(),0);
  }
  function closeExtras(){
    extras.classList.add('hidden');if(!document.querySelector('.overlay:not(.hidden)'))document.body.classList.remove('modal-open');returnFocus?.focus?.();
  }
  function unlock(){
    sessionStorage.setItem(UNLOCK_KEY,'1');sessionStorage.removeItem(INTRO_KEY);extrasState.textContent='Yep.';extrasState.className='extras-state good';updateEntry();setTimeout(closeExtras,680);
  }
  function revokeExtras(){
    sessionStorage.removeItem(UNLOCK_KEY);sessionStorage.removeItem(VISION_KEY);sessionStorage.removeItem(INTRO_KEY);updateEntry();
    const show=document.querySelector('#showExtrasBtn'),hide=document.querySelector('#hideExtrasBtn');
    show?.classList.remove('hidden');hide?.classList.add('hidden');
  }
  extrasForm.addEventListener('submit',event=>{
    event.preventDefault();
    if(password.value==='SIDBASA')unlock();
    else{extrasState.textContent='Nope.';extrasState.className='extras-state bad';password.select();}
  });
  document.querySelector('#extrasClose').addEventListener('click',closeExtras);
  extras.addEventListener('click',event=>{if(event.target.dataset.extrasClose)closeExtras()});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!extras.classList.contains('hidden'))closeExtras()});

  function portalMarkup(){
    return `<div class="archive-intro" aria-live="polite" aria-atomic="true" hidden><p>ACCESSING ROYAL ARCHIVE…</p></div>
      <div class="archive-utility"><button class="archive-return" type="button" data-archive-return>Return to ratings</button><button class="basa-vision" type="button" data-vision aria-label="Toggle BasaVision" aria-pressed="false">♛</button></div>
      <section class="archive-hero" data-hero><img class="archive-hero-img" src="assets/sid-throne-hero.png" fetchpriority="high" alt="Sid Basa seated on an ornate royal tennis throne."><div class="hero-copy"><div class="archive-kicker">Royal Tennis Archive · 2027</div><h1>SIDDHARTH R. BASA</h1><p>Champion · Monarch · Wielder of the Blade</p></div></section>
      <section class="archive-section"><h2 class="archive-heading">THE ROYAL ARCHIVES</h2><div class="archive-duo"><figure class="archive-image-frame"><img src="assets/sid-federer-handshake.png" loading="lazy" width="1672" height="941" alt="Sid Basa shaking hands with Roger Federer in the royal hall."><figcaption>I. The Handshake</figcaption></figure><figure class="archive-image-frame offset"><img src="assets/sid-federer-kneeling.png" loading="lazy" width="1672" height="941" alt="Sid Basa holding his racket while Federer kneels in the royal hall."><figcaption>II. The Recognition</figcaption></figure></div></section>
      <section class="archive-section" aria-labelledby="winsHeading"><h2 id="winsHeading" class="archive-heading">GREATEST WINS</h2><div class="season-line" aria-label="2027 Grand Slam timeline"><button class="ao" type="button" data-slide-jump="1">Melbourne</button><button class="rg" type="button" data-slide-jump="2">Paris</button><button class="wb" type="button" data-slide-jump="3">London</button><button class="us" type="button" data-slide-jump="4">New York</button></div><div class="wins-carousel" data-carousel tabindex="0" aria-roledescription="carousel" aria-label="Greatest wins"><div class="wins-track">${wins.map((win,index)=>`<article class="win-slide${index===0?' active':''}" data-win-slide="${index}" aria-hidden="${index===0?'false':'true'}"><img data-src="${win.src}" width="1672" height="941" alt="${win.alt}"><div class="win-caption"><small>${win.event}</small><b>${win.name}</b><span>${win.score}</span></div></article>`).join('')}</div><div class="carousel-controls"><button class="carousel-arrow" type="button" data-slide-prev aria-label="Previous win">‹</button><div class="carousel-dots">${wins.map((_,index)=>`<button class="carousel-dot" type="button" data-slide-jump="${index}" aria-label="Show win ${index+1}" aria-current="${index===0?'true':'false'}"></button>`).join('')}</div><button class="carousel-arrow" type="button" data-slide-next aria-label="Next win">›</button></div></div></section>
      <section class="archive-section"><h2 class="archive-heading">THE FOUR CROWNS</h2><div class="crown-cabinet"><article class="crown-item"><small>AO 2027</small><b>Sinner</b><span>6–2  6–0  7–6(4)</span></article><article class="crown-item"><small>RG 2027</small><b>Alcaraz</b><span>4–6  6–2  6–3  6–1</span></article><article class="crown-item"><small>Wimbledon 2027</small><b>Sinner</b><span>6–2  6–4  6–4</span></article><article class="crown-item"><small>US Open 2027</small><b>Djokovic</b><span>2–6  6–7(6)  6–3  6–0  6–1</span></article></div></section>
      <section class="archive-section"><div class="records-layout"><div class="record-strip"><div class="record-stat"><span>2027 SLAMS</span><b>4</b></div><div class="record-stat"><span>SLAM FINALS</span><b>4–0</b></div><div class="record-stat"><span>FINAL SETS LOST</span><b>3</b></div><div class="record-stat"><span>FEDERER HANDSHAKES</span><b>1</b></div><div class="record-stat"><span>AURA</span><b>∞</b></div></div><aside class="h2h"><h3>HEAD-TO-HEAD</h3><ul><li><span>Jannik Sinner</span><b>2–0</b></li><li><span>Carlos Alcaraz</span><b>1–0</b></li><li><span>Novak Djokovic</span><b>1–0</b></li><li class="jayden"><span>Jayden Bone</span><small>6–0  6–0</small><b>1–0</b></li></ul></aside></div></section>
      <section class="archive-section"><div class="armament"><i class="blade-mark" aria-hidden="true"></i><div><h3>ROYAL ARMAMENT</h3><b>Wilson Blade</b><span>Blue / Black</span><span>Status: Wielded</span></div></div><p class="archive-quote" data-archive-quote>“The racket chose him.” — Royal Archive</p></section>
      <section class="archive-plaque"><img src="assets/sid-honour-plaque-transparent.png" loading="lazy" width="2048" height="682" alt="In Honour of Siddharth R. Basa. Champion. Monarch. Wielder of the Blade. The Royal Tennis Archive · Est. 2027."></section>
      <div class="music-dock" aria-label="Archive music controls"><button class="music-play" type="button" data-music-play aria-label="Play music">▶</button><div class="music-meta"><span class="music-title" data-music-title></span><canvas class="spectrum" data-spectrum width="230" height="36" aria-hidden="true"></canvas></div><div class="music-tools"><button type="button" data-music-swap aria-label="Switch track">↺</button><input class="music-volume" data-music-volume type="range" min="0" max="1" value=".55" step=".01" aria-label="Music volume"><button type="button" data-music-mute aria-label="Mute music">◉</button></div></div><button class="sid-effect-button" type="button" data-sid-effect>SID</button>`;
  }
  function renderPortal(){
    if(archive.childElementCount)return;
    archive.innerHTML=portalMarkup();
    archive.querySelector('[data-archive-return]').addEventListener('click',leavePortal);
    archive.querySelector('[data-vision]').addEventListener('click',toggleVision);
    archive.querySelector('[data-slide-prev]').addEventListener('click',()=>setSlide(slide-1));
    archive.querySelector('[data-slide-next]').addEventListener('click',()=>setSlide(slide+1));
    archive.querySelectorAll('[data-slide-jump]').forEach(button=>button.addEventListener('click',()=>setSlide(Number(button.dataset.slideJump))));
    const carousel=archive.querySelector('[data-carousel]');
    carousel.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'){event.preventDefault();setSlide(slide-1)}if(event.key==='ArrowRight'){event.preventDefault();setSlide(slide+1)}});
    carousel.addEventListener('touchstart',event=>{touchStart=event.changedTouches[0].clientX},{passive:true});
    carousel.addEventListener('touchend',event=>{const distance=event.changedTouches[0].clientX-touchStart;if(Math.abs(distance)>42)setSlide(slide+(distance<0?1:-1))},{passive:true});
    archive.querySelector('[data-music-play]').addEventListener('click',toggleMusic);
    archive.querySelector('[data-music-swap]').addEventListener('click',swapTrack);
    archive.querySelector('[data-music-volume]').addEventListener('input',event=>{music.volume=Number(event.target.value);music.muted=false;syncMusic();});
    archive.querySelector('[data-music-mute]').addEventListener('click',()=>{music.muted=!music.muted;syncMusic()});
    archive.querySelector('[data-sid-effect]').addEventListener('click',sidEffect);
    const hero=archive.querySelector('[data-hero]'),heroImage=hero.querySelector('img');
    hero.addEventListener('pointermove',event=>{if(reduced.matches)return;const box=hero.getBoundingClientRect(),x=(event.clientX-box.left)/box.width-.5,y=(event.clientY-box.top)/box.height-.5;heroImage.style.transform=`scale(1.025) translate(${x*6}px,${y*5}px)`});
    hero.addEventListener('pointerleave',()=>{heroImage.style.transform='scale(1.018)'});
    setTrack(0,false);setSlide(0);syncVision();
  }
  function loadSlide(index){const image=archive.querySelector(`[data-win-slide="${index}"] img`);if(image&&!image.getAttribute('src'))image.src=image.dataset.src;}
  function setSlide(next){slide=(next+wins.length)%wins.length;loadSlide(slide);archive.querySelectorAll('[data-win-slide]').forEach((element,index)=>{const active=index===slide;element.classList.toggle('active',active);element.setAttribute('aria-hidden',String(!active))});archive.querySelectorAll('[data-slide-jump]').forEach(button=>{const current=Number(button.dataset.slideJump)===slide;button.setAttribute('aria-current',String(current))});}
  function setTrack(next,shouldPlay){track=(next+tracks.length)%tracks.length;const wasPlaying=!music.paused;music.src=tracks[track].src;music.load();syncMusic();if(shouldPlay||wasPlaying)playMusic();}
  function ensureAnalyser(){
    const AudioContext=window.AudioContext||window.webkitAudioContext;
    if(!AudioContext)return false;
    try{
      if(!audioContext){audioContext=new AudioContext();sourceNode=audioContext.createMediaElementSource(music);analyser=audioContext.createAnalyser();analyser.fftSize=64;sourceNode.connect(analyser);analyser.connect(audioContext.destination);}
      if(audioContext.state==='suspended')audioContext.resume();
      return true;
    }catch{return false}
  }
  function playMusic(){ensureAnalyser();music.play().then(()=>{syncMusic();drawSpectrum()}).catch(()=>syncMusic())}
  function toggleMusic(){if(music.paused)playMusic();else{music.pause();syncMusic();stopSpectrum()}}
  function swapTrack(){setTrack(track+1,true)}
  function syncMusic(){const play=archive.querySelector('[data-music-play]'),title=archive.querySelector('[data-music-title]'),mute=archive.querySelector('[data-music-mute]'),volume=archive.querySelector('[data-music-volume]');if(!play)return;play.textContent=music.paused?'▶':'Ⅱ';play.setAttribute('aria-label',music.paused?'Play music':'Pause music');title.textContent=tracks[track].title;mute.textContent=music.muted||music.volume===0?'○':'◉';mute.setAttribute('aria-label',music.muted?'Unmute music':'Mute music');volume.value=String(music.volume)}
  function stopSpectrum(){cancelAnimationFrame(animationFrame);animationFrame=0;const canvas=archive.querySelector('[data-spectrum]'),context=canvas?.getContext('2d');if(context&&canvas){context.clearRect(0,0,canvas.width,canvas.height);context.strokeStyle='rgba(235,190,91,.38)';context.beginPath();context.moveTo(0,canvas.height/2);context.lineTo(canvas.width,canvas.height/2);context.stroke();}}
  function drawSpectrum(){if(!portalOpen||music.paused||!analyser){stopSpectrum();return}const canvas=archive.querySelector('[data-spectrum]'),context=canvas?.getContext('2d');if(!canvas||!context)return;const bins=new Uint8Array(analyser.frequencyBinCount);const draw=()=>{if(!portalOpen||music.paused)return stopSpectrum();analyser.getByteFrequencyData(bins);context.clearRect(0,0,canvas.width,canvas.height);const width=canvas.width/bins.length;for(let i=0;i<bins.length;i++){const height=Math.max(2,bins[i]/255*canvas.height);context.fillStyle=`rgba(244,${185+i*2},92,${.34+bins[i]/510})`;context.fillRect(i*width,canvas.height-height,width-1,height)}animationFrame=requestAnimationFrame(draw)};cancelAnimationFrame(animationFrame);draw()}
  function toggleVision(){sessionStorage.setItem(VISION_KEY,sessionStorage.getItem(VISION_KEY)==='1'?'0':'1');syncVision()}
  function syncVision(){const on=sessionStorage.getItem(VISION_KEY)==='1';document.body.classList.toggle('basavision',on);const control=archive.querySelector('[data-vision]');if(control)control.setAttribute('aria-pressed',String(on))}
  function beginQuotes(){const quote=archive.querySelector('[data-archive-quote]'),quotes=['“The racket chose him.” — Royal Archive','“Four majors. One year. Suspicious.” — Statistical Department'];let index=0;clearInterval(quoteTimer);quoteTimer=setInterval(()=>{if(!portalOpen||!quote)return;quote.classList.add('fading');setTimeout(()=>{index=(index+1)%quotes.length;quote.textContent=quotes[index];quote.classList.remove('fading')},220)},8500)}
  function showIntro(){const intro=archive.querySelector('.archive-intro');if(sessionStorage.getItem(INTRO_KEY)==='1'||reduced.matches){intro.hidden=true;return}intro.hidden=false;setTimeout(()=>{intro.querySelector('p').textContent='SIDDHARTH R. BASA'},560);setTimeout(()=>{intro.classList.add('leaving');sessionStorage.setItem(INTRO_KEY,'1');setTimeout(()=>{intro.hidden=true;intro.classList.remove('leaving')},470)},1350)}
  function enterPortal(){if(!unlocked())return;returnFocus=document.activeElement;playMusic();transition(()=>{setHash(ROUTE);activatePortal()},{title:'THE GLORIOUS SID BASA PORTAL',message:'Unsealing the Royal Archive…',variant:'royal'})}
  function activatePortal(){if(!unlocked()){setHash('');return}renderPortal();portalOpen=true;document.body.classList.add('portal-active');archive.classList.remove('hidden');archive.setAttribute('aria-hidden','false');document.title='Royal Tennis Archive';showIntro();beginQuotes();syncMusic();if(!music.paused)drawSpectrum();setTimeout(()=>archive.querySelector('[data-archive-return]')?.focus(),0)}
  function leavePortal(){if(!portalOpen)return;transition(()=>{portalOpen=false;music.pause();stopSpectrum();clearInterval(quoteTimer);document.body.classList.remove('portal-active','basavision');archive.classList.add('hidden');archive.setAttribute('aria-hidden','true');setHash('');document.title='BRTA Power Ratings';returnFocus?.focus?.()},{title:'Returning to ratings',message:'Restoring BRTA Power Ratings…'})}
  function sidEffect(){
    if(sidBusy||!portalOpen)return;sidBusy=true;gong.currentTime=0;gong.muted=music.muted;gong.volume=Math.min(.8,Math.max(.08,music.volume));gong.play().catch(()=>{});
    const stage=document.createElement('div');stage.className='sid-rise-stage';stage.setAttribute('aria-hidden','true');
    for(let i=0;i<34;i++){const piece=document.createElement('i');piece.className='royal-confetti';piece.style.setProperty('--x',`${Math.round((Math.random()-.5)*540)}px`);piece.style.setProperty('--y',`${Math.round(-90-Math.random()*320)}px`);piece.style.setProperty('--r',`${Math.round((Math.random()-.5)*880)}deg`);piece.style.setProperty('--confetti-color',i%3===0?'#fff1bd':i%3===1?'#d89d36':'#a27325');stage.appendChild(piece)}
    const figure=document.createElement('img');figure.className='sid-rise-figure';figure.src='assets/sid-royal-rise-transparent.png';figure.alt='';stage.appendChild(figure);document.body.appendChild(stage);if(!reduced.matches)document.body.classList.add('royal-shake');setTimeout(()=>document.body.classList.remove('royal-shake'),360);setTimeout(()=>{stage.remove();sidBusy=false},reduced.matches?760:2500);
  }
  entry.addEventListener('click',enterPortal);homeButton.addEventListener('click',enterPortal);
  window.addEventListener('hashchange',()=>{if(location.hash===ROUTE){if(unlocked()&&!portalOpen)activatePortal();else if(!unlocked())setHash('')}else if(portalOpen)leavePortal()});
  window.SidPortal={bindSettings,open:enterPortal,isUnlocked:unlocked,locked:()=>!unlocked()};
  updateEntry();bindSettings();
  if(location.hash===ROUTE){if(unlocked())activatePortal();else setHash('')}
})();
