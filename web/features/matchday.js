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

function fixtureRow(fixture) {
  const { home, away, status, fixtureId } = fixture;
  const score = (a, b) => a != null && b != null ? esc(a + '–' + b) : '—';
  if (status === 'Bye') return '<div class="round-fixture latest-fixture"><b>' + teamName(home === 'Bye' ? away : home) + '</b><span>Bye</span></div>';
  const complete = status === 'Completed';
  const action = complete || findMatch(fixtureId) ? 'data-82-result' :
    status === 'Scheduled' && fixtureById(fixtureId) ? 'data-82-predict' : '';
  const tag = action ? 'button' : 'div';
  return '<' + tag + ' class="round-fixture latest-fixture"' + (action ? ' type="button" ' + action + '="' + esc(fixtureId) + '"' : '') +
    '><div class="latest-fixture-title"><b>' + teamName(home) + ' <span>vs</span> ' + teamName(away) +
    '</b><span class="latest-status' + (complete ? ' complete' : '') + '">' + esc(status === 'Missing Result' ? 'Awaiting result' : status) + '</span></div>' +
    (complete ? '<div class="latest-score"><span>Points <b>' + score(fixture.homePoints, fixture.awayPoints) +
      '</b></span><span>Rubbers <b>' + score(fixture.homeRubbers ?? fixture.homeSets, fixture.awayRubbers ?? fixture.awaySets) +
      '</b></span><span>Games <b>' + score(fixture.homeGames, fixture.awayGames) + '</b></span></div>' : '') +
    (action ? '<span class="latest-action">' + (action === 'data-82-result' ? 'View scorecard' : 'Fixture Outlook') + ' ›</span>' : '') + '</' + tag + '>';
}

function render() {
  $('#roundBtn').textContent = 'Latest Round';
  if (!D) return;
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
  const highlights = Number(D.roundOverview?.round) === Number(round.round) ? D.roundOverview : null;
  const featured = [highlights?.topPerformance && roundHighlight('Top performance', highlights.topPerformance, 'top'),
    highlights?.biggestUpset && roundHighlight('Biggest upset', highlights.biggestUpset, 'upset'),
    round.closest && '<div class="round-highlight"><span>Closest by games</span><b>' + teamName(round.closest.home) +
      ' vs ' + teamName(round.closest.away) + '</b><small>' + Math.abs(round.closest.homeGames - round.closest.awayGames) +
      ' game margin</small></div>'].filter(Boolean);
  page.innerHTML = context + '<section class="latest-round-summary"><div><span class="kicker">Round overview</span><h3>' +
    esc(roundHeading(round)) + '</h3><p class="small-note">' + esc(roundDate(round.date)) + '</p></div>' +
    '<div class="latest-round-kpis">' + [['Completed', round.completed], ['Awaiting results', pending],
      ['Matches played', round.singles + round.doubles], ['Games played', round.games]].map(([label, value]) =>
      '<div><strong>' + value + '</strong><span>' + label + '</span></div>').join('') + '</div></section>' +
    (featured.length ? '<div class="round-highlights latest-highlights">' + featured.join('') + '</div>' : '') +
    '<h3>Fixtures</h3><div class="round-fixtures latest-fixtures">' + fixtures.map(fixtureRow).join('') + '</div>';
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

