((root) => {
  'use strict';
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_MS = 86400000 * 30.4375;
  function matchTime(value) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
    const named = /^(\d{1,2}) ([a-z]{3,9}) (\d{2}|\d{4})$/i.exec(value || '');
    if (!named) return null;
    const month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase());
    if (month < 0) return null;
    const year = +named[3] + (named[3].length === 2 ? (+named[3] < 70 ? 2000 : 1900) : 0);
    return Date.UTC(year, month, +named[1]);
  }

  function identityRows(archive, name, meta, team, seasonKey, search) {
    const results = search.find(archive, name);
    const candidates = results.filter(row => row.player === name && row.competitionCode === meta.competition_code &&
      row.sectionCode === meta.section_code && (seasonKey ? row.seasonKey === seasonKey : row.isCurrent));
    const exact = candidates.filter(row => row.team === team);
    const local = exact.length ? exact : candidates;
    if (local.length !== 1) return [];
    const appearance = local[0];
    if (!appearance.identity) return [appearance];
    return archive.entries.filter(row => row[3] === appearance.identity).flatMap(([nameId, sectionId, team]) => {
      const section = archive.sections[sectionId], player = archive.players[nameId];
      return section && player ? [{...section, team, player}] : [];
    });
  }

  function seasonRecords(entries) {
    const groups = new Map();
    for (const entry of entries) {
      const row = entry.row;
      const key = JSON.stringify([row.competitionCode, row.seasonKey || row.seasonLabel]);
      if (!groups.has(key)) groups.set(key, {row, matches: new Map(), appearances: new Map()});
      const group = groups.get(key);
      group.appearances.set(JSON.stringify([row.sectionCode, row.player, row.team]), entry);
      for (const match of entry.matches) {
        const id = JSON.stringify([row.sectionCode, match.fixtureId || match.round, match.kind, match.position, match.opp, match.partner]);
        group.matches.set(id, match);
      }
    }
    const stats = matches => {
      const count = matches.length, wins = matches.filter(match => match.won).length;
      const games = matches.reduce((sum, match) => sum + match.gf + match.ga, 0);
      return {count, wins, winRate: count ? 100 * wins / count : null,
        gameShare: games ? 100 * matches.reduce((sum, match) => sum + match.gf, 0) / games : null};
    };
    return [...groups.values()].map(group => {
      const matches = [...group.matches.values()];
      const dates = matches.map(match => matchTime(match.date)).filter(Number.isFinite);
      return {row: group.row, date: dates.length ? Math.max(...dates) : null,
        overall: stats(matches), singles: stats(matches.filter(match => match.kind === 'singles')),
        doubles: stats(matches.filter(match => match.kind === 'doublesPlayers')),
        appearances: [...group.appearances.values()]};
    }).sort((a, b) => (b.date ?? -Infinity) - (a.date ?? -Infinity) ||
      a.row.competitionCode.localeCompare(b.row.competitionCode) || a.row.seasonLabel.localeCompare(b.row.seasonLabel));
  }

  function seasonAwards(seasons) {
    const highest = (stat, field, minimum) => seasons.filter(season =>
      season[stat].count >= minimum && Number.isFinite(season[stat][field])
    ).sort((a, b) => b[stat][field] - a[stat][field] || b[stat].count - a[stat].count);
    const categories = [
      ['Best singles win rate', 'singles', 'winRate', 5],
      ['Best doubles win rate', 'doubles', 'winRate', 5],
      ['Best share of games won', 'overall', 'gameShare', 5],
      ['Most match wins', 'overall', 'wins', 1],
      ['Most matches played', 'overall', 'count', 1]
    ];
    return categories.flatMap(([label, stat, field, minimum]) => {
      const ranked = highest(stat, field, minimum);
      if (!ranked.length) return [];
      const value = ranked[0][stat][field];
      return [{label, value, field, records: ranked.filter(season => season[stat][field] === value)}];
    });
  }

  if (typeof module !== 'undefined') module.exports = {matchTime, identityRows, seasonRecords, seasonAwards};
  if (typeof window === 'undefined') return;

  const profile = document.querySelector('#profileContent');
  const overlay = document.querySelector('#profileOverlay');
  const colours = ['#327bc1', '#269264', '#bd6434', '#9563bd', '#be5478', '#268a97', '#997b25'];
  const percent = value => Number.isFinite(value) ? Math.round(value) + '%' : '—';
  const showCompetition = row => row.competitionLabel || competitionLabel(row.competitionCode);
  const label = row => row.seasonLabel + ' · ' + showCompetition(row);
  const requests = new Map();

  function timeline(seasons, discipline, metric) {
    const points = seasons.filter(season => Number.isFinite(season.date) && Number.isFinite(season[discipline][metric])).sort((a, b) => a.date - b.date);
    if (!points.length) return '<p>No dated matches for this view.</p>';
    const series = new Map();
    for (const point of points) {
      const code = point.row.competitionCode;
      if (!series.has(code)) series.set(code, []);
      series.get(code).push(point);
    }
    const left = 50, right = 608, top = 16, bottom = 179;
    const first = points[0].date, last = points.at(-1).date;
    const range = Math.max(last - first, 1);
    const x = date => first === last ? (left + right) / 2 : left + (date - first) / range * (right - left);
    const scale = metric === 'count' ? Math.ceil(Math.max(...points.map(point => point[discipline].count)) / 4) * 4 : 100;
    const y = value => bottom - value / scale * (bottom - top);
    const dates = first === last ? [first] : [first, ...((last - first) > 12 * MONTH_MS ? [(first + last) / 2] : []), last];
    const tickDate = new Intl.DateTimeFormat('en-AU', {month: 'short', year: 'numeric', timeZone: 'UTC'});
    const ticks = Array.from({length: 5}, (_, i) => {
      const val = i * scale / 4, at = y(val);
      return '<path d="M50 ' + at + 'H608"/><text x="42" y="' + (at + 4) + '" text-anchor="end">' + val + (metric === 'count' ? '' : '%') + '</text>';
    }).join('') + dates.map((date, i) => '<text x="' + x(date) + '" y="205" text-anchor="' +
      (dates.length === 1 || i === 1 && dates.length === 3 ? 'middle' : i === 0 ? 'start' : 'end') + '">' +
      esc(tickDate.format(date)) + '</text>').join('');
    let lines = '', legend = '';
    for (const [index, entries] of [...series.values()].entries()) {
      const color = colours[index % colours.length];
      const coords = point => x(point.date).toFixed(1) + ',' + y(point[discipline][metric]).toFixed(1);
      lines += '<polyline points="' + entries.map(coords).join(' ') + '" stroke="' + color + '" fill="none" stroke-width="2.5"/>' +
        entries.map(point => '<circle cx="' + x(point.date) + '" cy="' + y(point[discipline][metric]) + '" r="4.5" fill="' + color +
          '"><title>' + esc(label(point.row)) + ' · ' + (metric === 'count' ? point[discipline][metric] + ' matches' : percent(point[discipline][metric])) +
          '</title></circle>').join('');
      legend += '<li><i style="background:' + color + '" aria-hidden="true"></i>' + esc(showCompetition(entries[0].row)) + '</li>';
    }
    return '<svg viewBox="0 0 632 218" role="img" aria-label="Career results timeline, with all competitions on the same dates">' +
      '<g class="career99-axes">' + ticks + '</g>' + lines + '</svg><ul class="career99-legend">' + legend + '</ul>';
  }

  function draw(panel, seasons, missing) {
    panel.innerHTML = '<p>One timeline for all recorded competitions. Each dot is a competition season, placed at its last dated match.</p>' +
      '<div class="career99-filters"><label>Discipline <select data-career-discipline><option value="overall">All matches</option><option value="singles">Singles</option><option value="doubles">Doubles</option></select></label>' +
      '<label>Show <select data-career-metric><option value="winRate">Match win rate</option><option value="gameShare">Share of games won</option><option value="count">Matches played</option></select></label></div>' +
      '<div data-career-chart class="career99-chart"></div>' +
      (missing ? '<p role="status">' + missing + ' section ' + (missing === 1 ? 'record is' : 'records are') + ' unavailable.</p>' : '') +
      '<h4>Best seasons</h4><p>Rate awards require at least five matches. Each competition season is assessed separately.</p><div class="career99-awards">' +
      (seasonAwards(seasons).map(award => '<article><span>' + award.label + '</span><strong>' +
        (['winRate','gameShare'].includes(award.field) ? percent(award.value) : award.value) +
        '</strong><small>' + award.records.map(season => esc(label(season.row))).join(' / ') + '</small></article>').join('') ||
        '<p>Season awards will appear when there are recorded matches.</p>') +
      '</div><h4>Season-by-season record</h4><div class="career99-seasons">' + seasons.map(season =>
        '<article><h5>' + esc(label(season.row)) + '</h5><p>' + season.singles.wins + '–' + (season.singles.count - season.singles.wins) +
        ' singles · ' + season.doubles.wins + '–' + (season.doubles.count - season.doubles.wins) + ' doubles</p><ul>' +
        season.appearances.map(entry => '<li>' + esc([entry.row.sectionLabel, entry.row.team].filter(Boolean).join(' · ')) +
          (entry.emergencyTies ? ' · ' + entry.emergencyTies + ' emergency ' + (entry.emergencyTies === 1 ? 'tie' : 'ties') : '') +
          (entry.finalsTies ? ' · ' + entry.finalsTies + ' finals ' + (entry.finalsTies === 1 ? 'tie' : 'ties') : '') + '</li>').join('') +
        '</ul></article>').join('') + '</div>';
    const chart = panel.querySelector('[data-career-chart]');
    const refresh = () => { chart.innerHTML = timeline(seasons,
      panel.querySelector('[data-career-discipline]').value, panel.querySelector('[data-career-metric]').value); };
    panel.addEventListener('change', refresh);
    refresh();
  }

  function sectionData(row, active) {
    if (active.meta.section_code === row.sectionCode && active.meta.competition_code === row.competitionCode &&
        (!active.meta.is_archive && row.isCurrent || active.meta.is_archive && !row.isCurrent &&
          active.meta.season_label === row.seasonLabel)) return Promise.resolve(active);
    const path = row.dataPath;
    if (!requests.has(path)) requests.set(path, fetch(path).then(response => {
      if (!response.ok) throw Error('Section unavailable');
      return response.json();
    }).then(normaliseTeamLabels).catch(error => { requests.delete(path); throw error; }));
    return requests.get(path);
  }

  async function openCareer(panel, context) {
    const {active, name, team, seasonKey} = context;
    panel.innerHTML = '<p role="status">Loading published match history…</p>';
    try {
      const index = await ensurePlayerSearchIndex();
      if (!index) throw Error('Player history is unavailable.');
      const rows = identityRows(index, name, active.meta, team, seasonKey, BRTAPlayerSearch);
      if (!panel.isConnected) return;
      if (!rows.length) {
        panel.innerHTML = '<p>No matching archive appearance was found for this entry.</p>';
        return;
      }
      let position = 0, missing = 0;
      const entries = new Array(rows.length);
      async function read() {
        while (position < rows.length && panel.isConnected && !overlay.classList.contains('hidden')) {
          const current = position++, row = rows[current];
          try {
            const data = await sectionData(row, active);
            const matches = ['singles', 'doublesPlayers'].flatMap(kind => L8.matches(data, row.player, kind)
              .filter(match => !row.team || row.team === match.team).map(match => ({...match, kind})));
            const emergencyTies = row.team ? (BRTATeamLab.build(data, row.team).players.find(player => player.name === row.player)?.emergencyDays.length || 0) :
              new Set(matches.filter(match => match.emergency).map(match => match.fixtureId || match.round)).size;
            const finals = new Set((data.results || []).flatMap(group => (group.fixtures || []).filter(fixture =>
              /final|playoff|knockout/i.test([fixture.stage, group.stage, group.label].filter(Boolean).join(' '))
            ).map(fixture => fixture.fixtureId)));
            const finalsTies = new Set(matches.filter(match => finals.has(match.fixtureId)).map(match => match.fixtureId)).size;
            entries[current] = {row, matches, emergencyTies, finalsTies};
          } catch { missing++; }
        }
      }
      await Promise.all(Array.from({length: Math.min(3, rows.length)}, read));
      if (!panel.isConnected) return;
      if (overlay.classList.contains('hidden')) { panel.dataset.loaded = ''; return; }
      if (!entries.some(Boolean)) throw Error('Section records could not be loaded.');
      draw(panel, seasonRecords(entries.filter(Boolean)), missing);
    } catch (error) {
      if (!panel.isConnected) return;
      panel.innerHTML = '<p role="status">' + esc(error.message) + '</p><button type="button" class="button secondary">Try again</button>';
      panel.querySelector('button').onclick = () => openCareer(panel, context);
    }
  }

  function addCareer(name, round = null) {
    if (!D?.meta || D.meta.is_custom || auxiliaryPlayer(name) || root.BRTAPlayerDisplay?.isUnknown(name) ||
        overlay.classList.contains('hidden') || profile.querySelector('.career99')) return;
    const head = profile.querySelector('.profile-head');
    if (!head) return;
    const team = (L8.row(D, 'singles', name, round) || L8.row(D, 'doublesPlayers', name, round))?.team;
    const context = {active: D, name, team, seasonKey: activeHistorySeasonId};
    const section = document.createElement('details');
    section.className = 'profile-section career99';
    section.innerHTML = '<summary>Career timeline and best seasons</summary><div class="career99-content"></div>';
    head.after(section);
    const panel = section.querySelector('.career99-content');
    section.addEventListener('toggle', () => {
      if (!section.open || panel.dataset.loaded) return;
      panel.dataset.loaded = '1';
      openCareer(panel, context);
    });
  }

  const player = openProfile;
  openProfile = function (name) { player(name); addCareer(name); };
  const historical = openHistoricalProfile;
  openHistoricalProfile = function (name, round) { historical(name, round); addCareer(name, round); };
})(typeof window === 'undefined' ? globalThis : window);
