(() => {
  'use strict';
  const M = window.BRTARacquetModel;
  const key = 'brta-racquet-club-v1';
  const sections = ['Spin','Key Vault','Collection','Inventory','Equipment','Accessory Shop','Fuel Station','Statistics','Settings'];
  const navIcons = ['▷','⚿','▦','▤','⊙','◇','＋','◫','⚙'];
  const defaults = {effective:true,base:true,confirmFuel:true,confirmReplace:true,cinematics:true,minTier:3,quiet:false,master:0,roll:50,reveal:65,interface:25,compact:false,motion:false,contrast:false,boosts:true,stage:true};
  const icons = ['◉', '▧', '⊙', '✦'];
  const $ = selector => document.querySelector(selector);
  const number = value => new Intl.NumberFormat('en-AU').format(value);
  const cash = value => '$' + number(value);
  const percent = p => (p * 100).toPrecision(4) + '%';
  const ratio = n => Number(n.toFixed(3)) + '×';
  const known = r => r.tier < 2 || !!state.items[r.id]?.pulled;
  const obtained = () => Object.values(state.items).reduce((sum,item)=>sum+item.pulled,0);
  const keyCount = tier => state.keys.filter(key=>key.tier===tier).length;
  const date = time => new Date(time).toLocaleDateString('en-AU');
  const extras = () => auxiliaryEnabled();
  const openButton = document.createElement('button');
  openButton.type = 'button';
  openButton.className = 'button secondary rc-entry';
  openButton.hidden = true;
  openButton.setAttribute('aria-haspopup', 'dialog');
  $('.header-actions')?.append(openButton);

  let state = read(), dialog, panel = 'Spin', selected = 0, animation, busy = false, saving = false;
  let filter = 'all', sort = 'high', query = '', confirmId = 0, actionMessage = '';
  let mode = 'club', toastTimer, spinVersion = 0, fuelConfirmation = '', inventoryView = 'Racquets';
  let shopSlot = 0, gearSlot = 0, gearId = '', fuelTab = 'Buy', recipeId = 'match', settingsTab = 'Rolling';
  let keySelection = 0, presentation = null, menu = false, resultVisible = true, confirmFuel = '', audio;
  const scrollPositions = new Map();
  const pref = name => state.presentation?.[name] ?? defaults[name];
  const reduced = () => motion.matches || pref('motion') || document.documentElement.dataset.animation === 'off';
  const animateRoll = () => !state.skip && !reduced();
  let inventoryFilter = 'all', inventoryQuery = '';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const enabled = () => extras() && state.enabled;

  function read() {
    try { return {...M.initial(), ...JSON.parse(localStorage.getItem(key))}; }
    catch { return M.initial(); }
  }

  // Re-read under an origin-wide lock so tabs can't spend the same balance.
  async function update(fn, requireEnabled = true) {
    const apply = () => {
      const draft = read();
      if (!extras() || (requireEnabled && !draft.enabled)) return null;
      const result = fn(draft);
      if (!result) return null;
      localStorage.setItem(key, JSON.stringify(draft));
      state = draft;
      sync();
      return result;
    };
    try { return navigator.locks?.request ? await navigator.locks.request(key, apply) : apply(); }
    catch {
      notify('Racquet Club progress could not be saved.');
      return null;
    }
  }

  function sync() {
    openButton.hidden = !enabled();
    openButton.textContent = enabled() ? '🎾 Racquet Club · ' + number(state.balls) : '';
    const more = $('#moreSettingsEntry');
    if (more && !$('#racquetClubSettings')) {
      more.insertAdjacentHTML('afterend', '<div id="racquetClubSettings" class="settings-group settings-wide" hidden><button type="button" class="button secondary" data-rc-settings aria-haspopup="dialog">Gamify the Site</button></div>');
    }
    const settings = $('#racquetClubSettings');
    if (settings) settings.hidden = !extras();
    if (dialog?.open && (!extras() || (mode === 'club' && !enabled()))) dialog.close();
    const balance = dialog?.querySelector('[data-rc-balance]');
    if(balance) {
      const message=number(state.balls)+' 🎾 · '+cash(state.cash)+' Club Cash';
      if(balance.textContent!==message){
        balance.textContent=message;
        if(!reduced()&&!pref('quiet')) balance.animate?.([{opacity:.6},{opacity:1}],{duration:260});
      }
    }
  }

  function notify(message) {
    let status = $('#racquetClubStatus');
    if (!status) {
      status = document.createElement('div');
      status.id = 'racquetClubStatus';
      status.setAttribute('role', 'status');
      document.body.append(status);
    }
    status.textContent = message;
    status.classList.add('rc-notify');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => status.classList.remove('rc-notify'), 1800);
  }

  async function earn(action, target) {
    if (!enabled() || !target) return;
    const amount = await update(s => M.reward(s, action, target, Date.now()));
    if (amount) {
      notify('+' + amount + ' 🎾');
      if (dialog?.open && !busy && !saving) draw();
    }
  }

  function ensureDialog() {
    if (dialog) return;
    dialog = document.createElement('dialog');
    dialog.className = 'rc-dialog';
    dialog.setAttribute('aria-labelledby', 'racquetClubTitle');
    dialog.addEventListener('click', click);
    dialog.addEventListener('change', change);
    dialog.addEventListener('input', event => {
      const input = event.target;
      if (!input.matches('[data-rc-search]')) return;
      const start = input.selectionStart, end = input.selectionEnd;
      query = input.value;
      draw();
      dialog.querySelector('[data-rc-search]').setSelectionRange(start,end);
    });
    dialog.addEventListener('cancel', event => {
      if (presentation || menu || keySelection || (panel === 'Collection' && selected)) {
        event.preventDefault();
        presentation = null; menu = false; keySelection = 0; selected = 0;
        cancelSpinPresentation(); draw();
      }
    });
    dialog.addEventListener('close', () => {
      presentation = null; keySelection = 0; menu = false;
      cancelSpinPresentation();
      confirmId = 0;
      fuelConfirmation = '';
      actionMessage = '';
    });
    document.body.append(dialog);
  }

  function cancelSpinPresentation() {
    spinVersion++;
    animation?.cancel();
    animation = null;
    busy = false;
  }

  function show(nextMode) {
    if (!extras() || (nextMode === 'club' && !enabled())) return;
    ensureDialog();
    mode = nextMode;
    if (!dialog.open) dialog.showModal();
    draw();
    dialog.querySelector('[data-rc-close]')?.focus();
  }

  function art(r) {
    const paint = (r.id * 43) % 360;
    return '<svg class="rc-racquet-art" viewBox="0 0 120 265" aria-hidden="true" style="--paint:'+paint+'">' +
      '<path class="rc-frame-shadow" d="M60 8C29 8 9 31 9 67c0 49 20 71 42 83l5 35h8l5-35c22-12 42-34 42-83C111 31 91 8 60 8Z"/>' +
      '<path class="rc-frame" d="M60 8C29 8 9 31 9 67c0 49 20 71 42 83l5 35h8l5-35c22-12 42-34 42-83C111 31 91 8 60 8Z"/>' +
      '<path class="rc-bed" d="M60 18C36 18 20 38 20 67c0 35 17 62 40 65 23-3 40-30 40-65C100 38 84 18 60 18Z"/>' +
      '<path class="rc-strings" d="M31 38v69M41 24v96M51 20v108M61 18v113M71 20v108M81 25v93M91 39v65M30 37h60M24 47h72M21 57h78M20 67h80M21 77h78M23 87h74M26 97h68M30 107h60M38 117h44"/>' +
      '<path class="rc-shine" d="M18 59C20 35 35 16 55 15M101 83c-5 22-17 41-30 51M51 143l9 30 9-30"/>' +
      '<path class="rc-grip" d="M49 182h22l3 70H46Z"/><path class="rc-wrap" d="M50 194l20 5m-20 4 20 5m-21 4 22 5m-22 4 22 5m-23 4 24 5m-24 4 24 5"/><path class="rc-cap" d="M44 249h32v9H44Z"/></svg>';
  }

  function keyArt(tier) {
    return '<svg class="rc-key-art rc-tier-'+tier+'" viewBox="0 0 140 140" aria-hidden="true"><path d="M36 22 60 12 84 22 94 46 84 70 73 75 73 112 64 121 55 112 55 103 63 95 55 87 55 77 36 70 26 46Z" class="rc-key-metal"/><path d="M60 26 76 36 76 55 60 65 44 55 44 36Z" class="rc-key-cut"/><path d="M60 26v39m-16-29 32 19m0-19L44 55m20 25v9" class="rc-key-line"/><path d="M94 79v22m-11-11h22M109 106v12m-6-6h12" class="rc-key-line"/></svg>';
  }

  function sound(kind) {
    const level = pref('master') * pref(kind) / 10000;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!level || !Context) return;
    try {
      audio ||= new Context();
      if(audio.state==='suspended') audio.resume().catch(()=>{});
      const start=audio.currentTime, note=audio.createOscillator(), gain=audio.createGain();
      note.type='sine'; note.frequency.setValueAtTime(kind==='reveal'?470:kind==='roll'?260:380,start);
      note.frequency.exponentialRampToValueAtTime(kind==='reveal'?940:310,start+.13);
      gain.gain.setValueAtTime(.13*level,start); gain.gain.exponentialRampToValueAtTime(.001,start+.24);
      note.connect(gain).connect(audio.destination); note.start(start); note.stop(start+.25);
    } catch {}
  }

  const label = r => r.name + (r.parent ? ' ✦' : '');
  const baseOdds = r => r.denominator ? '1 in ' + number(r.denominator) : percent(r.base);
  const tile = (r, content) => '<article class="rc-card rc-tier-' + r.tier + '">' + content + '</article>';
  const badge = r => '<span class="rc-badge">' + r.rarity + (r.parent ? ' · Variant' : '') + '</span>';
  const discovered = () => M.racquets.filter(r => state.items[r.id]?.pulled);
  const rarest = () => discovered().at(-1);
  const gearSummary = e => '<dl class="rc-stats"><div><dt>Luck</dt><dd>' + ratio(e.luck) +
    '</dd></div><div><dt>Spin time</dt><dd>' + e.duration.toFixed(1) +
    ' s</dd></div><div><dt>Tenth spin</dt><dd>' + ratio(e.bonus) +
    '</dd></div><div><dt>Mutation weight</dt><dd>+' + Math.round((e.mutation - 1) * 100) +
    '%</dd></div><div><dt>Selling bonus</dt><dd>+' + Math.round((e.sale - 1) * 100) + '%</dd></div><div><dt>Ball earnings</dt><dd>+' + e.balls + '%</dd></div></dl>';

  function draw() {
    const oldFocus = document.activeElement;
    const focusKey = oldFocus?.dataset.rcFocus;
    const scroll = dialog.querySelector('.rc-body')?.scrollTop || 0;
    const title = mode === 'club' ? 'Racquet Club' : 'Gamify the Site';
    dialog.dataset.mode = mode;
    dialog.dataset.panel = panel;
    dialog.classList.toggle('rc-compact',pref('compact'));
    dialog.classList.toggle('rc-contrast',pref('contrast'));
    dialog.classList.toggle('rc-reduced',reduced()||pref('quiet'));
    dialog.classList.toggle('rc-wide-stage',pref('stage'));
    const stats = M.next(state);
    const info = mode==='club' ? '<div class="rc-top-stats"><strong data-rc-balance>'+number(state.balls)+' 🎾 · '+cash(state.cash)+' Club Cash</strong>' +
      '<span data-rc-top-luck>'+ratio(stats.effectiveLuck)+' luck</span><span data-rc-top-boosts title="Active fuel boosts">'+stats.boosts.length+' boosts</span>' +
      '<button class="button secondary rc-icon-button" data-rc-tab="Settings" data-rc-focus="settings" aria-label="Racquet Club settings">⚙</button></div>' : '';
    const header = '<header class="rc-header"><div class="rc-brand"><button class="button secondary" data-rc-close data-rc-focus="close">'+
      (mode==='club'?'← Back to BRTA':'Close')+'</button><span class="rc-brand-mark" aria-hidden="true">◉</span><h2 id="racquetClubTitle">'+title+'</h2></div>'+info+'</header>';
    const navButton = (tab, i, name = tab) => '<button type="button" data-rc-tab="'+tab+'" data-rc-focus="tab-'+tab+
      '" aria-current="'+(tab===panel?'page':'false')+'"><span aria-hidden="true">'+navIcons[i]+'</span><b>'+name+'</b>'+
      (tab==='Key Vault'&&state.keys.length?'<small>'+state.keys.length+'</small>':'')+'</button>';
    const desktopNav = '<nav class="rc-tabs" aria-label="Racquet Club sections">'+sections.map((tab,i)=>navButton(tab,i,
      tab==='Spin'?'Roll':tab==='Accessory Shop'?'Shop':tab)).join('')+'</nav>';
    const mobileNav = '<nav class="rc-mobile" aria-label="Mobile sections">'+navButton('Spin',0,'Roll')+navButton('Key Vault',1,'Keys')+
      navButton('Collection',2)+'<button data-rc-menu aria-expanded="'+menu+'"><span aria-hidden="true">☰</span><b>Menu</b></button></nav>';
    const extraMenu = menu ? '<nav class="rc-mobile-menu" aria-label="More Racquet Club sections">'+
      sections.slice(3).map(tab=>navButton(tab,sections.indexOf(tab))).join('')+'</nav>' : '';
    dialog.innerHTML = header + (mode === 'settings' ? '<div class="rc-body rc-settings">' +
      '<label><input type="checkbox" data-rc-enable data-rc-focus="enable"' + (state.enabled ? ' checked' : '') +
      '> Enable Gamify the Site</label><p>Earn Tennis Balls while using BRTA Power Ratings. Spin for racquets and trade duplicates for Club Cash.</p>' +
      '<p>Progress is saved in this browser. Club Cash is fictional.</p>' + (enabled() ?
        '<button class="button primary" data-rc-open data-rc-focus="open">Open Racquet Club</button>' : '') + '</div>' :
      '<div class="rc-shell"'+(presentation?' inert':'')+'>'+desktopNav+'<div class="rc-body" role="region" aria-label="'+panel+'">' + content() +
      '<p class="rc-message" role="status">' + actionMessage + '</p></div>'+extraMenu+mobileNav+'</div>') + presentationMarkup();
    dialog.querySelector('.rc-header').inert = !!presentation;
    dialog.querySelector('.rc-body').scrollTop = scroll;
    const search = dialog.querySelector('[data-rc-search]');
    if (search) search.value = query;
    if (focusKey) [...dialog.querySelectorAll('[data-rc-focus]')].find(el => el.dataset.rcFocus === focusKey)?.focus({preventScroll:true});
  }

  function content() {
    if (panel === 'Spin') return spinPanel();
    if (panel === 'Key Vault') return keySelection ? keyOpening() : keyPanel();
    if (panel === 'Settings') return settingsPanel();
    if (panel === 'Fuel Station') return fuelPanel();
    if (panel === 'Inventory') {
      const tabs = ['Racquets','Keys','Consumables'].map(label=>'<button class="button secondary" data-rc-inventory="' +
        label + '" aria-pressed="' + (inventoryView===label) + '">' + label + '</button>').join('');
      return '<nav class="rc-actions" aria-label="Inventory categories">' + tabs + '</nav>' +
        (inventoryView==='Keys'?keyPanel(false):inventoryView==='Consumables'?activePanel()+fuelInventory():racquetPanel(false));
    }
    if (panel === 'Equipment' || panel === 'Accessory Shop') return gearPanel();
    if (panel === 'Statistics') return statsPanel();
    return racquetPanel(panel === 'Collection');
  }

  function spinPanel() {
    const setup = M.next(state);
    return '<section class="rc-spin"><div class="rc-stage-top"><div><p class="kicker">Racquet roulette</p><h3>Roll</h3></div>'+
      '<button class="button secondary" data-rc-tab="Key Vault">Key Vault'+(state.keys.length?' · '+state.keys.length:'')+'</button></div>'+
      '<div class="rc-roll-meta"><p data-rc-luck>'+luckText(setup)+'</p>'+(pref('boosts')?'<div data-rc-active>'+activeMarkup()+'</div>':'')+'</div>'+
      '<div class="rc-roulette" aria-label="Racquet roulette"><div class="rc-reel" aria-hidden="true"><div class="rc-track">'+
      (state.last && !busy ? [{id:3,tier:0},state.last,{id:17,tier:1}] :
        [{id:3,tier:0},{id:10,tier:0},{tier:2,key:true},{id:17,tier:1},{tier:4,key:true}]).map(entry=>wheelCard(entry)).join('')+
      '</div></div></div><div class="rc-roll-controls"><div class="rc-progress">'+spinProgress(setup)+'</div>'+
      '<div class="rc-spin-actions"><button class="button primary rc-spin-button'+(setup.bonusSpin?' rc-bonus':'')+
      '" data-rc-spin data-rc-focus="spin"'+(!state.balls||busy?' disabled':'')+'>Spin · 1 🎾</button>'+
      '<button class="button secondary" data-rc-skip hidden>Skip animation</button></div>'+
      (state.last && !busy && resultVisible ? resultCard(state.last) : '<p class="rc-spin-note">'+
        (state.balls?'':'Explore BRTA Power Ratings to earn Tennis Balls.')+'</p>')+'</div></section>';
  }

  function spinProgress(setup) {
    const progress = state.spins % M.config.bonusEvery;
    return '<span>' + number(state.spins) + ' spins completed</span><strong>' +
      (setup.bonusSpin ? 'Bonus spin ready · ' + ratio(setup.effectiveLuck) + ' effective luck' : 'Bonus spin · ' + progress + '/10') +
      '</strong><progress aria-label="Tenth-spin progress" value="' + progress + '" max="10"></progress>';
  }

  function wheelCard(entry, hidden = false) {
    if (hidden) return '<span class="rc-wheel-card rc-unknown"><strong>?</strong></span>';
    if (entry.key) return '<span class="rc-wheel-card rc-tier-' + entry.tier + '">' + keyArt(entry.tier) + '<b>' + M.keyName(entry.tier) + '</b></span>';
    const r = M.racquet(entry.id);
    return '<span class="rc-wheel-card rc-tier-' + r.tier + '">' + art(r) + '<b>' + label(r) + '</b></span>';
  }

  function resultCard(last, redemption = false) {
    const r = last.key ? null : M.racquet(last.id);
    const tier = last.key ? last.tier : r.tier;
    return '<div class="rc-result rc-tier-'+tier+'" role="status">'+(last.key?keyArt(tier):art(r))+
      '<div>'+(r?badge(r):'')+'<strong>'+(r?label(r):M.keyName(tier))+'</strong>'+
      '<span>'+(pref('effective')?percent(last.odds)+(redemption?' inside this key':' on this spin'):'')+
      (r&&pref('base')?' · Base '+baseOdds(r):'')+(last.new?' · New discovery':'')+
      (last.bonusSpin?' · Bonus spin':'')+'</span><div class="rc-actions">'+
      (last.key?'<button class="button secondary" data-rc-tab="Key Vault">Open Key Vault</button>':
        '<button class="button secondary" data-rc-tab="Inventory">View Inventory</button>')+
      '<button class="button secondary" '+(redemption?'data-rc-key-back':'data-rc-continue')+'>Continue</button></div></div></div>';
  }

  function keyPanel(openable = true) {
    const weights = M.wheel(M.probabilities());
    return '<div class="rc-page-head"><p class="kicker">Racquet keys</p><h3>'+(openable?'Key Vault':'Key inventory')+'</h3></div>'+
      '<div class="rc-key-grid">' + M.keyTiers.map(tier => {
        const key = state.keys.find(item=>item.tier===tier);
        return '<article class="rc-card rc-gear rc-tier-' + tier + (key?'':' rc-unavailable')+'">' + keyArt(tier) +
          '<h3>'+M.keyName(tier)+'</h3><p>'+keyCount(tier)+' owned'+(pref('base')?' · '+percent(weights.find(item=>item.key&&item.tier===tier).weight)+' base drop rate':'')+'</p>'+
          '<button class="button secondary" data-rc-key-select="'+(key?.id||0)+'"'+(!key?' disabled':'')+'>Open Key</button></article>';
      }).join('')+'</div>';
  }

  function keyOpening() {
    const key=state.keys.find(item=>item.id===keySelection);
    const last=keySelection===-1?state.lastKey:null;
    const tier=key?.tier??last?.tier;
    if (tier==null) return keyPanel();
    return '<section class="rc-spin rc-key-opening rc-tier-'+tier+'"><div class="rc-stage-top"><div><p class="kicker">Key Vault</p><h3>'+M.keyName(tier)+'</h3></div>'+
      '<button class="button secondary" data-rc-key-back>← Key Vault</button></div>'+
      '<div class="rc-roulette"><div class="rc-reel rc-key-reel rc-tier-'+tier+'" aria-hidden="true"><div class="rc-track">'+
      Array.from({length:5},()=>wheelCard({},true)).join('')+'</div></div></div><div class="rc-roll-controls"><div class="rc-key-controls">'+
      keyArt(tier)+(key?'<button class="button primary rc-spin-button" data-rc-redeem="'+key.id+'"'+(busy?' disabled':'')+'>Open Key · Free</button>':'')+
      '<button class="button secondary" data-rc-skip hidden>Skip animation</button></div>'+
      (last&&!busy?resultCard(last,true):'<p class="rc-spin-note">A guaranteed '+M.tiers[tier][0]+' racquet. This key keeps its original odds.</p>')+'</div></section>';
  }

  function presentationMarkup() {
    if (!presentation) return '';
    const {id, kind} = presentation, r = M.racquet(id);
    const cinema = kind === 'reveal';
    const animation = cinema && pref('cinematics') && r.tier >= pref('minTier') && !reduced() && !pref('quiet');
    return '<section role="region" aria-label="'+(cinema?'Racquet reveal':'Racquet showcase')+'" class="rc-presentation rc-tier-'+r.tier+
      (animation?' rc-cinematic':'')+(r.id===60?' rc-regna':r.id===59?' rc-hof':r.id===51?' rc-espresso':'')+'">'+
      '<button class="button secondary rc-exit-presentation" data-rc-presentation-close>'+ (cinema?'Skip reveal':'Exit showcase')+'</button>'+
      '<div class="rc-presentation-art">'+art(r)+'</div><div class="rc-presentation-copy"><p class="kicker">'+r.rarity+
      (presentation.new?' · New discovery':'')+'</p><h3>'+label(r)+'</h3><p>'+r.brand+(pref('base')?' · '+baseOdds(r):'')+
      '</p><button class="button primary" data-rc-presentation-close>Continue</button></div></section>';
  }

  function showPresentation(id,kind,fresh=false) {
    presentation={id,kind,new:fresh};
    draw();
    dialog.querySelector('.rc-exit-presentation')?.focus();
    if(kind==='reveal'&&!reduced())sound('reveal');
  }

  function luckText(setup) {
    return 'Upcoming spin luck <strong>' + ratio(setup.effectiveLuck) + '</strong>' +
      (setup.uncappedLuck > setup.effectiveLuck ? ' · Capped from ' + ratio(setup.uncappedLuck) : '') +
      ' · Equipment ' + ratio(setup.gearLuck) + (setup.bonusSpin ? ' · Tenth spin ' + ratio(setup.bonus) : '') +
      (setup.boosts.some(b=>b.effect.luck) ? ' · Fuel ' + ratio(setup.boosts.find(b=>b.effect.luck).effect.luck) : '');
  }

  function fuelEffect(item) {
    const e = item.effect;
    const bonus = [e.luck ? ratio(e.luck) + ' luck' : '', e.mutation ? '+' + Math.round((e.mutation-1)*100) + '% mutation weight' : '',
      e.balls ? '+' + e.balls + '% Tennis Balls' : '', e.sale ? '+' + Math.round((e.sale-1)*100) + '% selling cash' : ''].filter(Boolean).join(' · ');
    const duration = item.minutes ? item.minutes + ' min' : item.slot === 'sale' ? item.charges + ' sales' : item.charges === 1 ? 'Next spin' : item.charges + ' spins';
    return bonus + ' · ' + duration;
  }

  function activeMarkup() {
    const now = Date.now(), boosts = M.activeBoosts(state,now);
    return boosts.length ? '<h3>Active boosts</h3><ul class="rc-boosts">' + boosts.map(b => {
      const seconds = b.expires ? Math.ceil((b.expires-now)/1000) : 0;
      const remaining = b.expires ? Math.floor(seconds/60) + 'm ' + seconds % 60 + 's' :
        b.slot === 'sale' ? b.remaining + ' sales' : b.remaining === 1 ? 'Next spin' : b.remaining + ' spins';
      return '<li><strong>' + b.name + '</strong> · ' + fuelEffect(b).split(' · ').slice(0,-1).join(' · ') + ' · ' + remaining + '</li>';
    }).join('') + '</ul>' : '<p>No active fuel boosts.</p>';
  }

  function activePanel() { return '<div data-rc-active>' + activeMarkup() + '</div>'; }

  function fuelInventory() {
    const owned = M.fuel.filter(item=>state.fuel[item.id] > 0);
    return '<h3>Consumables</h3>' + (owned.length ? '<div class="rc-gear-grid">' + owned.map(item=>
      '<article class="rc-card rc-gear"><h3>🍌 ' + item.name + ' × ' + state.fuel[item.id] + '</h3><p>' +
      fuelEffect(item) + '</p><button class="button secondary" data-rc-use="' + item.id + '">' +
      (fuelConfirmation.startsWith(item.id+':')?'Confirm replacement':confirmFuel===item.id?'Confirm':'Activate') + '</button></article>').join('') + '</div>' : '<p>No consumables owned.</p>');
  }

  function subnav(items,current,attr) {
    return '<nav class="rc-subnav">'+items.map(([value,title])=>'<button class="button secondary" '+attr+'="'+value+
      '" aria-pressed="'+(value===current)+'">'+title+'</button>').join('')+'</nav>';
  }

  function fuelPanel() {
    const tabs=subnav(['Buy','Craft','Active Boosts'].map(n=>[n,n]),fuelTab,'data-rc-fuel-tab');
    const head='<div class="rc-page-head"><p class="kicker">Performance & hydration</p><h3>Fuel Station</h3></div>'+tabs;
    if(fuelTab==='Active Boosts') return head+activePanel()+fuelInventory();
    if(fuelTab==='Buy') return head+'<div class="rc-gear-grid">'+M.fuel.map(item=>
      '<article class="rc-card rc-product"><div class="rc-product-art" aria-hidden="true">'+(item.minutes?'◒':item.slot==='sale'?'◉':'ϟ')+
      '</div><h3>'+item.name+'</h3><p>'+fuelEffect(item)+'</p><p>'+(state.fuel[item.id]||0)+' owned</p>'+
      '<button class="button primary" data-rc-fuel="'+item.id+'"'+(state.cash<item.price?' disabled':'')+'>Buy · '+cash(item.price)+'</button></article>').join('')+'</div>';
    const item=M.fuelItem(recipeId), recipe=M.recipes[recipeId];
    const ingredients=Object.entries(recipe.ingredients);
    const craftable=state.cash>=recipe.fee&&ingredients.every(([id,n])=>(state.fuel[id]||0)>=n);
    const requirement=(name,have,need)=>'<div class="rc-requirement'+(have>=need?' rc-complete':'')+'"><strong>'+name+'</strong><span>'+
      number(Math.min(have,need))+' / '+number(need)+'</span><progress aria-label="'+name+'" value="'+Math.min(have,need)+'" max="'+need+'"></progress></div>';
    return head+'<div class="rc-workspace"><aside class="rc-recipe-list">'+
      subnav(Object.keys(M.recipes).map(id=>[id,M.fuelItem(id).name]),recipeId,'data-rc-recipe')+
      '</aside><section class="rc-card rc-work-detail"><h3>Ingredients</h3>'+ingredients.map(([id,n])=>requirement(M.fuelItem(id).name,state.fuel[id]||0,n)).join('')+
      requirement('Club Cash',state.cash,recipe.fee)+'</section><section class="rc-card rc-product"><div class="rc-product-art" aria-hidden="true">ϟ</div><h3>'+
      item.name+'</h3><p>'+fuelEffect(item)+'</p><button class="button primary" data-rc-craft="'+item.id+'"'+(craftable?'':' disabled')+'>Craft</button></section></div>';
  }

  function settingsPanel() {
    const tabs=['Rolling','Animations','Audio','Display'];
    const box=(id,title)=>'<label><span>'+title+'</span><input type="checkbox" data-rc-pref="'+id+'"'+(pref(id)?' checked':'')+'></label>';
    const range=(id,title)=>'<label><span>'+title+' · '+pref(id)+'%</span><input type="range" min="0" max="100" step="5" data-rc-pref="'+id+'" value="'+pref(id)+'"></label>';
    const parts={
      Rolling:box('effective','Show effective odds')+box('base','Show base odds')+box('confirmFuel','Confirm before activating expensive fuel')+
        box('confirmReplace','Confirm boost replacement')+'<p>Every tenth paid spin uses your bonus multiplier. Key openings do not advance it.</p>',
      Animations:box('cinematics','Play reveal cinematics')+box('quiet','Reduce particle and lighting effects')+
        '<label><span>Minimum cinematic rarity</span><select data-rc-pref="minTier">'+M.tiers.slice(3).map(([tier],i)=>
          '<option value="'+(i+3)+'"'+(pref('minTier')===i+3?' selected':'')+'>'+tier+'</option>').join('')+
        '</select></label><label><span>Skip ordinary roll animations</span><input type="checkbox" data-rc-motion'+(state.skip?' checked':'')+'></label>'+
        '<p>Replay Epic or higher reveals from a discovered racquet’s detail screen.</p>',
      Audio:range('master','Master volume')+range('roll','Roulette volume')+range('reveal','Reveal volume')+range('interface','Interface volume'),
      Display:box('compact','Compact inventory')+box('motion','Reduced motion')+box('contrast','High contrast')+box('boosts','Show active boosts on Roll')+box('stage','Expanded roulette stage'),
    };
    return '<div class="rc-page-head"><p class="kicker">Racquet Club</p><h3>Settings</h3></div>'+subnav(tabs.map(t=>[t,t]),settingsTab,'data-rc-settings-tab')+
      '<div class="rc-card rc-preferences">'+parts[settingsTab]+'</div>';
  }

  function random() {
    return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
  }

  async function spin(keyId = 0) {
    if (busy || (!keyId && !state.balls)) return;
    const version = ++spinVersion;
    busy = true;
    const redemption = !!keyId, targetPanel = redemption ? 'Key Vault' : 'Spin';
    let oldKey;
    const priorKnown = new Set(M.racquets.filter(known).map(r=>r.id));
    const last = await update(s => {
      if (!redemption) return M.spin(s,random(),Date.now());
      oldKey = s.keys.find(key=>key.id===keyId);
      return M.redeem(s,keyId,random(),Date.now());
    });
    if (version !== spinVersion) return;
    if (!last || !dialog.open || mode !== 'club' || panel !== targetPanel) { busy = false; if (dialog.open) draw(); return; }
    if (redemption) keySelection=-1;
    resultVisible=true;
    draw();
    let skip = !animateRoll();
    if(!skip)sound('roll');
    const reel = dialog.querySelector('.rc-reel');
    if (!redemption) dialog.querySelector('[data-rc-spin]').classList.toggle('rc-bonus', last.bonusSpin);
    reel.hidden = false;
    reel.closest('.rc-roulette')?.classList.add('rc-rolling');
    if (redemption) reel.classList.add('rc-key-reel','rc-tier-' + last.tier);
    const track = reel.querySelector('.rc-track');
    try {
      if (!skip && track.animate) {
        // Independent filler draws. The recorded result is always the final card.
        const weights = redemption ? oldKey.weights : M.wheel(M.probabilities(last.effectiveLuck,last.mutation));
        const final = last;
        track.innerHTML = Array.from({length:29}, () => {
          const entry = M.select(weights,random());
          return wheelCard(entry,redemption&&!priorKnown.has(entry.id));
        }).join('') + wheelCard(final,redemption&&!priorKnown.has(last.id));
        reel.classList.toggle('rc-titanium', last.titanium);
        const finalCard = track.lastElementChild;
        const x = finalCard.offsetLeft + finalCard.offsetWidth / 2 - reel.clientWidth / 2;
        dialog.querySelector('[data-rc-skip]').hidden = false;
        animation = track.animate([{transform:'translateX(0)'}, {transform:'translateX(' + -x + 'px)'}],
          {duration:last.duration * 1000, easing:'cubic-bezier(.10,.72,.18,1)', fill:'forwards'});
        await animation.finished;
        skip ||= reel.hasAttribute('data-skipped');
        track.style.left = '0';
        track.style.transform = 'translateX(' + -x + 'px)';
      }
      if (dialog.open && mode === 'club' && panel === targetPanel && dialog.contains(reel)) {
        const reveal = !skip && animateRoll();
        reel.closest('.rc-roulette')?.classList.remove('rc-rolling');
        track.lastElementChild?.classList.add('rc-landed');
        busy = false;
        if (redemption) {
          if(!reduced() && pref('cinematics') && last.tier>=pref('minTier') && (reveal || state.skip && !reel.hasAttribute('data-skipped'))) showPresentation(last.id,'reveal',last.new);
          else {
            draw();
            if(!skip) dialog.querySelector('.rc-roulette .rc-reel').replaceWith(reel);
            dialog.querySelector('[data-rc-key-back]')?.focus();
          }
        } else {
          if(skip) {
            track.innerHTML=wheelCard({id:3,tier:0})+wheelCard(last)+wheelCard({id:17,tier:1});
            track.children[1].classList.add('rc-landed');
          }
          const pending = dialog.querySelector('.rc-spin-note');
          pending?.insertAdjacentHTML('afterend',resultCard(last));
          pending?.remove();
          dialog.querySelector('[data-rc-skip]').hidden = true;
          const button = dialog.querySelector('[data-rc-spin]');
          button.disabled = !state.balls;
          const after = M.next(state);
          dialog.querySelector('.rc-progress').innerHTML = spinProgress(after);
          button.classList.toggle('rc-bonus',after.bonusSpin);
          if (!button.disabled) button.focus({preventScroll:true});
        }
      }
    } catch {
      // Navigating away cancels only the presentation. The award is already saved.
      if (dialog.open && dialog.contains(reel)) { busy = false; draw(); }
    } finally { if (version === spinVersion) { animation = null; busy = false; } }
  }

  function racquetPanel(collection) {
    const found = discovered();
    const list = M.racquets.filter(r => {
      const item = state.items[r.id], visible = !collection || known(r);
      return (collection ? visible : item?.count > 0) && (filter === 'all' || filter === String(r.tier) ||
        filter === 'mutations' && r.parent || filter === 'duplicates' && item?.count > 1) &&
        (!query || visible && (r.name + ' ' + r.brand).toLowerCase().includes(query.trim().toLowerCase()));
    });
    const orders = {
      high:(a,b)=>b.id-a.id, low:(a,b)=>a.id-b.id, alpha:(a,b)=>a.name.localeCompare(b.name),
      brand:(a,b)=>a.brand.localeCompare(b.brand)||a.name.localeCompare(b.name),
      value:(a,b)=>M.sellValue(state,b.id)-M.sellValue(state,a.id),
      recent:(a,b)=>(state.items[b.id]?.last||0)-(state.items[a.id]?.last||0),
      quantity:(a,b)=>(state.items[b.id]?.count||0)-(state.items[a.id]?.count||0)
    };
    if (!collection) list.sort(orders[sort]);
    const toolbar = '<div class="rc-tools"><label>Search <input type="search" data-rc-search data-rc-focus="search" placeholder="Racquet or brand"></label><label>Filter <select data-rc-filter data-rc-focus="filter">' +
      [['all','All rarities'], ...M.tiers.flatMap((t,i)=>!collection||M.racquets.some(r=>r.tier===i&&known(r))?[[i,t[0]]]:[]), ['mutations','Mutations'], ...(!collection ? [['duplicates','Duplicates']] : [])]
        .map(([v,n])=>'<option value="' + v + '"' + (String(v) === filter ? ' selected' : '') + '>' + n + '</option>').join('') +
      '</select></label>' + (!collection ? '<label>Sort <select data-rc-sort data-rc-focus="sort">' +
        [['high','Rarity, highest first'],['low','Rarity, lowest first'],['alpha','Alphabetical'],['brand','Brand'],
          ['value','Sell value'],['recent','Recently obtained'],['quantity','Quantity owned']].map(([v,n])=>
          '<option value="' + v + '"' + (v === sort ? ' selected' : '') + '>' + n + '</option>').join('') +
        '</select></label><button class="button secondary" data-rc-duplicates data-rc-focus="duplicates">Sell Duplicates' +
        (duplicateValue() ? ' · ' + cash(duplicateValue()) : '') + '</button>' : '') + '</div>';
    const summary = collection ? '<div class="rc-page-head"><p class="kicker">Collection</p><h3>Racquet gallery</h3></div><div class="rc-collection-summary"><strong>' + found.length + '/60 racquets discovered</strong><progress aria-label="Collection completion" value="' +
      found.length + '" max="60"></progress><p>' + Math.round(found.length / 60 * 100) + '% complete · ' +
      found.filter(r=>r.parent).length + ' mutations · ' + number(obtained()) + ' obtained' +
      (rarest() ? ' · Rarest: ' + label(rarest()) : '') +
      '</p>' + (found.length === 60 ? '<strong class="rc-achievement">✦ Grand Slam Collection</strong>' : '') + '</div>' :
      '<h3>' + Object.values(state.items).reduce((sum,item)=>sum+item.count,0) + ' racquets owned</h3>';
    const cards = list.map(r => {
      const item = state.items[r.id];
      const hint = M.racquets.some(variant=>variant.parent===r.id&&!state.items[variant.id]?.pulled);
      return tile(r, '<button class="rc-item" data-rc-focus="detail-' + r.id + '" data-rc-detail="' + r.id + '">' +
        art(r) + badge(r) + '<strong>' + label(r) + '</strong><span>' + r.brand + (pref('base')?' · '+baseOdds(r):'') + '</span><span>' +
        (item?.first && Date.now()-item.first<86400000 ? 'NEW · ' : '') + (item?.count ? '×' + item.count : item?.pulled ? 'Discovered' : 'Uncollected') +
        (item?.count && !collection ? ' · ' + cash(M.sellValue(state,r.id)) : '') +
        (item?.locked ? ' · Locked' : '') + (state.favourite===r.id?' · Favourite':'') +
        '</span>' + (collection&&hint?'<small>✦ Undiscovered mutation available</small>':'') + '</button>');
    }).join('');
    return summary + toolbar + '<div class="rc-catalog-layout'+(!collection&&selected?' rc-master-detail':'')+'"><div class="rc-grid">' + (cards + (collection && filter==='all' && !query ? '<article class="rc-card rc-item rc-unknown"><strong>?</strong><span>Undiscovered racquet</span></article>'.repeat(M.racquets.filter(r=>!known(r)).length) : '') || '<p>No racquets match these filters.</p>') + '</div>' + (selected ? '<div class="rc-inspector'+(collection?' rc-gallery-detail':'')+'">'+itemDetail(M.racquet(selected))+'</div>' : '')+'</div>';
  }

  function duplicateValue() {
    return M.racquets.reduce((total,r)=>{
      const item = state.items[r.id];
      return total + (item && !item.locked ? Math.max(0,item.count-1) * M.sellValue(state,r.id) : 0);
    },0);
  }

  function itemDetail(r) {
    const item = state.items[r.id] || {count:0}, setup = M.next(state);
    const variants = M.racquets.filter(x => x.parent === r.id && state.items[x.id]?.pulled);
    const undiscovered = M.racquets.some(x=>x.parent===r.id&&!state.items[x.id]?.pulled);
    const links = (r.parent&&known(M.racquet(r.parent))?'<p>Variant of '+M.racquet(r.parent).name+'</p>':'')+
      (undiscovered?'<p>✦ Undiscovered mutation</p>':'')+
      variants.map(v=>'<button class="button secondary" data-rc-detail="'+v.id+'">View '+label(v)+'</button>').join('');
    return tile(r, '<div class="rc-detail">' + art(r) + '<div>' + badge(r) + '<h3>' + label(r) + '</h3><p>' + r.brand +
      (item.first ? ' · Discovered ' + date(item.first) : ' · Uncollected') + ' · ' + item.count + ' owned</p><p>' + (pref('base')?'Base odds '+baseOdds(r):'') +
      (pref('effective')?(r.tier < 2 ? ' · Next spin ' : ' · Per-roll equivalent ') + percent(M.probabilities(setup.effectiveLuck,setup.mutation)[r.id-1]):'') +
      ' · Sell value ' + cash(M.sellValue(state,r.id)) + '</p>' + links +
      '<div class="rc-actions"><button class="button secondary" data-rc-detail="0">Close details</button>'+
      '<button class="button secondary" data-rc-showcase="'+r.id+'">Showcase Mode</button>'+
      (item.pulled&&r.tier>=3?'<button class="button secondary" data-rc-replay="'+r.id+'">Replay reveal</button>':'') +
      (item.count ? '<button class="button secondary" data-rc-focus="lock-' + r.id + '" data-rc-lock="' + r.id + '">' + (item.locked ? 'Unlock' : 'Lock') + '</button>' +
      '<button class="button secondary" data-rc-focus="favourite-' + r.id + '" data-rc-favourite="' + r.id + '">' + (state.favourite === r.id ? 'Remove favourite' : 'Favourite') + '</button>' +
      (!item.locked ? '<label>Quantity <input type="number" data-rc-count min="1" max="' + item.count + '" value="1"></label>' +
        '<button class="button secondary" data-rc-focus="sell-' + r.id + '" data-rc-sell="' + r.id + '">' + (confirmId === r.id ? 'Confirm sale' : 'Sell') +
        ' · <span data-rc-payout>' + cash(M.sellValue(state,r.id)) + '</span></button>' : '') : '') +
      '</div></div></div>');
  }

  function effectText(effect) {
    if (effect.luck) return ratio(effect.luck) + ' luck' + (effect.titanium ? ' · Titanium spin finish' : '');
    if (effect.duration) return effect.duration.toFixed(1) + ' s spin';
    if (effect.mutation) return '+' + Math.round((effect.mutation-1)*100) + '% mutation weight';
    if (effect.balls) return '+' + effect.balls + '% Tennis Balls';
    if (effect.sale) return '+' + Math.round((effect.sale-1)*100) + '% selling cash';
    return ratio(effect.bonus) + ' tenth-spin bonus';
  }

  function gearPanel() {
    const shop=panel==='Accessory Shop', slot=shop?shopSlot:gearSlot;
    const equipped=M.accessory(state.equipped[slot]);
    const items=M.accessories.filter(item=>item.slot===slot&&(shop||state.gear[item.id]));
    const chosen=items.find(item=>item.id===gearId);
    const heading='<div class="rc-page-head"><p class="kicker">Accessories</p><h3>'+(shop?'Accessory Shop':'Equipment loadout')+'</h3></div>';
    const slotName=(i)=>M.accessory(state.equipped[i])?.name||(i===1?'Default grip':'Empty');
    const loadout=shop?'':'<section class="rc-loadout"><div class="rc-loadout-art">'+art(M.racquet(state.favourite)||M.racquet(1))+'</div>'+
      M.slots.map((name,i)=>'<button class="button secondary rc-slot rc-slot-'+i+'" data-rc-gear-slot="'+i+'" aria-pressed="'+(i===slot)+
      '"><span aria-hidden="true">'+icons[i]+'</span><strong>'+name+'</strong><small>'+slotName(i)+'</small></button>').join('')+
      '<div class="rc-loadout-stats">'+gearSummary(M.effects(state))+'</div></section>';
    const controls=item=>{
      const owned=state.gear[item.id], disabled=state.cash<item.price?' disabled':'';
      if(owned) return equipped===item?'<button class="button secondary" data-rc-unequip="'+slot+'">Unequip</button>':
        '<button class="button primary" data-rc-equip="'+item.id+'">Equip</button>';
      return '<button class="button secondary" data-rc-buy="'+item.id+'"'+disabled+'>Buy</button> '+
        '<button class="button primary" data-rc-buy-equip="'+item.id+'"'+disabled+'>Buy &amp; equip</button>';
    };
    const products=items.map(item=>'<article class="rc-card rc-product"><button class="rc-product-pick" data-rc-gear-detail="'+item.id+
      '"><span class="rc-product-art" aria-hidden="true">'+icons[slot]+'</span><strong>'+item.name+'</strong><span>'+
      effectText(item.effect)+'</span><small>'+(equipped===item?'Equipped':state.gear[item.id]?'Owned':cash(item.price))+
      '</small></button>'+controls(item)+'</article>').join('');
    const detail=chosen?'<section class="rc-card rc-gear-comparison"><div><p class="kicker">Current '+M.slots[slot]+'</p><h3>'+
      slotName(slot)+'</h3><p>'+(equipped?effectText(equipped.effect):'Default effects')+'</p></div><div><p class="kicker">Selected</p><h3>'+
      chosen.name+'</h3><p>'+effectText(chosen.effect)+(state.gear[chosen.id]?'':' · '+cash(chosen.price))+'</p>'+controls(chosen)+'</div></section>':'';
    return heading+loadout+(shop?subnav(M.slots.map((name,i)=>[i,name]),slot,'data-rc-gear-slot')+
      '<p><button class="button secondary" data-rc-tab="Fuel Station">Visit Fuel Station</button></p>':'')+detail+
      '<div class="rc-gear-grid">'+(products||'<p>No owned items in this slot. <button class="button secondary" data-rc-tab="Accessory Shop">Browse shop</button></p>')+'</div>';
  }

  function statsPanel() {
    const found = discovered(), most = [...found].sort((a,b)=>state.items[b.id].pulled-state.items[a.id].pulled)[0];
    const stats = [
      ['Spins completed',state.spins],['Balls earned',state.earned],['Balls spent',state.spins],
      ['Club Cash earned',cash(state.cashEarned)],['Club Cash spent',cash(state.cashSpent)],
      ['Racquets obtained',obtained()],['Unique discoveries',found.length],
      ['Mutations',found.filter(r=>r.parent).length],['Rarest pull',rarest() ? label(rarest()) : '—'],
      ['Most pulled',most ? label(most) + ' × ' + number(state.items[most.id].pulled) : '—'],
      ['Favourite',state.favourite ? label(M.racquet(state.favourite)) : '—'],
      ['Equipped luck',ratio(M.effects(state).luck)],['Bonus spins',state.bonusSpins],['Duplicates sold',state.duplicatesSold],
      ['Keys obtained',Object.values(state.keysEarned).reduce((a,b)=>a+b,0)],['Keys opened',state.keysRedeemed],
      ['Fuel purchased',state.fuelBought],['Fuel crafted',state.fuelCrafted],['Fuel activated',state.fuelUsed],
      ['Highest spin luck',ratio(state.strongestLuck)],
      ...M.keyTiers.map(tier=>[M.keyName(tier)+'s obtained',state.keysEarned[tier]||0]),
      ...M.tiers.slice(3).map(([name],i)=>[name+' pulls',found.filter(r=>r.tier===i+3).reduce((n,r)=>n+state.items[r.id].pulled,0)])
    ];
    return '<div class="rc-page-head"><p class="kicker">Club record</p><h3>Statistics</h3></div><dl class="rc-stats rc-statistics">' + stats.map(([name,value])=>
      '<div><dt>' + name + '</dt><dd>' + (typeof value==='number' ? number(value) : value) + '</dd></div>').join('') + '</dl>';
  }

  async function click(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const data = button.dataset;
    if (data.rcClose !== undefined) { dialog.close(); return; }
    if (data.rcOpen !== undefined) { show('club'); return; }
    if (data.rcSkip !== undefined) { dialog.querySelector('.rc-reel')?.setAttribute('data-skipped',''); animation?.finish(); return; }
    if (data.rcPresentationClose !== undefined) {
      presentation=null;draw();
      dialog.querySelector('[data-rc-replay], [data-rc-key-back], [data-rc-spin]')?.focus();
      return;
    }
    if (data.rcShowcase || data.rcReplay) {
      const r=M.racquet(data.rcShowcase||data.rcReplay);
      if(r&&known(r)&&(!data.rcReplay||state.items[r.id]?.pulled&&r.tier>=3))showPresentation(r.id,data.rcReplay?'reveal':'showcase');
      return;
    }
    if (data.rcContinue !== undefined) { resultVisible=false;draw();dialog.querySelector('[data-rc-spin]')?.focus();return; }
    if (data.rcMenu !== undefined) { menu=!menu;draw();dialog.querySelector('[data-rc-menu]')?.focus();return; }
    if (data.rcInventory) { inventoryView=data.rcInventory;selected=0;draw();return; }
    if (data.rcKeyBack !== undefined) { cancelSpinPresentation();keySelection=0;draw();return; }
    if (data.rcKeySelect) {
      if (!state.keys.some(k=>k.id===Number(data.rcKeySelect))) return;
      panel='Key Vault';keySelection=Number(data.rcKeySelect);draw();dialog.querySelector('[data-rc-redeem]')?.focus();return;
    }
    if (data.rcRedeem) { void spin(Number(data.rcRedeem)); return; }
    if (data.rcGearSlot !== undefined) {
      if(panel==='Accessory Shop')shopSlot=Number(data.rcGearSlot);else gearSlot=Number(data.rcGearSlot);
      gearId='';draw();return;
    }
    if (data.rcGearDetail) {gearId=data.rcGearDetail;draw();return;}
    if (data.rcFuelTab) {fuelTab=data.rcFuelTab;fuelConfirmation=confirmFuel='';actionMessage='';draw();return;}
    if (data.rcRecipe) {recipeId=data.rcRecipe;draw();return;}
    if (data.rcSettingsTab) {settingsTab=data.rcSettingsTab;draw();return;}
    if (data.rcTab) {
      scrollPositions.set(panel,dialog.querySelector('.rc-body').scrollTop);
      if(panel==='Inventory'){inventoryFilter=filter;inventoryQuery=query;}
      cancelSpinPresentation();
      panel=data.rcTab;menu=false;keySelection=0;
      filter=panel==='Inventory'?inventoryFilter:'all';
      query=panel==='Inventory'?inventoryQuery:'';
      selected=confirmId=0;
      fuelConfirmation=confirmFuel='';
      actionMessage='';
      sound('interface');draw();
      dialog.querySelector('.rc-body').scrollTop=scrollPositions.get(panel)||0;
      return;
    }
    if (data.rcDetail !== undefined) {
      const entry = M.racquet(data.rcDetail);
      selected = entry && known(entry) ? entry.id : 0; confirmId = 0; draw();
      if(selected) {dialog.querySelector('.rc-detail')?.scrollIntoView({block:'nearest'});dialog.querySelector('.rc-detail button')?.focus({preventScroll:true});}
      return;
    }
    if (data.rcSpin !== undefined) { void spin(); return; }
    if (saving || !enabled()) return;
    actionMessage = '';
    saving = true;
    try {
      if (data.rcSell) {
        const id = Number(data.rcSell), quantity = Number(dialog.querySelector('[data-rc-count]').value);
        if (quantity === state.items[id]?.count && M.racquet(id).tier >= 3 && confirmId !== id) {
          confirmId = id;
          button.firstChild.textContent = 'Confirm sale · ';
          actionMessage = 'This is your last copy. Confirm to sell it.';
          dialog.querySelector('.rc-message').textContent = actionMessage;
          return;
        }
        const payout = await update(s=>M.sell(s,id,quantity,confirmId===id));
        actionMessage = payout ? 'Sold for ' + cash(payout) + '.' : 'Sale unavailable.';
        confirmId = 0;
        if (!state.items[id]?.count && panel==='Inventory') selected = 0;
      } else if (data.rcFuel || data.rcCraft || data.rcUse) {
        const item = M.fuelItem(data.rcFuel || data.rcCraft || data.rcUse);
        const current = M.activeBoosts(state,Date.now()).find(b=>b.slot===item.slot);
        const confirmation = [item.id,current?.id,current?.expires,current?.remaining].join(':');
        if (data.rcUse && current && pref('confirmReplace') && fuelConfirmation !== confirmation) {
          fuelConfirmation = confirmation;
          actionMessage = 'Activating ' + item.name + ' will replace ' + current.name + '. Confirm to continue.';
          draw();
          return;
        }
        if(data.rcUse && item.price>=7500 && pref('confirmFuel') && confirmFuel!==item.id && !fuelConfirmation){
          confirmFuel=item.id;
          actionMessage='Use '+item.name+'? Select Confirm to activate it.';
          draw();return;
        }
        const applied = await update(s=>data.rcFuel?M.buyFuel(s,item.id):data.rcCraft?M.craft(s,item.id):
          M.activate(s,item.id,Date.now(),!pref('confirmReplace') || fuelConfirmation===confirmation && M.activeBoosts(s,Date.now()).some(b=>[item.id,b.id,b.expires,b.remaining].join(':')===confirmation)));
        fuelConfirmation = confirmFuel = '';
        actionMessage = applied ? item.name + (data.rcFuel?' purchased.':data.rcCraft?' crafted.':' activated.') : 'Action unavailable.';
      } else if (data.rcDuplicates !== undefined) {
        const payout = await update(M.sellDuplicates);
        actionMessage = payout ? 'Duplicates sold for ' + cash(payout) + '.' : 'No unlocked duplicates to sell.';
      } else if (data.rcBuy || data.rcBuyEquip) {
        const item = M.accessory(data.rcBuy || data.rcBuyEquip);
        const bought = await update(s=>M.buy(s,item.id,!!data.rcBuyEquip));
        actionMessage = bought ? item.name + (data.rcBuyEquip ? ' purchased and equipped.' : ' purchased.') : 'Purchase unavailable.';
      } else if (data.rcEquip) await update(s=>M.equip(s,data.rcEquip));
      else if (data.rcUnequip !== undefined) await update(s=>delete s.equipped[data.rcUnequip]);
      else if (data.rcLock) await update(s=>{
        if (!s.items[data.rcLock]?.count) return false;
        s.items[data.rcLock].locked = !s.items[data.rcLock].locked;
        return true;
      });
      else if (data.rcFavourite) await update(s=>{
        const id = Number(data.rcFavourite);
        if (!s.items[id]?.count) return false;
        s.favourite = s.favourite === id ? null : id;
        return true;
      });
      else return;
      if (dialog.open) {
        draw();
        if (data.rcCraft && actionMessage.endsWith(' crafted.') && !state.skip) dialog.querySelector('.rc-message').classList.add('rc-crafted');
      }
    } finally { saving = false; }
  }

  async function change(event) {
    const el = event.target;
    if(el.dataset.rcPref) {
      const id=el.dataset.rcPref;
      await update(s=>{(s.presentation||={})[id]=el.type==='checkbox'?el.checked:Number(el.value);return true;});
      if(dialog.open){draw();dialog.querySelector('[data-rc-pref="'+id+'"]')?.focus();}
      return;
    }
    if (el.matches('[data-rc-enable]')) {
      await update(s=>{ s.enabled = el.checked; return true; },false);
    } else if (el.matches('[data-rc-motion]')) {
      await update(s=>{ s.skip = el.checked; return true; });
      if (state.skip) animation?.finish();
      if (busy) return;
    } else if (el.matches('[data-rc-filter]')) {
      filter = el.value; selected = confirmId = 0;
    } else if (el.matches('[data-rc-sort]')) sort = el.value;
    else if (el.matches('[data-rc-count]')) {
      const id = Number(dialog.querySelector('[data-rc-sell]').dataset.rcSell);
      dialog.querySelector('[data-rc-payout]').textContent = cash((Number(el.value)||0)*M.sellValue(state,id));
      confirmId = 0;
      dialog.querySelector('[data-rc-sell]').firstChild.textContent = 'Sell · ';
      return;
    }
    else return;
    if (dialog.open) draw();
  }

  openButton.addEventListener('click', () => show('club'));
  const bindSettings = window.AmbientPanel.bindSettings;
  window.AmbientPanel = Object.freeze({...window.AmbientPanel, bindSettings() { bindSettings(); sync(); }});
  window.addEventListener('brta-module-toggle', sync);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== 'brta-module-enabled-v1' && event.key !== null) return;
    state = read();
    sync();
    if (dialog?.open && !busy && !saving) draw();
  });
  window.addEventListener('brta-club-activity', event => {
    const {action, target} = event.detail || {};
    void earn(action,target);
  });
  document.addEventListener('click', event => {
    if (event.target.closest('[data-rc-settings]')) show('settings');
  });
  document.addEventListener('change', event => {
    const el = event.target;
    if (el.matches('[data-profile-opponent],[data-aux-profile-opponent],[data-eight-pair-opponent]')) {
      const heading = $('#profileContent .profile-head h2');
      if (heading) void earn('comparison', heading.textContent + '|' + el.value);
    }
    if (el.matches('#themeSelect,#ratingScope,#ratingRound,#competitionSelect,#sectionSelect,#historySection,#historySeason,#teamFilter')) {
      if (el.value) void earn('filter', el.id + '|' + el.value);
    }
  });
  setInterval(() => {
    if (!dialog?.open || busy) return;
    const active = dialog.querySelector('[data-rc-active]');
    if (active) active.innerHTML = activeMarkup();
    const setup=M.next(state), luck=dialog.querySelector('[data-rc-luck]'), top=dialog.querySelector('[data-rc-top-luck]'), boosts=dialog.querySelector('[data-rc-top-boosts]');
    if(luck)luck.innerHTML=luckText(setup);
    if(top)top.textContent=ratio(setup.effectiveLuck)+' luck';
    if(boosts)boosts.textContent=setup.boosts.length+' boosts';
  },1000);
  sync();
})();
