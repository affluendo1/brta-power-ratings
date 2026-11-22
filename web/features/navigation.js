/* first visit stuff and the quick nav list */
(function () {
  'use strict';
  const mobile = matchMedia('(max-width: 900px)');
  const firstVisit = window.BRTAFirstVisit;
  const linkedVisit = /\/(current|history)\//.test(location.pathname) ||
    new URLSearchParams(location.search).has('brta-route');
  const overlay = document.createElement('div');
  overlay.id = 'navigationOverlay';
  overlay.className = 'overlay hidden';
  overlay.innerHTML = '<div class="overlay-backdrop" data-nav-close></div><section class="settings-sheet navigation-sheet" role="dialog" aria-modal="true" aria-labelledby="navigationTitle"><header><div><span class="kicker">BRTA POWER RATINGS</span><h2 id="navigationTitle">Quick navigation</h2></div><button class="close-btn" data-nav-close aria-label="Close quick navigation">×</button></header><div id="navigationCrumbs" class="navigation-crumbs"></div><p id="navigationIntro"></p><div class="navigation-search"><button id="navigationBack" type="button" aria-label="Back to navigation">Back</button><input id="navigationSearch" type="search" autocomplete="off" enterkeyhint="go" placeholder="Where would you like to go?" aria-label="Search navigation" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="navigationResults"></div><div id="navigationResults" role="listbox" aria-label="Navigation results"></div><p id="navigationStatus" role="status"></p><footer><span>↑ ↓ to choose · Enter to open · Esc to go back</span><button class="export-link" id="navigationHelp">Tutorials</button></footer></section>';
  const defaultForm = document.createElement('form');
  defaultForm.className = 'navigation-default-form';
  defaultForm.hidden = true;
  const choiceMarkup = (id, label) => '<div class="section-choice" id="' + id + 'Choice"><span class="choice-label" id="' + id +
    'Label">' + label + '</span><button class="choice-trigger" type="button" id="' + id +
    'Select" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="' + id + 'Label ' + id +
    'Value"><span id="' + id + 'Value"></span><i aria-hidden="true"></i></button><div class="choice-options" id="' +
    id + 'Options" role="listbox" aria-labelledby="' + id + 'Label"></div></div>';
  defaultForm.innerHTML = choiceMarkup('navigationDefaultCompetition', 'Competition') + choiceMarkup('navigationDefaultSection', 'Section') +
    '<button type="submit" class="button primary">Save default section</button>';
  overlay.querySelector('#navigationStatus').before(defaultForm);
  document.body.append(overlay);
  const input = overlay.querySelector('input');
  const list = overlay.querySelector('#navigationResults');
  const back = overlay.querySelector('#navigationBack');
  const title = overlay.querySelector('h2');
  const intro = overlay.querySelector('#navigationIntro');
  const status = overlay.querySelector('[role="status"]');
  let items = [], filtered = [], selected = 0, stack = [], welcome = false, busy = false;
  let demonstration = false, playerQuery = '', playerRows = [], playerTimer, searchingPlayers = false;
  const searchBox = overlay.querySelector('.navigation-search');
  const viewport = window.visualViewport;
  function fitViewport() {
    if (!mobile.matches || overlay.classList.contains('hidden')) return;
    const height = viewport?.height ?? innerHeight;
    overlay.style.setProperty('--navigation-height', height + 'px');
    overlay.style.setProperty('--navigation-offset', (viewport?.offsetTop ?? 0) + 'px');
    overlay.classList.toggle('navigation-keyboard', input === document.activeElement && innerHeight - height > 100);
  }
  window.addEventListener('resize', fitViewport);
  viewport?.addEventListener('resize', fitViewport);
  viewport?.addEventListener('scroll', fitViewport);
  function focusSearch() {
    if (!mobile.matches && !demonstration) input.focus({ preventScroll: true });
  }
  const official = () => currentCatalog().filter(row => !row.is_custom);
  const action = (label, detail, run) => ({ label, detail, run });
  function hide() {
    clearTimeout(playerTimer);
    input.blur();
    close('#navigationOverlay');
    if (welcome) localStorage.setItem('brta-onboarding-v1', '1');
    welcome = false;
    demonstration = false;
  }
  function paint() {
    const query = BRTAPlayerSearch.normalise(input.value);
    const words = query.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
    const matchWords = label => words.every(word => /^\d+$/.test(word) ?
      label.split(/[^\p{L}\p{N}]+/u).includes(word) : label.includes(word));
    const score = item => {
      const label = BRTAPlayerSearch.normalise(item.label), details = BRTAPlayerSearch.normalise(item.detail);
      if (!words.length) return item.searchOnly ? Infinity : 0;
      if (label === query) return 0;
      if (label.startsWith(query)) return 1;
      if (matchWords(label)) return 2;
      return matchWords(label + ' ' + details) ? 4 : Infinity;
    };
    const rootSearch = !stack.length && title.textContent === 'Quick navigation';
    const matches = items.map(item => [item, score(item)]).filter(([, rank]) => Number.isFinite(rank));
    if (rootSearch && input.value.trim() === playerQuery) for (const item of playerRows) {
      matches.push([item, item.typo ? 5 : score(item)]);
    }
    if (words.length) matches.sort((a, b) => a[1] - b[1]);
    list.classList.toggle('navigation-shortcuts', rootSearch && !words.length);
    filtered = (words.length ? matches.slice(0, 60) : matches).map(([item]) => item);
    selected = Math.min(selected, Math.max(0, filtered.length - 1));
    list.innerHTML = filtered.map((item, index) => '<button type="button" role="option" id="navigationOption' + index + '" aria-selected="' + (index === selected) + '" data-nav-index="' + index + '"><span class="nav-row-copy"><b>' + esc(item.label) + '</b><small>' + esc(item.detail) + '</small></span>' + (item.nested ? '<span class="nav-chevron" aria-hidden="true"></span>' : '') + '</button>').join('');
    input.setAttribute('aria-activedescendant', filtered.length ? 'navigationOption' + selected : '');
    status.textContent = searchingPlayers ? 'Searching player history…' : filtered.length ? '' : 'No matches. Try a player, team, section or page name.';
    back.hidden = !stack.length;
    overlay.querySelector('#navigationCrumbs').textContent = ['Quick Nav', ...stack.map(item => item.label).filter(label => label !== 'Quick navigation'), title.textContent].filter((label,index,all) => index === 0 || label !== all[index-1]).join(' / ');
  }
  function show(label, rows, description = '', nested = false) {
    if (busy && overlay.classList.contains('hidden')) return;
    if (mobile.matches) input.blur();
    if (nested) stack.push({
      label: title.textContent, rows: items, description: intro.textContent, query: input.value, scroll: list.scrollTop
    });
    clearTimeout(playerTimer);
    playerQuery = '';
    playerRows = [];
    searchingPlayers = false;
    closeChoices();
    defaultForm.hidden = true;
    overlay.classList.remove('navigation-choosing-default');
    searchBox.hidden = list.hidden = false;
    title.textContent = label;
    input.placeholder = label === 'Quick navigation' ? 'Search players, teams or pages' : 'Search ' + label.toLowerCase();
    intro.textContent = description;
    intro.hidden = !description;
    items = rows;
    input.value = '';
    selected = 0;
    paint();
    list.scrollTop = 0;
    focusSearch();
    fitViewport();
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
  function guide() { window.BRTATutorial.open(); }
  const requests = new Map();
  async function json(path) {
    if (!requests.has(path)) requests.set(path, fetch(path).then(response => {
      if (!response.ok) throw Error('This directory could not be loaded. Try again.');
      return response.json();
    }).catch(error => { requests.delete(path); throw error; }));
    return requests.get(path);
  }
  async function archive() {
    const result = await ensureHistoryCatalog();
    if (!result) throw Error('The season directory is unavailable. Try again.');
    return result;
  }
  function sectionMeta(section, season) {
    return { ...section, competition_code: section.competition_code || season?.competition_code,
      season_id: section.season_id || season?.season_id,
      season_label: section.season_label || season?.season_label };
  }
  async function payload(row) {
    if (D.meta.section_code === row.section_code && (D.meta.season_id === row.season_id || !row.season_id)) return D;
    if (row.is_custom) return window.CustomSections.payload(row.section_code);
    return json(row.data_path || 'data/site/sections/' + row.section_code + '.json');
  }
  async function visit(row, season, page = 'results', callback) {
    const previous = { catalog: viewCatalog, history: activeHistorySeasonId };
    viewCatalog = season && !season.is_current ? historySeasonSections(season) : currentCatalog();
    activeHistorySeasonId = season && !season.is_current ? season.id : null;
    if (!await loadSection(row.section_code)) {
      viewCatalog = previous.catalog;
      activeHistorySeasonId = previous.history;
      throw Error('Could not open this section. Try again.');
    }
    switchPage(page);
    if (callback) await callback();
  }
  const nested = (label, detail, run) => ({ label, detail, run, nested: true });
  async function sectionMenu(row, season) {
    const data = await payload(row);
    const context = [row.competition_label || season?.competition_label, row.season_label, row.section_label].filter(Boolean).join(' · ');
    show(row.section_label, [
      action('Open results', context, () => visit(row, season, 'results')),
      action('Open standings', context, () => visit(row, season, 'standings')),
      action('Open ratings', context, () => visit(row, season, 'ratings')),
      nested('Teams', 'Results, club pages and participation', () => teamList(row, season, data)),
      nested('Players', 'Player Labs for this section appearance', () => {
        const players = [...new Map([...(data.singles || []), ...(data.doublesIndividuals || [])].map(player => [player.player, player])).values()];
        show('Players', players.map(player => action(player.player, player.team + ' · ' + context,
          () => visit(row, season, 'ratings', () => openProfile(player.player)))), context, true);
      }),
      nested('Results & fixtures', 'Search teams, opponents, rounds and dates', () => fixtureList(row, season, data))
    ], context, true);
  }
  function fixtureList(row, season, data, team) {
    const fixtures = new Map();
    const groups = data.meta?.is_archive || season && !season.is_current ? (data.results || []) :
      [...(data.results || []), ...(data.upcomingFixtures || [])];
    for (const group of groups) {
      for (const fixture of group.fixtures || []) {
        if (team && fixture.home !== team && fixture.away !== team) continue;
        if (!fixtures.has(fixture.fixtureId)) fixtures.set(fixture.fixtureId, { ...group, fixtures: undefined, ...fixture });
      }
    }
    const rows = [...fixtures.values()].sort((a,b) => Number(b.round)-Number(a.round)).map(fixture =>
      action(fixture.home + ' vs ' + fixture.away, [fixture.label || 'Round ' + fixture.round, fixture.date, fixture.status].filter(Boolean).join(' · '),
        () => visit(row, season, fixture.status === 'Scheduled' ? 'fixtures' : 'results', () => {
          if (fixtureIsBye(fixture)) return;
          const result = findMatch(fixture.fixtureId);
          if (result && !BRTAStandings.pending(result)) openMatch(fixture.fixtureId);
          else if (canPredictFixture(fixture, fixture.round)) return openPrediction(fixture.fixtureId);
        })));
    show(team ? team + ' results & fixtures' : 'Results & fixtures', rows, row.season_label + ' · ' + row.section_label, true);
  }
  function teamMenu(team, row, season, data) {
    show(team, [
      nested('Results & fixtures', 'See this team’s schedule in this competition', () => fixtureList(row, season, data, team)),
      action('Team stats', 'Open the corresponding club page', () => visit(row, season, 'teams', async () => {
        await window.BRTAClubs.ready();
        await window.BRTAClubs.openTeam(team, 'stats');
      })),
      ...(!row.is_custom ? [action('Club participation', 'Explore this club’s competitions and seasons', () => visit(row, season, 'teams', async () => {
        await window.BRTAClubs.ready();
        await window.BRTAClubs.openTeam(team, 'participation');
      }))] : [])
    ], [row.season_label, row.section_label].filter(Boolean).join(' · '), true);
  }
  function teamList(row, season, data) {
    const rows = BRTATeamLab.teamNames(data).map(team =>
      nested(team, row.section_label, () => teamMenu(team, row, season, data)));
    show('Teams', rows, 'Choose a team in this section.', true);
  }
  async function historyMenu() {
    const directory = await archive();
    const competitions = [...new Map(directory.seasons.map(season => [season.competition_code, season.competition_label])).entries()];
    show('Past seasons', competitions.map(([code, label]) => nested(label, 'Browse seasons', () =>
      show(label, directory.seasons.filter(season => season.competition_code === code).map(season =>
        nested(season.season_label, season.is_current ? 'Current season' : 'Historical season', () =>
          show(season.season_label, historySeasonSections(season).map(row => nested(row.section_label, label,
            () => sectionMenu(sectionMeta(row, season), season))), 'Choose a section.', true))), 'Choose a season.', true)
    )), 'Choose a competition, season and section.', true);
  }
  async function clubEntries(name, team, code, competition) {
    const details = await json(competition.path);
    const club = details.clubs.find(item => item.name === name);
    if (!club) throw Error('This club record is unavailable.');
    const directory = await archive();
    const rows = club.entries.filter(entry => !team || entry.team === team);
    show((team || name) + ' · ' + competition.label, rows.map(entry =>
      nested(entry.season_label + ' · ' + entry.team, entry.section_label, async () => {
        const season = directory.seasons.find(item => item.competition_code === code &&
          (item.season_id === entry.season_id || item.is_current && entry.season_id === 'current'));
        const section = season && historySeasonSections(season).find(item =>
          item.section_code === entry.section_code || item.source_section_code === entry.section_code);
        if (!section) throw Error('This section could not be matched to the season directory.');
        const row = sectionMeta(section, season);
        teamMenu(entry.team, row, season, await payload(row));
      })), 'Select a season and team entry.', true);
  }
  function clubMenu(name, entries, team = null) {
    show(team || name, entries.map(({ code, competition }) =>
      nested(competition.label, 'Participation and team results', () => clubEntries(name, team, code, competition))),
    'Choose a competition with recorded participation.', true);
  }
  async function clubDirectoryRows(searchOnly = false) {
    const index = await json('data/archive/clubs.json');
    const clubs = new Map();
    for (const [code, competition] of Object.entries(index.competitions)) {
      for (const club of competition.clubs) {
        if (!clubs.has(club.name)) clubs.set(club.name, []);
        clubs.get(club.name).push({ code, competition, teams: club.teams || [] });
      }
    }
    const rows = [];
    for (const [name, entries] of clubs) {
      const labels = entries.map(entry => entry.competition.label).join(' · ');
      rows.push(nested(name, 'Club participation · ' + labels, () => clubMenu(name, entries)));
      for (const team of new Set(entries.flatMap(entry => entry.teams))) {
        const teamEntries = entries.filter(entry => entry.teams.includes(team));
        const teamLabels = teamEntries.map(entry => entry.competition.label).join(' · ');
        rows.push(nested(team, 'Team entries · ' + name + ' · ' + teamLabels, () => clubMenu(name, teamEntries, team)));
      }
    }
    rows.sort((a, b) => a.label.localeCompare(b.label, 'en-AU', { numeric: true }));
    return searchOnly ? rows.map(row => ({ ...row, searchOnly: true })) : rows;
  }
  async function clubDirectory() {
    show('Clubs across competitions', await clubDirectoryRows(), 'Search for a club or team.', true);
  }
  function bindDefaultChoice(id, options, current, select) {
    const trigger = overlay.querySelector('#' + id + 'Select'), menu = overlay.querySelector('#' + id + 'Options');
    renderChoice(trigger.id, options, current);
    for (const item of menu.children) {
      delete item.dataset.choiceId;
      item.onclick = () => {
        closeChoices();
        select(item.dataset.choiceValue);
        trigger.focus({preventScroll: true});
      };
    }
    trigger.onkeydown = event => {
      if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      if (trigger.getAttribute('aria-expanded') === 'false') trigger.click();
      (menu.querySelector('.selected') || menu.firstElementChild)?.focus();
    };
    menu.onkeydown = event => {
      if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const forward = event.key === 'ArrowDown';
      const next = event.key === 'Home' ? menu.firstElementChild : event.key === 'End' ? menu.lastElementChild :
        forward ? event.target.nextElementSibling || menu.firstElementChild : event.target.previousElementSibling || menu.lastElementChild;
      next?.focus();
    };
  }
  function defaultMenu() {
    const catalog = official();
    const saved = catalog.find(row => row.section_code === localStorage.getItem('brta-default-section'));
    const initial = saved || catalog.find(row => row.section_code === D?.meta?.section_code) ||
      catalog.find(row => row.competition_code === D?.meta?.competition_code) || catalog[0];
    show('Default Section', [], 'Choose where the site opens on this device.', true);
    defaultForm.hidden = false;
    overlay.classList.add('navigation-choosing-default');
    input.blur();
    searchBox.hidden = list.hidden = true;
    status.textContent = '';
    const competition = 'navigationDefaultCompetition', section = 'navigationDefaultSection';
    const competitions = [...new Map(catalog.map(row => [row.competition_code, sectionCompetitionLabel(row)]))];
    const sections = (code, current) => bindDefaultChoice(section,
      catalog.filter(row => row.competition_code === code).map(row => [row.section_code, row.section_label]),
      current, value => sections(code, value));
    const chooseCompetition = (code, current) => {
      bindDefaultChoice(competition, competitions, code, value => chooseCompetition(value));
      sections(choiceValue(competition + 'Select'), current);
    };
    chooseCompetition(initial?.competition_code, initial?.section_code);
    defaultForm.onsubmit = async event => {
      event.preventDefault();
      const row = catalog.find(item => item.section_code === choiceValue(section + 'Select'));
      if (!row || defaultForm.querySelector('button').disabled) return;
      const submit = defaultForm.querySelector('button');
      submit.disabled = true;
      status.textContent = 'Opening ' + row.section_label + '…';
      try { await chooseSection(row, true); hide(); }
      catch (error) { status.textContent = error.message; }
      finally { submit.disabled = false; }
    };
    overlay.querySelector('#' + competition + 'Select').focus({preventScroll: true});
  }
  function commands() {
    const rows = [
      action('Results', 'Scorecards and rounds', () => switchPage('results')),
      action('Latest Round', 'Recent results and highlights', () => BRTALatestRound.open()),
      action('Standings', 'Section ladder and finals', () => switchPage('standings')),
      action('Fixtures', 'Section draw', () => switchPage('fixtures')),
      action('Prediction Centre', 'Lineups and score estimates', () => openPredictionHome()),
      action('Players', 'Open the Players tab', () => switchPage('ratings')),
      action('Ratings', 'Section rankings and Power', () => {
        switchPage('ratings'); window.BRTAPlayers?.show('section');
      }),
      action('Player directory', 'Career search across seasons', () => {
        switchPage('ratings'); window.BRTAPlayers?.show('history');
      }),
      action('Following', 'Starred players and return watches', () => { hide(); switchPage('ratings'); window.BRTAPlayers?.following(); }),
      action('Clubs', 'Venues, teams and participation', () => switchPage('teams')),
      action('Find a club', 'Search the club directory', () => { hide(); window.BRTAClubs.openSearch(); }),
      nested('Current competitions', 'Choose a competition and section', () => {
        const choices = [...new Map(official().map(row => [row.competition_code, sectionCompetitionLabel(row)])).entries()];
        show('Current competitions', choices.map(([code,label]) => nested(label, 'Sections, teams, players and fixtures', () =>
          show(label, official().filter(row => row.competition_code === code).map(row => nested(row.section_label, label, () => sectionMenu(row))), 'Choose a section.', true))), '', true);
      }),
      nested('Past seasons', 'Browse competitions, years and sections', historyMenu),
      nested('This section', 'Browse teams, players and fixtures', () => sectionMenu(D.meta, activeHistorySeasonId ? historyCatalog?.seasons.find(season => season.id === activeHistorySeasonId) : null)),
      nested('Clubs across competitions', 'Explore team entries and results', clubDirectory),
      action('Custom Competitions', 'Create or edit a competition', () => window.CustomSections?.open()),
      action('Export section', 'Download results or a section report', () => window.BRTAExportUI853.open()),
      nested('Default Section', 'Choose where the site opens', defaultMenu),
      action('Settings', 'Theme, model and preferences', () => openSettings()),
      action('Changelog', 'Version and release history', () => window.BRTAChangelog?.open()),
      action('Methodology', 'Rating models and full site reference', () => openLayoutOverlay('methodology')),
      action('Rating model', 'Change the Power model', () => openLayoutOverlay('model')),
      action('Tutorial', 'Guided walkthroughs', guide)
    ];
    if (D?.meta) {
      const data = D;
      const season = activeHistorySeasonId ? historyCatalog?.seasons.find(item => item.id === activeHistorySeasonId) : null;
      const context = sectionCompetitionLabel(data.meta) + ' · ' + data.meta.section_label;
      for (const team of BRTATeamLab.teamNames(data)) {
        rows.push({ ...nested(team, 'Team · ' + context, () => teamMenu(team, data.meta, season, data)), searchOnly: true });
      }
    }
    for (const row of official()) rows.push({...nested(sectionCompetitionLabel(row) + ' · ' + row.section_label, 'Browse this section', () => sectionMenu(row)), searchOnly: true});
    if (D?.meta?.is_custom) for (const player of [...new Map([...(D.singles || []), ...(D.doublesIndividuals || [])].map(row => [row.player,row])).values()])
      rows.push({...action(player.player, 'Player Lab · ' + player.team, () => openProfile(player.player)), searchOnly: true});
    if (window.AuxiliaryPortal?.isUnlocked?.()) rows.push(action('Diagnostics', 'Extras · local logs and commands', () => window.dispatchEvent(new Event('brta-open-diagnostics'))));
    return rows;
  }
  function openNavigation({ preview = false } = {}) {
    if (busy) return;
    demonstration = preview;
    welcome = false;
    stack = [];
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
    const rootRows = commands();
    show('Quick navigation', rootRows);
    if (!preview) window.BRTAPlayers?.ready().catch(() => {});
    if (!preview) clubDirectoryRows(true).then(rows => {
      rootRows.push(...rows);
      if (items === rootRows && !busy && input.value.trim() && !overlay.classList.contains('hidden')) paint();
    }).catch(() => { /* The current section is searchable without the archive. */ });
  }
  async function run(index) {
    if (busy || !filtered[index]) return;
    const item = filtered[index], before = items;
    busy = true;
    if (mobile.matches) input.blur();
    list.setAttribute('aria-busy', 'true');
    status.textContent = 'Opening…';
    try {
      await item.run();
      if (items === before) {
        busy = false;
        hide();
      }
    } catch (error) {
      if (!overlay.classList.contains('hidden')) {
        status.textContent = error.message || 'Could not open that destination. Try again.';
      }
    } finally {
      busy = false;
      list.removeAttribute('aria-busy');
      if (!overlay.classList.contains('hidden')) {
        focusSearch();
        fitViewport();
      }
    }
  }
  input.addEventListener('input', () => {
    if (busy) return;
    selected = 0;
    clearTimeout(playerTimer);
    const value = input.value.trim();
    const global = !stack.length && title.textContent === 'Quick navigation' && value.length >= 2 && !demonstration;
    playerQuery = value;
    playerRows = [];
    searchingPlayers = global;
    paint();
    list.scrollTop = 0;
    if (!global) return;
    const rootRows = items;
    playerTimer = setTimeout(async () => {
      try {
        const matches = await window.BRTAPlayers.search(value);
        if (items !== rootRows || input.value.trim() !== value || overlay.classList.contains('hidden')) return;
        playerRows = matches.map(person => ({
          ...action(publicPlayerName(person.match.player),
            ['Career Lab', person.teams[0], person.seasons[0]].filter(Boolean).join(' · '),
            () => { hide(); window.BRTAPlayers.open(person, {careerOnly: true}); }),
          typo: person.match.score > 2
        }));
      } catch {
        if (items !== rootRows || input.value.trim() !== value) return;
      }
      searchingPlayers = false;
      paint();
    }, 80);
  });
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
    if (busy) return;
    const previous = stack.pop();
    if (!previous) return;
    show(previous.label, previous.rows, previous.description);
    input.value = previous.query;
    paint();
    list.scrollTop = previous.scroll;
  };
  overlay.querySelector('#navigationHelp').onclick = guide;
  function backOrClose() {
    const choice = defaultForm.querySelector('.section-choice.open');
    if (choice) {
      closeChoices();
      choice.querySelector('.choice-trigger').focus();
    } else if (!busy && stack.length) back.click();
    else hide();
  }
  window.BRTAOverlays?.register('navigationOverlay', backOrClose);
  const button = document.createElement('button');
  button.id = 'quickNavigationBtn';
  button.className = 'button secondary';
  button.innerHTML = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><span>Quick Nav</span>';
  button.setAttribute('aria-label', 'Quick navigation');
  button.title = 'Quick navigation · Ctrl/Cmd+Shift+P';
  button.onclick = () => openNavigation();
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-controls', 'navigationOverlay');
  document.querySelector('.header-actions').prepend(button);
  const toolbar = document.createElement('div');
  toolbar.className = 'navigation-home-actions';
  toolbar.innerHTML = '<button class="button primary" id="navigationGuide">Tutorial</button><button class="button secondary" id="navigationDefault">Default Section</button>';
  document.querySelector('#sectionPicker').parentElement.append(toolbar);
  toolbar.querySelector('#navigationDefault').onclick = () => { openNavigation(); defaultMenu(); };
  toolbar.querySelector('#navigationGuide').onclick = guide;
  function update() {
    const saved = currentCatalog().find(row => row.section_code === localStorage.getItem('brta-default-section'));
    toolbar.querySelector('#navigationDefault').title = saved ? 'Default · ' + sectionCompetitionLabel(saved) + ' · ' + saved.section_label : 'Choose where the site opens';
  }
  document.querySelector('#settingsBtn').innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 3-1 3-3 1-2 5 2 5 3 1 1 3h6l1-3 3-1 2-5-2-5-3-1-1-3Z"/><circle cx="12" cy="12" r="3"/></svg><span>Settings</span>';
  const mobileMenu = document.createElement('div');
  mobileMenu.id = 'mobileHeaderMenu';
  mobileMenu.className = 'overlay hidden';
  mobileMenu.innerHTML = '<div class="overlay-backdrop" data-header-menu-close></div>' +
    '<section class="settings-sheet header-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="headerMenuTitle">' +
    '<header><h2 id="headerMenuTitle">Menu</h2><button type="button" class="close-btn" aria-label="Close menu" data-header-menu-close>×</button></header>' +
    '<div class="header-menu-actions"></div></section>';
  document.body.append(mobileMenu);
  const menuButton = document.createElement('button');
  menuButton.type = 'button';
  menuButton.id = 'mobileMenuBtn';
  menuButton.className = 'button secondary';
  menuButton.setAttribute('aria-haspopup', 'dialog');
  menuButton.setAttribute('aria-controls', mobileMenu.id);
  menuButton.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>Menu</span>';
  document.querySelector('.header-settings-group').append(menuButton);
  function closeHeaderMenu() {
    close('#mobileHeaderMenu');
    window.BRTAOverlays.unlock(mobileMenu);
    if (mobile.matches) menuButton.focus({ preventScroll: true });
  }
  menuButton.onclick = () => {
    const actions = mobileMenu.querySelector('.header-menu-actions');
    actions.replaceChildren();
    const entries = [
      ['#settingsBtn', 'Settings'],
      ['#latestRoundBtn', 'Latest Round'],
      ['#customEditorBtn', 'Back to editor'],
      ['#customCompetitionsBtn', 'Custom Competitions'],
      ['.rc-entry', 'Racquet Club']
    ];
    for (const [selector, label] of entries) {
      const source = document.querySelector(selector);
      if (!source || source.hidden || source.classList.contains('hidden')) continue;
      const entry = document.createElement('button');
      entry.type = 'button';
      entry.className = 'button secondary';
      entry.textContent = label;
      entry.disabled = source.disabled;
      entry.onclick = () => {
        closeHeaderMenu();
        source.click();
      };
      actions.append(entry);
    }
    mobileMenu.classList.remove('hidden');
    window.BRTAOverlays.lock(mobileMenu);
    mobileMenu.querySelector('button').focus({ preventScroll: true });
  };
  mobileMenu.addEventListener('click', event => {
    if (event.target.closest('[data-header-menu-close]')) closeHeaderMenu();
  });
  window.BRTAOverlays.register(mobileMenu.id, closeHeaderMenu);
  mobile.addEventListener('change', () => {
    if (!mobile.matches && !mobileMenu.classList.contains('hidden')) closeHeaderMenu();
  });
  let introduced = false;
  function ready() {
    update();
    if (introduced || !firstVisit || linkedVisit) return;
    if (document.querySelector('.overlay:not(.hidden)')) { setTimeout(ready, 300); return; }
    introduced = true;
    openNavigation();
    welcome = true;
    show('Welcome to BRTA Power Ratings', [
      action('Find my competition', 'Choose your day and section, then save it as your default', defaultMenu),
      action('Start tutorial', 'A short guide to results, ratings, clubs and predictions', guide),
      action('Explore this section', 'You can choose a home section at any time above the main tabs', () => {})
    ], 'Start with your competition. Your choice is saved on this device.');
  }
  window.addEventListener('brta-section-ready', ready);
  if (typeof D !== 'undefined' && D) ready();
  window.BRTANavigation = { open: openNavigation, guide, defaultSection: () => { openNavigation(); defaultMenu(); } };
  window.addEventListener('keydown', event => {
    const shortcut = ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'p') ||
      (event.shiftKey && event.altKey && (event.code === 'KeyU' || event.key.toLowerCase() === 'u'));
    const escape = event.key === 'Escape' && !event.target.closest?.('input,textarea,select,[contenteditable="true"]') &&
      !document.querySelector('.overlay:not(.hidden)') && !window.BRTATutorial?.active();
    if (!shortcut && !escape || window.BRTATutorial?.active()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (!overlay.classList.contains('hidden')) backOrClose();
    else openNavigation();
  }, true);
})();
