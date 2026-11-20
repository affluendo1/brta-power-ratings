/* 9.2: first visit setup and searchable navigation. */
(function () {
  'use strict';
  const firstVisit = window.BRTAFirstVisit;
  const linkedVisit = /\/(current|history)\//.test(location.pathname) ||
    new URLSearchParams(location.search).has('brta-route');
  const overlay = document.createElement('div');
  overlay.id = 'navigationOverlay';
  overlay.className = 'overlay hidden';
  overlay.innerHTML = '<div class="overlay-backdrop" data-nav-close></div><section class="settings-sheet navigation-sheet" role="dialog" aria-modal="true" aria-labelledby="navigationTitle"><header><div><span class="kicker">BRTA POWER RATINGS</span><h2 id="navigationTitle">Quick navigation</h2></div><button class="close-btn" data-nav-close aria-label="Close quick navigation">×</button></header><p id="navigationIntro"></p><div class="navigation-search"><button id="navigationBack" type="button" aria-label="Back to navigation">Back</button><input id="navigationSearch" type="search" autocomplete="off" placeholder="Where would you like to go?" aria-label="Search navigation" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="navigationResults"></div><div id="navigationResults" role="listbox" aria-label="Navigation results"></div><p id="navigationStatus" role="status"></p><footer><span>↑ ↓ to choose · Enter to open · Esc to close</span><button class="export-link" id="navigationHelp">Site guide</button></footer></section>';
  document.body.append(overlay);
  const input = overlay.querySelector('input');
  const list = overlay.querySelector('[role="listbox"]');
  const back = overlay.querySelector('#navigationBack');
  const title = overlay.querySelector('h2');
  const intro = overlay.querySelector('#navigationIntro');
  const status = overlay.querySelector('[role="status"]');
  let items = [], filtered = [], selected = 0, stack = [], welcome = false, busy = false;
  const official = () => currentCatalog().filter(row => !row.is_custom);
  const action = (label, detail, run) => ({ label, detail, run });
  function hide() {
    if (busy) return;
    close('#navigationOverlay');
    if (welcome) localStorage.setItem('brta-onboarding-v1', '1');
    welcome = false;
  }
  function paint() {
    const words = input.value.toLowerCase().trim().split(/\s+/);
    filtered = items.filter(item => words.every(word => (item.label + ' ' + item.detail).toLowerCase().includes(word)));
    selected = Math.min(selected, Math.max(0, filtered.length - 1));
    list.innerHTML = filtered.map((item, index) => '<button type="button" role="option" id="navigationOption' + index + '" aria-selected="' + (index === selected) + '" data-nav-index="' + index + '"><b>' + esc(item.label) + '</b><small>' + esc(item.detail) + '</small></button>').join('');
    input.setAttribute('aria-activedescendant', filtered.length ? 'navigationOption' + selected : '');
    status.textContent = filtered.length ? '' : 'No matches. Try a competition, section, player or page name.';
    back.hidden = !stack.length;
  }
  function show(label, rows, description = '', nested = false) {
    if (nested) stack.push({ label: title.textContent, rows: items, description: intro.textContent, query: input.value });
    title.textContent = label;
    intro.textContent = description;
    intro.hidden = !description;
    items = rows;
    input.value = '';
    selected = 0;
    paint();
    input.focus({ preventScroll: true });
  }
  async function chooseSection(row, saveDefault) {
    const previous = { catalog: viewCatalog, history: activeHistorySeasonId };
    activeHistorySeasonId = null;
    viewCatalog = currentCatalog();
    try {
      if (!await loadSection(row.section_code)) throw Error('Could not open this section. Try again.');
      if (saveDefault) {
        localStorage.setItem('brta-default-competition', row.competition_code);
        localStorage.setItem('brta-default-section', row.section_code);
      }
      localStorage.setItem('brta-onboarding-v1', '1');
      update();
      welcome = false;
    } catch (error) {
      viewCatalog = previous.catalog;
      activeHistorySeasonId = previous.history;
      throw error;
    }
  }
  function competitions(saveDefault = false) {
    const catalog = official();
    const choices = [...new Map(catalog.map(row => [row.competition_code, sectionCompetitionLabel(row)])).entries()];
    show(saveDefault ? 'Choose your home competition' : 'Change competition',
      choices.map(([code, label]) => action(label, 'Choose a section', () => {
        show('Choose your section', catalog.filter(row => row.competition_code === code).map(row =>
          action(row.section_label, label + (saveDefault ? ' · Save as my default' : ''),
            () => chooseSection(row, saveDefault))),
          saveDefault ? 'Your choice opens automatically on future visits on this device.' : 'Open any current section.', true);
      })), 'Select the day and competition you play in.', true);
  }
  function guide() {
    show('Find your way around', [
      action('Choose my default competition', 'Pick where the site opens on this device', () => competitions(true)),
      action('Results', 'Open a team match to see its individual scores and Player Labs', () => switchPage('results')),
      action('Standings', 'See the ladder, qualifiers and knockout draw', () => switchPage('standings')),
      action('Ratings', 'Tap a player for their Player Lab. Switch between singles and doubles.', () => switchPage('ratings')),
      action('Clubs', 'Club information, team stats and participation', () => switchPage('teams')),
      action('Fixtures', 'Choose an upcoming match to compare lineups in Prediction Centre', () => switchPage('fixtures')),
      action('History', 'Browse past seasons and competitions', () => openLayoutOverlay('history')),
      action('Settings', 'Change your theme, rating model and preferences', () => openSettings())
    ], 'Change Competition and Section using the selectors above the main tabs. Open Quick navigation from the header, or press Ctrl/Cmd+Shift+P.', true);
  }
  function commands() {
    const rows = [
      action('Change competition or section', 'Browse all current competitions', () => competitions()),
      action('Choose my default section', 'Save the competition that opens on future visits', () => competitions(true)),
      ...[['Results','results'],['Standings','standings'],['Ratings','ratings'],['Clubs','teams'],['Fixtures','fixtures']].map(([label,page]) => action(label, 'Open ' + label.toLowerCase(), () => switchPage(page))),
      action('Latest Round', 'Results and highlights from the recent round', () => openRound()),
      action('History', 'Browse past seasons', () => openLayoutOverlay('history')),
      action('Settings', 'Theme, rating model and preferences', () => openSettings()),
      action('Custom Competitions', 'Create or edit your competition', () => window.CustomSections?.open()),
      action('Site guide', 'Learn where to find things', guide)
    ];
    for (const row of official()) rows.push(action(sectionCompetitionLabel(row) + ' · ' + row.section_label, 'Open section', () => chooseSection(row, false)));
    for (const row of [...new Map([...(D?.singles || []), ...(D?.doublesIndividuals || [])].map(player => [player.player, player])).values()]) rows.push(action(row.player, 'Player Lab · ' + row.team, () => openProfile(row.player)));
    if (window.AuxiliaryPortal?.isUnlocked?.()) rows.push(action('Diagnostics', 'Extras · local logs and commands', () => window.dispatchEvent(new Event('brta-open-diagnostics'))));
    return rows;
  }
  function openNavigation() {
    if (busy) return;
    welcome = false;
    stack = [];
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
    show('Quick navigation', commands());
  }
  async function run(index) {
    if (busy || !filtered[index]) return;
    const item = filtered[index], before = items;
    busy = true;
    input.disabled = true;
    status.textContent = 'Opening…';
    try {
      await item.run();
      if (items === before) {
        busy = false;
        hide();
      }
    } catch (error) {
      overlay.classList.remove('hidden');
      document.body.classList.add('modal-open');
      status.textContent = error.message || 'Could not open that destination. Try again.';
    } finally {
      busy = false;
      input.disabled = false;
      if (!overlay.classList.contains('hidden')) input.focus({ preventScroll: true });
    }
  }
  input.addEventListener('input', () => { selected = 0; paint(); });
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % (filtered.length || 1);
      paint();
      list.children[selected]?.scrollIntoView({ block: 'nearest' });
    }
    if (event.key === 'Enter') { event.preventDefault(); run(selected); }
  });
  overlay.addEventListener('click', event => {
    const option = event.target.closest('[data-nav-index]');
    if (option) run(Number(option.dataset.navIndex));
    if (event.target.closest('[data-nav-close]')) hide();
  });
  back.onclick = () => {
    const previous = stack.pop();
    if (!previous) return;
    show(previous.label, previous.rows, previous.description);
    input.value = previous.query;
    paint();
  };
  overlay.querySelector('#navigationHelp').onclick = guide;
  window.BRTAOverlays?.register('navigationOverlay', hide);
  const button = document.createElement('button');
  button.id = 'quickNavigationBtn';
  button.className = 'button secondary';
  button.textContent = 'Quick navigation';
  button.title = 'Quick navigation · Ctrl/Cmd+Shift+P';
  button.onclick = openNavigation;
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'navigationOverlay');
  document.querySelector('#roundBtn').before(button);
  const toolbar = document.createElement('div');
  toolbar.className = 'navigation-home-actions';
  toolbar.innerHTML = '<button class="export-link" id="navigationDefault">Make this my default</button><button class="export-link" id="navigationChoose">Choose my home section</button><button class="export-link" id="navigationGuide">New here? Site guide</button><span id="navigationSaved" role="status"></span>';
  document.querySelector('#sectionPicker').parentElement.append(toolbar);
  toolbar.querySelector('#navigationDefault').onclick = () => {
    localStorage.setItem('brta-default-competition', D.meta.competition_code);
    localStorage.setItem('brta-default-section', D.meta.section_code);
    toolbar.querySelector('#navigationSaved').textContent = D.meta.section_label + ' saved as your default on this device.';
  };
  toolbar.querySelector('#navigationChoose').onclick = () => { openNavigation(); competitions(true); };
  toolbar.querySelector('#navigationGuide').onclick = () => { openNavigation(); guide(); };
  function update() {
    const saved = document.querySelector('#navigationSaved');
    saved.textContent = '';
    const current = !activeHistorySeasonId && D?.meta?.section_code === localStorage.getItem('brta-default-section');
    const save = document.querySelector('#navigationDefault');
    save.hidden = !!activeHistorySeasonId;
    save.textContent = current ? 'Your default section' : 'Make this my default';
    save.disabled = current;
  }
  let introduced = false;
  function ready() {
    update();
    if (introduced || !firstVisit || linkedVisit) return;
    if (document.querySelector('.overlay:not(.hidden)')) { setTimeout(ready, 300); return; }
    introduced = true;
    openNavigation();
    welcome = true;
    show('Welcome to BRTA Power Ratings', [
      action('Find my competition', 'Choose your day and section, then save it as your default', () => competitions(true)),
      action('Show me around', 'A short guide to results, ratings, clubs and predictions', guide),
      action('Explore this section', 'You can choose a home section at any time above the main tabs', () => {})
    ], 'Start with your competition. Your choice is saved on this device.');
  }
  window.addEventListener('brta-section-ready', ready);
  if (typeof D !== 'undefined' && D) ready();
  window.BRTANavigation = { open: openNavigation, guide: () => { openNavigation(); guide(); } };
  window.addEventListener('keydown', event => {
    const shortcut = ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') ||
      (event.shiftKey && event.altKey && (event.code === 'KeyU' || event.key.toLowerCase() === 'u'));
    const escape = event.key === 'Escape' && !event.target.closest?.('input,textarea,select,[contenteditable="true"]') &&
      !document.querySelector('.overlay:not(.hidden)');
    if (!shortcut && !escape) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (!overlay.classList.contains('hidden')) hide();
    else openNavigation();
  }, true);
})();
