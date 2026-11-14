(() => {
  'use strict';
  const M = window.BRTARacquetModel;
  const key = 'brta-racquet-club-v1';
  const sections = ['Spin','Key Vault','Collection','Inventory','Equipment','Accessory Shop','Fuel Station','Statistics'];
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
    if (balance) balance.textContent = number(state.balls) + ' 🎾 · ' + cash(state.cash) + ' Club Cash';
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
    dialog.addEventListener('close', () => {
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
    return '<span aria-hidden="true" class="rc-racquet-art" style="--paint:' + (r.id * 43) % 360 + '"><i></i><b></b></span>';
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
    dialog.innerHTML = '<header class="rc-header"><div><p class="kicker">BRTA Power Ratings</p><h2 id="racquetClubTitle">' + title +
      '</h2></div><button class="button secondary" data-rc-close data-rc-focus="close" aria-label="Close ' + title +
      '">×</button></header>' + (mode === 'settings' ? '<div class="rc-body rc-settings">' +
      '<label><input type="checkbox" data-rc-enable data-rc-focus="enable"' + (state.enabled ? ' checked' : '') +
      '> Enable Gamify the Site</label><p>Earn Tennis Balls while using BRTA Power Ratings. Spin for racquets and trade duplicates for Club Cash.</p>' +
      '<p>Progress is saved in this browser. Club Cash is fictional.</p>' + (enabled() ?
        '<button class="button primary" data-rc-open data-rc-focus="open">Open Racquet Club</button>' : '') + '</div>' :
      '<div class="rc-summary"><strong data-rc-balance>' + number(state.balls) + ' 🎾 · ' + cash(state.cash) + ' Club Cash</strong>' +
      '<label><input type="checkbox" data-rc-motion data-rc-focus="motion"' + (state.skip ? ' checked' : '') +
      '> Skip animations</label></div><nav class="rc-tabs" aria-label="Racquet Club panels">' +
      sections.map(tab => '<button type="button" data-rc-tab="' + tab + '" data-rc-focus="tab-' + tab + '" aria-pressed="' + (tab === panel) + '">' + tab + (tab === 'Key Vault' && state.keys.length ? ' · ' + state.keys.length : '') + '</button>').join('') +
      '</nav><div class="rc-body" role="region" aria-label="' + panel + '">' + content() +
      '<p class="rc-message" role="status">' + actionMessage + '</p></div>');
    dialog.querySelector('.rc-body').scrollTop = scroll;
    const search = dialog.querySelector('[data-rc-search]');
    if (search) search.value = query;
    if (focusKey) [...dialog.querySelectorAll('[data-rc-focus]')].find(el => el.dataset.rcFocus === focusKey)?.focus({preventScroll:true});
  }

  function content() {
    if (panel === 'Spin') return spinPanel();
    if (panel === 'Key Vault') return keyPanel();
    if (panel === 'Fuel Station') return activePanel() + fuelPanel();
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
    return '<div class="rc-spin">' + gearSummary(M.effects(state)) +
      '<div data-rc-active>' + activeMarkup() + '</div><p data-rc-luck>' + luckText(setup) + '</p>' +
      '<p><button class="button secondary" data-rc-tab="Key Vault">Key Vault · ' + state.keys.length + '</button></p>' + '<div class="rc-progress">' + spinProgress(setup) + '</div>' +
      '<div class="rc-reel" aria-hidden="true"><div class="rc-track">' +
      [{id:3,tier:0},{id:10,tier:0},{tier:2,key:true},{id:17,tier:1},{tier:4,key:true}].map(entry => wheelCard(entry)).join('') + '</div></div>' +
      '<div class="rc-spin-actions"><button class="button primary rc-spin-button' + (setup.bonusSpin ? ' rc-bonus' : '') +
      '" data-rc-spin data-rc-focus="spin"' + (!state.balls || busy ? ' disabled' : '') +
      '>Spin · 1 🎾</button><button class="button secondary" data-rc-skip hidden>Skip spin animation</button></div>' +
      (state.last && !busy ? resultCard(state.last) : '<p class="rc-spin-note">' +
        (state.balls ? 'One Tennis Ball per spin.' : 'Open Player Lab, explore tabs, or try a comparison to earn Tennis Balls.') +
        '</p>') + '</div>';
  }

  function spinProgress(setup) {
    const progress = state.spins % M.config.bonusEvery;
    return '<span>' + number(state.spins) + ' spins completed</span><strong>' +
      (setup.bonusSpin ? 'Bonus spin ready · ' + ratio(setup.effectiveLuck) + ' effective luck' : 'Bonus spin · ' + progress + '/10') +
      '</strong><progress aria-label="Tenth-spin progress" value="' + progress + '" max="10"></progress>';
  }

  function wheelCard(entry, hidden = false) {
    if (hidden) return '<span class="rc-wheel-card rc-unknown"><strong>?</strong></span>';
    if (entry.key) return '<span class="rc-wheel-card rc-tier-' + entry.tier + '"><span class="rc-key-icon" aria-hidden="true">⚿</span><b>' + M.keyName(entry.tier) + '</b></span>';
    const r = M.racquet(entry.id);
    return '<span class="rc-wheel-card rc-tier-' + r.tier + '">' + art(r) + '<b>' + label(r) + '</b></span>';
  }

  function resultCard(last, reveal = false, redemption = false) {
    if (last.key) return '<div class="rc-result rc-tier-' + last.tier + '" role="status"><span class="rc-key-icon" aria-hidden="true">⚿</span><div><strong>' +
      M.keyName(last.tier) + '</strong><span>' + percent(last.odds) + ' on this spin</span><button class="button secondary" data-rc-tab="Key Vault">Open Key Vault</button></div></div>';
    const r = M.racquet(last.id);
    return '<div class="rc-result rc-tier-' + r.tier + (reveal && r.tier >= 3 ? ' rc-reveal' : '') +
      (r.id === 60 ? ' rc-regna' : r.id === 59 ? ' rc-hof' : '') + '" role="status">' + art(r) +
      '<div>' + badge(r) + '<strong>' + label(r) + '</strong><span>' + percent(last.odds) +
      (redemption ? ' inside this key' : ' on this spin') + (last.new ? ' · New discovery' : '') +
      (last.bonusSpin ? ' · Bonus spin' : '') + '</span></div></div>';
  }

  function keyPanel(openable = true) {
    const weights = M.wheel(M.probabilities());
    return '<div class="rc-key-grid">' + M.keyTiers.map(tier => {
      const key = state.keys.find(item=>item.tier===tier);
      return '<article class="rc-card rc-gear rc-tier-' + tier + '"><span class="rc-key-icon" aria-hidden="true">⚿</span><h3>' +
        M.keyName(tier) + ' × ' + keyCount(tier) + '</h3><p>Base drop rate ' +
        percent(weights.find(item=>item.key&&item.tier===tier).weight) + '</p>' +
        (openable ? '<button class="button secondary" data-rc-redeem="' + (key?.id || 0) +
          '" data-rc-focus="key-' + tier + '"' + (!key || busy ? ' disabled' : '') + '>Open Key</button>' : '') + '</article>';
    }).join('') + '</div>' + (openable ?
      '<div class="rc-key-stage"><div class="rc-reel" aria-hidden="true" hidden><div class="rc-track"></div></div>' +
      '<button class="button secondary" data-rc-skip hidden>Skip key animation</button>' +
      (state.lastKey && !busy ? resultCard(state.lastKey,false,true) : '') + '</div>' :
      '<p><button class="button secondary" data-rc-tab="Key Vault">Open Key Vault</button></p>');
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
      (fuelConfirmation.startsWith(item.id+':')?'Confirm replacement':'Activate') + '</button></article>').join('') + '</div>' : '<p>No consumables owned.</p>');
  }

  function fuelPanel() {
    return fuelInventory() + '<h3 class="rc-subhead">Shop and crafting</h3><div class="rc-gear-grid">' + M.fuel.map(item => {
      const recipe = M.recipes[item.id];
      const ingredients = recipe ? Object.entries(recipe.ingredients) : [];
      const affordable = state.cash >= item.price;
      const craftable = recipe && state.cash >= recipe.fee && ingredients.every(([id,n])=>(state.fuel[id]||0)>=n);
      return '<article class="rc-card rc-gear"><h3>🍌 ' + item.name + '</h3><p>' + fuelEffect(item) +
        '</p><button class="button secondary" data-rc-fuel="' + item.id + '"' + (affordable?'':' disabled') +
        '>Buy · ' + cash(item.price) + '</button>' + (recipe ? '<p>' + ingredients.map(([id,n])=>
          n + ' × ' + M.fuelItem(id).name + ' (' + (state.fuel[id]||0) + ' owned)').join(' + ') + ' + ' + cash(recipe.fee) +
          '</p><button class="button secondary" data-rc-craft="' + item.id + '"' + (craftable?'':' disabled') + '>Craft</button>' : '') + '</article>';
    }).join('') + '</div>';
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
    draw();
    let skip = state.skip || motion.matches || document.documentElement.dataset.animation === 'off';
    const reel = dialog.querySelector('.rc-reel');
    if (!redemption) dialog.querySelector('[data-rc-spin]').classList.toggle('rc-bonus', last.bonusSpin);
    reel.hidden = false;
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
        track.style.transform = 'translateX(' + -x + 'px)';
      }
      if (dialog.open && mode === 'club' && panel === targetPanel && dialog.contains(reel)) {
        const reveal = !skip && !state.skip;
        busy = false;
        if (redemption) {
          draw();
          if (!skip) dialog.querySelector('.rc-key-stage .rc-reel').replaceWith(reel);
          const result = dialog.querySelector('.rc-key-stage .rc-result');
          if (result) result.outerHTML = resultCard(last,reveal,true);
        } else {
          reel.hidden = skip;
          const pending = dialog.querySelector('.rc-spin-note');
          pending?.insertAdjacentHTML('afterend',resultCard(last,reveal));
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
    const summary = collection ? '<div class="rc-collection-summary"><h3>' + found.length + '/60 racquets discovered</h3><progress aria-label="Collection completion" value="' +
      found.length + '" max="60"></progress><p>' + Math.round(found.length / 60 * 100) + '% complete · ' +
      found.filter(r=>r.parent).length + ' mutations · ' + number(obtained()) + ' obtained' +
      (rarest() ? ' · Rarest: ' + label(rarest()) : '') +
      '</p>' + (found.length === 60 ? '<strong class="rc-achievement">✦ Grand Slam Collection</strong>' : '') + '</div>' :
      '<h3>' + Object.values(state.items).reduce((sum,item)=>sum+item.count,0) + ' racquets owned</h3>';
    const cards = list.map(r => {
      const item = state.items[r.id];
      const hint = M.racquets.some(variant=>variant.parent===r.id&&!state.items[variant.id]?.pulled);
      return tile(r, '<button class="rc-item" data-rc-focus="detail-' + r.id + '" data-rc-detail="' + r.id + '">' +
        art(r) + badge(r) + '<strong>' + label(r) + '</strong><span>' + r.brand + ' · ' + baseOdds(r) + '</span><span>' +
        (item?.count ? '×' + item.count : item?.pulled ? 'Discovered' : 'Uncollected') +
        (item?.count && !collection ? ' · ' + cash(M.sellValue(state,r.id)) : '') +
        (item?.locked ? ' · Locked' : '') + (state.favourite===r.id?' · Favourite':'') +
        '</span>' + (collection&&hint?'<small>✦ Undiscovered mutation available</small>':'') + '</button>');
    }).join('');
    return summary + toolbar + (selected ? itemDetail(M.racquet(selected)) : '') +
      '<div class="rc-grid">' + (cards + (collection && filter==='all' && !query ? '<article class="rc-card rc-item rc-unknown"><strong>?</strong><span>Undiscovered racquet</span></article>'.repeat(M.racquets.filter(r=>!known(r)).length) : '') || '<p>No racquets match these filters.</p>') + '</div>';
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
    const links = r.parent && known(M.racquet(r.parent)) ? '<p>Variant of ' + M.racquet(r.parent).name + '</p>' :
      variants.length ? '<p>Related variant · ' + variants.map(label).join(', ') + '</p>' : '';
    return tile(r, '<div class="rc-detail">' + art(r) + '<div>' + badge(r) + '<h3>' + label(r) + '</h3><p>' + r.brand +
      (item.first ? ' · Discovered ' + date(item.first) : ' · Uncollected') + ' · ' + item.count + ' owned</p><p>Base odds ' + baseOdds(r) +
      (r.tier < 2 ? ' · Next spin ' : ' · Per-roll equivalent ') + percent(M.probabilities(setup.effectiveLuck,setup.mutation)[r.id-1]) +
      ' · Sell value ' + cash(M.sellValue(state,r.id)) + '</p>' + links +
      '<div class="rc-actions"><button class="button secondary" data-rc-detail="0">Close details</button>' +
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
    const shop = panel === 'Accessory Shop';
    return gearSummary(M.effects(state)) + '<div class="rc-gear-grid">' + M.slots.map((slot,i)=>{
      const equipped = M.accessory(state.equipped[i]);
      return '<section class="rc-card rc-gear"><h3><span aria-hidden="true">' + icons[i] + '</span> ' + slot + '</h3><p>' +
        (equipped ? 'Equipped · ' + equipped.name : i===1 ? 'Default Grip · 5.0 s' : 'Empty slot') + '</p>' +
        (!shop && equipped ? '<button class="button secondary" data-rc-focus="unequip-' + i + '" data-rc-unequip="' + i + '">Unequip</button>' : '') +
        M.accessories.filter(item=>item.slot===i).map(item=>{
          const owned = !!state.gear[item.id];
          return '<div class="rc-gear-row"><div><strong>' + item.name + '</strong><small>' + effectText(item.effect) +
            ' · ' + (owned ? (equipped === item ? 'Equipped' : 'Owned') : cash(item.price)) + '</small></div>' +
            (owned ? (equipped !== item ? '<button class="button secondary" data-rc-focus="equip-' + item.id + '" data-rc-equip="' + item.id + '">Equip</button>' : '') :
              shop ? '<div class="rc-actions"><button class="button secondary" data-rc-focus="buy-' + item.id + '" data-rc-buy="' + item.id + '"' +
              (state.cash < item.price ? ' disabled' : '') + '>Buy</button><button class="button secondary" data-rc-focus="buy-equip-' + item.id + '" data-rc-buy-equip="' + item.id + '"' +
              (state.cash < item.price ? ' disabled' : '') + '>Buy &amp; equip</button></div>' : '') + '</div>';
        }).join('') + '</section>';
    }).join('') + '</div>';
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
    return '<dl class="rc-stats rc-statistics">' + stats.map(([name,value])=>
      '<div><dt>' + name + '</dt><dd>' + (typeof value==='number' ? number(value) : value) + '</dd></div>').join('') + '</dl>';
  }

  async function click(event) {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    const data = button.dataset;
    if (data.rcClose !== undefined) { dialog.close(); return; }
    if (data.rcOpen !== undefined) { show('club'); return; }
    if (data.rcSkip !== undefined) { dialog.querySelector('.rc-reel')?.setAttribute('data-skipped',''); animation?.finish(); return; }
    if (data.rcInventory) { inventoryView = data.rcInventory; selected = 0; draw(); return; }
    if (data.rcRedeem) { void spin(Number(data.rcRedeem)); return; }
    if (data.rcTab) {
      cancelSpinPresentation();
      panel = data.rcTab;
      filter = 'all';
      query = '';
      selected = confirmId = 0;
      fuelConfirmation = '';
      actionMessage = '';
      draw();
      dialog.querySelector('.rc-body').scrollTop = 0;
      return;
    }
    if (data.rcDetail !== undefined) {
      const entry = M.racquet(data.rcDetail);
      selected = entry && known(entry) ? entry.id : 0; confirmId = 0; draw();
      if (selected) dialog.querySelector('.rc-detail')?.scrollIntoView({block:'nearest'});
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
        if (data.rcUse && current && fuelConfirmation !== confirmation) {
          fuelConfirmation = confirmation;
          actionMessage = 'Activating ' + item.name + ' will replace ' + current.name + '. Confirm to continue.';
          draw();
          return;
        }
        const applied = await update(s=>data.rcFuel?M.buyFuel(s,item.id):data.rcCraft?M.craft(s,item.id):
          M.activate(s,item.id,Date.now(),fuelConfirmation===confirmation && M.activeBoosts(s,Date.now()).some(b=>[item.id,b.id,b.expires,b.remaining].join(':')===confirmation)));
        fuelConfirmation = '';
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
    const luck = dialog.querySelector('[data-rc-luck]');
    if (luck) luck.innerHTML = luckText(M.next(state));
  },1000);
  sync();
})();
