(function(root){'use strict';
function draw(){
  const head = $('#teamLabTitle');
  const content = $('#teamLabContent');
  if (!head || !content || !D) return;
  const team = head.dataset.teamName || head.textContent;
  const fixtures = (D.results || []).flatMap(round => round.fixtures.map(fixture => ({
    ...fixture, round: fixture.round ?? round.round, date: fixture.date || round.date,
    label: fixture.label || round.label, stage: fixture.stage || round.stage
  }))).filter(fixture => fixture.home === team || fixture.away === team).sort((a, b) => b.round - a.round);
  let panel = content.querySelector('.team822-explorer');
  if (!panel) {
    const main = document.createElement('div');
    main.className = 'team822-main';
    while (content.firstChild) main.append(content.firstChild);
    panel = document.createElement('aside');
    panel.className = 'team822-explorer expanded';
    content.append(panel, main);
  }
  const matches = fixtures.map(fixture => {
    const home = fixture.home === team;
    const opponent = home ? fixture.away : fixture.home;
    const winner = matchWinner(fixture);
    const complete = fixture.status === 'Completed';
    const result = complete ? (winner === team ? 'W' : winner ? 'L' : 'D') : '—';
    const score = complete ? [fixture.homeRubbers, fixture.awayRubbers] : null;
    if (score && !home) score.reverse();
    const label = score?.join('–') || ({ 'Forfeited To': 'W/O', 'Forfeited By': 'W/O', 'Wash Out': 'WASH' }[fixture.status] || fixture.status);
    const tone = result === 'W' ? 'win' : result === 'L' ? 'loss' : '';
    return '<button class="match-row" title="' + esc(fixture.status) + '" data-match-id="' + esc(fixture.fixtureId) +
      '"><span class="match-round">' + esc(roundHeading(fixture, true)) + '</span><b class="match-score ' + tone + '">' + result + ' ' +
      esc(label) + '</b><span class="match-opponent"><b>' + esc(opponent) + '</b><small>' +
      esc(roundDate(fixture.date)) + ' · ' + (home ? 'Home' : 'Away') + '</small></span></button>';
  }).join('');
  panel.innerHTML = '<header><div><h3>Team Explorer</h3><p>' + fixtures.length + ' fixtures · ' + esc(team) +
    '</p></div></header><div class="team822-matches">' + (matches || '<p class="small-note">No results published yet.</p>') + '</div>';
  content.classList.add('team823-expanded');
}
const base=BRTATeamLabUI.open;BRTATeamLabUI.open=function(...args){const out=base(...args);draw();return out};
// Team UI's internal renderer retains its own closure, so also observe title changes.
new MutationObserver(()=>{if($('#teamLabTitle')&&!$('#teamLabContent .team822-explorer'))draw()}).observe($('#teamLabContent'),{childList:true});
document.addEventListener('click',e=>{const pair=e.target.closest('[data-projection-pair]');if(pair){const name=pair.dataset.projectionPair,entry=L8.rows(D,'pairs',null).find(p=>L8.key(p.player)===L8.key(name));if(entry)lab8Open(entry.player,null,true);else BRTA82.modal('Doubles pair','<p>This pair has never been played before.</p>');return}});
document.addEventListener('change',e=>{if(!e.target.matches('[data-predict-pair-check]'))return;const input=e.target,side=selectedPrediction?.[input.dataset.side];if(!side)return;const index=+input.dataset.pair,pair=side.doubles[index]||[],name=input.value;side.manualPairs=true;if(input.checked){if(pair.length>=2){input.checked=false;return}side.doubles[index]=[...pair,name]}else side.doubles[index]=pair.filter(p=>p!==name);selectedPrediction.simulation=null;refreshPrediction()});
})(window);

