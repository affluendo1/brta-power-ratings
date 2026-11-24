(function (root) {
  'use strict';
  const requireLocal = name => typeof module !== 'undefined' ? require(name) : null;
  const Scores = root.BRTAScores || requireLocal('./score-formats');
  const Lab = root.BRTALabModel || requireLocal('./lab-model');
  const History = root.BRTAHistory || requireLocal('./rating-history');
  const Career = root.BRTACareerTimeline || requireLocal('../features/career-history');
  const members = Lab.members;
  const dateValue = match => Career.matchTime(match.date) ?? Infinity;
  const chronological = (a, b) => dateValue(a) - dateValue(b) || (a.round || 0) - (b.round || 0) ||
    String(a.fixtureId).localeCompare(String(b.fixtureId)) || String(a.position).localeCompare(String(b.position), undefined, {numeric: true});
  const dateText = date => date == null ? '—' : new Date(date).toISOString().slice(0, 10);
  const recordKey = match => JSON.stringify([match.entry.seasonKey, match.entry.sectionCode, match.fixtureId || match.round,
    match.type, match.position, match.ownTeam, match.oppTeam, match.opponent, match.partner]);
  const roundTitle = match => /semi/i.test(match.stage || '') ? 'Semifinals' :
    /final/i.test(match.stage || '') ? 'Grand final' : match.round == null ? '—' : 'Round ' + match.round;

  function powerHistory(data, name, pairs) {
    if (!data) return [];
    const scopes = [
      ['Singles', 'singles', name], ['Individual doubles', 'doublesPlayers', name], ['Overall', 'overall', name],
      ...pairs.map(pair => ['Pair', 'pairs', pair])
    ];
    return scopes.flatMap(([label, view, player]) => {
      const key = view === 'pairs' ? Lab.key : value => value;
      const pick = (round, date) => {
        const row = History.ranked(History.rowsAt(data, view, round), view, data).find(r => key(r.player) === key(player));
        if (!row || !Number.isFinite(row.rating)) return [];
        return [{round, date, rating: row.rating, rank: row.rank, matches: row.matches ?? null,
          standardError: row.se ?? null, lower: row.lo ?? null, upper: row.hi ?? null, status: row.ranking_status || null}];
      };
      const rounds = History.rounds(data, view === 'overall' ? 'singles' : view)
        .flatMap(item => pick(Number(item.round), item.date || null));
      const current = pick(null, null)[0] || null;
      return rounds.length || current ? [{label, player, current, rounds}] : [];
    });
  }

  function extract(data, entry, rated, modelLabel) {
    const matches = [];
    const ties = new Map();
    const preRounds = [...new Set((rated?.ratingHistory?.rounds || []).map(item => Number(item.round)))].sort((a,b) => a-b);
    const section = [entry.sectionCode, entry.seasonKey].join('|');
    const teamStatus = entry.team ? (data.standings || []).findIndex(row => row.team === entry.team) : -1;
    const team = teamStatus < 0 ? null :
      {...data.standings[teamStatus], position: data.standings[teamStatus].officialPosition || teamStatus + 1,
        final: !entry.isCurrent || !!data.knockout?.regularSeasonComplete || !!root.BRTAStandings?.season(data).complete};
    const prePower = (view, player, pre) => {
      if (!rated || pre == null) return null;
      if (view === 'singles') return History.rowsAt(rated, 'singles', pre).find(row => row.player === player)?.rating ?? null;
      return Lab.pairPower(rated, player, pre).rating;
    };
    for (const group of data.results || []) for (const fixture of group.fixtures || []) {
      const round = Number(fixture.round ?? group.round), date = fixture.date || group.date || null;
      const pre = preRounds.findLast(value => value < round);
      const fixtureId = fixture.fixtureId || null, stage = fixture.stage || group.stage || 'regular';
      const sideFor = rubber => {
        const sides = ['home','away'].filter(side => members(rubber[side]).includes(entry.player));
        const exact = sides.filter(side => fixture[side] === entry.team);
        if (exact.length === 1) return exact[0];
        return !entry.team && sides.length === 1 ? sides[0] : null;
      };
      for (const rubber of fixture.rubbers || []) {
        const side = sideFor(rubber);
        if (!side) continue;
        const other = side === 'home' ? 'away' : 'home';
        const own = rubber[side], opponent = rubber[other] || '';
        const type = rubber.type || 'Singles', doubles = type === 'Doubles';
        const partner = doubles ? members(own).find(player => player !== entry.player) || null : null;
        const winnerSide = rubber.winnerSide || rubber.winner_side ||
          (rubber.winner && rubber.home !== rubber.away ? ['home','away'].find(key => Lab.key(rubber[key]) === Lab.key(rubber.winner)) : null);
        const won = winnerSide === side ? true : winnerSide === other ? false : null;
        const sourceScore = rubber.sourceScore || rubber.score || null;
        const status = rubber.status || (/ret\b/i.test(sourceScore) ? 'Retired' : /forfeit|walkover|\bw\/o\b/i.test(sourceScore) ? 'Forfeit' :
          /unfinished/i.test(sourceScore) ? 'Unfinished' : winnerSide ? 'Completed' : 'Result unavailable');
        const sets = Scores.parse(sourceScore, {outcomeCode: Scores.outcomeCode(data, type)});
        const ordinary = sets.filter(set => !set.mt);
        const gamesFor = ordinary.length ? ordinary.reduce((sum, set) => sum + set[side[0]], 0) : null;
        const gamesAgainst = ordinary.length ? ordinary.reduce((sum, set) => sum + set[other[0]], 0) : null;
        const view = doubles ? 'pairs' : 'singles';
        const known = rubber.valid_for_rating !== false && status === 'Completed' && won != null && sets.length > 0;
        const flags = rubber[side + 'Emergencies'];
        const slot = members(own).indexOf(entry.player);
        matches.push({entry, fixtureId, round: Number.isFinite(round) ? round : null, date, stage, type,
          position: rubber.position || null, ownTeam: fixture[side], oppTeam: fixture[other], opponent, partner,
          pair: doubles ? Lab.key(own) : null, home: rubber.home, away: rubber.away, side, status, won, sourceScore,
          score: sourceScore && (side === 'home' ? sourceScore : Scores.flip(sourceScore)),
          gamesFor, gamesAgainst, rated: known, emergency: Array.isArray(flags) ? !!flags[slot] : !!rubber[side + 'Emergency'],
          beforeRound: pre ?? null, preOwn: known ? prePower(view, own, pre) : null, preOpponent: known ? prePower(view, opponent, pre) : null});
        const key = JSON.stringify([section, fixtureId || round, fixture.home, fixture.away, side]);
        if (!ties.has(key)) ties.set(key, {fixtureId, round: Number.isFinite(round) ? round : null, date, stage, side,
          home: fixture.home, away: fixture.away, status: fixture.status, winner: fixture.winner ?? null,
          homeRubbers: fixture.homeRubbers ?? null, awayRubbers: fixture.awayRubbers ?? null,
          homeSets: fixture.homeSets ?? null, awaySets: fixture.awaySets ?? null,
          homeGames: fixture.homeGames ?? null, awayGames: fixture.awayGames ?? null,
          homePoints: fixture.homePoints ?? null, awayPoints: fixture.awayPoints ?? null});
      }
    }
    const pairs = [...new Set(matches.map(match => match.pair).filter(Boolean))];
    const skillMatches = ['singles','doublesPlayers'].flatMap(kind => Lab.matches(data, entry.player, kind)
      .filter(match => !entry.team || match.team === entry.team).map(match => ({...match, kind, entry})));
    return {entry, team, ties: [...ties.values()].sort(chronological), matches: matches.sort(chronological),
      qualifying: !!data.knockout?.qualifiers?.some(row => row.team === entry.team),
      champion: !!entry.team && data.knockout?.champion === entry.team, runnerUp: !!entry.team && data.knockout?.runnerUp === entry.team,
      ratings: powerHistory(rated, entry.player, pairs), model: rated ? modelLabel : null, skillMatches};
  }

  function totals(matches) {
    return matches.reduce((out, match) => {
      out.recorded++;
      out.rated += Number(match.rated);
      if (match.won === true) out.wins++;
      else if (match.won === false) out.losses++;
      else out.undecided++;
      if (match.gamesFor != null) { out.gamesFor += match.gamesFor; out.gamesAgainst += match.gamesAgainst; out.scored++; }
      return out;
    }, {recorded: 0, rated: 0, wins: 0, losses: 0, undecided: 0, scored: 0, gamesFor: 0, gamesAgainst: 0});
  }
  const groups = (matches, key) => {
    const result = new Map();
    for (const match of matches) {
      const id = key(match);
      if (!result.has(id)) result.set(id, []);
      result.get(id).push(match);
    }
    return result;
  };
  const matchStats = matches => [
    ['All', totals(matches)], ['Singles', totals(matches.filter(match => match.type !== 'Doubles'))],
    ['Doubles', totals(matches.filter(match => match.type === 'Doubles'))]
  ];
  function highlights(matches, scale) {
    const wins = matches.filter(match => match.won && match.rated);
    return [...groups(wins, match => (scale(match.entry)?.pool || match.entry.competitionCode + '/' + match.entry.sectionLabel) + '/' + match.type)]
      .map(([, rows]) => {
        const strength = match => scale(match.entry)?.baseline ?? 0;
        const ordered = [...rows].sort((a,b) => strength(b) - strength(a) ||
          (b.preOpponent ?? -Infinity) - (a.preOpponent ?? -Infinity) ||
          (b.gamesFor - b.gamesAgainst) - (a.gamesFor - a.gamesAgainst) || chronological(b,a));
        const upset = rows.filter(match => match.preOwn != null && match.preOpponent > match.preOwn)
          .sort((a,b) => (b.preOpponent - b.preOwn) - (a.preOpponent - a.preOwn) || chronological(b,a))[0];
        return {best: ordered[0], upset: upset || null};
      }).concat(wins.length ? [{
        dominant: [...wins].filter(match => match.gamesFor != null).sort((a,b) =>
          (b.gamesFor - b.gamesAgainst) - (a.gamesFor - a.gamesAgainst) || chronological(b,a))[0]
      }] : []).filter(highlight => highlight.best || highlight.dominant);
  }

  function compile(person, entries, scale, model, {generatedAt = new Date().toISOString()} = {}) {
    const matches = [...new Map(entries.flatMap(entry => entry.matches || []).map(match => [recordKey(match), match])).values()].sort(chronological);
    const skillMatches = [...new Map(entries.flatMap(entry => entry.skillMatches || []).map(match =>
      [JSON.stringify([match.entry.seasonKey, match.entry.sectionCode, match.fixtureId || match.round, match.kind, match.position,
        match.team, match.opp, match.partner]), match])).values()];
    const history = Object.fromEntries(['overall','singles','doubles'].map(view => [view, Career.skillHistory(skillMatches, scale, view)]));
    const seasons = [...groups(entries, entry => entry.entry.seasonLabel)].map(([label, sections]) => {
      const results = matches.filter(match => match.entry.seasonLabel === label);
      return {label, sections: sections.map(({skillMatches, ...entry}) => entry), records: matchStats(results),
        highlights: highlights(results, scale), first: results.find(match => Number.isFinite(dateValue(match)))?.date || null,
        last: results.findLast(match => Number.isFinite(dateValue(match)))?.date || null};
    });
    const rivals = [...groups(matches.filter(match => match.opponent), match =>
      JSON.stringify([match.type, match.opponent, match.oppTeam]))].map(([, rows]) =>
      ({name: rows[0].opponent, team: rows[0].oppTeam, type: rows[0].type, ...totals(rows)}))
      .sort((a,b) => b.recorded - a.recorded || a.name.localeCompare(b.name));
    const partners = [...groups(matches.filter(match => match.partner), match => match.partner)].map(([name, rows]) =>
      ({name, ...totals(rows)})).sort((a,b) => b.recorded - a.recorded || a.name.localeCompare(b.name));
    const dated = matches.filter(match => Number.isFinite(dateValue(match)));
    const awards = Career.seasonAwards(Career.seasonRecords(skillMatches.map(match => ({row: match.entry, matches:[match]}))))
      .map(award => ({label: award.label, value: award.value, field: award.field,
        seasons: award.records.map(season => ({season: season.row.seasonLabel, competition: season.row.competitionLabel}))}));
    return {version: 1, generatedAt, name: person.name, names: person.names, teams: person.teams, linked: person.linked,
      model, first: dated[0]?.date || null, last: dated.at(-1)?.date || null, records: matchStats(matches), seasons, history, awards,
      partners, rivals, missing: entries.filter(entry => entry.unavailable).length,
      missingPower: entries.filter(entry => !entry.unavailable && (entry.ratingFallback || !entry.model)).length};
  }

  const esc = value => String(value ?? '—').replace(/[&<>"']/g, char =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const pct = (n,d) => d ? (100*n/d).toFixed(1) + '%' : '—';
  const resultLabel = won => won == null ? '—' : won ? 'Win' : 'Loss';
  const points = (a,b) => a == null || b == null ? '—' : a + '–' + b;
  const table = (fields, rows) => rows.length ? '<div class="table"><table><thead><tr>' +
    fields.map(field => '<th scope="col">' + esc(field) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(row =>
      '<tr>' + row.map(value => '<td>' + esc(value) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>' :
    '<p>No records available.</p>';
  const summary = records => table(['Discipline','Recorded','Wins','Losses','Undecided','Win rate','Games','Game share','Rated'],
    records.map(([label,r]) => [label,r.recorded,r.wins,r.losses,r.undecided,pct(r.wins,r.wins+r.losses),
      r.scored ? points(r.gamesFor,r.gamesAgainst) : null,pct(r.gamesFor,r.gamesFor+r.gamesAgainst),r.rated]));
  const expandable = (label, html, open = false) => '<details' + (open ? ' open' : '') + '><summary>' + esc(label) + '</summary>' + html + '</details>';
  const describeMatch = match => [match.type, match.opponent, match.score, match.entry.competitionLabel, match.entry.sectionLabel,
    match.date || roundTitle(match), match.partner ? 'with ' + match.partner : '', match.preOpponent == null ? '' :
      'opponent Power ' + match.preOpponent + ' before the round'].filter(Boolean).join(' · ');

  function sectionHTML(section) {
    const {entry, team, ties, matches, ratings, qualifying, champion, runnerUp} = section;
    const name = [entry.competitionLabel,entry.sectionLabel,entry.team || 'Team unlisted'].join(' · ');
    if (section.unavailable) return expandable(name, '<p>Published section record could not be loaded.</p>', true);
    const standing = team ? '<p>' + esc(team.final ? 'Final ladder' : 'Current ladder') + ' #' + esc(team.position) +
      ' · ' + esc(team.points) + ' points · ' + esc([team.officialWins??team.wins,team.officialDraws??team.draws,team.officialLosses??team.losses].join('–')) +
      ' team W–D–L' + (champion ? ' · Champion' : runnerUp ? ' · Runner-up' : qualifying ? ' · Qualified for finals' : '') + '</p>' : '';
    const matchRows = matches.map(match => [match.date,roundTitle(match),match.type,match.position,match.opponent,match.partner,
      resultLabel(match.won),match.score,match.status,match.emergency ? 'Yes' : '—',match.rated ? 'Yes' : '—',match.preOwn,match.preOpponent]);
    const tieRows = ties.map(tie => [tie.date,roundTitle(tie),tie.home,tie.away,tie.status,points(tie.homeRubbers,tie.awayRubbers),
      points(tie.homeSets,tie.awaySets),points(tie.homeGames,tie.awayGames),points(tie.homePoints,tie.awayPoints),tie.winner]);
    const ratingRows = ratings.flatMap(series => {
      const points = [...series.rounds,...(series.current?[series.current]:[])];
      return points.map(row => [series.label,series.player,row.round ?? 'Final/latest',row.date,row.rating,row.rank,row.standardError,
        row.lower,row.upper,row.matches,row.status]);
    });
    return expandable(name, standing + '<h4>Match log</h4>' + table(['Date','Round','Discipline','Position','Opponent','Partner','Result','Score',
      'Status','Emergency','Rated','Pre-round Power','Opponent Power'],matchRows) + '<h4>Team fixtures played</h4>' +
      table(['Date','Round','Home','Away','Status','Rubbers','Sets','Games','Points','Winner'],tieRows) +
      '<h4>Power history</h4><p>' + esc(section.model || 'Rating model unavailable') + '</p>' +
      table(['Discipline','Player or pair','Round','Date','Power','Rank','SE','Lower','Upper','Modelled matches','Status'],ratingRows), true);
  }

  function html(report) {
    const seasons = report.seasons.map((season, i) => '<section id="season-' + i + '"><h2>' + esc(season.label) + '</h2>' +
      summary(season.records) + '<h3>Highlights</h3>' + (season.highlights.length ? '<ul>' + season.highlights.map(item =>
        (item.best ? '<li><b>Best ' + esc(item.best.type.toLowerCase()) + ' win in this ladder</b> · ' + esc(describeMatch(item.best)) + '</li>' : '') +
        (item.upset ? '<li><b>Biggest upset in this ladder</b> · ' + esc(describeMatch(item.upset)) + '</li>' : '') +
        (item.dominant ? '<li><b>Largest game margin</b> · ' + esc(describeMatch(item.dominant)) + '</li>' : '')).join('') +
        '</ul>' : '<p>No rated wins recorded.</p>') + season.sections.map(sectionHTML).join('') + '</section>').join('');
    const skill = ['overall','singles','doubles'].map(view => expandable(view[0].toUpperCase()+view.slice(1),
      table(['Season','Ladder','Sections','Last dated match','Matches','Skill','Evidence'],
        report.history[view].map(point => [point.row.seasonLabel,point.row.competitionLabel + ' · ' + point.family,
          point.sections.map(section => section.label).join(', '),dateText(point.date),point.count,point.rating,point.count < 5 ? 'Provisional' : ''])),
      view === 'overall')).join('');
    const recordTable = rows => table(['Player or pair','Team','Discipline','Matches','Wins','Losses','Undecided','Games'],
      rows.map(row => [row.name,row.team,row.type,row.recorded,row.wins,row.losses,row.undecided,row.scored ? points(row.gamesFor,row.gamesAgainst) : null]));
    const coverage = report.missing + ' of ' + report.seasons.reduce((n,season) => n+season.sections.length,0) + ' section records unavailable. ' +
      (report.missingPower ? report.missingPower + ' loaded section records use published fallback ratings. ' : '');
    const json = JSON.stringify(report).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' +
      esc(report.name) + ' · BRTA career report</title><style>' +
      'body{font:16px/1.5 system-ui,sans-serif;color:#182929;background:#f6f8f6;margin:0}main{max-width:1120px;margin:auto;padding:clamp(14px,4vw,48px)}' +
      'header,section{background:#fff;border:1px solid #dce4df;padding:clamp(13px,3vw,28px);border-radius:8px;margin-bottom:16px}' +
      'h1,h2,h3,h4{line-height:1.18;margin:1em 0 .45em}h1{font-size:clamp(30px,7vw,50px);margin-top:.2em}p{margin:.45em 0 1em}a{color:#155e46}' +
      'nav{margin-bottom:16px}.table{overflow:auto;margin-bottom:12px}table{border-collapse:collapse;width:100%;font-size:.87rem}' +
      'th,td{text-align:left;padding:7px 9px;border-bottom:1px solid #dce4df;white-space:nowrap}th{background:#edf4ef}' +
      'summary{cursor:pointer;font-weight:700;padding:7px 0}details{border-top:1px solid #dce4df;padding-top:4px;margin-top:6px}' +
      'small,.muted{color:#465854}.brand{font-weight:750;color:#155e46}@media print{body{background:white}main{padding:0}.table{overflow:visible}' +
      'table{font-size:7pt}th,td{padding:3px;white-space:normal}header,section{border:0;padding:0}tr{break-inside:avoid}}</style></head><body><main>' +
      '<header><span class="brand">BRTA Power Ratings</span><h1>' + esc(report.name) + '</h1><p>Career report · ' + esc(report.generatedAt.slice(0,10)) +
      '</p><p>First dated match ' + esc(report.first) + ' · Last dated match ' + esc(report.last) + '</p><p>Teams · ' + esc(report.teams.join(', ') || 'Unlisted') +
      (report.names.length > 1 ? '<br>Recorded names · ' + esc(report.names.join(', ')) : '') + '</p>' + summary(report.records) +
      '<p class="muted">' + esc(coverage) + 'Coverage is limited to BRTA records linked to this player by the published archive. ' +
      'Totals include recorded match outcomes, including non-rated results. Game totals include recorded ordinary-set games. Section Power model · ' +
      esc(report.model) + '.</p></header><nav aria-label="Report sections"><a href="#skill">Skill history</a> · <a href="#opponents">Opponents and partners</a> · ' +
      report.seasons.map((season,i) => '<a href="#season-' + i + '">' + esc(season.label) + '</a>').join(' · ') + '</nav>' +
      '<section id="skill"><h2>Skill history</h2><p>' + esc(Career.skillMethod) + ' Compare points within each ladder.</p>' + skill +
      '<h3>Best seasons</h3>' + table(['Award','Value','Competition seasons'],report.awards.map(award => [award.label,
        ['winRate','gameShare'].includes(award.field) ? award.value.toFixed(1)+'%' : award.value,
        award.seasons.map(season => season.season + ' · ' + season.competition).join(', ')])) + '</section>' + seasons +
      '<section id="opponents"><h2>Opponents and partners</h2><p>Opponent records group published names by team and discipline.</p><h3>Opponents</h3>' +
      recordTable(report.rivals) + '<h3>Doubles partners</h3>' + recordTable(report.partners) + '</section>' +
      '<section><h2>How to read this report</h2><p>Scores are shown from the player’s side. The embedded data also preserves the published home–away score. ' +
      'Season best wins prioritise the strongest division in each ladder, then available pre-round opponent Power, then game margin. ' +
      'Upsets rank wins by the pre-round Power gap where both Power estimates are available. A dash marks missing or inapplicable data.</p>' +
      '<p>Source · <a href="https://affluendo1.github.io/brta-power-ratings/">BRTA Power Ratings</a></p></section></main>' +
      '<script type="application/json" id="brta-career-data">' + json + '</script></body></html>';
  }

  const api = {extract, compile, html};
  root.BRTACareerReport = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
