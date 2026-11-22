(function(){'use strict';let state=null;
 let setup;
 const fixturesFor = round => (D.upcomingFixtures || []).find(row => String(row.round) === String(round));
 const isBye = fixture => window.BRTAFinalsMath?.bye?.(fixture) ?? (fixture.status === 'Bye' || /^(?:bye|byes)$/i.test(fixture.home) || /^(?:bye|byes)$/i.test(fixture.away));
 const scheduled = entry => entry.fixtures.filter(fixture => canPredictFixture(fixture, entry.round));
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
   const form = '<form class="round-scenario-form"><p>Edit either team’s lineup below or lock totals for any fixture. Remaining fixtures are simulated.</p>' +
     (byes.length?'<div class="round-bye-note"><span>BYE</span><div><b>'+byes.map(teamName).join(' · ')+'</b><small>No fixture, no points and no lineup required this round.</small></div></div>':'')+
     scheduled(entry).map(fixture => {
       const lock = setup.locks[fixture.fixtureId];
       return '<details class="round-scenario-fixture"' + (lock ? ' open' : '') + '><summary><b>' +
         esc(fixture.home + ' v ' + fixture.away) + '</b>' + (setup.lineups[fixture.fixtureId] ? ' · edited lineup' : '') +
         (lock ? ' · result locked' : '') + '</summary><button class="button secondary" type="button" data-round-edit="' +
         esc(fixture.fixtureId) + '">Edit lineups</button><div class="round-inline-editor" hidden></div>' +
         (D.meta.competition_rules?.teamPoints === 'published only' ? '' : '<fieldset data-round-lock="' + esc(fixture.fixtureId) +
         '"><legend>Result lock</legend><label><input type="checkbox" data-round-lock-toggle ' + (lock ? 'checked' : '') +
         '> Lock this result</label><div class="round-lock-fields"' + (lock ? '' : ' hidden') + '>' + names.map(([key, label]) =>
           '<label>' + label + '<input type="number" min="0" max="1000" ' + (key.endsWith('Points') ? 'step=".5"' : 'step="1"') +
           ' name="' + key + '" value="' + (lock?.[key] ?? '') + '" ' + (lock ? 'required' : 'disabled') + '></label>').join('') +
         '</div></fieldset>') + '</details>';
     }).join('') + '<p role="alert" data-round-error></p><button class="button primary" type="submit">Simulate round</button></form>';
   BRTAOverlays.openSheet('Round simulation · ' + roundHeading(entry), form);
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
 function draw(){if(!state)return;const f=state.fixtures[state.index];selectedMatch=null;const overlay=$('#resultOverlay');overlay.dataset.simulated='true';$('#resultFixtureEdit').hidden=true;$('#resultContent').innerHTML=f.simulationError?'<h2>'+teamName(f.home)+' vs '+teamName(f.away)+'</h2><p>'+esc(f.simulationError)+'</p>':resultDetailHTML(f);if(f.locked){const noScores=$('#resultContent .result-scorecard .notice');if(noScores)noScores.textContent='Locked totals supplied for this scenario.'}overlay.querySelector('.round841-controls')?.remove();overlay.insertAdjacentHTML('beforeend','<div class="round841-controls"><div class="round841-tools"><button class="button secondary" data-round84-standings>Simulated standings</button><button class="button secondary" data-round84-rerun>Rerun simulation</button><button class="button secondary" data-round84-configure>Edit scenario</button></div><nav class="round841-counter" aria-label="Simulated fixture position"><button class="round841-mobile-step" data-round84-step="-1" aria-label="Previous simulated fixture">‹</button><span>SIMULATED · ROUND '+esc(state.round)+' · '+(state.index+1)+' / '+state.fixtures.length+'</span><button class="round841-mobile-step" data-round84-step="1" aria-label="Next simulated fixture">›</button></nav></div>');overlay.querySelector('.round84-externalnav')?.remove();if(state.fixtures.length>1)overlay.insertAdjacentHTML('beforeend','<nav class="round84-externalnav" aria-label="Navigate simulated fixtures"><button class="round84-arrow" data-round84-step="-1" aria-label="Previous simulated fixture">‹</button><button class="round84-arrow" data-round84-step="1" aria-label="Next simulated fixture">›</button></nav>');overlay.classList.remove('hidden');resetResultScroll();positionArrows();eightRaise(overlay);document.body.classList.add('modal-open')}
 function open(round){if(D.meta?.singlesOnly){openPredictionHome();return}configure(round)}
 function standings() {
   if (!state) return;
   const fixtures = state.fixtures.filter(fixture => !fixture.simulationError);
   const rows = BRTAStandings.project(D, fixtures);
   const missing = state.fixtures.length - fixtures.length;
   const unknown = rows.some(row => row.points == null);
   const changes = rows.filter(row => row.positionChange).map(row => teamName(row.team) +
     (row.positionChange > 0 ? ' up ' : ' down ') + Math.abs(row.positionChange));
   BRTAOverlays.openSheet('Simulated standings · Round ' + state.round,
     '<p class="simulation84-context">After these hypothetical results. Movement compares with the current ladder.</p>' +
     (missing ? '<p>' + missing + ' fixture' + (missing === 1 ? ' was' : 's were') + ' omitted because the lineup was incomplete.</p>' : '') +
     (!fixtures.some(fixture => BRTAStandings.counts(D, fixture)) ? '<p>No regular-season ladder changes were projected.</p>' : '') +
     (state.byes?.length ? '<p class="round-bye-summary"><b>Bye:</b> '+state.byes.map(teamName).join(' · ')+' remain unchanged.</p>' : '') +
     (unknown ? '<p>Competition points are published by TROLS for this format. Projected points and positions are unavailable.</p>' : '') +
     (changes.length ? '<p><b>Position changes</b> · ' + changes.join(' · ') + '</p>' : '') +
     '<div class="table-wrap simulated84-standings"><table><thead>' + standingsHeadHTML() +
     '</thead><tbody>' + standingsRowsHTML(rows) + '</tbody></table></div>');
 }
 document.addEventListener('submit', event => {
   if (!event.target.matches('.round-scenario-form')) return;
   event.preventDefault();
   const unapplied = event.target.querySelector('.round-inline-editor:not([hidden])');
   if (unapplied) {
     unapplied.closest('details').open = true;
     unapplied.querySelector('[data-inline-lineup-error]').textContent = 'Apply or cancel this lineup edit before simulating.';
     unapplied.querySelector('[data-inline-save]').focus();
     return;
   }
   if (!saveLocks(event.target)) return;
   state = build(setup.round);
   BRTAOverlays.dismissSheet();
   if (state) draw();
 });
 document.addEventListener('change', event => {
   if (!event.target.matches('[data-round-lock-toggle]')) return;
   const fields = event.target.closest('fieldset').querySelector('.round-lock-fields');
   fields.hidden = !event.target.checked;
   for (const input of fields.querySelectorAll('input')) input.required = !(input.disabled = fields.hidden);
 });
 function editLineups(trigger) {
   const host = trigger.nextElementSibling;
   const fixture = scheduled(fixturesFor(setup.round)).find(row => row.fixtureId === trigger.dataset.roundEdit);
   if (!fixture || !host.hidden) return;
   const needed = predictionNeeded();
   const sides = structuredClone(setup.lineups[fixture.fixtureId] ||
     [defaultSide(fixture.home, needed, setup.round), defaultSide(fixture.away, needed, setup.round)]);
   const render = () => {
     sides.forEach((side, index) => normaliseSide(index ? fixture.away : fixture.home, side, needed));
     host.innerHTML = '<div class="round-inline-sides">' +
       predictionLineupPicker(fixture.home, sides[0], 'home', needed, false) +
       predictionLineupPicker(fixture.away, sides[1], 'away', needed, false) +
       '</div><p role="alert" data-inline-lineup-error></p><button type="button" class="button primary" data-inline-save>Apply lineups</button> ' +
       '<button type="button" class="button secondary" data-inline-cancel>Cancel</button>';
   };
   const finish = () => {
     host.hidden = true;
     host.replaceChildren();
     trigger.hidden = false;
     trigger.focus();
   };
   host.onchange = event => {
     const input = event.target, d = input.dataset;
     const side = sides[(d.predictSide || d.singlesSide || d.side) === 'away' ? 1 : 0];
     event.stopPropagation();
     if (d.predictSide) {
       if (!input.checked) side.draft = side.draft.filter(name => name !== d.predictPlayer);
       else if (side.draft.length < needed) side.draft.push(d.predictPlayer);
     } else if (d.singlesSide) {
       const slot = Number(d.singlesPosition), previous = side.singles.indexOf(input.value);
       if (previous >= 0) side.singles[previous] = side.singles[slot];
       side.singles[slot] = input.value;
       side.manualOrder = true;
     } else if (input.matches('[data-predict-pair-check]')) {
       const pair = side.doubles[Number(d.pair)];
       if (input.checked && pair.length < 2) pair.push(input.value);
       if (!input.checked) side.doubles[Number(d.pair)] = pair.filter(name => name !== input.value);
       side.manualPairs = true;
     }
     render();
     const control = [...host.querySelectorAll('input,select')].find(node =>
       node.dataset.predictPlayer === d.predictPlayer && node.dataset.predictSide === d.predictSide &&
       node.dataset.singlesSide === d.singlesSide && node.dataset.singlesPosition === d.singlesPosition &&
       node.dataset.pair === d.pair && node.dataset.side === d.side && (!d.pair || node.value === input.value));
     control?.focus({ preventScroll: true });
   };
   host.onclick = event => {
     event.stopPropagation();
     const button = event.target.closest('button');
     if (!button) return;
     if (button.dataset.autoOrder) {
       sides[button.dataset.autoOrder === 'away' ? 1 : 0].manualOrder = false;
       render();
       return;
     }
     if (button.hasAttribute('data-inline-cancel')) return finish();
     if (!button.hasAttribute('data-inline-save')) return;
     if (sides[0].draft.some(name => sides[1].draft.includes(name)) || !predictionMath(...sides, false, fixture)) {
       host.querySelector('[data-inline-lineup-error]').textContent = 'Choose two complete lineups without shared players.';
       return;
     }
     setup.lineups[fixture.fixtureId] = structuredClone(sides);
     trigger.textContent = 'Edit lineups · saved';
     finish();
   };
   trigger.hidden = true;
   host.hidden = false;
   render();
   host.querySelector('input, select, button')?.focus();
 }

 document.addEventListener('click', event => {
   const edit = event.target.closest('[data-round-edit]');
   if (edit) editLineups(edit);
   if (event.target.closest('[data-round84-configure]') && state) {
     close('#resultOverlay');
     configure(state.round);
   }
 });
 document.addEventListener('click',e=>{const step=e.target.closest('[data-round84-step]');if(step&&state){state.index=(state.index+Number(step.dataset.round84Step)+state.fixtures.length)%state.fixtures.length;draw();return}if(e.target.closest('[data-round84-rerun]')&&state){const i=state.index;state=build(state.round);if(state){state.index=Math.min(i,state.fixtures.length-1);draw()}return}if(e.target.closest('[data-round84-standings]'))standings()});
 window.addEventListener('resize',()=>{if(state&&!$('#resultOverlay').classList.contains('hidden'))positionArrows()});
 window.addEventListener('brta-section-ready',()=>{state=null;setup=null;delete $('#resultOverlay').dataset.simulated});
 window.BRTARoundSimulation={open,standings,getState:()=>state};
})();
