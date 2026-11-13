(function (root) {
  'use strict';

  const Model = root.BRTAClubData;
  const $ = selector => document.querySelector(selector);
  const statsView = BRTATeamLabUI.open;
  const tabs = [['overview', 'Overview'], ['stats', 'Team Stats'], ['participation', 'Participation']];
  const requests = new Map();
  const competitionRecords = new Map();
  const recordScopes = new Map();
  const trail = [];
  let data, network, directory, catalog, selected, team, panel = 'overview';
  let entries, mapAbort, mountedMap, revision = 0, navigation = 0, competition = '', historyCompetition = '', entryOrder = 'section';
  let sectionClubs = [], searchClubs = [], query = '', scope = 'section';
  let searchOpen = false, searchOrder = 'name', showProvisional = false, mapScope = 'section';
  let recordIndex, recordRevision = 0, ratingViewForTeam = 'singles', destinationView, pendingView;
  const escape = esc;
  const localClub = () => selected?.id.startsWith('local:');

  function json(path) {
    if (!requests.has(path)) {
      requests.set(path, fetch(path, { signal: AbortSignal.timeout?.(15000) }).then(response => {
        if (!response.ok) throw Error('This club data could not be loaded.');
        if (!path.endsWith('.gz')) return response.json();
        return new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).json();
      }).catch(error => {
        requests.delete(path);
        throw error;
      }));
    }
    return requests.get(path);
  }

  async function prepare() {
    if (directory && catalog) return;
    const [foundation, archive] = await Promise.all([
      json('data/current/club-foundation.json'), json('data/archive/clubs.json')
    ]);
    if (!directory) directory = Model.directory(network = foundation);
    catalog = archive;
  }

  function resolve(name, meta = data.meta, baseName = clubBaseName(name)) {
    return directory?.resolve(name, meta, baseName) || 'observed:' + Model.key(baseName);
  }

  function sectionTeams() {
    return BRTATeamLab.teamNames(data).map(name => {
      const id = data.meta.is_custom ? 'local:' + name : resolve(name);
      const rank = standing(name)?.rank ?? null;
      return { id, name: directory?.clubs.get(id)?.name || name, teams: [{ name, rank }], rank };
    }).sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity) ||
      a.teams[0].name.localeCompare(b.teams[0].name));
  }

  function button(label, action, value = '', extra = '') {
    return '<button type="button" class="button secondary" data-clubs-action="' + action +
      '" data-value="' + escape(value) + '" ' + extra + '>' + label + '</button>';
  }

  function standing(teamName) {
    const index = data.standings?.findIndex(row => row.team === teamName) ?? -1;
    return index < 0 ? null : { ...data.standings[index], rank: data.standings[index].officialPosition || index + 1 };
  }

  function select(club, tab = 'overview', pickedTeam) {
    selected = club;
    team = pickedTeam || sectionClubs.find(item => item.id === club.id)?.teams[0]?.name || '';
    panel = tab;
    if (!team && panel === 'stats') panel = 'participation';
    window.BRTARouteUI?.club(team, panel);
    return render();
  }

  function toolbar() {
    const list = sectionClubs.map(club => {
      const name = club.teams[0].name;
      return button(escape(name) + (Number.isFinite(club.rank) ? ' <small>#' + club.rank + '</small>' : ''),
        'club', name, 'aria-pressed="' + (team === name) + '"');
    }).join('');
    return '<div class="clubs9-toolbar"><div>' +
      '<h2>' + (data.meta.is_custom ? 'Local clubs' : 'Clubs in this section') + '</h2></div>' +
      button(searchOpen ? 'Close club search' : 'Find a club', 'search', '', 'aria-expanded="' + searchOpen + '"') +
      '</div><div class="clubs9-picker" aria-label="Clubs in this section">' + list + '</div>' +
      (searchOpen ? searchHTML() : '');
  }

  function choice(id, label) {
    return '<div class="section-choice" id="' + id + 'Choice"><label class="choice-label" id="' + id +
      'Label">' + escape(label) + '</label><button class="choice-trigger" type="button" id="' + id +
      'Select" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="' + id + 'Label ' + id +
      'Value"><span id="' + id + 'Value"></span><i aria-hidden="true"></i></button><div class="choice-options" id="' +
      id + 'Options" role="listbox" aria-labelledby="' + id + 'Label"></div></div>';
  }

  function bindChoice(id, values, value, change) {
    const trigger = $('#' + id + 'Select');
    if (!trigger) return;
    renderChoice(trigger.id, values, value);
    const menu = $('#' + id + 'Options');
    for (const item of menu.querySelectorAll('[data-choice-id]')) {
      const next = item.dataset.choiceValue;
      delete item.dataset.choiceId;
      item.onclick = () => {
        closeChoices();
        change(next);
        $('#' + id + 'Select')?.focus({ preventScroll: true });
      };
    }
    trigger.onkeydown = event => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      if (trigger.getAttribute('aria-expanded') === 'false') trigger.click();
      (menu.querySelector('.selected') || menu.firstElementChild)?.focus();
    };
    menu.onkeydown = event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeChoices();
        trigger.focus();
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? event.target.nextElementSibling : event.target.previousElementSibling;
      (step || (event.key === 'ArrowDown' ? menu.firstElementChild : menu.lastElementChild))?.focus();
    };
  }

  function competitionChoices() {
    return Object.entries(catalog?.competitions || {}).map(([id, row]) => [id, row.label]);
  }

  function searchHTML() {
    return '<section class="clubs9-search"><div class="clubs9-filters"><label class="clubs9-searchfield">' +
      '<span class="choice-label">Club name</span><span class="clubs9-query"><span aria-hidden="true">⌕</span>' +
      '<input data-clubs-query type="search" value="' + escape(query) + '" placeholder="Search club names and aliases"></span></label>' +
      choice('clubScope', 'Search scope') + choice('clubSort', 'Sort clubs') +
      '</div><label class="clubs9-provisional-control"><input type="checkbox" data-clubs-provisional ' +
      (showProvisional ? 'checked' : '') + '> Include provisional clubs</label><div data-clubs-results aria-live="polite"></div></section>';
  }

  function searchControls() {
    bindChoice('clubScope', [
      ['section', 'This section'], ['brta', 'All BRTA clubs'], ...competitionChoices(),
      ['beta', 'BRTA archive · beta'], ['beyond', 'Beyond BRTA · coming later']
    ], scope, value => { scope = value; searchControls(); refreshRecords(); });
    bindChoice('clubSort', [
      ['name', 'Alphabetical'], ['results', 'Best historical results'],
      ['size', 'Most team entries'], ['active', 'Most active this season']
    ], searchOrder, value => { searchOrder = value; searchControls(); searchResults(); });
  }

  function searchResults() {
    const dest = $('[data-clubs-results]');
    if (!dest) return;
    if (scope === 'beyond') {
      dest.textContent = 'Club search beyond BRTA will be available in a later update.';
      return;
    }
    if (!recordIndex) {
      dest.textContent = 'Loading the BRTA club directory…';
      return;
    }

    const pool = new Map();
    const scopedCompetition = catalog.competitions[scope] ? scope : null;
    if (scope === 'section') sectionClubs.forEach(club => pool.set(club.id, { id: club.id, name: club.name }));
    else {
      if (scope === 'brta') directory.clubs.forEach(club => pool.set(club.id, club));
      for (const [id, rows] of recordIndex.clubs) {
        if (scopedCompetition && !rows.some(row => row.competition === scopedCompetition)) continue;
        if (scope === 'beta' && !rows.some(row => !row.current)) continue;
        pool.set(id, { id, name: directory.clubs.get(id)?.name || rows[0].club });
      }
    }

    const term = Model.key(query);
    const aliases = new Set(Object.entries(network.aliases || {}).filter(([alias]) => term && alias.includes(term))
      .map(([, value]) => value.club_id));
    const matched = [...pool.values()].filter(club => !term || Model.key(club.name).includes(term) ||
      aliases.has(directory.clubs.get(club.id)?.legacy_id)).map(club => {
      const allRows = recordIndex.clubs.get(club.id) || [];
      const rows = scopedCompetition ? allRows.filter(row => row.competition === scopedCompetition) : allRows;
      const provisional = !club.id.startsWith('local:') && (!directory.clubs.has(club.id) || !allRows.length);
      return {
        ...club, provisional, count: rows.length, active: rows.filter(row => row.current).length,
        performance: Model.compare(rows, recordIndex.reference).score
      };
    });
    const value = club => searchOrder === 'results' ? club.performance ?? -1 :
      searchOrder === 'size' ? club.count : searchOrder === 'active' ? club.active : 0;
    searchClubs = matched.filter(club => showProvisional || !club.provisional || scope === 'section')
      .sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name));
    const hidden = matched.length - searchClubs.length;
    const summary = searchClubs.length + (searchClubs.length === 1 ? ' club' : ' clubs') +
      (hidden ? ' · ' + hidden + ' provisional hidden' : '');
    dest.innerHTML = '<p class="clubs9-note">' + summary + '</p><div class="clubs9-search-results">' +
      searchClubs.map(club => button('<b>' + escape(club.name) + '</b><small>' +
        (club.provisional ? 'Provisional · ' : '') + entryCount(club.count) +
        (searchOrder === 'results' && club.performance != null ? ' · ' + Math.round(club.performance) + '/100' : '') +
        (searchOrder === 'active' ? ' · ' + club.active + ' current' : '') + '</small>', 'search-result', club.id)).join('') + '</div>' +
      (searchClubs.length ? '' : '<p class="clubs9-note">No clubs match these filters.</p>');
  }

  function header() {
    const s = standing(team);
    const detail = team ? data.meta.season_label + ' · ' + competitionLabel(data.meta.competition_code) + ' · ' +
      data.meta.section_label : 'BRTA club directory';
    const record = s ? [s.officialWins ?? s.wins, s.officialDraws ?? s.draws, s.officialLosses ?? s.losses] : [];
    return '<header class="clubs9-hero"><div><span class="kicker">' + escape(detail) + '</span><h2>' +
      escape(team && Model.key(team) !== Model.key(selected.name) ? team : selected.name) + '</h2>' +
      (selected.provisional ? '<span class="clubs9-badge">Provisional club listing</span>' : '') +
      '</div>' + (s ? '<div class="clubs9-standing"><strong>#' + s.rank + '</strong><b>' +
        (s.points == null ? 'Points unavailable' : escape(s.points) + ' pts') + '</b>' +
        (record.some(n => n != null) ? '<span class="clubs9-wdl" aria-label="Wins, draws, losses">' +
          record.map((n, index) => '<span class="' + ['clubs9-win', '', 'clubs9-loss'][index] + '">' +
            escape(n ?? '—') + '</span>').join('<span aria-hidden="true">–</span>') + '</span>' : '') + '</div>' : '') + '</header>' +
      '<nav class="clubs9-tabs" aria-label="Club views">' + tabs.map(([id, label]) =>
        button(label, 'panel', id, 'aria-pressed="' + (panel === id) + '"' +
          (id === 'stats' && !team ? ' disabled title="Choose a team from Participation"' : ''))
      ).join('') + '</nav>';
  }

  function link(url, label) {
    try {
      const address = new URL(url);
      if (['http:', 'https:'].includes(address.protocol)) {
        return '<a href="' + escape(address.href) + '" target="_blank" rel="noopener">' + escape(label) + '</a>';
      }
    } catch {}
    return '';
  }

  const mapScopes = [
    ['section', 'Clubs in this section'], ['competition', 'Current competition'], ['history', 'All recorded BRTA clubs']
  ];

  function overview() {
    if (localClub()) return '<div class="clubs9-card"><h3>Local club</h3><p>View this club’s lineup and results in Team Stats.</p>' +
      button('Open Team Stats', 'panel', 'stats') + '</div>';
    const club = directory?.clubs.get(selected.id);
    const primary = directory?.venues.get(club?.main_venue_id);
    const venue = primary?.club_id === club?.id ? primary : null;
    const courts = club?.facts?.courts;
    const address = venue?.address_lines?.map(line => line.trim().replace(/[,;]+$/, '')).filter(Boolean).join(', ');
    const facts = [
      ['Courts', courts?.count ?? (typeof courts === 'number' ? courts : null)],
      ['Court facilities', courts?.groups?.map(group =>
        group.count + ' ' + group.surface + (group.lit == null ? '' : ' · ' + group.lit + ' lit')).join(' / ') || club?.facts?.lighting],
      ['Parking', club?.facts?.parking || 'No published details'],
      ['Accessibility', club?.facts?.accessibility || 'No published details'], ['Club phone', club?.phones?.join(' · ')]
    ].filter(([, value]) => value != null && String(value).trim());
    const contacts = (club?.contacts || []).filter(contact =>
      [contact.name, contact.phone, contact.email].some(Boolean));
    const extraDetails = [...new Set(club?.additional_details || [])].filter(line =>
      !/^no (?:web.?site|details?)|^(?:https?:|www\.)/i.test(line) &&
      !(courts?.groups?.length && /^\d+\s+.*\bcourts?\b/i.test(line)) &&
      !facts.some(([, value]) => line === value));
    const melway = venue?.melway || club?.observations?.find(row => row.melway &&
      row.coordinates?.latitude === venue?.coordinates?.latitude &&
      row.coordinates?.longitude === venue?.coordinates?.longitude)?.melway;
    const postal = (club?.mailing_address_lines || []).join(', ');
    if (postal) facts.push(['Postal address', postal]);
    if (melway) facts.push(['Melway reference', melway.replace(/^Melway\s*/i, '')]);
    const alternates = (club?.venue_ids || []).map(id => directory.venues.get(id)).filter(location =>
      location?.club_id === club.id && location.id !== venue?.id && location.address_lines?.length);
    const directions = location => {
      const destination = location?.address_lines?.filter(Boolean).join(' ');
      return destination ? link('https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent(destination + ', Victoria, Australia'), 'Directions ↗') : '';
    };
    const availableMap = !!directory;
    const point = root.BRTAClubMap.inside(venue?.coordinates) ? venue.coordinates : null;
    return '<div class="clubs9-overview"><section class="clubs9-card clubs9-location">' +
      '<div class="clubs9-card-head"><div><span class="kicker">VENUE</span><h3>Club map</h3></div>' +
      (availableMap ? '<div class="clubs9-map-actions">'+(point ? button('Focus venue', 'focus-map') : '')+
        button('Expand map', 'map')+'</div>' : '') + '</div>' +
      (availableMap ? '<div class="clubs9-map-controls">' + choice('clubMap', 'Map scope') +
        '<div class="clubs9-map-key" aria-label="Map key"><span class="selected">Selected club</span>' +
        '<span class="section">This section</span><span class="competition">Current competition</span>' +
        '<span class="history">BRTA history</span></div></div>' +
        '<div class="clubs9-map-frame"><div id="clubs9Map" aria-label="Club and section venues"></div></div>' +
        '<p id="clubs9MapStatus" class="clubs9-note" role="status"></p>' : '<p>Loading club venues…</p>') +
      '</section><section class="clubs9-card clubs9-logistics-card"><span class="kicker">CLUB DIRECTORY</span><h3>Club logistics</h3>' +
      '<div class="clubs9-address"><span>MAIN VENUE</span><strong>' +
      escape(address || (directory ? 'Address unavailable' : 'Loading address…')) + '</strong></div>' +
      (facts.length ? '<dl class="clubs9-logistics">' + facts.map(([label, value]) =>
        '<div><dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd></div>').join('') + '</dl>' : '') +
      (contacts.length ? '<details class="clubs9-contacts"><summary>Published club contacts</summary>' + contacts.map(contact =>
        '<p><b>' + escape(contact.role || 'Contact') + '</b><br>' +
        escape([contact.name, contact.phone, contact.email].filter(Boolean).join(' · ')) + '</p>').join('') + '</details>' : '') +
      (extraDetails.length ? '<details class="clubs9-contacts"><summary>More club information</summary><ul>' +
        extraDetails.map(line => '<li>' + escape(line) + '</li>').join('') + '</ul></details>' : '') +
      (alternates.length ? '<details class="clubs9-contacts"><summary>Other reported venues</summary><ul>' +
        alternates.map(location => '<li>' + escape(location.address_lines.join(', ')) + ' · ' + directions(location) +
          '</li>').join('') + '</ul></details>' : '') +
      '<div class="clubs9-links">' + directions(venue) + (club?.websites || []).map(url => link(url, 'Club website ↗')).join('') +
      (point ? link('https://www.openstreetmap.org/?mlat=' + point.latitude + '&mlon=' + point.longitude +
        '#map=17/' + point.latitude + '/' + point.longitude, 'Open venue map ↗') : '') +
      link('https://www.trols.org.au/brta/clubs.php', 'TROLS directory ↗') + '</div></section></div>' +
      '<section class="clubs9-card clubs9-alltime"><span class="kicker">ALL-TIME PERFORMANCE</span><h3>How the club has performed</h3>' +
      '<div class="clubs9-filters clubs9-history-filters">' + choice('clubHistoryCompetition', 'Competition') +
      '</div><div data-clubs-history-stats>Loading participation records…</div><div data-clubs-archive-names></div></section>';
  }

  function map(id) {
    const container = $('#clubs9Map');
    if (!container) return;
    mapAbort?.abort();
    mountedMap = null;
    const inSection = new Set(sectionClubs.map(club => club.id));
    const inCompetition = new Set(network.teams.filter(row => row.source?.competition_code === data.meta.competition_code)
      .map(row => row.club_id));
    if (recordIndex) for (const [clubId, rows] of recordIndex.clubs) {
      if (rows.some(row => row.current && row.competition === data.meta.competition_code)) inCompetition.add(clubId);
    }
    const ids = new Set([selected.id, ...inSection]);
    if (mapScope !== 'section') inCompetition.forEach(clubId => ids.add(clubId));
    if (mapScope === 'history') recordIndex?.clubs.forEach((rows, clubId) => {
      if (rows.some(row => !row.current)) ids.add(clubId);
    });
    const clubs = [...ids].flatMap(clubId => {
      const club = directory.clubs.get(clubId);
      const venue = directory.venues.get(club?.main_venue_id);
      if (!club || venue?.club_id !== club.id || !root.BRTAClubMap.inside(venue.coordinates)) return [];
      return [{ ...club, coordinates: venue.coordinates,
        group: inSection.has(clubId) ? 'section' : inCompetition.has(clubId) ? 'competition' : 'history' }];
    });
    const status = $('#clubs9MapStatus');
    status.textContent = clubs.length + ' mapped clubs · ' + (clubs.some(club => club.id === selected.id) ?
      'Main venues from TROLS. Pins may be approximate.' : 'The selected club has no verified map location.');
    mapAbort = new AbortController();
    const signal = mapAbort.signal;
    return root.BRTAClubMap.mountNetwork(container, clubs, point => {
      const club = clubs.find(item => item.id === point.id);
      if (club) select(club);
    }, { signal, selectedId: selected.id, onTileError: () => {
      if (id === revision && status.isConnected) status.textContent = 'Street tiles are unavailable. Club markers still show relative locations.';
    }}).then(mount => {
      if (!signal.aborted) { mountedMap = mount; return mount.ready; }
    }).catch(error => {
      if (id === revision && error.name !== 'AbortError' && status.isConnected) status.textContent = error.message;
    });
  }

  function loadCompetition(code) {
    if (!competitionRecords.has(code)) {
      competitionRecords.set(code, json('data/archive/club-participation/' + code + '.json.gz').then(rows => {
        const clubs = new Map();
        for (const row of rows) {
          const id = resolve(row.team, row, row.club);
          if (!clubs.has(id)) clubs.set(id, []);
          clubs.get(id).push(row);
        }
        return { clubs, reference: Model.benchmark(rows) };
      }).catch(error => {
        competitionRecords.delete(code);
        throw error;
      }));
    }
    return competitionRecords.get(code);
  }

  function loadRecords(codes) {
    const key = [...codes].sort().join('|');
    if (!recordScopes.has(key)) {
      const request = Promise.allSettled([...codes].map(loadCompetition)).then(parts => {
        const clubs = new Map(), reference = new Map();
        for (const part of parts) {
          if (part.status !== 'fulfilled') continue;
          for (const [id, rows] of part.value.clubs) {
            if (!clubs.has(id)) clubs.set(id, []);
            clubs.get(id).push(...rows);
          }
          for (const [row, value] of part.value.reference) reference.set(row, value);
        }
        const partial = parts.some(part => part.status === 'rejected');
        if (partial) recordScopes.delete(key);
        return { clubs, reference, partial };
      });
      recordScopes.set(key, request);
    }
    return recordScopes.get(key);
  }

  function requestedCodes() {
    const codes = new Set();
    const add = code => {
      if (!code) Object.keys(catalog.competitions).forEach(value => codes.add(value));
      else if (catalog.competitions[code]) codes.add(code);
    };
    if (!localClub() && panel === 'participation') add(competition);
    if (!localClub() && panel === 'overview') {
      add(historyCompetition);
      if (mapScope === 'history') add('');
      if (mapScope === 'competition') add(data.meta.competition_code);
    }
    if (searchOpen && scope !== 'beyond') add(scope === 'section' ? data.meta.competition_code :
      catalog.competitions[scope] ? scope : '');
    return codes;
  }

  async function showRecords(id, task) {
    if (!catalog) return;
    const request = ++recordRevision;
    task.stage(36, 'Getting participation and ladder records…');
    const index = await loadRecords(requestedCodes());
    if (revision !== id || request !== recordRevision) return false;
    recordIndex = index;
    if (searchOpen) searchResults();
    if (selected && !localClub()) {
      entries = { rows: index.clubs.get(selected.id) || [], partial: index.partial };
      if (panel === 'overview') {
        updateStats(entries);
        const host = $('[data-clubs-archive-names]');
        const aliases = new Map();
        for (const row of entries.rows.filter(row => !row.current)) {
          if (!aliases.has(row.team)) aliases.set(row.team, new Map());
          const seasons = aliases.get(row.team);
          if (!seasons.has(row.season_label)) seasons.set(row.season_label, row);
        }
        if (host) host.innerHTML = aliases.size ? '<details class="clubs9-contacts"><summary>Names in the archive</summary><ul>' +
          [...aliases].sort(([a], [b]) => a.localeCompare(b)).map(([name, seasons]) => '<li><b>' + escape(name) + '</b> · ' +
            [...seasons.values()].sort((a, b) => String(b.season_label).match(/\d{4}/)?.[0]?.localeCompare(String(a.season_label).match(/\d{4}/)?.[0] || '') || 0)
              .map(row => {
                const path = root.BRTASiteRoutes.path({ season_label: row.season_label, section_label: row.section_label,
                  competition_code: row.competition_code || row.competition }, 'teams', { club: row.team });
                return path ? '<a href="' + escape(new URL(path, document.baseURI).href) + '">' + escape(row.season_label) + '</a>' : escape(row.season_label);
              }).join(' · ') + '</li>').join('') + '</ul></details>' : '';
      }
      if (panel === 'participation') participation();
    }
  }

  function refreshRecords() {
    const id = revision;
    return BRTAActivity.run('Loading club records', async task => {
      try { return await showRecords(id, task); }
      catch (error) {
        if (revision === id) $('#clubs9Panel')?.insertAdjacentHTML('beforeend', '<p role="alert">' + escape(error.message) + '</p>');
        return false;
      }
    }, { key: 'clubs-records' });
  }

  function trend(rows) {
    const groups = Model.groupSeasons(rows).slice(0, 10).reverse();
    const bars = groups.map(group => {
      const score = Model.compare(group.rows, recordIndex.reference).score;
      return '<div class="clubs9-trend-row"><span>' + escape(group.label) +
        '</span><div class="clubs9-track"><i class="' + (score >= 50 ? 'above' : 'below') +
        '" style="width:' + Math.round(score) + '%"></i></div><b>' + Math.round(score) + '</b></div>';
    }).join('');
    return '<section class="clubs9-history-section"><h4>Season by season</h4>' +
      '<p class="clubs9-note">Ladder performance out of 100. The line marks the section average of 50.</p>' + bars + '</section>';
  }

  function entryCount(count) {
    return count + (count === 1 ? ' entry' : ' entries');
  }

  function finishBreakdown(rows) {
    const buckets = [
      ['Top quarter', 'top', score => score >= 75],
      ['Middle half', 'middle', score => score > 25 && score < 75],
      ['Bottom quarter', 'bottom', score => score <= 25]
    ].map(([label, tone, test]) => {
      const count = rows.filter(row => test(recordIndex.reference.get(row).score)).length;
      return { label, tone, count, share: count / rows.length * 100 };
    });
    return '<h4>Ladder finishes</h4><div class="clubs9-finish-bar" aria-hidden="true">' +
      buckets.map(({tone, share}) => '<i class="' + tone + '" style="flex-basis:' + share + '%"></i>').join('') +
      '</div><ul class="clubs9-finish-key">' + buckets.map(({label, tone, count, share}) =>
        '<li><span class="' + tone + '">' + label + '</span><b>' + Math.round(share) + '%</b><small>' +
        entryCount(count) + '</small></li>').join('') + '</ul>';
  }

  function updateStats(result) {
    const dest = $('[data-clubs-history-stats]');
    if (!dest) return;
    const past = result.rows.filter(row => !row.current && (!historyCompetition || row.competition === historyCompetition));
    const comparison = Model.compare(past, recordIndex.reference);
    if (!past.length) {
      dest.innerHTML = '<p class="clubs9-note">No published past-season results for this club in the selected competition.</p>';
      return;
    }
    const stats = Model.totals(past);
    const finalists = past.filter(row => row.finalist || row.champion).length;
    const finals = past.filter(row => row.semifinalist || row.finalist || row.champion).length;
    const delta = Math.round((comparison.score ?? 50) - 50);
    const line = comparison.score == null ? 'Not enough complete ladders for a comparison' : delta === 0 ?
      'Around the section average' : Math.abs(delta) + ' percentage points ' + (delta > 0 ? 'above' : 'below') + ' the section average';
    const titles = comparison.titleSample ? '<div class="clubs9-title-benchmark"><span class="kicker">PREMIERSHIPS VS OPPORTUNITY</span><strong>' +
      comparison.won + ' won · ' + comparison.expected.toFixed(1) + ' expected</strong><p class="clubs9-note">Equal chances per team in ' +
      comparison.titleSample + ' entries with a complete ladder and a recorded champion.</p></div>' : '';
    const comps = competitionChoices().map(([code, label]) => {
      const rows = past.filter(row => row.competition === code);
      if (!rows.length) return '';
      const score = Model.compare(rows, recordIndex.reference).score;
      return '<li><b>' + escape(label) + '</b><span>' + entryCount(rows.length) + ' · ' +
        (score == null ? 'Ladder comparison unavailable' : Math.round(score) + '/100 ladder performance') + '</span></li>';
    }).join('');
    dest.innerHTML = '<div class="clubs9-history-lead"><div class="clubs9-history-verdict ' +
      (delta >= 0 ? 'clubs9-above' : 'clubs9-below') + '"><span class="kicker">RELATIVE LADDER PERFORMANCE</span><strong>' +
      escape(line) + '</strong><p class="clubs9-note">' + comparison.sample +
       ' complete ladder entries. Every team entry counts once, so seasons with more teams count more. Each team is compared with opponents in its own section.</p></div>' + titles + '</div>' +
      '<div class="clubs9-history-grid">' + (comparison.eligible.length ? trend(comparison.eligible) : '') +
      '<section class="clubs9-history-section">' + (comparison.eligible.length ? finishBreakdown(comparison.eligible) : '') +
      '<h4>Competition record</h4><ul class="clubs9-comp-record">' + comps +
      '</ul><p class="clubs9-note">' + stats.titles + ' published premierships across ' + stats.seasons +
      ' recorded seasons.</p>' + (finals ? '<p class="clubs9-note">Published finals records identify ' + finals +
        ' finals entries, including ' + finalists + ' grand finalists.</p>' : '') + '</section></div><details class="clubs9-history-method"><summary>How the comparison works</summary><p>First in a complete ladder scores 100 and last scores 0. ' +
      'Tied ranks share the midpoint of the positions they occupy. The section average is 50. Equal-chance premierships add one divided by the number of teams for each eligible entry. ' +
      'The comparison uses published past-season results.</p></details>' +
      (result.partial ? '<p class="clubs9-note">Some competition data could not be loaded.</p>' : '');
  }

  function card(row, index) {
    const rank = Model.position(row);
    const available = row.current || !!row.historyKey;
    return '<button type="button" class="clubs9-entry" data-clubs-action="entry" data-value="' + index + '"' +
      (available ? '' : ' disabled title="Historical section file not published"') + '>' +
      '<span><small>' + escape(catalog.competitions[row.competition]?.label || row.competition) + '</small><b>' +
      escape(row.section_label) + '</b><small>' + escape(row.team) + ' · ' + escape(row.season_label) + '</small></span>' +
      '<span class="clubs9-entry-result"><strong>' + (Number.isFinite(rank) ? '#' + rank : '—') + '</strong><small>' +
      escape(row.champion ? 'Premiers' : row.points == null ? 'Points unavailable' : row.points + ' pts') +
      '</small><small>' + escape(Model.record(row)) + '</small></span></button>';
  }

  function performanceOrder(a, b) {
    const reference = recordIndex.reference;
    return (reference.get(b)?.score ?? -1) - (reference.get(a)?.score ?? -1) ||
      Model.position(a) - Model.position(b) || Model.sectionOrder(a, b);
  }

  function seasonGroup(group, open, current = false) {
    const best = [...group.rows].sort(performanceOrder).find(row => Number.isFinite(Model.position(row)));
    const rows = [...group.rows].sort(entryOrder === 'performance' ? performanceOrder : Model.sectionOrder);
    const count = rows.length + (rows.length === 1 ? ' entry' : ' entries');
    return '<details class="clubs9-season' + (current ? ' clubs9-current' : '') + '" data-season-label="' + escape(group.label) + '"' + (open ? ' open' : '') +
      '><summary>' + escape(group.label + ' · ' + count) + '</summary>' +
      '<div class="clubs9-season-body"><div class="clubs9-entries">' +
      rows.map(row => card(row, entries.rows.indexOf(row))).join('') +
      '</div><aside class="clubs9-best"><span class="kicker">' +
      (current ? 'LEADING CURRENT ENTRY' : 'BEST LADDER FINISH') + '</span>' +
      (best ? '<strong>#' + best.position + '</strong><b>' + escape(best.section_label) + '</b><small>' +
        escape(catalog.competitions[best.competition]?.label || best.competition) + '</small>' :
        '<p>No ladder position published.</p>') + '</aside></div></details>';
  }

  function participation() {
    const dest = $('#clubs9Panel');
    if (!entries || !dest) return;
    const matches = entries.rows.filter(row => !competition || row.competition === competition);
    const current = matches.filter(row => row.current);
    const past = Model.groupSeasons(matches.filter(row => !row.current));
    dest.innerHTML = '<div class="clubs9-filters clubs9-participation-filters">' + choice('clubCompetition', 'Competition') +
      choice('clubEntryOrder', 'Entry order') + '</div><p class="clubs9-note">Open an entry to view Team Stats in its section.' +
      (entries.partial ? ' Some competition data could not be loaded.' : '') + '</p>' +
      '<section class="clubs9-current-block"><h3>Current season</h3>' + (current.length ? seasonGroup({
        label: 'Playing now', rows: current
      }, true, true) : '<p class="clubs9-note">No current entries in this scope.</p>') + '</section>' +
      '<section class="clubs9-past-block"><h3>Past seasons</h3>' + (past.length ? past.map((group, index) =>
        seasonGroup(group, index === 0)).join('') : '<p class="clubs9-note">No past entries in this scope.</p>') + '</section>' +
      '<p data-clubs-navigation role="status"></p>';
    bindChoice('clubCompetition', [['', 'All BRTA competitions'], ...competitionChoices()], competition,
       value => { competition = value; render(); });
    bindChoice('clubEntryOrder', [['section', 'Section order'], ['performance', 'Best performance']], entryOrder,
      value => { entryOrder = value; participation(); });
  }

  function participationSnapshot(row) {
    return {
      code: data.meta.section_code, season: activeHistorySeasonId, catalog: viewCatalog,
      selected, team, competition, entryOrder, searchOpen, scope, query, searchOrder, showProvisional,
      expanded: [...document.querySelectorAll('.clubs9-season[open]')].map(group => group.dataset.seasonLabel),
      scroll: [root.scrollX, root.scrollY], row
    };
  }

  function navigationMessage(message) {
    const status = $('[data-clubs-navigation]') || $('.clubs9-return-status');
    if (status) status.textContent = message;
  }

  function sameEntry(a, b) {
    return a.section_code === b.section_code && a.season_id === b.season_id &&
      a.competition === b.competition && a.team === b.team;
  }

  async function navigate(row) {
    if (!row) return;
    const request = ++navigation, sectionRequest = loadingToken, origin = participationSnapshot(row);
    let target;
    navigationMessage('Opening ' + row.section_label + '…');
    return BRTAActivity.run('Opening ' + row.section_label, async task => {
      try {
        const history = row.current ? null : await ensureHistoryCatalog();
        const season = history?.seasons.find(item => item.id === row.historyKey);
        if (!row.current && !season) throw Error('This archived season is unavailable.');
        if (request !== navigation || sectionRequest !== loadingToken) return false;
        const catalog = row.current ? currentCatalog() : historySeasonSections(season);
        if (!catalog.some(item => item.section_code === row.section_code)) throw Error('This section is unavailable.');
        const matchInCurrentSection = data.meta.section_code === row.section_code && activeHistorySeasonId === (season?.id || null);
        target = { code: row.section_code, team: row.team, origin };
        destinationView = target;
        if (matchInCurrentSection) await mount(data);
        else {
          activeHistorySeasonId = season?.id || null;
          viewCatalog = catalog;
          if (!await loadSection(row.section_code, null, task, () => request === navigation)) throw Error('This section could not be opened.');
        }
        if (request !== navigation) return false;
        if (panel !== 'stats') navigationMessage('The selected team is missing from this section.');
        $('#clubs9Shell').scrollIntoView({ block: 'start', behavior: 'instant' });
        $('[data-clubs-action="return"]')?.focus({ preventScroll: true });
        return true;
      } catch (error) {
        if (request === navigation) navigationMessage(error.message);
        return false;
      } finally {
        if (destinationView === target) destinationView = null;
      }
    }, { priority: 1, message: 'Finding the season and section…' });
  }

  async function returnToParticipation() {
    if (destinationView?.restore) return;
    const origin = trail.pop();
    if (!origin) return;
    const request = ++navigation;
    const target = { code: origin.code, restore: origin };
    return BRTAActivity.run('Returning to Participation', async task => {
      try {
        const sameSection = data.meta.section_code === origin.code && activeHistorySeasonId === origin.season;
        destinationView = target;
        if (sameSection) await mount(data);
        else {
          activeHistorySeasonId = origin.season;
          viewCatalog = origin.catalog;
          if (!await loadSection(origin.code, null, task, () => request === navigation)) throw Error('Could not reopen the original section.');
        }
        if (request !== navigation) return false;
        for (const group of document.querySelectorAll('.clubs9-season')) group.open = origin.expanded.includes(group.dataset.seasonLabel);
        const index = entries?.rows.findIndex(row => sameEntry(row, origin.row));
        const control = index >= 0 && $('[data-clubs-action="entry"][data-value="' + index + '"]');
        control?.focus?.({ preventScroll: true });
        root.scrollTo({ left: origin.scroll[0], top: origin.scroll[1], behavior: 'instant' });
        return true;
      } catch (error) {
        if (request === navigation) {
          trail.push(origin);
          navigationMessage(error.message);
        }
        return false;
      } finally {
        if (destinationView === target) destinationView = null;
      }
    }, { priority: 1 });
  }

  const teamRatingViews = [
    ['singles', 'Singles'], ['pairs', 'Doubles pairs'], ['doublesPlayers', 'Individual doubles'], ['overall', 'Overall']
  ];
  let teamSlots;

  function usualPositions(model) {
    const slots = new Map();
    function add(name, position) {
      if (!slots.has(name)) slots.set(name, new Map());
      const counts = slots.get(name);
      counts.set(position, (counts.get(position) || 0) + 1);
    }
    for (const day of model.days) {
      for (const rubber of day.rubbers) {
        if (String(rubber.type).toLowerCase() !== 'doubles') continue;
        const own = rubber[day.side];
        const names = Array.isArray(own) ? own : String(own || '').split(' / ');
        const position = 'D' + (String(rubber.position).match(/\d+/)?.[0] || 1);
        for (const name of names) if (day.selected[name]) add(name, position);
        if (names.length === 2 && names.every(name => day.selected[name])) add(BRTATeamLab.pairKey(names), position);
      }
    }
    const doubles = new Map([...slots].map(([name, positions]) =>
      [name, [...positions].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], undefined, { numeric: true }))[0][0]]));
    const singles = new Map(model.players.filter(player => player.usualSlot)
      .map(player => [player.name, 'S' + player.usualSlot]));
    return { singles, doubles };
  }

  function drawTeamRatings() {
    const host = $('#clubs9TeamRatings');
    if (!host) return;
    const views = data.meta.singlesOnly ? teamRatingViews.slice(0, 1) : teamRatingViews;
    if (!views.some(([id]) => id === ratingViewForTeam)) ratingViewForTeam = views[0][0];
    const view = ratingViewForTeam;
    const rows = BRTAHistory.withMovement(data, view).filter(row => row.team === team);
    const body = rows.map((row, index) => {
      const name = view === 'pairs' ? lab8PairLink(row.player, null, row.player) : ratingPerson(row);
      const single = teamSlots.singles.get(row.player);
      const double = teamSlots.doubles.get(view === 'pairs' ? BRTATeamLab.pairKey(row.player.split(' / ')) : row.player);
      const slot = view === 'overall' ? [single, double].filter(Boolean).join(' / ') : view === 'singles' ? single : double;
      const record = view === 'overall' ? [row.s?.rating, row.d?.rating].map(value => value ?? '—').join(' / ') :
        [row.wins, row.losses].map(value => value ?? '—').join('–');
      return '<tr' + (row.rank == null ? ' class="provisional"' : '') + '><td>' + (index + 1) + '</td><td>' +
        rankCell(row) + '</td><th scope="row">' + name + '</th><td><b>' + escape(row.rating) +
        '</b></td><td>' + escape(slot || '—') + '</td><td>' + escape(record) + '</td><td>' +
        (row.rank == null ? '<span class="clubs9-badge">Provisional</span>' : 'Ranked') + '</td></tr>';
    }).join('');
    host.innerHTML = '<h3>Team ratings</h3><div class="clubs9-rating-tabs" aria-label="Team rating type">' +
      views.map(([id, label]) => button(label, 'rating', id, 'aria-pressed="' + (id === view) + '"')).join('') + '</div>' +
      '<p class="clubs9-note">Ordered by Power within the team. Section ranks use the full rating table.</p>' +
      (rows.length ? '<div class="clubs9-rating-scroll" tabindex="0" role="region" aria-label="Team ratings table">' +
        '<table><thead><tr><th>Team #</th><th>Section #</th><th>' + (view === 'pairs' ? 'Pair' : 'Player') +
        '</th><th>Power</th><th>Usual spot</th><th>' + (view === 'overall' ? 'S / D Power' : 'W–L') +
        '</th><th>Status</th></tr></thead><tbody>' + body + '</tbody></table></div>' :
        '<p class="clubs9-note">No ' + escape(views.find(([id]) => id === view)[1].toLowerCase()) + ' ratings published for this team.</p>');
  }

  function teamRatings(lab) {
    const lineup = lab.querySelector('#tl-build');
    if (!lineup) return;
    teamSlots = usualPositions(BRTATeamLab.build(data, team));
    const layout = document.createElement('div');
    layout.className = 'clubs9-team-ratings-layout';
    const host = document.createElement('section');
    host.id = 'clubs9TeamRatings';
    host.className = 'tl-section';
    lineup.before(layout);
    layout.append(lineup, host);
    drawTeamRatings();
  }

  function render() {
    const shell = $('#clubs9Shell');
    if (!shell || !data || activePage !== 'teams') return;
    const id = ++revision;
    mapAbort?.abort();
    pendingView = BRTAActivity.run('Loading Clubs', async task => {
      try {
        if (!localClub() || searchOpen) {
          task.stage(10, 'Getting the club directory…');
          if (!directory || !catalog) {
            await prepare();
            if (revision !== id) return false;
            sectionClubs = sectionTeams();
            if (team) selected = sectionClubs.find(item => item.teams[0].name === team) || selected;
          }
        }
        if (revision !== id) return false;
        const lab = $('#teamLabContent');
        lab.hidden = panel !== 'stats';
        $('#teamCards').innerHTML = toolbar();
        shell.innerHTML = (trail.length ? '<div class="clubs9-return">' + button('← Back to Participation', 'return') +
          '<span class="clubs9-return-status" role="status"></span></div>' : '') +
          (selected ? header() + '<div id="clubs9Panel"></div>' : '<div class="clubs9-card"><p>No clubs are recorded in this section.</p></div>');
        const dest = $('#clubs9Panel');
        if (searchOpen) { searchControls(); searchResults(); }
        if (selected && panel === 'stats') {
          statsView(team);
          lab.removeAttribute('aria-labelledby');
          lab.setAttribute('aria-label', 'Team Stats');
          teamRatings(lab);
        }
        if (selected && panel === 'participation') dest.innerHTML = localClub() ?
          '<p class="clubs9-note">Local clubs have no published BRTA participation records.</p>' :
          '<p role="status">Loading club participation…</p>';
        if (selected && panel === 'overview') {
          dest.innerHTML = overview();
          bindChoice('clubMap', mapScopes, mapScope, value => { mapScope = value; render(); });
          const filters = [['', 'All BRTA competitions'], ...competitionChoices()];
          const changeHistory = value => {
            historyCompetition = value;
            bindChoice('clubHistoryCompetition', filters, historyCompetition, changeHistory);
            refreshRecords();
          };
          bindChoice('clubHistoryCompetition', filters, historyCompetition, changeHistory);
        }
        const mapReady = panel === 'overview' && mapScope === 'section' ? map(id) : null;
        await showRecords(id, task);
        if (revision !== id) return false;
        task.stage(85, 'Preparing the club view…');
        await (panel === 'overview' && mapScope !== 'section' ? map(id) : mapReady);
        return revision === id;
      } catch (error) {
        if (revision === id) shell.insertAdjacentHTML('beforeend', '<p role="alert">' + escape(error.message) + '</p>');
        return false;
      }
    }, { key: 'clubs-view' });
    return pendingView;
  }

  function mount(section) {
    if (!section) return;
    const changed = !data || data.meta.section_code !== section.meta.section_code || data.meta.season_id !== section.meta.season_id;
    data = section;
    if (changed) {
      selected = null;
      team = '';
      panel = section.meta.is_custom ? 'stats' : 'overview';
      const configured = localStorage.getItem('brta-default-competition');
      const defaultCompetition = (DATA.catalog || []).some(row => row.competition_code === configured) ? configured : section.meta.competition_code;
      competition = defaultCompetition;
      historyCompetition = defaultCompetition;
      mapScope = 'section';
      if (!destinationView) trail.length = 0;
    }
    sectionClubs = sectionTeams();
    if (!selected && sectionClubs.length) {
      selected = sectionClubs[0];
      team = selected.teams[0].name;
    }
    if (destinationView?.code === section.meta.section_code) {
      const target = destinationView;
      destinationView = null;
      if (target.restore) {
        ({ selected, team, competition, entryOrder, searchOpen, scope, query, searchOrder, showProvisional } = target.restore);
        panel = 'participation';
      } else {
        trail.push(target.origin);
        const match = sectionClubs.find(item => Model.key(item.teams[0].name) === Model.key(target.team));
        if (match) { selected = match; team = match.teams[0].name; panel = 'stats'; }
      }
    }
    if (activePage === 'teams') return render();
  }

  function openTeam(name, tab = 'stats') {
    if (activePage !== 'teams') switchPage('teams');
    const club = sectionClubs.find(item => item.teams.some(row => row.name === name));
    if (club) return select(club, tab, name);
  }

  function openSearch() {
    searchOpen = true;
    if (activePage !== 'teams') switchPage('teams');
    else render();
    $('[data-clubs-query]')?.focus();
  }

  document.addEventListener('click', event => {
    const control = event.target.closest('[data-clubs-action]');
    if (!control || control.disabled) return;
    const { clubsAction: action, value } = control.dataset;
    if (action === 'rating') {
      ratingViewForTeam = value;
      drawTeamRatings();
      $('.clubs9-rating-tabs [aria-pressed="true"]')?.focus({ preventScroll: true });
      return;
    }
    if (action === 'entry') navigate(entries?.rows[Number(value)]);
    else if (action === 'return') returnToParticipation();
    else {
      navigation++;
      if (action === 'club' || action === 'search-result') {
        const club = action === 'club' ? sectionClubs.find(item => item.teams[0].name === value) :
          searchClubs.find(item => item.id === value);
        if (club) select(club, club.id.startsWith('local:') ? 'stats' : 'overview',
          action === 'club' ? value : undefined);
      }
      if (action === 'panel') { panel = value; window.BRTARouteUI?.club(team, panel); render(); }
      if (action === 'search') { searchOpen = !searchOpen; render(); if (searchOpen) $('[data-clubs-query]')?.focus(); }
      if (action === 'focus-map') mountedMap?.focusSelected();
      if (action === 'map') toggleMap(control.closest('.clubs9-location'));
    }
  });
  function updateMapButton(section) {
    const control = section?.querySelector('[data-clubs-action="map"]');
    if (!control) return;
    const expanded = document.fullscreenElement === section || section.classList.contains('clubs9-map-expanded');
    control.textContent = expanded ? 'Close map' : 'Expand map';
    control.setAttribute('aria-pressed', String(expanded));
  }

  async function toggleMap(section) {
    if (document.fullscreenElement === section) await document.exitFullscreen();
    else if (section.classList.contains('clubs9-map-expanded')) section.classList.remove('clubs9-map-expanded');
    else {
      try {
        if (!section.requestFullscreen) throw Error('Fullscreen unavailable');
        await section.requestFullscreen();
      } catch { section.classList.add('clubs9-map-expanded'); }
    }
    updateMapButton(section);
  }

  document.addEventListener('fullscreenchange', () => updateMapButton($('.clubs9-location')));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const section = $('.clubs9-map-expanded');
      section?.classList.remove('clubs9-map-expanded');
      updateMapButton(section);
    }
  });
  document.addEventListener('input', event => {
    if (event.target.matches('[data-clubs-query]')) { query = event.target.value; searchResults(); }
  });
  document.addEventListener('change', event => {
    const control = event.target;
    if (control.matches('[data-clubs-provisional]')) { showProvisional = control.checked; searchResults(); }
  });

  root.BRTAClubs = { mount, openTeam, openSearch, ready: () => pendingView,
    leave: () => { navigation++; revision++; destinationView = null; mapAbort?.abort(); } };
  BRTATeamLabUI.open = name => openTeam(name);
  if (new URLSearchParams(location.search).get('view') === 'clubs') {
    root.addEventListener('brta-section-ready', () => switchPage('teams'), { once: true });
  }
  mount(D);
})(window);
