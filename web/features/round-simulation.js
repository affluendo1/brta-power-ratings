/* A simulated round uses the real scorecard and standings renderers. */
(function(){'use strict';let state=null;
 let setup;
 const fixturesFor = round => (D.upcomingFixtures || []).find(row => String(row.round) === String(round));
 const isBye = fixture => window.BRTAFinalsMath?.bye?.(fixture) ?? (fixture.status === 'Bye' || /^(?:bye|byes)$/i.test(fixture.home) || /^(?:bye|byes)$/i.test(fixture.away));
 const scheduled = entry => entry.fixtures.filter(fixture => !isBye(fixture) && fixture.status === 'Scheduled' && !findFixtureResult(fixture, entry.round));
 const byeTeams = entry => entry.fixtures.filter(isBye).map(fixture => fixture.home === 'Bye' ? fixture.away : fixture.home).filter(Boolean);
 const options = () => ({ format: D.format, greenBall: !!D.greenBall, custom: !!D.meta.is_custom,
   setWinsDecideTies: !!D.meta.competition_rules });
 function build(round) {
   const entry = fixturesFor(round);
   if (!entry) return null;
   const fixtures = scheduled(entry).map(fixture => {
     const f = { ...fixture, round: entry.round, date: fixture.date || entry.date, stage: fixture.stage || entry.stage };
     const sides = setup?.lineups[fixture.fixtureId] || [defaultSide(f.home, predictionNeeded(), entry.round), defaultSide(f.away, predictionNeeded(), entry.round)];
     const lock = setup?.locks[fixture.fixtureId];
     const prediction = lock ? null : predictionMath(...sides, false, f);
     if (!lock && !prediction) return { ...f, simulationError: 'This fixture needs two complete, distinct lineups.' };
     let sim;
     if (lock) {
       sim = { ...lock, winner: Math.sign(lock.homePoints - lock.awayPoints), results: [] };
     } else {
       sim = BRTAPrediction.simulateTie(BRTAPrediction.orderRubbers(prediction.rubbers, 'singles-first'), options());
     }
     return { ...f, ...sim, fixtureId: 'sim84:' + f.fixtureId, sourceFixtureId: f.fixtureId,
       label: entry.label || 'Round ' + entry.round, status: 'Completed', simulated: true, locked: !!lock,
       ...(D.meta.competition_rules?.teamPoints === 'published only' ? { homePoints: null, awayPoints: null } : {}),
       rubbers: sim.results.map((row, i) => ({ type: /^Singles/.test(row.label) ? 'Singles' : 'Doubles',
         position: 'No. ' + (row.label.match(/\d+/)?.[0] || 1), order: i, home: row.home, away: row.away,
         score: row.score, winner: row.homeWon ? row.home : row.away, status: 'Completed' })) };
   });
   return fixtures.length ? { round: entry.round, index: 0, fixtures, byes: byeTeams(entry) } : null;
 }

 function configure(round) {
   const entry = fixturesFor(round);
   if (!entry) return;
   if (String(setup?.round) !== String(round)) setup = { round, lineups: {}, locks: {} };
   const names = [['homePoints', 'Home points'], ['awayPoints', 'Away points'], ['homeGames', 'Home games'],
     ['awayGames', 'Away games'], ['homeRubbers', 'Home rubbers'], ['awayRubbers', 'Away rubbers']];
   const byes=byeTeams(entry);
   const form = '<form class="round-scenario-form"><p>Edit a lineup in the Prediction Centre or lock totals for any fixture. Remaining fixtures are simulated.</p>' +
     (byes.length?'<div class="round-bye-note"><span>BYE</span><div><b>'+byes.map(teamName).join(' · ')+'</b><small>No fixture, no points and no lineup required this round.</small></div></div>':'')+
     scheduled(entry).map(fixture => {
       const lock = setup.locks[fixture.fixtureId];
       return '<details class="round-scenario-fixture"' + (lock ? ' open' : '') + '><summary><b>' +
         esc(fixture.home + ' v ' + fixture.away) + '</b>' + (setup.lineups[fixture.fixtureId] ? ' · edited lineup' : '') +
         (lock ? ' · result locked' : '') + '</summary><button class="button secondary" type="button" data-round-edit="' +
         esc(fixture.fixtureId) + '">Edit lineups</button>' +
         (D.meta.competition_rules?.teamPoints === 'published only' ? '' : '<fieldset data-round-lock="' + esc(fixture.fixtureId) +
         '"><legend>Result lock</legend><label><input type="checkbox" data-round-lock-toggle ' + (lock ? 'checked' : '') +
         '> Lock this result</label><div class="round-lock-fields"' + (lock ? '' : ' hidden') + '>' + names.map(([key, label]) =>
           '<label>' + label + '<input type="number" min="0" max="1000" ' + (key.endsWith('Points') ? 'step=".5"' : 'step="1"') +
           ' name="' + key + '" value="' + (lock?.[key] ?? '') + '" ' + (lock ? 'required' : 'disabled') + '></label>').join('') +
         '</div></fieldset>') + '</details>';
     }).join('') + '<p role="alert" data-round-error></p><button class="button primary" type="submit">Simulate round</button></form>';
   BRTA82.modal('Round simulation · ' + roundHeading(entry), form, true);
 }

 function saveLocks(form) {
   const locks = {};
   const entry = fixturesFor(setup.round);
   const format = BRTALineups.rules(D);
   for (const fieldset of form.querySelectorAll('[data-round-lock]')) {
     if (!fieldset.querySelector('[data-round-lock-toggle]').checked) continue;
     const result = Object.fromEntries([...fieldset.querySelectorAll('input[type=number]')].map(input => [input.name, input.valueAsNumber]));
     const valid = Object.values(result).every(value => Number.isFinite(value) && value >= 0) && result.homeRubbers + result.awayRubbers === format.singles + format.doubles &&
       result.homePoints <= (window.BRTAFinalsMath.pointsCap(D) || Infinity) && result.awayPoints <= (window.BRTAFinalsMath.pointsCap(D) || Infinity);
     const standard = !D.meta.is_custom && !D.meta.competition_rules && D.format === 'sets';
     const winner = Math.sign(result.homeRubbers - result.awayRubbers || result.homeGames - result.awayGames);
     const correctPoints = !standard || (result.homePoints === result.homeRubbers + (winner > 0 ? 4 : winner === 0 ? 2 : 0) &&
       result.awayPoints === result.awayRubbers + (winner < 0 ? 4 : winner === 0 ? 2 : 0));
     const target = D.greenBall ? 6 : 7;
     const gamesValid = !standard || (result.homeGames >= result.homeRubbers * 6 && result.awayGames >= result.awayRubbers * 6 &&
       result.homeGames <= result.homeRubbers * target + result.awayRubbers * (target - 1) &&
       result.awayGames <= result.awayRubbers * target + result.homeRubbers * (target - 1));
     if (!valid || !correctPoints || !gamesValid) {
       const fixture = scheduled(entry).find(row => row.fixtureId === fieldset.dataset.roundLock);
       form.querySelector('[data-round-error]').textContent = 'Check the points and rubber totals for ' + fixture.home + ' v ' + fixture.away + '.';
       return false;
     }
     locks[fieldset.dataset.roundLock] = result;
   }
   setup.locks = locks;
   return true;
 }

 function positionArrows(){const o=$('#resultOverlay'),r=o.querySelector('.result-sheet').getBoundingClientRect();o.style.setProperty('--sim84-left',Math.max(8,r.left-52)+'px');o.style.setProperty('--sim84-right',Math.max(8,innerWidth-r.right-52)+'px');o.style.setProperty('--sim84-top',r.top+r.height/2+'px');o.style.setProperty('--sim841-left',r.left+'px');o.style.setProperty('--sim841-width',r.width+'px');o.style.setProperty('--sim841-top',Math.max(8,r.top-76)+'px')}
 function draw(){if(!state)return;const f=state.fixtures[state.index];selectedMatch=null;const overlay=$('#resultOverlay');overlay.dataset.simulated='true';$('#resultContent').innerHTML=f.simulationError?'<h2>'+teamName(f.home)+' vs '+teamName(f.away)+'</h2><p>'+esc(f.simulationError)+'</p>':resultDetailHTML(f);if(f.locked){const noScores=$('#resultContent .result-scorecard .notice');if(noScores)noScores.textContent='Locked totals supplied for this scenario.'}overlay.querySelector('.round841-controls')?.remove();overlay.insertAdjacentHTML('beforeend','<div class="round841-controls"><div class="round841-tools"><button class="button secondary" data-round84-standings>Simulated standings</button><button class="button secondary" data-round84-rerun>Rerun simulation</button><button class="button secondary" data-round84-configure>Edit scenario</button></div><nav class="round841-counter" aria-label="Simulated fixture position"><button class="round841-mobile-step" data-round84-step="-1" aria-label="Previous simulated fixture">‹</button><span>SIMULATED · ROUND '+esc(state.round)+' · '+(state.index+1)+' / '+state.fixtures.length+'</span><button class="round841-mobile-step" data-round84-step="1" aria-label="Next simulated fixture">›</button></nav></div>');overlay.querySelector('.round84-externalnav')?.remove();if(state.fixtures.length>1)overlay.insertAdjacentHTML('beforeend','<nav class="round84-externalnav" aria-label="Navigate simulated fixtures"><button class="round84-arrow" data-round84-step="-1" aria-label="Previous simulated fixture">‹</button><button class="round84-arrow" data-round84-step="1" aria-label="Next simulated fixture">›</button></nav>');overlay.classList.remove('hidden');positionArrows();eightRaise(overlay);document.body.classList.add('modal-open')}
 function open(round){if(D.meta?.singlesOnly){openPredictionHome();return}configure(round)}
 function standings() {
   if (!state) return;
   const fixtures = state.fixtures.filter(fixture => !fixture.simulationError);
   const rows = BRTAStandings.project(D, fixtures);
   const missing = state.fixtures.length - fixtures.length;
   const unknown = rows.some(row => row.points == null);
   const changes = rows.filter(row => row.positionChange).map(row => teamName(row.team) +
     (row.positionChange > 0 ? ' up ' : ' down ') + Math.abs(row.positionChange));
   BRTA82.modal('Simulated standings · Round ' + state.round,
     '<p class="simulation84-context">After these hypothetical results. Movement compares with the current ladder.</p>' +
     (missing ? '<p>' + missing + ' fixture' + (missing === 1 ? ' was' : 's were') + ' omitted because the lineup was incomplete.</p>' : '') +
     (!fixtures.some(fixture => BRTAStandings.counts(D, fixture)) ? '<p>No regular-season ladder changes were projected.</p>' : '') +
     (state.byes?.length ? '<p class="round-bye-summary"><b>Bye:</b> '+state.byes.map(teamName).join(' · ')+' remain unchanged.</p>' : '') +
     (unknown ? '<p>Competition points are published by TROLS for this format. Projected points and positions are unavailable.</p>' : '') +
     (changes.length ? '<p><b>Position changes</b> · ' + changes.join(' · ') + '</p>' : '') +
     '<div class="table-wrap simulated84-standings"><table><thead>' + standingsHeadHTML() +
     '</thead><tbody>' + standingsRowsHTML(rows) + '</tbody></table></div>', true);
 }
 document.addEventListener('submit', event => {
   if (!event.target.matches('.round-scenario-form')) return;
   event.preventDefault();
   if (!saveLocks(event.target)) return;
   state = build(setup.round);
   BRTA82.dismiss();
   if (state) draw();
 });
 document.addEventListener('change', event => {
   if (!event.target.matches('[data-round-lock-toggle]')) return;
   const fields = event.target.closest('fieldset').querySelector('.round-lock-fields');
   fields.hidden = !event.target.checked;
   for (const input of fields.querySelectorAll('input')) input.required = !(input.disabled = fields.hidden);
 });
 document.addEventListener('click', event => {
   const edit = event.target.closest('[data-round-edit]');
   if (edit) {
     const form = edit.closest('form');
     if (!saveLocks(form)) return;
     const fixture = fixtureById(edit.dataset.roundEdit);
     if (!fixture) return;
     BRTA82.dismiss();
     openPrediction(fixture.fixtureId);
     const saved = setup.lineups[fixture.fixtureId];
     if (saved && selectedPrediction) {
       [selectedPrediction.home, selectedPrediction.away] = structuredClone(saved);
       refreshPrediction();
     }
     const host = $('#predictionContent');
     if (selectedPrediction) { host.dataset.roundSetup = fixture.fixtureId; refreshPrediction(); }
     window.BRTARouteUI?.close('#predictionOverlay');
   }
   const apply = event.target.closest('[data-round-apply-lineup]');
   if (event.target.closest('[data-round84-configure]') && state) {
     close('#resultOverlay');
     configure(state.round);
   }
   if (apply && setup && selectedPrediction) {
     if (!predictionMath(selectedPrediction.home, selectedPrediction.away, false)) {
       $('#predictionContent [data-round-lineup-error]').textContent = 'Select complete, distinct lineups before applying.';
       return;
     }
     setup.lineups[apply.dataset.roundApplyLineup] = structuredClone([selectedPrediction.home, selectedPrediction.away]);
     delete $('#predictionContent').dataset.roundSetup;
     close('#predictionOverlay');
     configure(setup.round);
   }
 });
 document.addEventListener('click',e=>{const step=e.target.closest('[data-round84-step]');if(step&&state){state.index=(state.index+Number(step.dataset.round84Step)+state.fixtures.length)%state.fixtures.length;draw();return}if(e.target.closest('[data-round84-rerun]')&&state){const i=state.index;state=build(state.round);if(state){state.index=Math.min(i,state.fixtures.length-1);draw()}return}if(e.target.closest('[data-round84-standings]'))standings()});
 window.addEventListener('resize',()=>{if(state&&!$('#resultOverlay').classList.contains('hidden'))positionArrows()});
 window.addEventListener('brta-section-ready',()=>{state=null;setup=null;delete $('#resultOverlay').dataset.simulated});
 window.BRTARoundSimulation={open,standings,getState:()=>state, predictionControls(match) {
   return $('#predictionContent').dataset.roundSetup === match.fixtureId ? '<div class="round-lineup-apply"><button class="button primary" type="button" data-round-apply-lineup="' +
     esc(match.fixtureId) + '">Use these lineups in round simulation</button><p role="alert" data-round-lineup-error></p></div>' : '';
 }};
})();
