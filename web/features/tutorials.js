/* use the real section for the tour, then put the page back */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const mobile = matchMedia('(max-width: 900px)');
  const examples = {
    result: '#resultOverlay', player: '#profileOverlay', prediction: '#predictionOverlay', navigation: '#navigationOverlay'
  };
  const topics = [
    { id: 'start', title: 'Make it yours', detail: 'Competition, section and your default', page: 'results',
      steps: [
        ['#competitionPicker', 'Choose your competition', 'Start with the day you play. The competition selector includes every current BRTA competition.'],
        ['#sectionPicker', 'Find your section', 'Choose your section here. You can change sections whenever you want.'],
        ['#navigationDefault', 'Set your home section', 'Default Section saves where the site opens on this device. You can save your current section or choose another one.']
      ] },
    { id: 'results', title: 'Results & scoresheets', detail: 'From a team result to each individual rubber', page: 'results',
      steps: [
        ['.result-round', 'The round at a glance', 'Results are grouped by round. Each match shows the two teams, the score and the team points.'],
        ['.result-match[data-match-id]', 'Open a scorecard', 'Select a completed match to inspect the singles and doubles scores.'],
        ['#resultContent .result-scorecard', 'Read the scoresheet', 'Each row is one rubber. Scores stay between the two sides, with winners highlighted.', 'result'],
        ['#resultContent .result-detail-head', 'Follow the teams', 'The underlined team names open their corresponding club and team statistics.', 'result']
      ] },
    { id: 'standings', title: 'Standings & finals', detail: 'The ladder and the path to the final', page: 'standings',
      steps: [
        ['#standingsBody', 'Where every team stands', 'Read team points, records and movement together. Select an underlined team name for its club page.'],
        ['#page-standings', 'Qualification and knockout matches', 'At the end of the regular season, the final ladder stays fixed. Qualifiers and the knockout draw show the finals pathway.']
      ] },
    { id: 'ratings', title: 'Players & ratings', detail: 'Power, lineups, career history and Following', page: 'ratings',
      steps: [
        ['.players-modes', 'Two ways to explore Players', 'Ratings shows Power by discipline. Players shows the lineup for each team and lets you search past seasons.'],
        ['.players-rating-search', 'Filter section ratings', 'Search for a player or pair, or choose a team. Try part of a name or a close spelling.'],
        ['#ratingBody tr', 'Power and performance bands', 'Power summarises recorded performance. Bands show where a rating sits within the section.'],
        ['#profileContent .profile-head', 'Inside a Player Lab', 'The Section Lab shows graphs and results for the selected section. Use Career to see other seasons and rivalries.', 'player'],
        ['#careerSearch', 'Search across seasons', 'Find a player in the BRTA archive. Choose a scope to narrow the results or select a player to open their Career Lab.', 'directory'],
        ['#playersRosters .players-roster-title', 'Read the section lineups', 'Switch between Singles and Overall to change the colours and Power shown. Use a team’s Power order button to sort its players.', 'directory'],
        ['[data-following-open]', 'Keep track of players', 'Star someone in search results or their Player Lab. The gold star here opens your Following list.', 'directory']
      ] },
    { id: 'clubs', title: 'Clubs & teams', detail: 'Club details, team stats and participation', page: 'teams',
      steps: [
        ['#page-teams', 'Your section’s clubs', 'Choose a club to see its information and the teams represented in this section.'],
        ['#page-teams', 'Explore participation', 'Participation connects a club to its entries across competitions and seasons. Custom competitions show their team statistics directly.']
      ] },
    { id: 'fixtures', title: 'Fixtures & predictions', detail: 'Upcoming matches and lineup comparisons', page: 'fixtures',
      steps: [
        ['.fixture-round', 'What is coming up?', 'Upcoming fixtures include the round and teams. Open a playable match for its outlook. Byes have no match to predict.'],
        ['#predictionContent', 'Choose the lineups', 'The Prediction Centre lets you change selected players and pairings, then inspect the updated forecast.', 'prediction']
      ] },
    { id: 'history', title: 'Explore history', detail: 'Find past competitions, teams and scorecards', page: 'results',
      steps: [
        ['[data-layout-open="history"]', 'Browse another season', 'History opens the season directory. Quick Nav also lets you drill down through a competition, season and section.'],
        ['#quickNavigationBtn', 'Go straight to what you want', 'Quick Nav can browse a past section’s teams, players and fixtures. A name search opens the player’s Career Lab.']
      ] },
    { id: 'navigation', title: 'Quick navigation', detail: 'Search and browse with your keyboard or phone', page: 'results',
      steps: [
        ['#quickNavigationBtn', 'A shortcut to the whole site', 'Open Quick Nav here, with Ctrl/Cmd+Shift+P, or with Escape when a dialog is closed.'],
        ['#navigationSearch', 'Search within a destination', 'Type a player, team or page name to search directly. Open a section to browse its results and fixtures. Arrow keys move, Enter opens, and Escape goes back.', 'navigation']
      ] }
  ];
  const library = document.createElement('div');
  library.id = 'tutorialLibrary';
  library.className = 'overlay hidden';
  library.innerHTML = '<div class="overlay-backdrop" data-tutorial-close></div><section class="settings-sheet tutorial-library" role="dialog" aria-modal="true" aria-labelledby="tutorialLibraryTitle"><header><div><span class="kicker">LEARN YOUR WAY</span><h2 id="tutorialLibraryTitle">Tutorials</h2><p>Choose a topic. Follow it on the actual site, one step at a time.</p></div><button class="close-btn" data-tutorial-close aria-label="Close tutorials">×</button></header><div class="tutorial-library-content"><button class="button primary tutorial-full" data-tutorial="all">Take the full tour <small>All topics · Go at your own pace</small></button><div class="tutorial-topics"></div></div></section>';
  const tour = document.createElement('div');
  tour.id = 'tutorialTour';
  tour.className = 'overlay hidden tutorial-tour';
  tour.innerHTML = '<div class="tutorial-spotlight" aria-hidden="true"></div><section class="tutorial-callout" role="dialog" aria-modal="true" aria-labelledby="tutorialStepTitle" tabindex="-1"><div class="tutorial-progress"><span></span></div><div class="tutorial-caption"><span class="kicker"></span><button class="export-link" data-tour="exit">Exit tutorial</button></div><h2 id="tutorialStepTitle"></h2><p></p><div class="tutorial-controls"><button class="button secondary" data-tour="back">Back</button><span role="status"></span><button class="button primary" data-tour="next">Next</button></div></section>';
  document.body.append(library, tour);
  const panel = tour.querySelector('.tutorial-callout');
  const spot = tour.querySelector('.tutorial-spotlight');
  let steps = [], position = 0, origin, token = 0, target, example, pending = false, menuFocus;
  const completed = () => { try { return JSON.parse(localStorage.getItem('brta-tutorials-v1') || '[]'); } catch { return []; } };
  function menu() {
    if (origin) finish();
    if (!library.contains(document.activeElement)) {
      menuFocus = document.activeElement.closest('#navigationOverlay') ? $('#quickNavigationBtn') : document.activeElement;
    }
    close('#navigationOverlay');
    const seen = completed();
    library.querySelector('.tutorial-topics').innerHTML = topics.map(topic =>
      '<button class="tutorial-topic" data-tutorial="' + topic.id + '"><span class="tutorial-topic-icon" aria-hidden="true">' +
      ({ start:'⌂',results:'≡',standings:'▤',ratings:'▥',clubs:'⌂',fixtures:'▦',history:'◷',navigation:'⌕' })[topic.id] +
      '</span><span><b>' + topic.title + '</b><small>' + topic.detail + '</small></span>' + (seen.includes(topic.id) ? '<span class="tutorial-done">Completed</span>' : '') + '</button>').join('');
    library.classList.remove('hidden');
    window.BRTAOverlays.lock(library);
    library.querySelector('.tutorial-library-content').scrollTop = 0;
    library.querySelector('.close-btn').focus({ preventScroll: true });
  }
  function closeLibrary() {
    close('#tutorialLibrary');
    window.BRTAOverlays.unlock(library);
    menuFocus?.focus({ preventScroll: true });
  }
  function closeExample() {
    if (!example) return;
    close('#' + example.id);
    example.removeAttribute('data-dialog-preview');
    example = null;
  }
  function layout() {
    if (tour.classList.contains('hidden')) return;
    const box = target?.getBoundingClientRect();
    const within = target?.closest('.result-sheet, .profile-sheet, .prediction-sheet, .navigation-sheet')?.getBoundingClientRect();
    const callout = panel.getBoundingClientRect();
    const topDocked = panel.classList.contains('tutorial-callout-top');
    if (!box?.width || !box?.height) { spot.hidden = true; return; }
    const left = Math.max(4, box.left - 6, within?.left ?? 0);
    const top = Math.max(4, box.top - 6, within?.top ?? 0, topDocked ? callout.bottom + 4 : 0);
    const right = Math.min(innerWidth - 4, box.right + 6, within?.right ?? innerWidth);
    const bottom = Math.min(innerHeight - 4, box.bottom + 6, within?.bottom ?? innerHeight, topDocked ? innerHeight : callout.top - 4);
    spot.hidden = right <= left || bottom <= top;
    if (!spot.hidden) Object.assign(spot.style, { left: left + 'px', top: top + 'px', width: right - left + 'px', height: bottom - top + 'px' });
  }
  function frameTarget() {
    if (!target) return;
    const bounds = target.getBoundingClientRect();
    const needsScroll = bounds.top < 0 || bounds.bottom > innerHeight;
    if (needsScroll) target.scrollIntoView({ block: bounds.height > innerHeight * .6 ? 'start' : 'center', behavior: 'instant' });
    const box = target.getBoundingClientRect();
    const panelHeight = panel.offsetHeight + 20;
    const spaceAbove = Math.max(0, box.top);
    const spaceBelow = Math.max(0, innerHeight - box.bottom);
    const topDocked = spaceAbove >= panelHeight || spaceBelow < panelHeight && spaceAbove > spaceBelow;
    panel.classList.toggle('tutorial-callout-top', topDocked);
    if (mobile.matches && spaceAbove < panelHeight && spaceBelow < panelHeight) {
      const callout = panel.getBoundingClientRect();
      const first = topDocked ? callout.bottom + 12 : 12;
      const last = topDocked ? innerHeight - 12 : callout.top - 12;
      const desiredTop = Math.max(first, last - box.height);
      const offset = box.top - Math.max(first, Math.min(box.top, desiredTop));
      let scroller = target.parentElement;
      while (scroller && !(scroller.scrollHeight > scroller.clientHeight &&
          /auto|scroll/.test(getComputedStyle(scroller).overflowY))) scroller = scroller.parentElement;
      (scroller || document.scrollingElement).scrollBy({ top: offset, behavior: 'instant' });
    }
    layout();
  }
  async function renderStep() {
    const request = ++token;
    pending = true;
    const item = steps[position], [selector, heading, copy, detail] = item.step;
    target = null;
    spot.hidden = true;
    panel.classList.remove('tutorial-callout-top');
    panel.querySelector('h2').textContent = heading;
    panel.querySelector('p').textContent = copy;
    panel.querySelector('.kicker').textContent = item.topic.title;
    panel.querySelector('[role="status"]').textContent = (position+1) + ' of ' + steps.length;
    panel.querySelector('[data-tour="back"]').disabled = position === 0;
    panel.querySelector('[data-tour="next"]').disabled = true;
    panel.querySelector('[data-tour="next"]').textContent = position === steps.length-1 ? 'Finish' : 'Next';
    panel.querySelector('.tutorial-progress span').style.width = ((position+1)/steps.length*100)+'%';
    closeExample();
    if (activePage !== item.topic.page) switchPage(item.topic.page);
    tour.classList.remove('hidden');
    window.BRTAOverlays.lock(tour);
    panel.focus({ preventScroll: true });
    try {
      if (item.topic.page === 'teams') await window.BRTAClubs?.ready();
      if (request !== token) return;
      if (item.topic.id === 'ratings') window.BRTAPlayers?.show(detail === 'directory' ? 'history' : 'section');
      if (detail && examples[detail]) {
        example = $(examples[detail]);
        example?.setAttribute('data-dialog-preview', '');
      }
      if (detail === 'result') {
        const button = [...document.querySelectorAll('.result-match[data-match-id]')].find(card => findMatch(card.dataset.matchId)?.rubbers?.length) || document.querySelector('.result-match[data-match-id]');
        if (button) openMatch(button.dataset.matchId);
      }
      if (detail === 'player') {
        const row = singles[0] || dinds[0];
        if (row) openProfile(row.player);
      }
      if (detail === 'prediction') {
        const button = document.querySelector('.fixture-match[data-predict-id]');
        if (button) openPrediction(button.dataset.predictId);
      }
      if (detail === 'navigation') window.BRTANavigation.open({ preview: true });
      if (request !== token) return;
      if (example) example.style.zIndex = String(Number(tour.style.zIndex) - 1);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (request !== token) return;
      target = document.querySelector(selector);
      if (!target || !target.getClientRects().length) {
        target = document.querySelector('#page-' + item.topic.page);
        panel.querySelector('p').textContent = copy + ' This section has no example available to open.';
      }
      if (mobile.matches && item.topic.id === 'navigation') {
        panel.querySelector('p').textContent = detail ?
          'Tap Search and type a player, team or page name. You can also tap a competition to browse its sections.' :
          'Tap Quick Nav in the header to browse sections, teams, fixtures and players.';
      }
      frameTarget();
    } catch {
      if (request !== token) return;
      target = document.querySelector('#page-' + item.topic.page);
      panel.querySelector('p').textContent = copy + ' The example could not be loaded in this section.';
      frameTarget();
    } finally {
      if (request === token) {
        pending = false;
        panel.querySelector('[data-tour="next"]').disabled = false;
        panel.focus({ preventScroll: true });
      }
    }
  }
  function start(id) {
    closeLibrary();
    origin = { page: activePage, playersView: ratingScope, scroll: [scrollX, scrollY], focus: menuFocus };
    steps = topics.filter(topic => id === 'all' || topic.id === id).flatMap(topic => topic.steps.map(step => ({ topic, step })));
    position = 0;
    renderStep();
  }
  function finish(done = false) {
    token++;
    pending = false;
    tour.classList.add('hidden');
    closeExample();
    window.BRTAOverlays.unlock(tour);
    if (done) {
      const ids = [...new Set([...completed(), ...steps.map(item => item.topic.id)])];
      localStorage.setItem('brta-tutorials-v1', JSON.stringify(ids));
    }
    const previous = origin;
    origin = null;
    if (previous) {
      if (ratingScope !== previous.playersView) setRatingScope(previous.playersView);
      switchPage(previous.page);
      scrollTo(...previous.scroll);
      if (previous.focus?.isConnected) previous.focus.focus({ preventScroll: true });
    }
    if (!document.querySelector('.overlay:not(.hidden)')) document.body.classList.remove('modal-open');
  }
  library.addEventListener('click', event => {
    if (event.target.closest('[data-tutorial-close]')) closeLibrary();
    const topic = event.target.closest('[data-tutorial]');
    if (topic) start(topic.dataset.tutorial);
  });
  tour.addEventListener('click', event => {
    const command = event.target.closest('[data-tour]')?.dataset.tour;
    if (command === 'exit') finish();
    if (pending) return;
    if (command === 'back' && position > 0) { position--; renderStep(); }
    if (command === 'next') {
      if (position === steps.length-1) { finish(true); menu(); }
      else { position++; renderStep(); }
    }
  });
  window.addEventListener('resize', frameTarget);
  document.addEventListener('scroll', layout, true);
  window.BRTAOverlays.register('tutorialLibrary', closeLibrary);
  window.BRTAOverlays.register('tutorialTour', () => finish());
  window.BRTATutorial = { open: menu, active: () => !!origin };
})();
