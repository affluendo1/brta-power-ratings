(function () {
'use strict';
const page = document.createElement('div');
page.id = 'latestRoundContent';
const lastViewedScorecards = new Map();

function scorecardFocusKey(scope, visited = new Set()) {
  if (visited.has(scope)) return null;
  visited.add(scope);
  const parent = scope === 'section' ? 'latest-round' : 'section';
  const prefix = scorecardFocusKey(parent, visited);
  const name = scope === 'section' ? D?.meta?.section_code : 'latest-round';
  return prefix && name ? prefix + '/' + name : null;
}

function rememberScorecard(fixtureId) {
  const key = scorecardFocusKey('section');
  if (key && fixtureId) lastViewedScorecards.set(key, fixtureId);
}

function restoreScorecardFocus() {
  const key = scorecardFocusKey('section');
  if (!key) return;
  const fixtureId = lastViewedScorecards.get(key);
  const card = [...page.querySelectorAll('[data-latest-result]')].find(item => item.dataset.latestResult === fixtureId);
  card?.focus({preventScroll:true});
}

function fixtureRow(fixture, forecast) {
  const { home, away, status, fixtureId } = fixture;
  const score = (a, b) => a != null && b != null ? esc(a + '–' + b) : '—';
  if (fixtureIsBye(fixture)) return byeCard(fixture);
  const complete = status === 'Completed';
  const action = complete || findMatch(fixtureId) ? 'data-latest-result' :
    status === 'Scheduled' && fixtureById(fixtureId) ? 'data-latest-fixture' : '';
  const tag = action ? 'button' : 'div';
  const card = '<' + tag + ' class="round-fixture latest-fixture"' + (action ? ' type="button" ' + action + '="' + esc(fixtureId) + '"' : '') +
    '><div class="latest-fixture-title"><b>' + teamName(home) + ' <span>vs</span> ' + teamName(away) +
    '</b><span class="latest-status' + (complete ? ' complete' : '') + '">' + esc(status === 'Missing Result' ? 'Awaiting result' : status) + '</span></div>' +
    (complete ? '<div class="latest-score"><span>Points <b>' + score(fixture.homePoints, fixture.awayPoints) +
      '</b></span><span>Rubbers <b>' + score(fixture.homeRubbers ?? fixture.homeSets, fixture.awayRubbers ?? fixture.awaySets) +
      '</b></span><span>Games <b>' + score(fixture.homeGames, fixture.awayGames) + '</b></span></div>' : '') +
    (forecast ? '<span class="latest-chance">' + esc(forecast.label) + ' with these lineups · ' + chance(forecast.resultChance) + '</span>' : '') +
    (action ? '<span class="latest-action">' + (action === 'data-latest-result' ? 'View scorecard' : 'Fixture Outlook') + ' ›</span>' : '') + '</' + tag + '>';
  return card;
}

const chance = value => (100 * value).toFixed(1) + '%';
function latestPlayerNames(names) {
  return String(names).split(/\s*\/\s*/).map(personButton).join(' / ');
}
function highlight(title, row, tone, detail, empty = 'No completed match') {
  if (!row) return '<div class="round-highlight"><span>' + title + '</span><b>' + empty + '</b></div>';
  return '<div class="round-highlight ' + tone + '"><span>' + title + '</span><b>' +
    (row.playerNames ? latestPlayerNames(row.winner) + ' <span class="latest-player-score">' + esc(row.score) + '</span> ' + latestPlayerNames(row.loser) :
      esc(row.winner + ' ' + row.score + ' ' + row.loser)) + '</b>' +
    (detail ? '<small>' + esc(detail(row)) + '</small>' : '') + '</div>';
}

let previousAnalysis;
function roundAnalysis(round) {
  if (previousAnalysis?.data === D && previousAnalysis.round === round.round) return previousAnalysis;
  const prior = (D.ratingHistory?.rounds || []).map(row => Number(row.round))
    .filter(number => number < Number(round.round)).sort((a,b) => b-a)[0];
  const ratings = new Map((D.ratingHistory?.tables?.[prior] || []).map(row => [row.player, row.rating]));
  const doubles = new Map((D.doublesRatingHistory?.tables?.[prior]?.doublesPlayers || []).map(row => [row.player, row.rating]));
  const power = (names, isDoubles) => {
    const values = names.split(/\s+\/\s+/).map(name => (isDoubles ? doubles.get(name) : undefined) ?? ratings.get(name));
    return values.every(Number.isFinite) ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const scale = D.meta.ratingProbabilityScale || 450;
  const rules = D.meta.customRules || D.meta.competition_rules;
  const options = { format: D.format, greenBall: !!D.greenBall, custom: !!D.meta.is_custom, setWinsDecideTies: !!D.meta.competition_rules };
  const players = [], teams = [], forecasts = new Map(), rareUpsets = [];
  const priorBands = new Map();
  function priorBand(view, name) {
    if (prior == null) return '';
    const lab = window.BRTALabModel;
    if (!priorBands.has(view)) {
      const rows = lab.rows(D, view, prior);
      const bands = lab.performanceBands(D, view, rows, prior);
      priorBands.set(view, new Map(rows.map(row => [view === 'pairs' ? lab.key(row.player) : row.player, bands.classForEntry(row)])));
    }
    return priorBands.get(view).get(view === 'pairs' ? lab.key(name) : name);
  }
  for (const fixture of round.fixtures.filter(row => row.status === 'Completed')) {
    const rubbers = [];
    for (const rubber of fixture.rubbers || []) {
      if (!rubber.winner || rubber.valid_for_rating === false || (rubber.status && rubber.status !== 'Completed') ||
        /ret|forfeit|walkover|unfinished/i.test(rubber.score || '')) continue;
      const sets = BRTAScores.parse(rubber.score, { outcomeCode: BRTAScores.outcomeCode(D, rubber.type) }).filter(set => !set.mt);
      if (!sets.length) continue;
      const homeWon = rubber.winner === rubber.home;
      const diff = sets.reduce((sum, set) => sum + set.h - set.a, 0);
      const games = sets.reduce((sum, set) => sum + set.h + set.a, 0);
      const item = { playerNames: true, homeWon, winner: homeWon ? rubber.home : rubber.away, loser: homeWon ? rubber.away : rubber.home,
        score: homeWon ? rubber.score : BRTAScores.flip(rubber.score), margin: Math.abs(diff), bagelSets: sets.flatMap((set,index) => set.h === 6 && set.a === 0 ? [{index,home:true}] : set.a === 6 && set.h === 0 ? [{index,home:false}] : []) };
      players.push(item);
      const view = rubber.type === 'Doubles' ? 'pairs' : 'singles';
      const hasBand = (name, band) => priorBand(view, name) === band ||
        (view === 'pairs' && window.BRTALabModel.members(name).some(player => priorBand('doublesPlayers', player) === band));
      if (hasBand(item.loser, 'b18')) rareUpsets.push({title:'Zenith upset', item});
      if (hasBand(item.winner, 'b19')) rareUpsets.push({title:'Basement breakthrough', item});
      const isDoubles = rubber.type === 'Doubles';
      const home = power(rubber.home, isDoubles), away = power(rubber.away, isDoubles);
      if (home == null || away == null) continue;
      const p = BRTAPrediction.gameProbability(home, away, scale);
      const bestOf = rules ? rules[isDoubles ? 'doublesBestOf' : 'singlesBestOf'] : D.format === 'rubbers' && !isDoubles ? 3 : 1;
      const targetGames = rules ? rules[isDoubles ? 'doublesTarget' : 'setTarget'] : D.format === 'rubbers' && isDoubles ? 8 : 6;
      const matchTiebreak = rules?.matchTiebreak !== false;
      const distribution = bestOf === 1 ? BRTAPrediction.shortSetDistribution(p, { greenBall: options.greenBall, targetGames }) :
        BRTAPrediction.matchDistribution(p, { bestOf, targetGames, matchTiebreak });
      const win = distribution.reduce((sum, row) => sum + (row.homeWin ? row.probability : 0), 0);
      item.chance = homeWon ? win : 1 - win;
      item.gameChance = p;
      item.performance = Math.round((homeWon ? away : home) + scale * Math.log((games + (homeWon ? diff : -diff) + 1) /
        (games - (homeWon ? diff : -diff) + 1)));
      rubbers.push({ p: win, scoreDistribution: distribution });
    }
    if (fixture.homeGames == null || fixture.awayGames == null || fixture.homePoints == null || fixture.awayPoints == null) continue;
    const homeWon = fixture.homePoints > fixture.awayPoints, draw = fixture.homePoints === fixture.awayPoints;
    const team = { winner: homeWon || draw ? fixture.home : fixture.away, loser: homeWon || draw ? fixture.away : fixture.home,
      score: (homeWon || draw ? [fixture.homePoints, fixture.awayPoints] : [fixture.awayPoints, fixture.homePoints]).join('–'),
      margin: Math.abs(fixture.homeGames - fixture.awayGames) };
    teams.push(team);
    if (!rubbers.length || rubbers.length !== fixture.rubbers.length) continue;
    const outcome = BRTAPrediction.teamOutcome(rubbers, { gamesDecideTies: true,
      setWinsDecideTies: options.setWinsDecideTies || options.format === 'rubbers' });
    const resultChance = draw ? outcome.draw : homeWon ? outcome.homeWin : outcome.awayWin;
    const label = draw ? 'Pre-round draw chance' : (homeWon ? fixture.home : fixture.away) + ' pre-round win chance';
    forecasts.set(fixture.fixtureId, { resultChance, label });
    const expectedMargin = rubbers.reduce((sum, row) => sum + row.scoreDistribution.reduce((n, score) => n + score.margin * score.probability, 0), 0);
    team.above = (fixture.homeGames - fixture.awayGames - expectedMargin) * (homeWon ? 1 : -1);
    if (!draw) team.chance = resultChance;
    else delete team.above;
  }
  const best = (rows, getter) => rows.filter(row => Number.isFinite(getter(row)))
    .sort((a,b) => getter(b) - getter(a))[0];
  previousAnalysis = { data: D, round: round.round, forecasts, rareUpsets, top: best(players, row => row.performance),
    upset: best(players, row => row.chance < .5 ? -row.chance : NaN),
    bagels: players.flatMap(row => row.bagelSets.map(set => ({
      ...row, score: '6–0', set: set.index+1,
      winner: set.home === row.homeWon ? row.winner : row.loser,
      loser: set.home === row.homeWon ? row.loser : row.winner,
      bagelChance: row.gameChance == null ? null : (set.home ? row.gameChance : 1-row.gameChance)**6
    }))).sort((a,b) => (a.bagelChance ?? Infinity) - (b.bagelChance ?? Infinity)),
    dominant: best(players, row => row.margin), closest: best(players, row => -row.margin),
    teamPerformance: best(teams, row => row.above > 0 ? row.above : NaN),
    teamUpset: best(teams, row => row.chance < .5 ? -row.chance : NaN), teamDominant: best(teams, row => row.margin) };
  return previousAnalysis;
}

function render() {
  if (!D || !page.closest('.latest-round-overlay')) return;
  const round = BRTAFixtureRecords.overview(D);
  const context = '<p id="latestRoundContext" class="small-note">' +
    esc([D.meta.competition_label, D.meta.season_label, D.meta.section_label].filter(Boolean).join(' · ')) + '</p>';
  if (!round) {
    page.innerHTML = context + '<p>No results have been published yet.</p>';
    return;
  }
  const currentRound = String(round.round);
  const scheduledFixtures = (D.upcomingFixtures || [])
    .filter(group => String(group.round) === currentRound)
    .flatMap(group => group.fixtures || []);
  function hasScorecard(fixture) {
    return round.fixtures.some(result => {
      if (result.fixtureId === fixture.fixtureId) return true;
      const sameOrder = result.home === fixture.home && result.away === fixture.away;
      const reversedOrder = result.home === fixture.away && result.away === fixture.home;
      return sameOrder || reversedOrder;
    });
  }
  const fixtures = [...round.fixtures, ...scheduledFixtures.filter(fixture => !hasScorecard(fixture))];
  const pending = fixtures.filter(f => ['Scheduled', 'Missing Result'].includes(f.status)).length;
  const analysis = roundAnalysis(round);
  const modelName = modelDisplayName(D.meta.modelChoice || D.meta.predictionModel || selectedRatingModel());
  const playerHighlights = [
    ...analysis.rareUpsets.map(({title,item})=>highlight(title,item,'rare-upset')),
    highlight('Top performance', analysis.top, 'top', row => 'Performance ≈ ' + row.performance, 'No pre-round rating evidence'),
    highlight('Biggest upset', analysis.upset, 'upset', row => chance(row.chance) + ' pre-round win chance · ' + modelName, 'No upset identified'),
    analysis.bagels.length ? '<details class="round-highlight latest-bagels"><summary>Most dominant · '+analysis.bagels.length+' 6–0 scoreline'+(analysis.bagels.length===1?'':'s')+'</summary>'+
      analysis.bagels.map(row => highlight('Set '+row.set, row, '', item => item.bagelChance == null ?
        'No pre-round rating evidence' : chance(item.bagelChance)+' chance of a 6–0 set')).join('')+'</details>' :
      highlight('Most dominant', analysis.dominant, '', row => row.margin + ' game margin'),
    highlight('Closest player match', analysis.closest, '')
  ];
  const teamHighlights = [
    highlight('Top team performance', analysis.teamPerformance, 'top', row => '+' + row.above.toFixed(1) + ' games vs expected', 'No team outperformance identified'),
    highlight('Biggest team upset', analysis.teamUpset, 'upset', row => chance(row.chance) + ' pre-round win chance · ' + modelName, 'No upset identified'),
    highlight('Most dominant team', analysis.teamDominant, '', row => row.margin + ' game margin'),
    round.closest && '<div class="round-highlight"><span>Closest team match</span><b>' + teamName(round.closest.home) +
      ' vs ' + teamName(round.closest.away) + '</b><small>' + Math.abs(round.closest.homeGames - round.closest.awayGames) +
      ' game margin</small></div>'
  ].filter(Boolean);
  const highlights = (title, cards) => '<section class="latest-highlight-group"><h4>' + title + '</h4><div class="round-highlights latest-highlights">' + cards.join('') + '</div></section>';
  page.innerHTML = context + '<section class="latest-round-summary"><div><span class="kicker">Round overview</span><h3>' +
    esc(roundHeading(round)) + '</h3><p class="small-note">' + esc(roundDate(round.date)) + '</p></div>' +
    '<div class="latest-round-kpis">' + [['Completed', round.completed], ['Awaiting results', pending],
      ['Matches played', round.singles + round.doubles], ['Games played', round.games]].map(([label, value]) =>
      '<div><strong>' + value + '</strong><span>' + label + '</span></div>').join('') + '</div></section>' +
    '<h3 class="latest-section-heading">Round highlights</h3>' + highlights('Team highlights', teamHighlights) + highlights('Player highlights', playerHighlights) +
    '<h3 class="latest-section-heading">Fixtures</h3><div class="round-fixtures latest-fixtures">' + fixtures.map(fixture => fixtureRow(fixture, analysis.forecasts.get(fixture.fixtureId))).join('') + '</div>';
}

function showLatestRound() {
  const existing = page.closest('.latest-round-overlay');
  if (existing) {
    existing.querySelector('.close-btn').focus();
    return;
  }
  const overlay = BRTAOverlays.openSheet('Latest Round', '', {
    className: 'latest-round-overlay',
    keepOpen: true,
    onDismiss: () => page.remove()
  });
  overlay.querySelector('.settings-sheet').append(page);
  render();
  restoreScorecardFocus();
}
$('#latestRoundBtn').onclick = showLatestRound;
window.BRTALatestRound = {open: showLatestRound};
document.addEventListener('click', event => {
  const result = event.target.closest('#latestRoundContent [data-latest-result]');
  const prediction = event.target.closest('#latestRoundContent [data-latest-fixture]');
  if (result) {
    rememberScorecard(result.dataset.latestResult);
    openMatch(result.dataset.latestResult);
  }
  if (prediction) openPrediction(prediction.dataset.latestFixture);
});
window.addEventListener('brta-section-ready', render);
render();
})();

