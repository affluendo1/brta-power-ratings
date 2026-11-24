(() => {
  'use strict';
  const page = document.querySelector('#page-ratings');
  const overlay = document.querySelector('#profileOverlay');
  const content = document.querySelector('#profileContent');
  const explorer = document.querySelector('#profileMatchExplorer');
  const sheet = overlay.querySelector('.profile-sheet');
  const hero = document.createElement('header');
  hero.className = 'players-masthead';
  hero.innerHTML = '<div class="clubs9-hero"><div><span class="clubs9-kicker kicker" id="players-context"></span><h1>Players</h1></div><button type="button" class="follow82-star player-follow-star players-following-launch" data-following-open aria-label="Following" aria-haspopup="dialog" title="Following">' + BRTAPlayerFollowing.icon + '<span data-follow-count></span></button></div><div class="clubs9-tabs players-modes" role="group" aria-label="Players view"><button type="button" class="button secondary" data-players-view="section">Ratings</button><button type="button" class="button secondary" data-players-view="history">Players</button></div>';
  const directory = document.createElement('section');
  directory.className = 'players-directory';
  directory.hidden = true;
  directory.innerHTML = '<div class="players-search-panel"><h2>Find a player</h2><div class="players-directory-fields"><label class="players-search-input"><span>Player name</span><span class="players-search-control">' + BRTARatingControls.searchIcon + '<input type="search" id="careerSearch" placeholder="First name or surname" autocomplete="off"></span></label><label>Search scope<select id="careerSearchScope"><option value="section">This section</option><option value="season">Current seasons</option><option value="competition">This competition · all seasons</option><option value="all" selected>All BRTA history</option></select></label></div></div><div id="careerSearchStatus" role="status"></div><div id="careerSearchResults"></div><section id="playersRosters"></section>';
  page.prepend(hero, directory);
  const query = directory.querySelector('input');
  const found = directory.querySelector('#careerSearchResults');
  const status = directory.querySelector('#careerSearchStatus');
  const filterScope = directory.querySelector('#careerSearchScope');
  const rosters = directory.querySelector('#playersRosters');
  const skillWorkspace = document.createElement('section');
  skillWorkspace.className = 'skill-comparison';
  rosters.before(skillWorkspace);
  const skillComparison = BRTASkillComparison.setup(skillWorkspace, {
    careers, section: () => D?.meta, load: loadComparison,
    teams: () => rosterTeams, teamPlayers: comparisonTeamPlayers,
    followedPlayers: code => following.comparisonPlayers(code),
  });
  const ratingUI = window.BRTARatingControls.setup(page);
  const followingOverlay = document.createElement('div');
  followingOverlay.id = 'playersFollowingOverlay';
  followingOverlay.className = 'overlay hidden';
  followingOverlay.innerHTML = '<div class="overlay-backdrop" data-following-close></div><section class="settings-sheet players-following-sheet" role="dialog" aria-modal="true" aria-labelledby="players-following-title"><header class="players-following-header"><span class="following-icon">'+BRTAPlayerFollowing.icon+'</span><h2 id="players-following-title">Following</h2><button type="button" class="close-btn" aria-label="Close Following" data-following-close>×</button></header><div id="playersFollowing" hidden></div></section>';
  document.body.append(followingOverlay);
  const followingPanel = followingOverlay.querySelector('#playersFollowing');
  function closeFollowing() {
    followingPanel.hidden = true;
    close('#playersFollowingOverlay');
    BRTAOverlays.unlock(followingOverlay);
  }
  function openFollowing() {
    followingPanel.hidden = false;
    followingOverlay.classList.remove('hidden');
    BRTAOverlays.lock(followingOverlay);
    following.draw();
    followingPanel.scrollTop = 0;
    following.refresh();
    followingOverlay.querySelector('button').focus({preventScroll: true});
  }
  followingOverlay.addEventListener('click', event => {
    if (event.target.closest('[data-following-close]')) closeFollowing();
  });
  BRTAOverlays.register(followingOverlay.id, closeFollowing);
  const followingResults = BRTAFollowingResults.setup();
  const following = BRTAPlayerFollowing.setup({
    host: followingPanel, badge: hero.querySelector('[data-follow-count]'), careers,
    async loadResults(path) {
      const response = await fetch(path, {cache: 'no-cache', signal: AbortSignal.timeout?.(20000)});
      if (!response.ok) throw Error('Section unavailable');
      return normaliseTeamLabels(await response.json());
    },
    openResults: slides => {
      if (!slides.length) return false;
      if (!followingPanel.hidden) closeFollowing();
      return followingResults.open(slides);
    },
    open: person => { closeFollowing(); openCareer(person); }, analytics,
  });
  const indexData = {request: null};
  function analytics() {
    if (!indexData.request) indexData.request = fetch('data/archive/player-analytics.json.gz?v=990-full').then(response => {
      if (!response.ok) throw Error('Career analytics unavailable');
      const decoded = response.body.pipeThrough(new DecompressionStream('gzip'));
      return new Response(decoded).json();
    }).catch(() => { indexData.request = null; return null; });
    return indexData.request;
  }
  let rosterSource, rosterTeams = [], rosterView = 'singles';
  const orderedTeams = new Set();
  const rosterTones = ['top', 'strong', 'neutral', 'developing', 'low'];
  const rosterLabels = ['Top', 'Strong', 'Mid-range', 'Developing', 'Lower'];
  function emergencyMark(count = 0) {
    const title = count ? 'Emergency in ' + plural(count, 'tie') : 'Emergency';
    return '<abbr class="emergency-marker" title="' + title + '" aria-label="' + title + '">E</abbr>';
  }
  function drawRosters(force = false) {
    if (!D || (!force && rosterSource === D)) return;
    if (rosterSource !== D) {
      if (rosterSource?.meta.section_code !== D.meta.section_code) orderedTeams.clear();
      rosterTeams = BRTATeamLab.teamNames(D).map(team => BRTATeamLab.build(D, team));
      rosterSource = D;
    }
    const available = ['singles', 'overall'].filter(view => L8.rows(D, view).some(row => Number.isFinite(row.rating)));
    if (available.length && !available.includes(rosterView)) rosterView = available[0];
    const rated = L8.rows(D, rosterView).filter(row => Number.isFinite(row.rating));
    const rankings = new Map(BRTAHistory.ranked(rated, rosterView, D).map(row => [row.player, row]));
    const bands = BRTALayoutModel.bands(rated);
    const bandTones = ['top', 'top', 'strong', 'strong', 'neutral', 'developing', 'low', 'low'];
    const modes = ['singles', 'overall'].map(view => '<button type="button" data-roster-view="' + view +
      '" aria-pressed="' + (view === rosterView) + '"' + (!available.includes(view) ? ' disabled' : '') + '>' +
      (view === 'singles' ? 'Singles' : 'Overall') + '</button>').join('');
    rosters.innerHTML = '<div class="players-roster-title"><div><h2>Section lineups</h2><p>' +
      esc(D.meta.section_label) + ' · ' + plural(rosterTeams.length, 'team') + '</p></div><div class="players-switch" role="group" aria-label="Lineup Power and colours">' +
      modes + '</div></div><ul class="players-roster-key" aria-label="Section rating colours">' + rosterTones.map((tone, i) =>
        '<li class="roster-tone-' + tone + '">' + rosterLabels[i] + '</li>').join('') + '</ul><div class="players-roster-grid">' + rosterTeams.map((team, i) => {
      const core = [...team.core, ...team.historical];
      const orderByPower = orderedTeams.has(team.team);
      const lineup = [...core.map((p, j) => [p, p.order || j + 1]), ...team.emergencies.filter(p => !core.includes(p)).map(p => [p, ''])];
      if (orderByPower) lineup.sort(([a], [b]) => (rankings.get(b.name)?.rating ?? -Infinity) - (rankings.get(a.name)?.rating ?? -Infinity));
      function row([player, position]) {
        const emergency = player.emergencyOnly || player.emergencyDays.length > 0;
        const rating = rankings.get(player.name);
        const band = bands.classFor(rating?.rating);
        const tone = band ? bandTones[Number(band.slice(1))] : 'unrated';
        const power = rating ? 'P' + rating.rating + ' - ' + (rating.rank == null ? '—' : '#' + rating.rank) : '—';
        return '<li class="' + (emergency ? 'players-roster-emergency' : 'roster-tone-' + tone) + '"><span class="players-roster-slot">' + esc(position) +
          '</span><span class="players-roster-name"><button type="button" class="person" data-player="' + esc(player.name) + '">' +
          esc(publicPlayerName(player.name)) + '</button>' + (emergency ? emergencyMark(player.emergencyDays.length) : '') +
          '</span><span class="players-roster-power">' + power + '</span></li>';
      }
      return '<article class="players-roster-card"><header><h3><button type="button" class="person" data-directory-team="' +
        i + '">' + teamName(team.team) + '</button></h3><div class="roster-actions">'+
        (!D.meta.is_custom && lineup.length ? '<button type="button" class="button secondary" data-roster-skill="'+i+'">Skill graph</button>':'')+
        '<button type="button" class="button secondary roster-sort" data-roster-sort="' + i + '" aria-pressed="' + orderByPower +
        '" aria-label="Sort ' + esc(team.team) + ' by Power">Power order</button></div></header>' +
        (lineup.length ? '<ol>' + lineup.map(row).join('') + '</ol>' : '<p>No published lineup</p>') + '</article>';
    }).join('') + '</div>';
  }
  rosters.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.rosterView) {
      rosterView = button.dataset.rosterView;
      drawRosters(true);
      rosters.querySelector('[data-roster-view="' + rosterView + '"]').focus({preventScroll: true});
      return;
    }
    if (button.dataset.rosterSkill != null) {
      const team=rosterTeams[Number(button.dataset.rosterSkill)];
      if (team) void skillComparison.openTeam(team);
      return;
    }
    const sort = button.dataset.rosterSort;
    if (sort != null && rosterTeams[sort]) {
      const name = rosterTeams[sort].team;
      if (orderedTeams.has(name)) orderedTeams.delete(name);
      else orderedTeams.add(name);
      drawRosters(true);
      rosters.querySelector('[data-roster-sort="' + sort + '"]').focus({preventScroll: true});
      return;
    }
    const team = rosterTeams[button.dataset.directoryTeam];
    if (!team) return;
    switchPage('teams');
    await window.BRTAClubs?.ready();
    window.BRTAClubs?.openTeam(team.team);
  });
  const scopes = document.createElement('div');
  scopes.className = 'career-scopes';
  scopes.hidden = true;
  scopes.innerHTML = '<span class="players-eyebrow">PLAYER LAB SCOPE</span><div class="players-switch" role="group" aria-label="Player Lab scope"><button type="button" data-lab-scope="section">Section</button><button type="button" data-lab-scope="season">Season</button><button type="button" data-lab-scope="career">Career</button></div>';
  const career = document.createElement('section');
  career.className = 'career-panel';
  career.hidden = true;
  content.before(scopes, career);
  let model, indexRequest, lab, searchResults = [], visible = 15, debounce, labVersion = 0;
  const payloads = new Map();
  let exportingCareer = false;
  const comp = row => String(row.competitionLabel || competitionLabel(row.competitionCode)).split(' - ')[0];
  const distinct = (rows, key) => new Set(rows.map(key)).size;
  const plural = (n, noun) => n + ' ' + noun + (n === 1 ? '' : noun.endsWith('match') ? 'es' : 's');
  async function careers() {
    if (model) return model;
    if (!indexRequest) indexRequest = (async () => {
      if (playerSearchIndex) return playerSearchIndex;
      const res = await fetch('data/archive/player-search.json');
      if (!res.ok) throw Error('The career index could not be loaded.');
      const index = await res.json();
      if (index.version !== 1 || !Array.isArray(index.entries)) throw Error('The career index is unavailable.');
      playerSearchIndex = index;
      return index;
    })().then(index => model = BRTACareers.build(index, BRTAPlayerSearch)).catch(error => {
      indexRequest = null;
      throw error;
    });
    return indexRequest;
  }
  function syncPage() {
    const history = ratingScope === 'directory';
    if (history) following.refresh();
    page.classList.toggle('players-history', history);
    directory.hidden = !history;
    hero.querySelector('#players-context').textContent = [D?.meta?.season_label, D?.meta?.competition_code && competitionLabel(D.meta.competition_code), D?.meta?.section_label].filter(Boolean).join(' · ');
    if (!history && D) ratingUI.sync();
    hero.querySelectorAll('[data-players-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.playersView === (history ? 'history' : 'section'))));
  }
  const oldRatings = renderRatings;
  renderRatings = function () {
    if (ratingScope === 'directory') renderDirectory();
    else oldRatings();
    syncPage();
  };
  hero.addEventListener('click', event => {
    const view = event.target.closest('[data-players-view]')?.dataset.playersView;
    if (view === 'section') setRatingScope('section');
    if (view === 'history') setRatingScope('directory');
    if (event.target.closest('[data-following-open]')) openFollowing();
  });
  function renderDirectory() {
    drawRosters();
    skillComparison.draw();
    if (!query.value.trim()) {
      status.textContent = '';
      found.replaceChildren();
      rosters.hidden = false;
      return;
    }
    runSearch();
  }
  function matchesScope(row, scope) {
    if (scope === 'season') return row.isCurrent;
    if (scope === 'competition') return row.competitionCode === D?.meta?.competition_code;
    if (scope === 'section') return row.sectionCode === D?.meta?.section_code &&
      row.competitionCode === D?.meta?.competition_code &&
      (activeHistorySeasonId ? row.seasonKey === activeHistorySeasonId : row.isCurrent);
    return true;
  }
  let searchVersion = 0;
  async function runSearch() {
    const version = ++searchVersion;
    const value = query.value.trim(), scope = filterScope.value;
    if (!value) { renderDirectory(); return; }
    rosters.hidden = true;
    if (value.length < 2) {
      searchResults = [];
      found.replaceChildren();
      found.removeAttribute('aria-busy');
      status.textContent = 'Enter at least two characters.';
      return;
    }
    status.textContent = 'Searching published appearances…';
    found.setAttribute('aria-busy', 'true');
    try {
      if (D?.meta?.is_custom && scope === 'section') {
        const teams = BRTATeamLab.teamNames(D);
        searchResults = teams.flatMap(team => BRTATeamLab.build(D, team).players.flatMap(player => {
          const score = BRTAPlayerSearch.nameScore(player.name, value, true);
          if (!Number.isFinite(score)) return [];
          const row = {player: player.name, team, score, competitionLabel: 'Custom Competition', seasonLabel: D.meta.season_label,
            sectionLabel: D.meta.section_label, sectionCode: D.meta.section_code};
          return [{rows: [row], match: row, teams: [team], seasons: [row.seasonLabel], competitions: [], custom: true}];
        }));
        if (searchResults.some(person => person.match.score <= 2)) {
          searchResults = searchResults.filter(person => person.match.score <= 2);
        }
      } else {
        const m = await careers();
        if (version !== searchVersion || query.value.trim() !== value || filterScope.value !== scope) return;
        const inScope = person => person.rows.some(row => matchesScope(row, scope));
        searchResults = m.find(value).filter(inScope);
        if (!searchResults.length) searchResults = m.find(value, true).filter(inScope);
      }
      searchResults.sort((a, b) => Number(a.match.score > 2) - Number(b.match.score > 2) || b.seasons.length - a.seasons.length || b.rows.length - a.rows.length ||
        (a.match.score || 0) - (b.match.score || 0) || a.match.player.localeCompare(b.match.player));
      drawSearch();
    } catch {
      if (version !== searchVersion) return;
      status.textContent = 'Could not load player history.';
      if (!found.querySelector('table')) found.innerHTML = '<button class="button secondary" type="button" data-career-retry>Try again</button>';
    } finally {
      if (version === searchVersion) found.removeAttribute('aria-busy');
    }
  }
  function drawSearch() {
    status.textContent = searchResults.length ? plural(searchResults.length, 'Player') + (searchResults[0].match.score >= 3 ? ' · possible matches' : '') : 'No players found in this scope.';
    if (!found.querySelector('table')) {
      found.innerHTML = '<div class="table-wrap career-search-table" role="region" tabindex="0" aria-label="Player search results"><table><thead><tr><th>Player</th><th>Teams</th><th>First recorded</th><th>Seasons</th><th>Appearances</th><th>Competitions</th><th>Follow</th></tr></thead><tbody></tbody></table></div><button type="button" class="button secondary" data-career-more>Show more</button>';
    }
    const rows = searchResults.slice(0, visible).map((person, i) => '<tr><th scope="row"><button type="button" class="person" data-career-result="' +
      i + '">' + esc(publicPlayerName(person.match.player)) + '</button></th><td>' + esc([...new Set(person.teams.map(clubBaseName).filter(Boolean))].join(' · ') || '—') +
      '</td><td>' + esc(person.seasons.at(-1) || '—') + '</td><td>' + person.seasons.length +
      '</td><td>' + person.rows.length + '</td><td>' + esc(person.custom ? 'Custom Competition' :
        [...new Set(person.rows.map(comp))].join(' · ')) + '</td><td>' + (person.custom ? '—' : following.star(person)) + '</td></tr>');
    found.querySelector('tbody').innerHTML = rows.join('') || '<tr><td colspan="7">No matching players</td></tr>';
    found.querySelector('[data-career-more]').hidden = searchResults.length <= visible;
  }
  query.addEventListener('input', () => {
    clearTimeout(debounce);
    searchVersion++;
    visible = 15;
    if (!query.value.trim()) found.removeAttribute('aria-busy');
    debounce = setTimeout(runSearch, 120);
  });
  filterScope.addEventListener('change', () => { visible = 15; runSearch(); });
  found.addEventListener('click', event => {
    const b = event.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-career-more')) { visible += 15; drawSearch(); }
    if (b.hasAttribute('data-career-retry')) runSearch();
    if (b.hasAttribute('data-career-result')) {
      const person = searchResults[Number(b.dataset.careerResult)];
      if (!person) return;
      if (person.custom) { openProfile(person.match.player); return; }
      openCareer(person, {origin: person.rows.find(row => matchesScope(row, filterScope.value))});
    }
  });
  function openCareer(person, {careerOnly = true, origin = person.match || person.rows[0]} = {}) {
    query.blur();
    overlay.classList.remove('hidden');
    document.body.classList.add('modal-open');
    eightRaise(overlay);
    sheet.setAttribute('aria-label', publicPlayerName(origin.player));
    scopes.hidden = false;
    lab = {person, name: origin.player, season: origin.seasonLabel, sectionReady: false, origin, careerOnly};
    labVersion++;
    chooseScope('career');
    sheet.scrollTop = 0;
    career.querySelector('h2')?.focus({preventScroll: true});
  }
  function syncScopes() {
    scopes.querySelector('[data-lab-scope="section"]').hidden = !!lab?.careerOnly;
    scopes.querySelector('[data-lab-scope="season"]').hidden = !lab?.person?.rows.some(row => row.isCurrent);
  }
  function syncLab(name, round = null) {
    labVersion++;
    lab = null;
    content.hidden = false;
    career.hidden = true;
    scopes.hidden = true;
    if (!D?.meta || D.meta.is_custom || auxiliaryPlayer(name) || name.includes(' / ') || window.BRTAPlayerDisplay?.isUnknown(name)) return;
    const team = (L8.row(D, 'singles', name, round) || L8.row(D, 'doublesPlayers', name, round))?.team;
    lab = {name, meta: {...D.meta}, team, seasonKey: activeHistorySeasonId, season: D.meta.season_label, sectionReady: true,
      origin: {player: name, sectionCode: D.meta.section_code, seasonKey: activeHistorySeasonId}, round};
    scopes.hidden = false;
    scopes.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.labScope === 'section')));
    syncScopes();
    const current = lab;
    careers().then(m => {
      if (lab !== current || overlay.classList.contains('hidden')) return;
      current.person = m.inSection(current.name, current.meta, current.team, current.seasonKey);
      syncScopes();
      if (current.person) { following.placeSectionStar(content, current.person); following.refresh(); }
    }).catch(() => { /* Career can retry when opened. */ });
  }
  const sectionLab = openProfile;
  openProfile = function (name) { sectionLab(name); syncLab(name); };
  const historicalLab = openHistoricalProfile;
  openHistoricalProfile = function (name, round) { historicalLab(name, round); syncLab(name, round); };
  const renderSectionLab = lab8Open;
  lab8Open = function (name, round, pair) {
    renderSectionLab(name, round, pair);
    if (!pair) return;
    labVersion++;
    lab = null;
    scopes.hidden = career.hidden = true;
    content.hidden = false;
  };
  async function chooseScope(scope) {
    if (!lab) return;
    const version = ++labVersion;
    const current = lab;
    syncScopes();
    if (scope === 'season' && !lab.person?.rows.some(row => row.isCurrent)) scope = 'career';
    scopes.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.labScope === scope)));
    if (scope === 'section' && lab.careerOnly) return;
    if (scope === 'section') {
      if (!lab.sectionReady) return openAppearance(lab.origin);
      career.hidden = true;
      content.hidden = false;
      if (lab.showExplorer) explorer.classList.remove('hidden');
      if (lab.scroll != null) sheet.scrollTop = lab.scroll;
      return;
    }
    if (!content.hidden) {
      lab.showExplorer = !explorer.classList.contains('hidden');
      lab.scroll = sheet.scrollTop;
    }
    explorer.classList.add('hidden');
    career.hidden = true;
    content.hidden = true;
    sheet.scrollTop = 0;
    lab.scope = scope;
    await BRTAActivity.run(scope === 'career' ? 'Opening career history' : 'Opening season record', async task => {
      task.stage(12, 'Finding this player’s published entries…');
      if (!current.person) {
        try {
          const m = await careers();
          if (!isActiveLab(version)) return false;
          current.person = m.inSection(current.name, current.meta, current.team, current.seasonKey);
        } catch {
          if (!isActiveLab(version)) return false;
          career.innerHTML = '<p role="status">Could not load history.</p><button class="button secondary" type="button" data-career-lab-retry>Try again</button>';
          career.hidden = false;
          return false;
        }
      }
      if (!isActiveLab(version)) return false;
      syncScopes();
      task.stage(24, 'Preparing the player’s section history…');
      await drawLab(version, task);
      if (!isActiveLab(version)) return false;
      career.hidden = false;
      return true;
    }, {key: 'player-lab', message: 'Finding this player…'});
    if (isActiveLab(version) && !career.hidden) career.querySelector('h2')?.focus({preventScroll: true});
  }
  scopes.addEventListener('click', event => {
    const key = event.target.closest('[data-lab-scope]')?.dataset.labScope;
    if (key) chooseScope(key);
  });
  async function drawLab(version, task) {
    const {person, name, scope} = lab;
    const label = scope === 'career' ? 'Career history' : 'Season record';
    if (!person) {
      career.innerHTML = '<p class="players-eyebrow">' + label + '</p><h2 tabindex="-1">' + esc(publicPlayerName(name)) + '</h2><p>This section appearance has no clear match in the published history index. You can still view its ratings and matches in Section.</p>';
      return;
    }
    const current = person.rows.filter(row => row.isCurrent);
    const currentLabels = [...new Set(current.map(row => row.seasonLabel))];
    const season = currentLabels.includes(lab.season) ? lab.season : currentLabels[0];
    const rows = scope === 'career' ? person.rows : current.filter(row => row.seasonLabel === season);
    lab.displayRows = rows;
    const clubs = distinct(rows.filter(row => row.team), row => clubBaseName(row.team));
    career.innerHTML = '<header class="career-head"><div><p class="players-eyebrow">' + label + '</p><h2 tabindex="-1">' +
      esc(publicPlayerName(name)) + following.star(person) + '</h2></div>' +
      (scope === 'career' ? '<div class="career-export"><button class="button secondary" type="button" data-career-export' +
        (exportingCareer ? ' disabled' : '') + '>Export career</button><span role="status" data-career-export-status></span></div>' : '') +
      (scope === 'season' ? '<label class="career-season-label">Current season<select data-career-season>' + currentLabels.map(s =>
        '<option' + (s === season ? ' selected' : '') + '>' + esc(s) + '</option>').join('') + '</select></label>' : '') + '</header>' +
      '<div class="career-totals">' + [
        [scope === 'career' ? 'Seasons' : 'Competitions', scope === 'career' ? person.seasons.length : distinct(rows, r => r.competitionCode)],
        ['Section entries', rows.length],
        ...(scope === 'career' ? [['Competitions', distinct(rows, row => row.competitionCode)]] : []),
        ...(clubs > 1 ? [['Clubs', clubs]] : [])
      ].map(([text, n]) => '<div><b>' + n + '</b><span>' + text + '</span></div>').join('') + '</div>' +
      '<div class="career-rollup" role="status">Loading recorded matches…</div>' +
      (scope === 'career' ? '<section class="profile-section career99"><h3>Career skill rating</h3><div class="career99-content"></div></section><div class="career-progression"></div><section class="career-match-log career-rivals"><h3>Singles rivalries</h3><p>Loading repeat opponents…</p></section>' : '') +
      '<div class="career-timeline">' + [...new Set(rows.map(r => r.seasonLabel))].map(s =>
        '<section class="career-year' + (currentLabels.includes(s) ? ' career-year-current' : '') +
        '"><div class="career-year-head"><h3>' + esc(s) + '</h3>' + (currentLabels.includes(s) ? '<span>Current season</span>' : '') + (scope === 'career' && currentLabels.includes(s) ?
          '<button type="button" class="export-link" data-career-view-season="' + esc(s) + '">View season</button>' : '') +
        '</div>' + rows.map((row, i) => row.seasonLabel !== s ? '' :
          '<article class="career-appearance" data-career-card="' + i + '"><div><b class="career-team">' + esc(row.team || 'Team not listed') + (scope === 'career' ? '<span class="career-ladder" hidden></span>' : '') + '</b><p>' + esc(comp(row) + ' · ' + row.sectionLabel) +
          (row.player !== name ? ' · ' + esc(publicPlayerName(row.player)) : '') +
          '</p>' + (scope === 'season' ? '<span class="career-ladder" hidden></span>' : '') + '</div>' +
          '<div class="career-card-record" data-career-record="' + i + '">Loading record…</div>' +
          '<button class="button secondary" type="button" data-career-appearance="' + i + '">Section lab</button></article>').join('') + '</section>').join('') +
      '</div>' + (scope === 'season' ? '<section class="career-match-log"><h3>Season match log</h3><p role="status">Loading match records…</p></section>' : '');
    const modelName = selectedRatingModel();
    const [report] = await Promise.all([analytics(), loadRecords(rows, version, scope, modelName, task)]);
    if (isActiveLab(version) && report) drawAnalytics(person, rows, scope, report);
    task?.stage(96, 'Putting the player’s record together…');
  }
  function drawAnalytics(person, rows, scope, report) {
    const section = career.querySelector('.career-progression');
    const series = Object.entries(report.progress?.[person.id] || {}).sort((a, b) => b[1].days - a[1].days);
    if (section && series.length) {
      const ordinals = new Intl.PluralRules('en', {type: 'ordinal'});
      const calendar = new Intl.DateTimeFormat('en-AU', {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'});
      const signed = value => (value > 0 ? '+' : value < 0 ? '−' : '') + Math.abs(value).toFixed(1);
      section.innerHTML = '<h3>Improvement benchmark</h3><p>Estimated from match wins, share of games won and the strength of the section.</p>' +
        series.map(([pool, metrics]) => {
          const {discipline, days, first, last, change, percentile, peers} = metrics;
          const poolLabel = competitionLabel(pool.split('/')[0]).split(' - ')[0];
          const family = pool.split('/')[1];
          const months = Math.round(days / 30.4375), years = Math.floor(months / 12);
          const duration = [years ? plural(years, 'year') : '', months % 12 ? plural(months % 12, 'month') : ''].filter(Boolean).join(' and ');
          const suffix = {one: 'st', two: 'nd', few: 'rd', other: 'th'}[ordinals.select(percentile)];
          const badge = percentile == null ? '' : '<b>' + percentile + suffix + ' percentile for improvement</b>';
          const trend = change > 0 ? 'win' : change < 0 ? 'loss' : '';
          const changeText = change === 0 ? 'Playing level stayed steady' :
            signed(change) + ' playing-level points';
          const comparison = (label, field) => label + ' ' + first[field].toFixed(1) + '% to ' + last[field].toFixed(1) +
            '% (' + signed(last[field] - first[field]) + ' percentage points).';
          return '<article><header><h4>' + esc(poolLabel + (family === 'open' ? '' : ' · ' + family.replaceAll('-', ' ')) +
            ' · ' + discipline) + '</h4>' + badge + '</header><p><strong class="' + trend + '">' + changeText + '</strong> over about ' +
            duration + '.</p><p>' + esc(first.season) + ' → ' + esc(last.season) + ' · ' + first.score.toFixed(1) +
            ' → ' + last.score.toFixed(1) + '</p><details><summary>Match results and comparison</summary>' +
            '<p>' + comparison('Match win rate', 'winRate') + ' ' + comparison('Share of games won', 'gameShare') + '</p>' +
            '<p>Based on ' + plural(first.matches, 'match') + ' in the starting season and ' + plural(last.matches, 'match') +
            ' in the latest season. Time is measured between the last recorded matches in those samples (' +
            esc(calendar.format(new Date(first.date))) + ' to ' + esc(calendar.format(new Date(last.date))) + ').</p>' +
            (percentile == null ? '' : '<p>The percentile compares the pace of change with ' + peers.toLocaleString() +
              ' players in the same competition ladder and discipline. Each player counts once.</p>') + '</details></article>';
        }).join('');
    } else if (section) {
      section.innerHTML = '<h3>Improvement benchmark</h3><p>At least three rated matches in the same discipline in two comparable seasons, at least 90 days apart, are needed to estimate improvement.</p>';
    }
    rows.forEach((row, i) => {
      const comparisons = report.equivalents[row.sectionCode];
      if (!comparisons?.length) return;
      const node = career.querySelector('[data-career-card="' + i + '"] > div');
      if (!node) return;
      node.insertAdjacentHTML('beforeend', '<details class="career-equivalents"><summary>Comparable sections</summary><ul>' +
        comparisons.map(([section, competition, sample]) => '<li><b>' + esc(competition + ' · ' + section) +
          '</b><small>Estimated from ' + sample + ' players who played both competitions.</small></li>').join('') +
        '</ul></details>');
    });
    if (scope === 'season' && report.ranks[person.id]?.length) {
      const poolStats = report.ranks[person.id].map(([pool, rank, count, matches, wins, ladders]) =>
        '<article><strong>#' + rank + '<small> / ' + count + '</small></strong><span>' +
        (ladders > 1 ? ladders + ' calibrated BRTA ladders' : esc(competitionLabel(pool.split('/')[0]).split(' - ')[0]) + ' comparison group') +
        ' · ' + wins + ' wins from ' + matches + ' matches</span></article>').join('');
      career.querySelector('.career-rollup').insertAdjacentHTML('afterend', '<section class="career-season-form"><h3>How they compare this season</h3>' +
        poolStats + '<p>This is a rough comparison with other active players. It weighs the difficulty of their section with how many matches and games they won.</p></section>');
    }
  }
  function isActiveLab(version) {
    return version === labVersion && !overlay.classList.contains('hidden');
  }
  const fitQueue = [];
  let activeFits = 0;
  function pumpFits() {
    while (activeFits < 2 && fitQueue.length) {
      activeFits++;
      fitQueue.shift()().finally(() => { activeFits--; pumpFits(); });
    }
  }
  function sectionPayload(row) {
    const key = row.dataPath;
    if (!payloads.has(key)) {
      payloads.set(key, fetch(key, {signal: AbortSignal.timeout?.(30000)}).then(response => {
        if (!response.ok) throw Error('No published section');
        return response.json();
      }).then(normaliseTeamLabels).catch(error => {
        payloads.delete(key);
        throw error;
      }));
    }
    return payloads.get(key);
  }
  async function comparisonTeamPlayers(team) {
    const data=D, seasonKey=activeHistorySeasonId;
    const model=await careers();
    return [...new Set([...team.core,...team.historical,...team.emergencies].map(player=>player.name))].map(name=>{
      const person=model.inSection(name,data.meta,team.team,seasonKey);
      const anchor=person?.rows.find(row=>row.sectionCode===data.meta.section_code && row.team===team.team);
      return {name,id:person?.id || JSON.stringify([data.meta.section_code,team.team,name]),anchor,
        section:person?null:{code:data.meta.section_code,team:team.team}};
    });
  }
  async function loadComparison(player, competition) {
    const model = await careers();
    const person = model.get(player.id) || (player.anchor && model.reconcileAppearance(player.anchor));
    if (!person && player.section && D.meta.section_code===player.section.code && D.meta.competition_code===competition) {
      const row={competitionCode:competition,sectionCode:D.meta.section_code,sectionLabel:D.meta.section_label,seasonLabel:D.meta.season_label};
      const matches=['singles','doublesPlayers'].flatMap(kind=>L8.matches(D,player.name,kind)
        .filter(match=>match.team===player.section.team).map(match=>({...match,kind,entry:row})));
      return {matches,unavailable:0};
    }
    if (!person) return {matches: [], unavailable: 1};
    const rows = person.rows.filter(row => row.competitionCode === competition);
    const matches = new Map();
    let next = 0, unavailable = 0;
    await Promise.all(Array.from({length: Math.min(3, rows.length)}, async () => {
      while (next < rows.length) {
        const row = rows[next++];
        try {
          const data = await sectionPayload(row);
          for (const kind of ['singles','doublesPlayers']) {
            for (const match of L8.matches(data, row.player, kind)) {
              if (row.team && match.team !== row.team) continue;
              const key = JSON.stringify([row.seasonKey,row.sectionCode,match.fixtureId || match.round,kind,match.position,match.opp,match.partner]);
              matches.set(key, {...match, kind, entry: row});
            }
          }
        } catch { unavailable++; }
      }
    }));
    return {matches: [...matches.values()], unavailable};
  }
  function sectionPower(row, data, modelName, fits, isCurrent, completeHistory = false) {
    const key = row.dataPath;
    if (!fits.has(key)) {
      const pending = new Promise(resolve => fitQueue.push(async () => {
        if (!isCurrent()) { resolve(null); return; }
        try {
          let source = data;
          // Legacy archive payloads may omit the doubles snapshots published for current sections.
          if (completeHistory && modelName === 'RM3' && data.ratingHistory?.rounds?.length &&
              data.doubles?.length && !Object.keys(data.doublesRatingHistory?.tables || {}).length) {
            source = structuredClone(data);
            source.meta.needsScoreRefit = true;
          }
          resolve(await layoutApplyModel(source, modelName));
        } catch { fits.delete(key); resolve(null); }
      }));
      fits.set(key, pending);
      pumpFits();
    }
    return fits.get(key);
  }
  function showPower(row, data, record, version, modelName, fits) {
    const live = D?.meta?.section_code === row.sectionCode && D.meta.season_label === row.seasonLabel && !D.meta.is_custom ? D : null;
    const pending = live || sectionPower(row, data, modelName, fits, () => isActiveLab(version));
    const name = modelDisplayName(modelName);
    async function draw() {
      const data = await pending;
      if (!isActiveLab(version)) return;
      if (!data) {
        record.textContent = 'Power unavailable';
        return;
      }
      const kind = L8.discipline(data);
      const rating = L8.row(data, kind, row.player)?.rating;
      const rank = L8.rank(data, kind, row.player);
      record.innerHTML = Number.isFinite(rating) ? (kind === 'singles' ? 'Singles Power' : 'Doubles Power') +
        '<b>' + rating + '</b><small>' + esc(name) + (rank ? ' · #' + rank : ' · Unranked') +
        '</small>' : '<small>No rated matches</small>';
    }
    return draw();
  }
  function playedSingles(data, row) {
    const results = [];
    for (const group of data.results || []) for (const fixture of group.fixtures || []) {
      for (const rubber of fixture.rubbers || []) {
        if (rubber.type === 'Doubles' || /forfeit|walkover|default/i.test((rubber.status || '') + ' ' + (rubber.score || ''))) continue;
        const home = rubber.home === row.player && (!row.team || fixture.home === row.team);
        const away = rubber.away === row.player && (!row.team || fixture.away === row.team);
        if (!home && !away) continue;
        const opp = home ? rubber.away : rubber.home;
        if (!opp || opp === row.player || window.BRTAPlayerDisplay?.isUnknown(opp)) continue;
        const format = {outcomeCode: BRTAScores.outcomeCode(data, rubber.type)};
        const sets = BRTAScores.parse(rubber.score, format);
        if (!sets.some(set => set.h > 0 || set.a > 0)) continue;
        const otherTeam = home ? fixture.away : fixture.home;
        const rival = model.inSection(opp, {section_code: row.sectionCode, competition_code: row.competitionCode}, otherTeam, row.seasonKey);
        const score = BRTAScores.format(sets);
        const id = [row.seasonKey, row.sectionCode, fixture.fixtureId || group.round, rubber.position, opp].join('|');
        results.push({id, opp, otherTeam, entry: row, rival, date: fixture.date || group.date, round: fixture.round || group.round,
          score: home ? score : BRTAScores.flip(score), won: rubber.winner ? rubber.winner === row.player : null});
      }
    }
    return results;
  }
  async function loadRecords(rows, version, scope, modelName, task) {
    let next = 0, unavailable = 0, completed = 0;
    const log = new Map(), meetings = new Map(), emergencyTies = new Set();
    const powers = [];
    const fits = new Map();
    let completedPowers = 0;
    async function worker() {
      while (next < rows.length && isActiveLab(version)) {
        const i = next++, row = rows[i];
        const card = career.querySelector('[data-career-card="' + i + '"]');
        let html, data;
        try {
          data = await sectionPayload(row);
          if (!isActiveLab(version)) return;
          const teamModel = row.team ? BRTATeamLab.build(data, row.team) : null;
          if (teamModel?.position != null) {
            const ladder = card.querySelector('.career-ladder');
            const finished = !row.isCurrent || BRTAStandings.season(data).complete;
            ladder.textContent = (scope === 'career' ? ' - #' : finished ? 'Finished #' : 'Ladder #') + teamModel.position;
            if (scope === 'career') ladder.title = finished ? 'Final ladder position' : 'Current ladder position';
            ladder.hidden = false;
          }
          const emergency = teamModel?.players.find(player => player.name === row.player)?.emergencyDays || [];
          if (emergency.length) {
            card.classList.add('career-emergency');
            card.querySelector('.career-team').insertAdjacentHTML('beforeend', emergencyMark(emergency.length));
            emergency.forEach(day => emergencyTies.add([row.dataPath, day.id || day.round].join('|')));
          }
          const record = kind => {
            const matches = L8.matches(data, row.player, kind).filter(match => !row.team || match.team === row.team);
            for (const match of matches) {
              const id = [row.seasonKey, row.sectionCode, match.fixtureId || match.round, kind, match.position, match.opp].join('|');
              log.set(id, {...match, kind, entry: row});
              if (match.emergency && !emergency.length) emergencyTies.add([row.dataPath, match.fixtureId || match.round].join('|'));
            }
            const wins = matches.filter(match => match.won).length;
            const games = matches.reduce((n, match) => n + match.gf + match.ga, 0);
            const share = games ? Math.round(matches.reduce((n, match) => n + match.gf, 0) * 100 / games) + '% games' : '';
            return matches.length ? wins + '–' + (matches.length - wins) + (share ? '</b><small>' + share + '</small>' : '</b>') : '—</b>';
          };
          html = '<span>Singles <b>' + record('singles') + '</span><span>Doubles <b>' + record('doublesPlayers') +
            '</span><span class="career-power">Calculating Power…</span>';
          if (scope === 'career') playedSingles(data, row).forEach(meeting => meetings.set(meeting.id, meeting));
        } catch {
          unavailable++;
          html = '<small>Match record unavailable</small>';
        }
        if (isActiveLab(version)) {
          const record = card.querySelector('.career-card-record');
          record.innerHTML = html;
          const power = record.querySelector('.career-power');
          if (power) powers.push(showPower(row, data, power, version, modelName, fits)
            .catch(() => { power.textContent = 'Power unavailable'; })
            .finally(() => {
              completedPowers++;
              if (completed === rows.length) task?.stage(70 + 24 * completedPowers / rows.length, 'Calculating section Power…');
            }));
          completed++;
          task?.stage(28 + 40 * completed / rows.length, 'Read ' + completed + ' of ' + rows.length + ' section records');
        }
      }
    }
    await Promise.all(Array.from({length: Math.min(3, rows.length)}, worker));
    if (!isActiveLab(version)) return;
    if (completedPowers < powers.length) task?.stage(70, 'Calculating section Power…');
    await Promise.all(powers);
    if (!isActiveLab(version)) return;
    const panel = career.querySelector('.career-match-log');
    if (!panel) return;
    const matches = [...log.values()].sort((a, b) => matchDate(b.date) - matchDate(a.date) || b.round - a.round);
    const result = kind => {
      const matchesOfKind = matches.filter(match => match.kind === kind);
      const wins = matchesOfKind.filter(match => match.won).length;
      return matchesOfKind.length ? wins + '–' + (matchesOfKind.length - wins) : '—';
    };
    const rollup = career.querySelector('.career-rollup');
    const wonGames = matches.reduce((n, match) => n + match.gf, 0);
    const totalGames = matches.reduce((n, match) => n + match.gf + match.ga, 0);
    const dated = matches.map(match => matchDate(match.date)).filter(Boolean);
    const months = dated.length > 1 ? Math.round((Math.max(...dated) - Math.min(...dated)) / (30.4375 * 86400000)) : 0;
    const duration = months < 1 ? 'Less than a month' : [Math.floor(months / 12) ? plural(Math.floor(months / 12), 'year') : '',
      months % 12 ? plural(months % 12, 'month') : ''].filter(Boolean).join(' ');
    rollup.innerHTML = '<div><small>Singles W–L</small><b>' + result('singles') + '</b></div><div><small>Doubles W–L</small><b>' +
      result('doublesPlayers') + '</b></div><div><small>Completed rated matches</small><b>' + matches.length + '</b></div>' +
      (scope === 'season' && totalGames ? '<div><small>Games won</small><b>' + Math.round(100 * wonGames / totalGames) + '%</b></div>' : '') +
      (scope === 'season' && emergencyTies.size ? '<div class="career-emergency"><small>Emergency ties</small><b>' + emergencyTies.size + '</b></div>' : '') +
      (scope === 'career' && dated.length > 1 ? '<div><small>Recorded playing span</small><b>' + duration + '</b></div>' : '') +
      (unavailable ? '<p>' + plural(unavailable, 'section record') + ' unavailable. Totals cover loaded matches.</p>' : '');
    if (scope === 'career') {
      BRTACareerTimeline.render(career.querySelector('.career99-content'), matches, BRTACareerTimeline.skillScale);
      drawRivals(panel, [...meetings.values()], unavailable);
      return;
    }
    const summary = matches.length ? plural(matches.length, 'completed rated match') : 'No completed rated matches found';
    panel.innerHTML = '<h3>Season match log</h3><p>' + summary + (unavailable ? ' · ' + plural(unavailable, 'section record') + ' unavailable' : '') + '</p>' +
      (matches.length ? '<details><summary>View matches</summary><div class="career-match-rows">' +
        matches.map(match => '<article' + (match.emergency ? ' class="career-emergency"' : '') + '><div><b>' +
          esc(publicPlayerName(match.opp)) + '</b>' + (match.emergency ? emergencyMark() : '') + '<small>' +
          esc([matchDate(match.date) ? match.date : 'Round ' + match.round, match.kind === 'singles' ? 'Singles' : 'Doubles', match.entry.sectionLabel].filter(Boolean).join(' · ')) +
          '</small></div><div class="career-score"><span class="' + (match.won ? 'win' : 'loss') + '">' +
          (match.won ? 'W' : 'L') + '</span><b>' + esc(match.score) + '</b></div></article>').join('') + '</div></details>' : '');

  }
  function drawRivals(panel, matches, unavailable) {
    const opponents = new Map();
    const nameKey = BRTAPlayerSearch.normalise;
    for (const match of matches) {
      const club = nameKey(clubBaseName(match.otherTeam));
      const linked = !match.rival?.linked && club ? model.named(match.opp).filter(person =>
        person.linked && person.rows.some(row => nameKey(clubBaseName(row.team)) === club)) : [];
      const id = match.rival?.linked ? match.rival.id : linked.length === 1 ? linked[0].id :
        JSON.stringify([nameKey(match.opp), club, club && !linked.length ? '' : match.entry.seasonKey]);
      if (!opponents.has(id)) opponents.set(id, []);
      opponents.get(id).push(match);
    }
    const rivalries = [...opponents.values()].filter(rows => rows.length >= 2).sort((a, b) => b.length - a.length ||
      a[0].opp.localeCompare(b[0].opp));
    panel.innerHTML = '<details class="career-rival-list"><summary><b>Singles rivalries</b><span>' +
      (rivalries.length ? plural(rivalries.length, 'repeat opponent') : 'No repeat opponents') +
      '</span></summary><div>' + (unavailable ? '<p>' + plural(unavailable, 'section record') + ' unavailable</p>' : '') +
      rivalries.map(rows => {
        rows.sort((a, b) => matchDate(b.date) - matchDate(a.date) || b.round - a.round);
        const wins = rows.filter(m => m.won === true).length, losses = rows.filter(m => m.won === false).length;
        const status = wins > losses ? 'win' : wins < losses ? 'loss' : '';
        return '<details class="career-rival"><summary><b>' + esc(publicPlayerName(rows[0].opp)) + '</b><span>' +
          plural(rows.length, 'meeting') + '</span><strong class="' + status + '">' + wins + '–' + losses +
          '</strong></summary><div class="career-match-rows">' + rows.map(m => '<article><div>' +
            esc(matchDate(m.date) ? m.date : 'Round ' + m.round) + '<small>' +
            esc([m.otherTeam, m.entry.seasonLabel, m.entry.sectionLabel].join(' · ')) + '</small></div><b class="' +
            (m.won == null ? '' : m.won ? 'win' : 'loss') + '">' +
            (m.won == null ? '' : m.won ? 'W ' : 'L ') + esc(m.score) + '</b></article>').join('') +
          '</div></details>';
      }).join('') + '</div></details>';
  }
  function matchDate(date) {
    return BRTACareerTimeline.matchTime(date) ?? 0;
  }
  async function openAppearance(row, button) {
    if (!row) return;
    if (button) button.disabled = true;
    const current = lab;
    const ok = await openGlobalPlayer(row.sectionCode, row.player, row.seasonKey || '');
    if (ok === false && lab === current) {
      career.insertAdjacentHTML('afterbegin', '<p role="status">Could not open that section. Please try again.</p>');
      if (button) button.disabled = false;
    }
  }
  async function exportCareer(person, name, button) {
    if (exportingCareer || !person) return;
    exportingCareer = button.disabled = true;
    const status = career.querySelector('[data-career-export-status]');
    const modelChoice = selectedRatingModel();
    const modelName = modelChoice === 'RM1' ? 'RM3' : modelChoice;
    const modelLabel = modelDisplayName(modelName);
    const rows = person.rows, entries = [], fits = new Map();
    let next = 0, completed = 0;
    status.textContent = 'Preparing career report…';
    try {
      await BRTAActivity.run('Preparing career export', async task => {
        async function worker() {
          while (next < rows.length) {
            const i = next++, row = rows[i];
            try {
              const data = await sectionPayload(row);
              const rated = await sectionPower(row, data, modelName, fits, () => true, true);
              const actualModel = rated ? modelDisplayName(rated.meta?.modelChoice || rated.meta?.predictionModel || modelName) : 'Published section Power';
              entries[i] = {...BRTACareerReport.extract(data, row, rated || data, actualModel), ratingFallback: !rated};
            } catch {
              entries[i] = {entry: row, unavailable: true};
            }
            completed++;
            task.stage(10 + 80 * completed / rows.length, 'Processed ' + completed + ' of ' + rows.length + ' section entries');
          }
        }
        await Promise.all(Array.from({length: Math.min(rows.length, 3)}, worker));
        task.stage(94, 'Writing season summaries and the full match log…');
        await task.paint();
        const report = BRTACareerReport.compile({...person, name: publicPlayerName(name)}, entries, BRTACareerTimeline.skillScale, modelLabel);
        BRTAExportUI853.download(BRTACareerReport.html(report), BRTAExport853.slug(name) + '-brta-career.html', 'text/html;charset=utf-8');
        status.textContent = report.missing || report.missingPower ? 'Downloaded with coverage notes.' : 'Career report downloaded.';
      }, {key: 'career-export', message: 'Loading scorecards and Power histories…'});
    } catch {
      status.textContent = 'Could not create the career report. Try again.';
    } finally {
      exportingCareer = false;
      const current = career.querySelector('[data-career-export]');
      if (current) current.disabled = false;
    }
  }
  career.addEventListener('click', event => {
    const b = event.target.closest('button');
    if (!b || !lab) return;
    if (b.hasAttribute('data-career-export') && lab.scope === 'career') exportCareer(lab.person, lab.name, b);
    if (b.hasAttribute('data-career-lab-retry')) chooseScope(lab.scope);
    if (b.hasAttribute('data-career-appearance')) openAppearance(lab.displayRows[Number(b.dataset.careerAppearance)], b);
    if (b.hasAttribute('data-career-view-season')) { lab.season = b.dataset.careerViewSeason; chooseScope('season'); }
  });
  career.addEventListener('change', event => {
    if (!lab || !event.target.matches('[data-career-season]')) return;
    lab.season = event.target.value;
    chooseScope('season');
  });
  window.addEventListener('brta-section-ready', skillComparison.contextChanged);
  window.BRTAPlayers = {
    ready: careers,
    show(view) { setRatingScope(view === 'history' ? 'directory' : 'section'); },
    following: openFollowing,
    async search(value) {
      const directory = await careers();
      const exact = directory.find(value);
      return (exact.length ? exact : directory.find(value, true)).slice(0, 12);
    },
    open: openCareer,
  };
  syncPage();
})();
/* BRTA Power Ratings 9.9g */
