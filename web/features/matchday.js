/* 8.2: shared dialogs and week-by-week matchday view. */
(function(){'use strict';const M=BRTAMatchday;let dialog=null,focus=null,selectedRound=null;const dialogStack=[];let dialogId=0;
function dismiss(){if(!dialog)return;const rounds=dialog.querySelector('#rounds821Content');if(rounds)stash.append(rounds);dialog.remove();const previous=dialogStack.pop();dialog=previous?.dialog||null;const restoreFocus=focus;focus=previous?.focus||null;if(!document.querySelector('.overlay:not(.hidden)'))document.body.classList.remove('modal-open');restoreFocus?.focus?.({preventScroll:true})}
function modal(title,html,wide=false){if(dialog&&!dialog.classList.contains('rounds821-overlay'))dismiss();if(dialog){dialogStack.push({dialog,focus});dialog=null}focus=document.activeElement;const titleId='release82Title-'+(++dialogId);dialog=document.createElement('div');dialog.className='overlay release82-overlay';dialog.style.zIndex=Math.max(170,...[...document.querySelectorAll('.overlay:not(.hidden)')].map(e=>Number(getComputedStyle(e).zIndex)||0))+5;dialog.innerHTML='<div class="overlay-backdrop" data-82-close></div><section class="settings-sheet '+(wide?'release82-wide':'')+'" role="dialog" aria-modal="true" aria-labelledby="'+titleId+'"><button class="close-btn" data-82-close aria-label="Close">×</button><div class="overlay-title"><h2 id="'+titleId+'">'+esc(title)+'</h2></div>'+html+'</section>';document.body.append(dialog);document.body.classList.add('modal-open');dialog.querySelector('button').focus();return dialog}
document.addEventListener('click',e=>{if(e.target.closest('[data-82-close]')){e.stopImmediatePropagation();dismiss()}},true);
document.addEventListener('keydown',e=>{if(!dialog)return;const higher=[...document.querySelectorAll('.overlay:not(.hidden)')].filter(o=>o!==dialog&&Number(getComputedStyle(o).zIndex)>Number(dialog.style.zIndex));if(higher.length){if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();close('#'+higher.sort((a,b)=>Number(getComputedStyle(b).zIndex)-Number(getComputedStyle(a).zIndex))[0].id)}return}if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();dismiss()}if(e.key==='Tab'){const items=[...dialog.querySelectorAll('button,input,select,a[href],summary,[tabindex="0"]')].filter(x=>!x.disabled&&x.getClientRects().length);if(!items.length)return;if(e.shiftKey&&(document.activeElement===items[0]||!dialog.contains(document.activeElement))){e.preventDefault();items.at(-1).focus()}else if(!e.shiftKey&&(document.activeElement===items.at(-1)||!dialog.contains(document.activeElement))){e.preventDefault();items[0].focus()}}},true);
window.BRTA82={modal,dismiss};
const page = document.createElement('div');
page.id = 'rounds821Content';
const stash = document.createElement('div');
stash.hidden = true;
stash.append(page);
document.body.append(stash);

function fixtureRow(fixture, forecast) {
  const { home, away, status, fixtureId } = fixture;
  const score = (a, b) => a != null && b != null ? esc(a + '–' + b) : '—';
  if (fixtureIsBye(fixture)) return byeCard(fixture);
  const complete = status === 'Completed';
  const action = complete || findMatch(fixtureId) ? 'data-82-result' :
    status === 'Scheduled' && fixtureById(fixtureId) ? 'data-82-predict' : '';
  const tag = action ? 'button' : 'div';
  const card = '<' + tag + ' class="round-fixture latest-fixture"' + (action ? ' type="button" ' + action + '="' + esc(fixtureId) + '"' : '') +
    '><div class="latest-fixture-title"><b>' + teamName(home) + ' <span>vs</span> ' + teamName(away) +
    '</b><span class="latest-status' + (complete ? ' complete' : '') + '">' + esc(status === 'Missing Result' ? 'Awaiting result' : status) + '</span></div>' +
    (complete ? '<div class="latest-score"><span>Points <b>' + score(fixture.homePoints, fixture.awayPoints) +
      '</b></span><span>Rubbers <b>' + score(fixture.homeRubbers ?? fixture.homeSets, fixture.awayRubbers ?? fixture.awaySets) +
      '</b></span><span>Games <b>' + score(fixture.homeGames, fixture.awayGames) + '</b></span></div>' : '') +
    (forecast ? '<span class="latest-chance">' + chance(forecast.resultChance) + ' pre-round chance of this outcome</span>' : '') +
    (action ? '<span class="latest-action">' + (action === 'data-82-result' ? 'View scorecard' : 'Fixture Outlook') + ' ›</span>' : '') + '</' + tag + '>';
  return card;
}

const chance = value => (100 * value).toFixed(1) + '%';
function highlight(title, row, tone, detail, empty = 'No completed match') {
  if (!row) return '<div class="round-highlight"><span>' + title + '</span><b>' + empty + '</b></div>';
  return '<div class="round-highlight ' + tone + '"><span>' + title + '</span><b>' +
    esc(row.winner + ' ' + row.score + ' ' + row.loser) + '</b>' +
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
  const players = [], teams = [], forecasts = new Map();
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
      const item = { winner: homeWon ? rubber.home : rubber.away, loser: homeWon ? rubber.away : rubber.home,
        score: homeWon ? rubber.score : BRTAScores.flip(rubber.score), margin: Math.abs(diff) };
      players.push(item);
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
    forecasts.set(fixture.fixtureId, { resultChance });
    const expectedMargin = rubbers.reduce((sum, row) => sum + row.scoreDistribution.reduce((n, score) => n + score.margin * score.probability, 0), 0);
    team.above = (fixture.homeGames - fixture.awayGames - expectedMargin) * (homeWon ? 1 : -1);
    if (!draw) team.chance = resultChance;
    else delete team.above;
  }
  const best = (rows, getter) => rows.filter(row => Number.isFinite(getter(row)))
    .sort((a,b) => getter(b) - getter(a))[0];
  previousAnalysis = { data: D, round: round.round, forecasts, top: best(players, row => row.performance),
    upset: best(players, row => row.chance < .5 ? -row.chance : NaN),
    dominant: best(players, row => row.margin), closest: best(players, row => -row.margin),
    teamPerformance: best(teams, row => row.above > 0 ? row.above : NaN),
    teamUpset: best(teams, row => row.chance < .5 ? -row.chance : NaN), teamDominant: best(teams, row => row.margin) };
  return previousAnalysis;
}

function render() {
  $('#roundBtn').textContent = 'Latest Round';
  if (!D || !page.closest('.rounds821-overlay')) return;
  const round = M.overview(D);
  const context = '<p id="roundsContext" class="small-note">' +
    esc([D.meta.competition_label, D.meta.season_label, D.meta.section_label].filter(Boolean).join(' · ')) + '</p>';
  if (!round) {
    page.innerHTML = context + '<p>No results have been published yet.</p>';
    return;
  }
  const remaining = (D.upcomingFixtures || []).filter(group => String(group.round) === String(round.round))
    .flatMap(group => group.fixtures || []).filter(fixture => !round.fixtures.some(result =>
      result.fixtureId === fixture.fixtureId || (result.home === fixture.home && result.away === fixture.away)));
  const fixtures = [...round.fixtures, ...remaining];
  const pending = fixtures.filter(f => ['Scheduled', 'Missing Result'].includes(f.status)).length;
  const analysis = roundAnalysis(round);
  const playerHighlights = [
    highlight('Top performance', analysis.top, 'top', row => 'Performance ≈ ' + row.performance, 'No pre-round rating evidence'),
    highlight('Biggest upset', analysis.upset, 'upset', row => chance(row.chance) + ' pre-round win chance', 'No upset identified'),
    highlight('Most dominant', analysis.dominant, '', row => row.margin + ' game margin'),
    highlight('Closest player match', analysis.closest, '')
  ];
  const teamHighlights = [
    highlight('Top team performance', analysis.teamPerformance, 'top', row => '+' + row.above.toFixed(1) + ' games vs expected', 'No team outperformance identified'),
    highlight('Biggest team upset', analysis.teamUpset, 'upset', row => chance(row.chance) + ' pre-round win chance', 'No upset identified'),
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

function showRounds() {
  const overlay = modal('Latest Round', '', true);
  overlay.classList.add('rounds821-overlay');
  overlay.querySelector('.settings-sheet').append(page);
  render();
}
$('#roundBtn').onclick = showRounds;
openRound = showRounds;
document.addEventListener('click', event => {
  const result = event.target.closest('#rounds821Content [data-82-result]');
  const prediction = event.target.closest('#rounds821Content [data-82-predict]');
  if (result) openMatch(result.dataset['82Result']);
  if (prediction) openPrediction(prediction.dataset['82Predict']);
});
window.addEventListener('brta-section-ready', render);
render();
})();

