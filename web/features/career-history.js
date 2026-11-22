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

  if (typeof module !== 'undefined') module.exports = {matchTime, seasonRecords, seasonAwards};
  if (typeof window === 'undefined') return;

  const colours = ['#327bc1', '#269264', '#bd6434', '#9563bd', '#be5478', '#268a97', '#997b25'];
  const percent = value => Number.isFinite(value) ? Math.round(value) + '%' : '—';
  const showCompetition = row => row.competitionLabel || competitionLabel(row.competitionCode);
  const label = row => row.seasonLabel + ' · ' + showCompetition(row);
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
    const scale = metric === 'count'
      ? Math.ceil(Math.max(1, ...points.map(point => point[discipline].count)) / 4) * 4
      : 100;
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

  function draw(panel, seasons) {
    panel.innerHTML = '<p>One timeline for all recorded competitions. Each dot is a competition season, placed at its last dated match.</p>' +
      '<div class="career99-filters"><label>Discipline <select data-career-discipline><option value="overall">All matches</option><option value="singles">Singles</option><option value="doubles">Doubles</option></select></label>' +
      '<label>Show <select data-career-metric><option value="winRate">Match win rate</option><option value="gameShare">Share of games won</option><option value="count">Matches played</option></select></label></div>' +
      '<div data-career-chart class="career99-chart"></div>' +
      '<h4>Best seasons</h4><p>Rate awards require at least five matches. Each competition season is assessed separately.</p><div class="career99-awards">' +
      (seasonAwards(seasons).map(award => '<article><span>' + award.label + '</span><strong>' +
        (['winRate','gameShare'].includes(award.field) ? percent(award.value) : award.value) +
        '</strong><small>' + award.records.map(season => esc(label(season.row))).join(' / ') + '</small></article>').join('') ||
        '<p>Season awards will appear when there are recorded matches.</p>') +
      '</div>';
    const chart = panel.querySelector('[data-career-chart]');
    const refresh = () => { chart.innerHTML = timeline(seasons,
      panel.querySelector('[data-career-discipline]').value, panel.querySelector('[data-career-metric]').value); };
    panel.addEventListener('change', refresh);
    refresh();
  }

  root.BRTACareerTimeline = {
    matchTime,
    render(panel, matches) {
      const entries = matches.map(match => ({row: match.entry, matches: [match]}));
      draw(panel, seasonRecords(entries));
    }
  };
})(typeof window === 'undefined' ? globalThis : window);
