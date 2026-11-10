/* Session-only navigation secret, Model Vault and the local site console. */
(() => {
  'use strict';
  const nav = $('.main-nav'), removed = new Set();
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const lockIcon = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path class="lock-shackle" d="M10 14V10a6 6 0 0 1 12 0v4"/><rect x="6" y="14" width="20" height="15" rx="3"/><path d="M16 20v4"/></svg>';
  const doorIcon = '<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="5" width="24" height="22" rx="4"/><circle cx="16" cy="16" r="5"/><path d="M16 9v3m0 8v3m-7-7h3m8 0h3"/></svg>';
  const keyIcon = '<svg viewBox="0 0 40 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><circle cx="11" cy="12" r="7"/><path d="M18 12h18m-5 0v6m5-6v4"/></svg>';
  const blueprintCode = 'SCORE-FOLD-42';
  const savedBlueprint = 'brta-vault-blueprint';
  let blueprintUnlocked = false;
  try { blueprintUnlocked = localStorage.getItem(savedBlueprint) === '1'; } catch {}
  let audio, muted = false;
  function sound(from, to = from, duration = .15, type = 'sine') {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (muted || !Audio) return;
    try {
      audio ??= new Audio();
      if (audio.state === 'suspended') audio.resume().catch(() => {});
      const t = audio.currentTime, oscillator = audio.createOscillator(), gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(from, t);
      oscillator.frequency.exponentialRampToValueAtTime(to, t + duration);
      gain.gain.setValueAtTime(.06, t);
      gain.gain.exponentialRampToValueAtTime(.001, t + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(t);
      oscillator.stop(t + duration);
    } catch {}
  }

  function makeOverlay(id, classes, html, onClose) {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'overlay hidden ' + classes;
    overlay.innerHTML = html;
    document.body.append(overlay);
    BRTAOverlays.register(id, onClose);
    return overlay;
  }
  function open(overlay, focus) {
    overlay.classList.remove('hidden');
    BRTAOverlays.lock(overlay);
    document.body.classList.add('modal-open');
    overlay.querySelector(focus)?.focus({ preventScroll: true });
  }
  function hide(overlay) {
    overlay?.classList.add('hidden');
    if (overlay) BRTAOverlays.unlock(overlay);
  }

  // All navigation paths use switchPage, including deep links inside other features.
  const originalSwitch = switchPage;
  switchPage = function (page) {
    if (removed.has(page)) {
      if (!removed.has(activePage)) return;
      page = nav.querySelector('.main-tab:not([disabled])')?.dataset.page || '';
    }
    const before = activePage;
    originalSwitch(page);
    if (before !== activePage) trace('page', activePage || '(none)');
  };

  let press, blockClick, lock, lockStatus, key, keyFrame, unlocked = false;
  const cursor = { x: innerWidth / 2, y: innerHeight / 2 };
  const buttons = [...nav.querySelectorAll('.main-tab')];
  function cancelPress() {
    if (!press) return;
    clearTimeout(press.timer);
    press = null;
  }
  function addLock() {
    nav.classList.add('vault-nav-empty');
    lock = document.createElement('button');
    lock.type = 'button';
    lock.className = 'vault-hidden-lock';
    lock.setAttribute('aria-label', 'Inspect the lock');
    lock.innerHTML = lockIcon;
    lockStatus = document.createElement('p');
    lockStatus.className = 'vault-lock-status';
    lockStatus.setAttribute('role', 'status');
    nav.append(lock, lockStatus);
    lock.addEventListener('click', inspectLock);
    if (unlocked) lock.classList.add('vault-lock-open');
    lock.focus({ preventScroll: true });
  }
  function removeTab(tab) {
    const page = tab.dataset.page;
    if (removed.has(page)) return;
    removed.add(page);
    tab.disabled = true;
    tab.classList.add('vault-tab-fading');
    trace('tab removed', page);
    sound(260, 90, .22, 'triangle');
    if (activePage === page) switchPage(page);
    const finish = () => {
      const remaining = buttons.filter(button => !removed.has(button.dataset.page));
      const positions = remaining.map(button => button.getBoundingClientRect());
      tab.remove();
      nav.style.setProperty('--vault-tabs', nav.querySelectorAll('.main-tab').length);
      nav.classList.add('vault-nav-changed');
      if (removed.size === buttons.length && !lock) addLock();
      remaining.forEach((button, index) => {
        const next = button.getBoundingClientRect(), prev = positions[index];
        if (!motion.matches) button.animate?.([
          { transform: `translate(${prev.left - next.left}px,${prev.top - next.top}px) scaleX(${next.width ? prev.width / next.width : 1})` },
          { transform: 'none' },
        ], { duration: 260, easing: 'cubic-bezier(.2,.75,.25,1)' });
      });
    };
    if (motion.matches) finish();
    else setTimeout(finish, 180);
  }

  window.addEventListener('pointerdown', () => { blockClick = false; }, true);
  nav.addEventListener('pointerdown', event => {
    const tab = event.target.closest('.main-tab');
    if (!tab || tab.disabled || event.button !== 0 || event.isPrimary === false) return;
    cancelPress();
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, tab,
      timer: setTimeout(() => {
        blockClick = true;
        cancelPress();
        removeTab(tab);
      }, 650) };
  });
  window.addEventListener('pointermove', event => {
    cursor.x = event.clientX;
    cursor.y = event.clientY;
    if (press?.id === event.pointerId &&
        Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) cancelPress();
  }, { passive: true });
  for (const type of ['pointerup', 'pointercancel']) window.addEventListener(type, cancelPress);
  window.addEventListener('blur', cancelPress);
  nav.addEventListener('pointerout', event => {
    if (event.pointerType === 'mouse' && press && !press.tab.contains(event.relatedTarget)) cancelPress();
  });
  nav.addEventListener('contextmenu', event => {
    if (event.target.closest('.main-tab')) event.preventDefault();
  });
  nav.addEventListener('click', event => {
    // A touch release can land on a newly reflowed button or the revealed lock.
    if (blockClick && event.detail > 0) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    blockClick = false;
  }, true);

  function spawnKey(origin) {
    if (key || unlocked) return;
    key = document.createElement('div');
    key.className = 'vault-homing-key';
    key.setAttribute('aria-hidden', 'true');
    key.innerHTML = keyIcon;
    document.body.append(key);
    const rect = origin.getBoundingClientRect();
    let x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
    let vx = -5, vy = -7, angle = 0, last = performance.now();
    function chase(now) {
      if (!key) return;
      const step = Math.min(2, (now - last) / 16.67);
      last = now;
      const dx = cursor.x + 22 - x, dy = cursor.y + 20 - y;
      vx = (vx + dx * .014 * step) * .84 ** step;
      vy = (vy + dy * .014 * step) * .84 ** step;
      const speed = Math.hypot(vx, vy);
      const scale = speed > 24 ? 24 / speed : 1;
      x += vx * step * scale;
      y += vy * step * scale;
      if (speed > .4) {
        const heading = Math.atan2(vy, vx);
        angle += Math.atan2(Math.sin(heading - angle), Math.cos(heading - angle)) * .15 * step;
      }
      key.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) rotate(${angle}rad)`;
      keyFrame = requestAnimationFrame(chase);
    }
    keyFrame = requestAnimationFrame(chase);
  }
  function inspectLock() {
    if (unlocked) return enterChamber();
    if (!key) {
      lockStatus.textContent = 'The lock is locked.';
      sound(115, 83, .14, 'triangle');
      return;
    }
    cancelAnimationFrame(keyFrame);
    key.remove();
    key = null;
    unlocked = true;
    lock.classList.add('vault-lock-open');
    lock.setAttribute('aria-label', 'Enter through the open lock');
    lockStatus.textContent = 'The lock is open.';
    sound(230, 690, .27, 'triangle');
  }

  const settings = $('#settingsOverlay'), sheet = settings.querySelector('.settings-sheet');
  const entry = document.createElement('button');
  entry.type = 'button';
  entry.className = 'vault-settings-entry';
  entry.hidden = true;
  entry.title = 'Model Vault';
  entry.setAttribute('aria-label', 'Open the Model Vault');
  entry.innerHTML = doorIcon;
  settings.append(entry);
  function positionEntry() {
    if (entry.hidden || settings.classList.contains('hidden')) return;
    const rect = sheet.getBoundingClientRect(), close = $('#settingsClose').getBoundingClientRect();
    const x = rect.right + 50 < innerWidth ? rect.right + 8 : close.left - 49;
    entry.style.left = Math.max(4, x) + 'px';
    entry.style.top = Math.max(5, close.top) + 'px';
  }
  const originalSettings = openSettings;
  openSettings = function () {
    originalSettings();
    entry.hidden = !auxiliaryEnabled();
    positionEntry();
  };
  $('#settingsBtn').onclick = openSettings;
  if (window.ResizeObserver) new ResizeObserver(positionEntry).observe(sheet);
  window.addEventListener('resize', positionEntry);
  window.addEventListener('brta-module-toggle', () => {
    entry.hidden = !auxiliaryEnabled();
    positionEntry();
    if (entry.hidden) closeVault();
  });

  let vault, vaultArrival;
  function closeVault() {
    clearTimeout(vaultArrival);
    hide(vault);
  }
  function openVault() {
    if (!auxiliaryEnabled()) return;
    if (!vault) {
      vault = makeOverlay('modelVaultOverlay', 'deeds-overlay vault-overlay',
        `<section class="deeds-cabinet vault-cabinet" role="dialog" aria-modal="true" aria-labelledby="vault-title">
          <button class="close-btn" type="button" aria-label="Close the Vault">×</button>
          <div class="vault-eyebrow">Restricted access</div><h2 id="vault-title">The Model Vault</h2>
          <form><label for="vault-code">Speak the passphrase</label>
          <div class="vault-code-row"><input id="vault-code" spellcheck="false" autocomplete="off" autocapitalize="off" maxlength="64">
          <button type="submit" aria-label="Submit vault code">${doorIcon}</button></div></form>
          <p class="vault-reply" role="status">The door is listening.</p>
        </section>`, closeVault);
      vault.querySelector('.close-btn').addEventListener('click', closeVault);
      vault.querySelector('form').addEventListener('submit', submitCode);
    }
    clearTimeout(vaultArrival);
    vault.classList.remove('deeds-arrived');
    open(vault, '.close-btn');
    sound(81, 54, .48, 'triangle');
    vaultArrival = setTimeout(() => vault.classList.add('deeds-arrived'), motion.matches ? 0 : 630);
  }
  entry.addEventListener('click', openVault);
  function submitCode(event) {
    event.preventDefault();
    const input = vault.querySelector('input'), raw = input.value, code = raw.trim().toUpperCase();
    if (!code) return;
    input.value = '';
    const reply = vault.querySelector('.vault-reply');
    if (window.BRTAArchiveSecret?.redeem(raw)) {
      reply.textContent = 'Neon + unlocked. Find it under Theme in Settings.';
      sound(340, 1040, .34, 'triangle');
      input.focus();
      return;
    }
    switch (code) {
      case '104756':
        spawnKey(vault.querySelector('[type=submit]'));
        reply.textContent = unlocked ? 'That key has already done its job.' : 'Something followed you out.';
        sound(380, 920, .26, 'triangle');
        break;
      case blueprintCode:
        blueprintUnlocked = true;
        try { localStorage.setItem(savedBlueprint, '1'); } catch {}
        reply.textContent = 'Blueprint accepted. The Rating Methodology now includes technical notes.';
        sound(290, 870, .34);
        break;
      case 'TIEBREAK':
        reply.textContent = 'Seven points. Two clear. Zero sympathy.';
        vault.querySelector('section').classList.toggle('vault-tiebreak');
        sound(440, 660, .2);
        break;
      case 'BREADSTICK':
        reply.textContent = '6–1. The Vault has awarded you one ceremonial breadstick.';
        sound(188, 411, .21, 'triangle');
        break;
      default:
        reply.textContent = 'The door stares back.';
        sound(120, 82, .16, 'triangle');
    }
    input.focus();
  }

  const cast = [
    ['Melody', 'M', '#87e8c7'], ['Foundation', 'F', '#f2cb7f'],
    ['Choir', 'C', '#a8abff'], ['Harmony', 'H', '#ed9fc5'],
    ['Brass', 'B', '#f3a571'], ['Woodwind', 'W', '#a9da92'],
    ['Strings', 'S', '#c7a7f4'], ['Percussion', 'P', '#e9a095'],
    ['Baton', '↗', '#8acaff'], ['Orchestra', 'O', '#dfe6ee'],
    ['RM4.2', '4.2', '#87c9c2'], ['RM1000', '∞', '#eed969'],
    ['RM4.1 Ensemble', '4.1', '#c1e3aa'], ['RM4a', '4a', '#7cd2e7'],
    ['RM4b', '4b', '#a7c9f5'], ['RM3b', '3b', '#f29a86'],
    ['RM3', '3', '#dfaf85'], ['RM2', '2', '#b7c7dc'],
    ['RM1', '1', '#e1d0bc'], ['RM3ultra', 'U', '#b4f0a5'],
  ];
  const dialogue = [
    [9, 'Emergency meeting. Someone filed a tiebreak under percussion.'],
    [7, 'It made a noise. I stand by the filing.'],
    [5, 'The doubles set went to eight. We can all go home now.'],
    [1, 'Has anyone seen my prior? I left it here yesterday.'],
    [0, 'I weighted it down. It was getting carried away.'],
    [2, 'Could we discuss this in pairs? I have a seating chart.'],
    [3, 'I already blended the seating chart.'],
    [4, 'Whoever keeps calibrating my trumpet owes me a mouthpiece.'],
    [6, 'Can we circle back after the third set?'],
    [10, 'Unsupported format. Have you tried turning the table off and on?'],
    [12, 'According to my subcommittee, we need another subcommittee.'],
    [13, 'I counted the games. None of them were played on a table.'],
    [14, 'Did you account for how strongly the table won?'],
    [15, 'I would like to intercept that question.'],
    [16, 'Could everyone stop talking while I count the games?'],
    [17, 'I remember when this meeting fit on one scorecard.'],
    [18, 'In my day we had one column and we liked it.'],
    [19, 'The word “table” has two vowels. I give it provisional status.'],
    [11, 'I have solved it. The table is 1000.'],
    [8, 'Wait. Who opened the lock?'],
    [9, 'Someone is watching us. Close ranks!'],
  ];
  let chamber, sceneTimer, blueprintFound = false, phase = 'idle';
  function closeChamber() {
    clearTimeout(sceneTimer);
    phase = 'idle';
    hide(chamber);
    lock?.focus({ preventScroll: true });
  }
  function enterChamber() {
    if (phase !== 'idle' && !chamber.classList.contains('hidden')) return;
    if (!chamber) {
      chamber = makeOverlay('modelChamberOverlay', 'model-chamber',
        '<section class="model-chamber-view" role="dialog" aria-modal="true" aria-label="Model chamber"></section>', closeChamber);
      chamber.addEventListener('click', sceneClick);
    }
    clearTimeout(sceneTimer);
    phase = 'zoom';
    const rect = lock.getBoundingClientRect();
    chamber.style.setProperty('--portal-x', rect.left + rect.width / 2 + 'px');
    chamber.style.setProperty('--portal-y', rect.top + rect.height / 2 + 'px');
    const view = chamber.querySelector('section');
    view.innerHTML = `<div class="chamber-zoom" aria-hidden="true">${lockIcon}</div>`;
    chamber.classList.remove('chamber-arrived');
    open(chamber, 'section');
    sound(175, 34, .95, 'triangle');
    sceneTimer = setTimeout(drawChamber, motion.matches ? 0 : 1350);
  }
  function drawChamber() {
    if (chamber.classList.contains('hidden')) return closeChamber();
    chamber.classList.add('chamber-arrived');
    const seats = cast.map(([name, initials, color], index) => `<button type="button" class="chamber-model" data-seat="${index}" style="--seat-color:${color}" disabled>
      <span class="chamber-avatar" aria-hidden="true">${initials}</span><span>${name}</span></button>`);
    const split = seats.length / 2;
    chamber.querySelector('section').innerHTML = `
      <header class="chamber-header"><div><div class="vault-eyebrow">The Model Vault</div><h2>The calibration room</h2></div>
        <button type="button" data-chamber-close class="close-btn" aria-label="Leave the chamber">×</button></header>
      <div class="chamber-floor">
        <div class="chamber-seats">${seats.slice(0, split).join('')}</div>
        <div class="chamber-table"><span>MODEL COUNCIL</span>
          <button type="button" data-chamber-blueprint hidden>Inspect blueprint</button></div>
        <div class="chamber-seats">${seats.slice(split).join('')}</div>
      </div>
      <div class="chamber-caption" role="status"><strong></strong><p></p></div>
      <div class="chamber-controls"><button type="button" data-chamber-skip>Skip dialogue</button></div>`;
    chamber.querySelector('[data-chamber-close]').focus({ preventScroll: true });
    if (blueprintFound) return revealBlueprint();
    phase = 'dialogue';
    speak(0);
  }
  function speak(index) {
    if (phase !== 'dialogue' || chamber.classList.contains('hidden')) return;
    if (index === dialogue.length) return beginFight();
    const [seat, line] = dialogue[index];
    chamber.querySelector('.chamber-speaking')?.classList.remove('chamber-speaking');
    chamber.querySelector(`[data-seat="${seat}"]`).classList.add('chamber-speaking');
    caption(cast[seat][0], line);
    sound(188 + seat * 23, 216 + seat * 25, .09, 'triangle');
    sceneTimer = setTimeout(() => speak(index + 1), Math.max(1700, line.length * 33));
  }
  function caption(name, text) {
    const box = chamber.querySelector('.chamber-caption');
    box.querySelector('strong').textContent = name;
    box.querySelector('p').textContent = text;
    if (!motion.matches) box.animate?.([{ opacity: .35, transform: 'translateY(5px)' }, { opacity: 1, transform: 'none' }], { duration: 230 });
  }
  function beginFight() {
    clearTimeout(sceneTimer);
    phase = 'fight';
    chamber.querySelector('.chamber-speaking')?.classList.remove('chamber-speaking');
    chamber.querySelector('[data-chamber-skip]').hidden = true;
    chamber.querySelector('.chamber-floor').classList.add('chamber-fight');
    chamber.querySelectorAll('[data-seat]').forEach(button => { button.disabled = false; });
    caption('Intruder detected', 'Tap each model before they can convene another meeting.');
    chamber.querySelector('[data-seat]').focus({ preventScroll: true });
    sound(355, 92, .48, 'sawtooth');
  }
  function sceneClick(event) {
    if (event.target.closest('[data-chamber-close]')) return closeChamber();
    if (event.target.closest('[data-chamber-skip]') && phase === 'dialogue') return beginFight();
    const blueprint = event.target.closest('[data-chamber-blueprint]');
    if (blueprint && phase === 'won') {
      caption('Blueprint recovered', 'Enter ' + blueprintCode + ' in the Model Vault.');
      blueprint.textContent = blueprintCode;
      trace('vault', 'blueprint recovered');
      sound(392, 784, .35, 'triangle');
      return;
    }
    const model = event.target.closest('[data-seat]');
    if (phase !== 'fight' || !model || model.disabled) return;
    model.disabled = true;
    model.classList.add('chamber-dust');
    const dust = Array.from({ length: 8 }, (_, index) => {
      const particle = document.createElement('i'), angle = index * Math.PI / 4;
      particle.style.setProperty('--dust-x', Math.cos(angle) * 57 + 'px');
      particle.style.setProperty('--dust-y', Math.sin(angle) * 46 + 'px');
      model.append(particle);
      return particle;
    });
    setTimeout(() => dust.forEach(particle => particle.remove()), 540);
    sound(270 + Number(model.dataset.seat) * 25, 67, .2, 'triangle');
    const remaining = [...chamber.querySelectorAll('[data-seat]:not([disabled])')];
    if (!remaining.length) return revealBlueprint();
    caption('Model council', remaining.length + (remaining.length === 1 ? ' model remains.' : ' models remain.'));
    remaining[0].focus({ preventScroll: true });
  }
  function revealBlueprint() {
    blueprintFound = true;
    phase = 'won';
    chamber.querySelector('[data-chamber-skip]').hidden = true;
    chamber.querySelectorAll('[data-seat]').forEach(button => {
      button.disabled = true;
      button.classList.add('chamber-dust');
    });
    const blueprint = chamber.querySelector('[data-chamber-blueprint]');
    blueprint.hidden = false;
    blueprint.focus({ preventScroll: true });
    caption('The room falls quiet', 'A blueprint is lying on the table.');
    sound(261, 523, .45, 'triangle');
  }

  const originalMethodology = eightMethodologyHTML;
  eightMethodologyHTML = function () {
    const html = originalMethodology();
    if (!blueprintUnlocked) return html;
    Promise.all([ensureOrchestra(), ensureRM4Frozen()]).then(() => {
      const panel = $('#layoutOverlay .vault-technical');
      if (panel) panel.innerHTML = technicalNotes(window.BRTAOrchestraBundle, window.BRTARM4Frozen);
    }).catch(() => {
      const panel = $('#layoutOverlay .vault-technical-status');
      if (panel) panel.textContent = 'Model files unavailable. Reopen the guide to try again.';
    });
    return html.replace(/<\/div>$/, '<section class="guide-section vault-technical"><h3>Recovered blueprint</h3><p class="vault-technical-status">Reading model files…</p></section></div>');
  };
  function technicalNotes(bundle, frozen) {
    const percent = value => (value * 100).toFixed(2) + '%';
    const rows = (names, weights) => names.map((name, index) =>
      '<tr><th scope="row">' + esc(name) + '</th><td>' + percent(weights[index]) + '</td></tr>').join('');
    const table = (name, names, weights) => '<table><caption>' + esc(name) + '</caption><tbody>' + rows(names, weights) + '</tbody></table>';
    const ordinary = Object.entries(bundle.ordinary).map(([discipline, config]) =>
      table('Harmony · ' + discipline + ' · T = ' + config.temperature, ['Foundation', 'Melody', 'Orchestra', 'RM4b'], config.weights)).join('');
    const specialists = Object.entries(bundle.formatRouting.selection).flatMap(([profile, rule]) => {
      const routing = bundle.formatRouting;
      const model = routing.models[rule.selected];
      if (!model || profile === 'junior.rubbers' || profile === 'sets.standard') return [];
      return ['Singles', 'Doubles'].map(discipline => {
        const key = profile + (rule.selected.startsWith('discipline') ? ':' + discipline : '');
        return table(profile + ' · ' + discipline, routing.experts, model.cells[key]?.weights || model.globalWeights);
      });
    }).join('');
    const definitions = Object.entries(bundle.definitions).map(([name, config]) =>
      '<tr><th scope="row">' + esc(name) + '</th><td>' + Object.entries(config.parameters).map(([key, value]) => esc(key) + ' = ' + esc(String(value))).join(' · ') + '</td></tr>').join('');
    const legacy = Object.entries(window.BRTARM4.config).map(([name, config]) =>
      '<tr><th scope="row">' + esc(name) + '</th><td>' + Object.entries(config).map(([key, value]) => esc(key) + ' = ' + esc(String(value))).join(' · ') + '</td></tr>').join('');
    return `<span class="guide-tag">Technical methodology</span><h3>Recovered blueprint</h3>
      <h4>Joint player fit</h4><p>Skill gap η is the home mean skill minus the away mean skill. The game probability is σ(η).</p>
      <div class="equation">σ(η) = 1 / (1 + e<sup>−η</sup>)</div>
      <p>Older results decay by the configured half-life H. If a score cap C is set, the weight is also multiplied by min(1, C / max(1, games played)). The joint fit penalises deviations from its prior and couples singles and doubles with ρ.</p>
      <div class="equation">w = 2<sup>−age/H</sup> · L<sub>Melody</sub> = αL<sub>native</sub> + (1 − α)L<sub>composite</sub></div>
      <table><caption>Orchestra fit parameters</caption><tbody>${definitions}</tbody></table>
      <table><caption>Base model parameters</caption><tbody>${legacy}</tbody></table>
      <h4>Forecast blends</h4><p>Ordinary Sets use p = σ(T · logit(Σ wᵢpᵢ)). The format router may delegate to a base model for a particular context.</p>
      <div class="vault-blends">${ordinary}${table('Woodwind · Junior Rubbers', ['RM4a', 'RM4b', 'Symmetric RM4.1 Ensemble'], [1/3, 1/3, 1/3])}${table('RM4.1 Ensemble', frozen.ensemble.names, frozen.ensemble.weights)}</div>
      <details><summary>Specialist routing weights</summary><div class="vault-blends">${specialists}</div></details>`;
  }

  let consoleLayer, consoleOutput, consoleInput, logging = false, playback = 0;
  let historyIndex = 0;
  const lines = [], history = [];
  function print(message, kind = '') {
    const time = new Date().toLocaleTimeString('en-AU', { hour12: false });
    const row = { time, message, kind };
    lines.push(row);
    if (lines.length > 250) lines.shift();
    if (consoleOutput) {
      consoleOutput.append(consoleLine(row));
      if (consoleOutput.children.length > 250) consoleOutput.firstElementChild.remove();
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }
  function consoleLine({ time, message, kind }) {
    const row = document.createElement('div'), clock = document.createElement('time');
    row.className = 'vault-console-line' + (kind ? ' vault-console-' + kind : '');
    clock.textContent = time;
    row.append(clock, document.createTextNode(' ' + message));
    return row;
  }
  function trace(action, detail) {
    if (logging) print(action + (detail ? ' · ' + detail : ''));
  }
  function closeConsole() {
    playback++;
    hide(consoleLayer);
  }
  function openConsole() {
    if (!consoleLayer) {
      consoleLayer = makeOverlay('vaultConsoleOverlay', 'vault-console-overlay',
        `<div class="overlay-backdrop" data-console-close></div>
        <section class="vault-console" role="dialog" aria-modal="true" aria-labelledby="vault-console-title">
          <header><h2 id="vault-console-title">Site console</h2><span>LOCAL SESSION</span>
          <button type="button" data-console-close aria-label="Close console">×</button></header>
          <div class="vault-console-output" role="log" aria-label="Console output"></div>
          <form><label for="vault-console-input">›</label><input id="vault-console-input" aria-label="Console command" placeholder="Type help" maxlength="80" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="submit">Run</button></form>
        </section>`, closeConsole);
      consoleOutput = consoleLayer.querySelector('.vault-console-output');
      consoleInput = consoleLayer.querySelector('input');
      consoleOutput.replaceChildren(...lines.map(consoleLine));
      consoleLayer.querySelectorAll('[data-console-close]').forEach(button => button.addEventListener('click', closeConsole));
      consoleLayer.querySelector('form').addEventListener('submit', command);
      consoleInput.addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key) || !history.length) return;
        event.preventDefault();
        historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === 'ArrowUp' ? -1 : 1)));
        consoleInput.value = history[historyIndex] || '';
      });
      if (!lines.length) print('BRTA local console. Type help for commands.', 'system');
    }
    historyIndex = history.length;
    open(consoleLayer, 'input');
    consoleOutput.scrollTop = consoleOutput.scrollHeight;
  }
  function command(event) {
    event.preventDefault();
    const value = consoleInput.value.trim().toLowerCase();
    if (!value) return;
    consoleInput.value = '';
    // Only keep recognised commands in history. Mistyped pasted text is discarded.
    const known = ['help', 'log', 'stop', 'clear', 'status', 'prank', 'mute', 'unmute', 'exit'];
    if (known.includes(value)) {
      history.push(value);
      if (history.length > 30) history.shift();
      print('› ' + value, 'command');
    }
    historyIndex = history.length;
    switch (value) {
      case 'help': print('help · log · stop · clear · status · prank · mute · unmute · exit', 'system'); break;
      case 'log': logging = true; print('Action logging on. Type stop to end it.', 'system'); break;
      case 'stop': logging = false; playback++; print('Action logging and playback stopped.', 'system'); break;
      case 'clear': playback++; lines.length = 0; consoleOutput.replaceChildren(); break;
      case 'status': print(`${activePage || 'No tabs left'} · ${buttons.length - removed.size} tabs · logging ${logging ? 'on' : 'off'} · sound ${muted ? 'muted' : 'on'}`, 'system'); break;
      case 'prank': playPrank(); break;
      case 'mute': muted = true; print('Sound muted.', 'system'); break;
      case 'unmute': muted = false; sound(410, 620); print('Sound on.', 'system'); break;
      case 'exit': closeConsole(); break;
      default: print('Unknown command. Type help.', 'system');
    }
  }
  async function playPrank() {
    const token = ++playback;
    print('Opening the RM1000 relay transcript…', 'system');
    sound(290, 485, .12, 'triangle');
    const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
    let relay;
    for (let attempt = 0; attempt < 48; attempt++) {
      if (token !== playback || consoleLayer.classList.contains('hidden')) return;
      relay = window.BRTAHiddenRelay?.inspect();
      if (relay?.done) break;
      await pause(250);
    }
    if (token !== playback || consoleLayer.classList.contains('hidden')) return;
    if (!relay?.transcript.length) return print('The relay has not started. Try again once a section is loaded.', 'system');
    for (const { from, text, to, packet, scrambled } of relay.transcript) {
      if (token !== playback || consoleLayer.classList.contains('hidden')) return;
      const route = to ? ' → ' + to : '';
      const payload = packet ? ' [packet ' + packet + ']' : scrambled ? ' [scrambled ' + scrambled + ']' : '';
      print(from + route + '  ' + text + payload, 'relay');
      sound(305, 240, .055, 'triangle');
      if (!motion.matches) await pause(225 + Math.min(520, text.length * 5));
    }
    print(relay.done ? 'End of recovered transcript.' : 'The relay is still running. Type prank again for the rest.', 'system');
  }

  window.addEventListener('keydown', event => {
    if (!event.shiftKey || !event.altKey || event.ctrlKey || event.metaKey ||
        (event.code !== 'KeyU' && event.key.toLowerCase() !== 'u')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (consoleLayer && !consoleLayer.classList.contains('hidden') && BRTAOverlays.top() === consoleLayer) closeConsole();
    else openConsole();
  }, true);
  for (const type of ['click', 'change', 'submit']) {
    document.addEventListener(type, event => {
      if (!logging || event.target.closest?.('#vaultConsoleOverlay')) return;
      const target = event.target.closest?.('button,a,summary,input,select,textarea,form');
      if (!target) return;
      // Report the control, never a form value, link destination, player name or typed key.
      const named = target.dataset.page || target.id || [...target.attributes].find(attr => attr.name.startsWith('data-'))?.name;
      trace(type, named || target.localName);
    }, true);
  }
  for (const event of ['brta-section-ready', 'brta-module-toggle', 'brta-custom-sections-change']) {
    window.addEventListener(event, () => trace(event));
  }
})();
