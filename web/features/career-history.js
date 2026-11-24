((root) => {
  'use strict';
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const MONTH_MS = 86400000 * 30.4375;
  function matchTime(value) {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (iso) return Date.UTC(+iso[1], +iso[2] - 1, +iso[3]);
    const numeric = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(value || '');
    if (numeric) return Date.UTC(+numeric[3] + (numeric[3].length === 2 ? (+numeric[3] < 70 ? 2000 : 1900) : 0), +numeric[2] - 1, +numeric[1]);
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

  const skillMethod = 'Each division has a baseline 45 points above the next division in the same ladder. Sets 1 (or the top division of a separate ladder) starts at 1500, and junior Open Rubbers start above Sets. Results adjust the baseline using 60% match win rate and 40% game share, with five neutral matches pulling small samples toward the baseline. Each recorded match has equal weight in the season estimate.';
  const sectionOrder = row => {
    const label = String(row.sectionLabel || '').trim().toLowerCase();
    const number = Number(/(?:^|[^\d])(\d{1,2})(?!\d)/.exec(label)?.[1]);
    if (!Number.isInteger(number) || number < 1 || !label.match(/sets?|rub|section|secti?on|grade|div|s\/d|girls?|boys?|mixed|\bmx\b|^(?:a ?)?\d{1,2}$/)) return null;
    const junior = ['AA', 'UA'].includes(row.competitionCode);
    const family = /green/.test(label) ? 'Green Ball' : /girls?/.test(label) ? 'Girls' : /boys?/.test(label) ? 'Boys' :
      /^(?:women|ladies)/.test(label) ? 'Women’s ' + (/rub/.test(label) ? 'Rubbers' : 'Sets') :
      /^(?:men|tuemen)/.test(label) ? 'Men’s ' + (/rub/.test(label) ? 'Rubbers' : 'Sets') :
      /^(?:mx|mixed)/.test(label) ? 'Mixed' : 'Open';
    return {number, family, rubbers: junior && family === 'Open' && /^rub/.test(label)};
  };

  function skillScale(sections) {
    const rubbers = new Map();
    for (const row of sections) {
      const order = sectionOrder(row);
      if (order?.rubbers) rubbers.set(row.competitionCode, Math.max(order.number, rubbers.get(row.competitionCode) || 0));
    }
    return row => {
      const order = sectionOrder(row);
      if (!order) return null;
      const {number, family} = order;
      return {pool: row.competitionCode + '/' + family, family,
        baseline: 1500 + 45 * (order.rubbers ? (rubbers.get(row.competitionCode) || number) - number + 1 : 1 - number)};
    };
  }

  function skillHistory(matches, scale, discipline = 'overall') {
    const seasons = new Map();
    const sections = new Map();
    for (const match of matches) {
      if (discipline !== 'overall' && match.kind !== (discipline === 'doubles' ? 'doublesPlayers' : 'singles')) continue;
      const row = match.entry, tier = scale(row);
      if (!tier || typeof match.won !== 'boolean') continue;
      const season = JSON.stringify([row.seasonKey || row.seasonLabel, tier.pool]);
      const id = JSON.stringify([season, row.sectionCode]);
      if (!sections.has(id)) sections.set(id, {season, row, tier, count: 0, wins: 0, gamesFor: 0, gamesAgainst: 0, date: null});
      const sample = sections.get(id);
      sample.count++;
      sample.wins += Number(match.won);
      sample.gamesFor += match.gf || 0;
      sample.gamesAgainst += match.ga || 0;
      const date = matchTime(match.date);
      if (date != null) sample.date = Math.max(sample.date ?? date, date);
    }
    for (const sample of sections.values()) {
      const {season, row, tier, count, wins, gamesFor, gamesAgainst, date} = sample;
      const winRate = wins / count, gameShare = gamesFor + gamesAgainst ? gamesFor / (gamesFor + gamesAgainst) : winRate;
      const score = tier.baseline + 160 * (.6 * winRate + .4 * gameShare - .5) * count / (count + 5);
      if (!seasons.has(season)) seasons.set(season, {row, ...tier, date: null, count: 0, weighted: 0, sections: []});
      const point = seasons.get(season);
      if (date != null) point.date = Math.max(point.date ?? date, date);
      point.count += count;
      point.weighted += score * count;
      point.sections.push({label: row.sectionLabel, code: row.sectionCode, baseline: tier.baseline, count,
        winRate: winRate * 100, gameShare: gameShare * 100, rating: Math.round(score)});
    }
    return [...seasons.values()].map(({weighted, ...point}) => ({...point, rating: Math.round(weighted / point.count)}))
      .sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity) || a.pool.localeCompare(b.pool));
  }

  const career = {matchTime, seasonRecords, seasonAwards, skillScale, skillHistory, skillMethod};
  if (typeof module !== 'undefined') module.exports = career;
  if (typeof window === 'undefined') return;

  const colours = ['#327bc1', '#269264', '#bd6434', '#9563bd', '#be5478', '#268a97', '#997b25'];
  const percent = value => Number.isFinite(value) ? Math.round(value) + '%' : '—';
  const showCompetition = row => row.competitionLabel || competitionLabel(row.competitionCode);
  const label = row => row.seasonLabel + ' · ' + showCompetition(row);
  const ladderLabel = point => showCompetition(point.row) + ' · ' + point.family;
  function timeline(history) {
    const points = history.filter(point => Number.isFinite(point.date));
    if (!points.length) return '<p>No dated results in a recognised ladder for this discipline.</p>';
    const series = new Map();
    for (const point of points) {
      if (!series.has(point.pool)) series.set(point.pool, []);
      series.get(point.pool).push(point);
    }
    const left = 52, right = 608, top = 16, bottom = 179;
    const first = points[0].date, last = points.at(-1).date;
    const x = date => first === last ? (left + right) / 2 : left + (date - first) / (last - first) * (right - left);
    const low = Math.floor((Math.min(...points.map(point => point.rating)) - 15) / 25) * 25;
    const interval = Math.max(25, Math.ceil((Math.max(...points.map(point => point.rating)) + 15 - low) / 100) * 25);
    const y = value => bottom - (value - low) / (4 * interval) * (bottom - top);
    const dates = first === last ? [first] : [first, ...((last - first) > 12 * MONTH_MS ? [(first + last) / 2] : []), last];
    const tickDate = new Intl.DateTimeFormat('en-AU', {month: 'short', year: 'numeric', timeZone: 'UTC'});
    const ticks = Array.from({length: 5}, (_, i) => {
      const val = low + i * interval, at = y(val);
      return '<path d="M52 ' + at + 'H608"/><text x="44" y="' + (at + 4) + '" text-anchor="end">' + val + '</text>';
    }).join('') + dates.map((date, i) => '<text x="' + x(date) + '" y="205" text-anchor="' +
      (dates.length === 1 || i === 1 && dates.length === 3 ? 'middle' : i === 0 ? 'start' : 'end') + '">' +
      esc(tickDate.format(date)) + '</text>').join('');
    let lines = '', legend = '';
    for (const [index, entries] of [...series.values()].entries()) {
      const color = colours[index % colours.length];
      const coords = point => x(point.date).toFixed(1) + ',' + y(point.rating).toFixed(1);
      lines += '<polyline points="' + entries.map(coords).join(' ') + '" stroke="' + color + '" fill="none" stroke-width="2.5"/>' +
        entries.map(point => '<circle cx="' + x(point.date) + '" cy="' + y(point.rating) + '" r="4.5" fill="' + color +
          '"><title>' + esc(label(point.row) + ' · ' + point.family + ' · ' + point.rating + ' skill · ' +
            point.sections.map(section => section.label).join(', ')) + '</title></circle>').join('');
      legend += '<li><i style="background:' + color + '" aria-hidden="true"></i>' + esc(ladderLabel(entries[0])) + '</li>';
    }
    return '<svg viewBox="0 0 632 218" role="img" aria-label="Estimated playing skill by season and ladder">' +
      '<g class="career99-axes">' + ticks + '</g>' + lines + '</svg><ul class="career99-legend">' + legend + '</ul>';
  }

  function skillTable(history) {
    if (!history.length) return '';
    return '<details class="career-skill-record"><summary>Skill ratings by season</summary><div class="table-wrap"><table><thead><tr><th scope="col">Season</th><th scope="col">Ladder</th><th scope="col">Sections</th><th scope="col">Matches</th><th scope="col">Skill</th></tr></thead><tbody>' +
      [...history].reverse().map(point => '<tr><td>' + esc(point.row.seasonLabel) + '</td><td>' + esc(ladderLabel(point)) +
        '</td><td>' + esc(point.sections.map(section => section.label).join(', ')) + '</td><td>' + point.count +
        '</td><td><b>' + point.rating + '</b>' + (point.count < 5 ? ' <small>Provisional</small>' : '') + '</td></tr>').join('') + '</tbody></table></div></details>';
  }

  function draw(panel, matches, scale) {
    const seasons = seasonRecords(matches.map(match => ({row: match.entry, matches: [match]})));
    panel.innerHTML = '<p>Each dot estimates playing skill for a season in one ladder. Compare points within the same ladder.</p>' +
      '<div class="career99-filters"><label>Discipline <select data-career-discipline><option value="overall">All matches</option><option value="singles">Singles</option><option value="doubles">Doubles</option></select></label>' +
      '</div>' +
      '<div data-career-chart class="career99-chart"></div><div data-career-skill-table></div>' +
      '<details><summary>How skill is estimated</summary><p>' + skillMethod + ' A rating based on fewer than five matches is provisional. ' +
        'Dates are based on each ladder’s last recorded match that season.</p></details>' +
      '<h4>Best seasons</h4><p>Rate awards require at least five matches. Each competition season is assessed separately.</p><div class="career99-awards">' +
      (seasonAwards(seasons).map(award => '<article><span>' + award.label + '</span><strong>' +
        (['winRate','gameShare'].includes(award.field) ? percent(award.value) : award.value) +
        '</strong><small>' + award.records.map(season => esc(label(season.row))).join(' / ') + '</small></article>').join('') ||
        '<p>Season awards will appear when there are recorded matches.</p>') +
      '</div>';
    const chart = panel.querySelector('[data-career-chart]');
    const discipline = panel.querySelector('[data-career-discipline]');
    const refresh = () => {
      const points = skillHistory(matches, scale, discipline.value);
      chart.innerHTML = timeline(points);
      panel.querySelector('[data-career-skill-table]').innerHTML = skillTable(points);
    };
    discipline.addEventListener('change', refresh);
    refresh();
  }

  root.BRTACareerTimeline = {...career, render: draw};
})(typeof window === 'undefined' ? globalThis : window);
/* BRTA Power Ratings 9.9g */
