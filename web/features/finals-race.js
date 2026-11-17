(function () {
  'use strict';

  const model = BRTAFinalsMath;
  const depths = [
    { title: 'Quick', runs: 12000, samples: 2400, variants: 6, description: 'Faster forecast with broad lineup coverage' },
    { title: 'Standard', runs: 30000, samples: 6000, variants: 10, description: 'More season and scorecard simulations' }
  ];
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  let editing;
  let data, pending, rows, places, caps, team, report, job, selectedRound, planned, scenario = {};
  let pools = new Map(), rubberCache = new Map();
  const snapshots = () => {
    try { return JSON.parse(localStorage.getItem('brta-finals-race-91') || '{}'); } catch { return {}; }
  };
  const key = () => [data.meta.season_id, data.meta.source_section_code || data.meta.section_code, (data.meta.modelChoice || data.meta.predictionModel)].join(':');
  const pct = (value, total) => total ? (100 * value / total).toFixed(2) + '%' : '—';
  const qualification = (row, status) => row.qualifies === 0 && status !== 'Eliminated'
    ? '0 observed' : row.qualifies > 0 && row.qualifies * 100 / report.runs < .01
      ? '<0.01%' : pct(row.qualifies, report.runs);
  const playedRound = () => BRTAStandings.rounds(data).at(-1)?.round || 0;
  const firstRaceRound = () => Math.min(10, Math.max(1, (Number(data.meta.regular_season_rounds) ||
    Math.max(0, ...BRTAStandings.rounds(data).map(row => row.round), ...pending.map(row => row.round))) - 4));
  const teamIndex = () => rows.findIndex(row => row.team === team);
  const inline = () => $('#finalsRaceInline');
  const body = () => $('#finalsRaceOverlay [data-race-body]');
  const simulationOptions = () => ({ format: data.format, greenBall: !!data.greenBall, custom: !!data.meta?.is_custom,
    setWinsDecideTies: !!data.meta?.competition_rules });
  const roundLabel = fixture => roundHeading(fixture);
  const pointsOnly = () => data.format === 'sets' && !data.meta.is_custom && !data.meta.competition_rules;
  const title = fixture => fixture.home + ' v ' + fixture.away;

  const signature = side => JSON.stringify([side.singles, side.doubles.map(pair => [...pair].sort())]);
  function pool(teamName, round) {
    const key = JSON.stringify([teamName, round]);
    if (pools.has(key)) return pools.get(key);
    const needed = predictionNeeded();
    const template = defaultSide(teamName, needed, round);
    const eligible = name => name && !/^(no player|bye)$/i.test(name);
    const roster = [...new Set([...teamRoster(teamName).map(row => row.player), ...template.draft])].filter(eligible);
    const variants = new Map();
    function add(side, weight) {
      if (side.draft.length !== needed || !side.draft.every(eligible)) return;
      const id = signature(side);
      if (!variants.has(id)) variants.set(id, { side, weight, label: side.draft.join(', ') +
        (side.doubles.length ? ' · ' + side.doubles.map(pair => pair.join(' / ')).join(' · ') : '') });
    }
    for (const recorded of BRTALineups.configurations(data, teamName, round).slice(0, 10)) {
      add(BRTALineups.side(recorded), recorded.count);
    }
    const baseline = variants.values().next().value?.side || template;
    add(baseline, 1);
    const preferred = orderLineup(teamName, roster).slice(0, needed);
    const candidates = [preferred];
    for (const replacement of roster.filter(name => !preferred.includes(name)).slice(0, 8)) {
      for (let slot = preferred.length - 1; slot >= 0; slot--) {
        const draft = [...preferred];
        draft[slot] = replacement;
        candidates.push(draft);
      }
    }
    for (const draft of candidates) {
      if (variants.size >= 10) break;
      const doubles = baseline.doubles.map(pair => pair.map(name => draft[baseline.draft.indexOf(name)]).filter(Boolean));
      const side = normaliseSide(teamName, { draft, singles: [], doubles }, needed);
      add(side, 0.12);
      if (needed === 4 && side.doubles.length === 2 && variants.size < 10) {
        const [a,b,c,d] = draft;
        add({ ...side, doubles: [[a,c],[b,d]] }, 0.06);
      }
    }
    const result = [...variants.values()];
    pools.set(key, result);
    return result;
  }

  async function compile(fixture, running, limit) {
    const variants = [pool(fixture.home, fixture.round).slice(0, limit), pool(fixture.away, fixture.round).slice(0, limit)];
    const locks = scenario[fixture.fixtureId] || [];
    for (const [index, side] of locks.entries()) if (side) variants[index] = [{ side, weight: 1, label: 'Pinned · ' + side.draft.join(', ') }];
    const combinations = [];
    let evaluations = 0;
    for (const [i, home] of variants[0].entries()) {
      for (const [j, away] of variants[1].entries()) {
        if (home.side.draft.some(name => away.side.draft.includes(name))) continue;
        if (++evaluations % 128 === 1) await pause(0);
        if (running.abort.signal.aborted) throw Error('Forecast stopped.');
        const rubbers = BRTAForecastRubbers(home.side, away.side, fixture, rubberCache);
        if (rubbers) combinations.push({ home: i, away: j, weight: home.weight * away.weight, rubbers });
      }
    }
    if (!combinations.length) throw Error('A full forecast lineup is unavailable for ' + title(fixture) + '.');
    return { id: fixture.fixtureId, home: fixture.home, away: fixture.away, variants: variants.map(list => list.map(x => x.label)), combinations };
  }

  function overview() {
    const selected = rows[teamIndex()];
    if (!selected) return '';
    const opponents = rows.filter(row => row.team !== team).sort((a, b) => Number(b.points) - Number(a.points));
    const cutoff = opponents[places - 1];
    const gap = cutoff && selected.points != null && cutoff.points != null
      ? Number(cutoff.points) - Number(selected.points) : null;
    const own = pending.filter(fixture => [fixture.home, fixture.away].includes(team));
    const rivals = pending.filter((fixture, i) => !own.includes(fixture) && matters(fixture, places) &&
      (!report || resultSwing(report.fixtures[i], teamIndex()) >= .01));
    const metric = (label, value, tone = '') => '<div data-tone="' + tone + '"><span>' + label + '</span><strong>' + esc(value ?? '—') + '</strong></div>';
    const fixtures = (label, list) => list.length ? '<section><h4>' + label + '</h4>' + list.map(fixture =>
      '<div class="race-mini-fixture"><span>' + esc(roundLabel(fixture)) + '</span><b>' + esc(title(fixture)) + '</b></div>').join('') + '</section>' : '';
    return '<section class="race-team-summary"><header><div><span class="kicker">Team outlook</span><h3>' + teamName(team) +
      '</h3></div><span class="race-status-chip" data-status="' + esc(selected.status) + '">' + esc(selected.status) + '</span></header>' +
      '<div class="race-metrics">' + metric('Current points', selected.points, 'current') +
      (own.length && selected.ceiling != null ? metric('Most possible points', selected.ceiling, 'ceiling') : '') +
      (report ? metric('Chance of making finals', qualification(report.teams[teamIndex()], selected.status), 'odds') : '') + '</div>' +
      (cutoff && gap != null && own.length && selected.status === 'In contention' ? '<p class="race-cutoff-note"><b>' + esc(cutoff.team) +
      '</b> currently holds the cutoff. ' + (gap >= 0 ? 'Earn more than ' + esc(gap) + ' points to pass their current total.' : 'You lead them on points.') +
      ' Equal points go to games percentage.</p>' : '') +
      '<div class="race-relevant">' + fixtures('Your fixtures', own) + fixtures('Other fixtures to watch', rivals) + '</div>' +
      (pointsOnly() && selected.status === 'In contention' ? qualificationPaths() : '') + '</section>';
  }

  function qualificationPaths() {
    const paths = model.finalRoundPaths(rows, pending, places, team);
    if (!paths) return '';
    const possible = paths.find(row => row.clear || row.tie);
    const safe = paths.find(row => row.total === row.clear);
    return '<details class="race-details"><summary>What do we need in the final round?</summary>' +
      (possible ? '<div class="race-metrics"><div data-tone="current"><span>Can still qualify with</span><strong>' + possible.points +
        ' pts</strong><small>Depends on other results or games percentage</small></div><div data-tone="ceiling"><span>Through regardless of other scores</span><strong>' +
        (safe ? safe.points + ' pts' : 'No guaranteed score') + '</strong></div></div>' :
        '<p>There is no way through from completed final-round matches.</p>') +
      '<p class="race-detail-note">Points to earn in the final round. Washouts and penalties can change the picture.</p></details>';
  }

  function snapshotsHTML() {
    const history = snapshots()[key()] || {};
    const available = BRTAStandings.rounds(data).filter(row => row.round >= firstRaceRound()).reverse();
    if (!available.length) return '';
    const saved = history[selectedRound], last = history[Number(selectedRound) - 1];
    const records = selectedRound ? BRTAStandings.at(data, Number(selectedRound)) : [];
    const actual = records.find(row => row.team === team);
    const previousLadder = selectedRound ? BRTAStandings.at(data, Number(selectedRound) - 1) : [];
    const prior = previousLadder.find(row => row.team === team);
    const standingsDelta = actual?.position && prior?.position ? prior.position - actual.position : 0;
    const before = last?.teams.find(row => row.name === team);
    const after = saved?.teams.find(row => row.name === team);
    const snapshotFixtures = selectedRound ? model.remaining({ ...data,
      results: (data.results || []).filter(row => Number(row.round) <= Number(selectedRound)),
      upcomingFixtures: (data.upcomingFixtures || []).filter(row => Number(row.round) > Number(selectedRound)).map(row => ({
        ...row, fixtures: row.fixtures.map(fixture => fixture.status === 'Bye' ? fixture : { ...fixture, status: 'Scheduled' })
      }))
    }) : [];
    const oldBounds = actual && records.every(row => row.points != null) ?
      model.bounds(records, snapshotFixtures, caps, places).find(row => row.team === team) : null;
    const resultRound = (data.results || []).find(row => Number(row.round) === Number(selectedRound));
    const outcomes = (resultRound?.fixtures || []).map(fixture => {
      const forecast = last?.fixtures.find(row => row.home === fixture.home && row.away === fixture.away && Number(row.round) === Number(selectedRound));
      if (fixture.homePoints == null || fixture.awayPoints == null || (!forecast && ![fixture.home, fixture.away].includes(team))) return '';
      const actualScore = fixture.homePoints + '–' + fixture.awayPoints;
      return '<li>' + esc(title(fixture) + ' · ' + actualScore + ' actual' + (forecast ?
        ' · forecast: ' + forecast.score : '')) + '</li>';
    }).join('');
    return '<details class="race-details" ' + (selectedRound ? 'open' : '') + '><summary>Past finals race</summary><label>After round <select data-race-history><option value="">Choose a round</option>' +
      available.map(row => '<option value="' + row.round + '"' + (Number(selectedRound) === row.round ? ' selected' : '') + '>' +
        row.round + (history[row.round] ? ' · saved forecast' : '') + '</option>').join('') + '</select></label>' +
      (actual ? '<p>' + esc(team) + ' · ' + (actual.position ? '#' + actual.position + ' · ' + actual.points + ' pts' : 'position unavailable') +
        (actual.positionChange ? ' · ' + (actual.positionChange > 0 ? 'up ' : 'down ') + Math.abs(actual.positionChange) : '') +
        (oldBounds && snapshotFixtures.length ? ' · ' + esc(oldBounds.status) + ' at the time' : '') + '</p>' : '') +
      (standingsDelta ? '<p>' + (standingsDelta > 0 ? 'Moved closer to the top of the ladder.' : 'Lost ground in the ladder.') + '</p>' : '') +
      (after ? '<p>Saved qualification estimate · ' + pct(after.qualifies, saved.runs) +
        (before ? ' · ' + ((after.qualifies / saved.runs - before.qualifies / last.runs) * 100).toFixed(1) + ' percentage points vs previous round' : '') + '</p>' :
        selectedRound ? (before ? '<p>Prior qualification estimate · ' + pct(before.qualifies, last.runs) + '</p>' : '') +
          '<p>No forecast was saved on this device for this round.</p>' : '') +
      (outcomes ? '<ul>' + outcomes + '</ul>' : '') + '</details>';
  }

  function pathHTML(index) {
    const entry = report.teams[index];
    const status = rows[index].status;
    const target = status === 'Clinched' ? entry.counts.slice(0, places).findIndex(count => count > 0) : places - 1;
    if (target < 0) return '';
    const own = pending.findIndex(fixture => [fixture.home, fixture.away].includes(team));
    const exact = pointsOnly() && status === 'In contention' ? model.finalRoundPaths(rows, pending, places, team) : null;
    const winning = exact?.filter(row => row.points > 5);
    const guaranteed = winning?.length && winning.every(row => row.clear === row.total);
    const heading = guaranteed ? 'How to make finals' : status !== 'Clinched' ? 'How to make finals' : target === 0 ? 'How to finish first' : 'How to finish #' + (target + 1);
    const start = '<section class="race-path"><h3>' + heading + '</h3>';
    const inTarget = (path) => status === 'Clinched' ? path.finishes[index][target] :
      path.finishes[index].reduce((sum, count) => sum + count, 0);
    const keyFixtures = pending.map((fixture, i) => {
      const owned = [fixture.home, fixture.away].includes(team);
      if (guaranteed) return i === own ? i : -1;
      return owned || (matters(fixture, target + 1) && resultSwing(report.fixtures[i], index,
        status === 'Clinched' ? target : null) >= .01) ? i : -1;
    }).filter(i => i >= 0);
    const routes = new Map();
    for (const path of report.paths) {
      const key = keyFixtures.map(i => path.results[i]).join('');
      const route = routes.get(key) || { count: 0, successes: 0, example: null };
      const successes = inTarget(path);
      route.count += path.count;
      route.successes += successes;
      if (successes && (!route.example || inTarget(route.example) < successes)) route.example = path;
      routes.set(key, route);
    }
    const paths = [...routes.values()].filter(route => route.example)
      .sort((a,b) => (b.successes + 1) / (b.count + 2) - (a.successes + 1) / (a.count + 2) || b.successes - a.successes)
      .map(route => route.example);
    const best = paths[0];
    if (!guaranteed && !best) return start + '<p>No qualifying finish appeared in the sampled seasons.' + (exact ? ' Check the points scenarios above for possible routes.' : '') + '</p></section>';
    const relevant = keyFixtures.map(i => {
      const fixture = pending[i];
      const side = fixture.home === team ? 0 : fixture.away === team ? 1 : -1;
      const result = guaranteed ? side : best.results[i];
      const winner = result === 0 ? fixture.home : fixture.away;
      const loser = result === 0 ? fixture.away : fixture.home;
      const instruction = result === 2 ? (side < 0 ? 'Hope ' : '') + fixture.home + ' and ' + fixture.away + ' draw' :
        winner === team ? 'Beat ' + loser : (side < 0 ? 'Hope ' : '') + winner + ' beats ' + loser;
      return { i, fixture, instruction, chance: report.fixtures[i].odds[result] };
    });
    const groups = [...new Set(relevant.map(row => row.fixture.round))].sort((a, b) => a - b);
    const alternate = paths.find(path => path !== best && path.examples[index + ':' + target] &&
      relevant.some(({i}) => path.results[i] !== best.results[i]));
    const examplePath = alternate || best;
    const example = examplePath?.examples[index + ':' + target] || (status !== 'Clinched' && examplePath &&
      Object.entries(examplePath.examples).find(([key]) => key.startsWith(index + ':'))?.[1]);
    return start + '<p>' + (guaranteed ? 'A win secures a finals spot.' : 'One route from the forecast. The exact scores can matter.') + '</p>' +
      groups.map(round => '<div class="race-path-round"><h4>' + esc(roundLabel(relevant.find(row => row.fixture.round === round).fixture)) + '</h4><ul>' +
        relevant.filter(row => row.fixture.round === round).map(({ instruction, chance }) => '<li><span>' + esc(instruction) + '</span>' +
          '<strong>' + pct(chance, 1) + '</strong>' + '</li>').join('') + '</ul></div>').join('') +
      (relevant.length ? '<p class="small-note">Result odds weight recorded lineups by how often they played, with a small allowance for other plausible lineups.</p>' : '') +
      (!guaranteed && example && relevant.length ? '<details><summary>' + (alternate ? 'Another score combination' : 'Example scores') + '</summary><ul>' +
        relevant.map(({ i, fixture }) => '<li>' + esc(roundLabel(fixture) + ' · ' + title(fixture)) + ' · <b>' + example[i].join('–') + '</b></li>').join('') + '</ul></details>' : '') +
      '</section>';
  }

  function matters(fixture, target) {
    return model.fixtureMatters(rows, fixture, team, target);
  }

  function resultSwing(fixture, index, target) {
    const chances = fixture.wins.flatMap((count, side) => count >= Math.max(30, report.runs * .005) ?
      [(target == null ? fixture.conditions[index][side] : fixture.finishes[index][side][target]) / count] : []);
    return chances.length > 1 ? Math.max(...chances) - Math.min(...chances) : 0;
  }

  function reportHTML() {
    if (!report) return '';
    const index = teamIndex();
    const projected = report.teams.map(row => ({ ...row, mean: row.points / report.runs }))
      .sort((a, b) => b.mean - a.mean);
    const projectionCards = projected.map((row, position) => {
      const chance = 100 * row.qualifies / report.runs, seed = row.counts.indexOf(Math.max(...row.counts)) + 1;
      return '<button type="button" data-race-select="' + esc(row.name) + '" aria-pressed="' + (row.name === team) + '" class="race-projection-card' + (row.name === team ? ' selected' : '') + '" data-chance="' +
        (chance >= 80 ? 'high' : chance >= 35 ? 'live' : 'low') + '"><header><span>#' + (position + 1) + ' projected</span><b>' + teamName(row.name) +
        '</b></header><div class="race-projection-number"><strong>' + esc(qualification(row, rows.find(item => item.team === row.name)?.status)) + '</strong><span>qualify</span></div>' +
        '<div class="race-probability-track" aria-label="' + esc(row.name + ' qualification chance ' + chance.toFixed(1) + ' percent') + '"><i style="width:' + chance.toFixed(2) + '%"></i></div>' +
        '<footer><span>' + Math.round(row.mean) + ' expected pts</span><span>Most often #' + seed + '</span></footer></button>';
    }).join('');
    const outcome = report.fixtures.map((fixture, i) => {
      const source = pending[i];
      const score = Object.entries(fixture.points).sort((a, b) => b[1] - a[1])[0];
      const conditions = [source.home + ' win', source.away + ' win', 'Draw'];
      const split = fixture.wins.map((count, j) => [conditions[j], pct(fixture.conditions[index][j], count)]);
      return { source, score, split, swing: resultSwing(fixture, index) };
    }).filter(({ source, swing }) => swing >= .01 && ([source.home, source.away].includes(team) || matters(source, places)))
      .sort((a, b) => b.swing - a.swing);
    return '<section class="race-report"><header class="race-report-head"><div><span class="kicker">Simulation complete</span><h3>' + (report.scenario ? 'Lineup scenario' : 'Forecast') +
      '</h3></div><p><b>' + report.runs.toLocaleString() + '</b> seasons<br><small>' + esc(report.depth) + ' · ' + esc(modelDisplayName(data.meta.modelChoice || data.meta.predictionModel)) + '</small></p></header>' +
      '<p class="race-detail-note">Select a team to see its route to finals.</p><div class="race-projection-grid">' + projectionCards + '</div>' + pathHTML(index) +
      (outcome.length ? '<div class="race-effects-heading"><h3>Fixtures to watch for ' + esc(team) + '</h3><p>See how each result could change their chance of making finals.</p></div><div class="race-fixture-grid">' +
      outcome.map(({ source, score, split }) => '<details><summary><b>' + esc(title(source)) +
        '</b><span>' + esc(roundLabel(source)) + ' · most likely score ' + esc(score[0]) + '</span></summary>' +
        '<h4>' + esc(team) + '’s chance of making finals</h4><ul class="race-outcome-bars">' + split.map(([label, chance]) =>
          '<li><span>' + esc(label) + '</span>' + (chance === '—' ? '<small>No sampled results</small>' :
            '<meter aria-label="' + esc(label) + '" min="0" max="100" value="' + parseFloat(chance) + '"></meter>') + '<b>' + chance + '</b></li>').join('') + '</ul>' +
        '<details><summary>What these chances mean</summary><p>Each bar uses simulated seasons with that fixture result. The other fixtures can still go either way.</p></details>' +
        '</details>').join('') + '</div>' : '') +
      '<p class="race-detail-note">Forecasts depend on who plays and how each match goes.' +
      (report.unresolvedCutoffs ? ' Teams tied for the last spot share the chance of qualifying in those simulations.' : '') + '</p></section>';
  }

  function scenarioHTML() {
    return '<div class="race-scenario-list">' + pending.map((fixture, index) => {
      const pinned = scenario[fixture.fixtureId] || [];
      return '<article><span class="kicker">' + esc(roundLabel(fixture)) + '</span><h4>' + esc(title(fixture)) + '</h4>' +
        '<div class="race-scenario-teams">' + ['home','away'].map((side, i) => '<div><b>' + esc(fixture[side]) +
          '</b><small>' + esc(pinned[i]?.draft.join(', ') || 'Use likely lineups') + '</small>' +
          '<button type="button" class="button secondary" data-race-edit="' + index + '" data-side="' + i + '">' +
          (pinned[i] ? 'Edit pinned lineup' : 'Choose lineup') + '</button>' +
          (pinned[i] ? ' <button type="button" class="export-link" data-race-reset="' + index + '" data-side="' + i + '">Unpin</button>' : '') + '</div>').join('') +
        '</div></article>';
    }).join('') + '</div>';
  }

  function settings() {
    const dialog = $('#raceSetupOverlay');
    dialog.querySelector('[data-race-setup]').innerHTML = '<div class="kicker">Finals race</div><h2>Run the Numbers</h2>' +
      '<h3>Simulation depth</h3><div class="race-depth-grid">' + depths.map((depth,index) =>
        '<button type="button" data-race-depth="' + index + '" aria-pressed="' + (planned === index) + '"><b>' + depth.title +
        '</b><small>' + depth.runs.toLocaleString() + ' seasons</small><span>' +
        depth.description + '</span></button>').join('') + '</div><h3>Team to follow</h3>' +
      '<div class="race-team-pills">' + rows.map(row => '<button type="button" data-race-setup-team="' + esc(row.team) +
        '" aria-pressed="' + (team === row.team) + '">' + esc(row.team) + '</button>').join('') + '</div>' +
      '<details class="race-scenario"><summary>Pin lineups for a scenario</summary>' + scenarioHTML() + '</details>' +
      '<div class="race-setup-actions"><button type="button" class="button primary" data-race-start>Start forecast</button></div>';
    eightRaise(dialog);
    dialog.classList.remove('hidden');
    document.body.classList.add('modal-open');
    dialog.querySelector('[aria-pressed="true"]')?.focus();
  }

  function editLineup(index, side) {
    const fixture = pending[index];
    if (!fixture || fixture.status !== 'Scheduled') return;
    close('#raceSetupOverlay');
    openPrediction(fixture.fixtureId);
    if (!selectedPrediction) return;
    editing = { fixture, side };
    const saved = scenario[fixture.fixtureId]?.[side];
    if (saved) selectedPrediction[side ? 'away' : 'home'] = structuredClone(saved);
    refreshPrediction();
  }

  function render() {
    const content = rows?.length ? '<header class="race-heading"><div><h2 class="race-inline-title">Finals race</h2><p>' +
      places + ' finals spots · ' + pending.length + ' regular-season fixtures left</p></div><label>Follow a team<select data-race-team>' +
      rows.map(row => '<option value="' + esc(row.team) + '"' + (team === row.team ? ' selected' : '') + '>' +
        esc(row.team) + '</option>').join('') + '</select></label></header>' + overview() +
      '<div class="race-status-grid">' + rows.map((row,index) => '<button type="button" data-race-select="' + esc(row.team) +
        '" data-status="' + esc(row.status) + '" aria-pressed="' + (row.team === team) + '"><i>#' + (row.officialPosition || index + 1) + '</i><b>' + teamName(row.team) + '</b><span data-status="' + row.status +
        '">' + esc(row.status) + '</span><small>' + esc(row.points ?? '—') + ' pts' +
        (row.ceiling == null ? '' : ' · max ' + esc(row.ceiling)) + '</small></button>').join('') + '</div>' +
      (pending.length && caps != null && predictionEvidenceReady() ? '<div class="race-run"><div><b>Forecast the finish</b><small>See who could make finals and try different lineups</small></div><button class="button primary" type="button" data-race-run>Run the Numbers</button></div>' :
        pending.length ? '<p>' + (caps == null ? 'Forecasts require a known team points formula for this section.' : 'Forecasts open after three rounds of results.') + '</p>' : '') +
      reportHTML() + snapshotsHTML() : '';
    for (const host of [inline(), body()]) if (host) {
      host.hidden = !content;
      host.innerHTML = content;
    }
  }

  function scheduledFinalsUnderway() {
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Australia/Melbourne', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date());
    const local = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const today = [local.year, local.month, local.day].join('-');
    return (data.upcomingFixtures || []).some(group => (group.fixtures || []).some(fixture => {
      const name = [group.stage, group.label, fixture.stage, fixture.label].join(' ');
      const day = BRTAMatchday.iso(fixture.date || group.date);
      const start = BRTAMatchday.time(fixture.startTime, data.meta.competition_code);
      return /final|playoff|knockout|\bsf\b/i.test(name) && !model.bye(fixture) && day &&
        (day < today || (day === today && start && start.slice(0, 2) + ':' + start.slice(2, 4) <= local.hour + ':' + local.minute));
    }));
  }

  function setUp() {
    cancel();
    data = D;
    pools = new Map();
    rubberCache = new Map();
    pending = model.remaining(data);
    places = Number(data.meta?.semifinalPlaces ?? 4);
    caps = model.pointsCap(data);
    const eligible = !BRTAStandings.season(data).complete && !model.finalsStarted(data) && !scheduledFinalsUnderway() && data.standings?.length > places && places > 0 &&
      (data.meta.is_archive || playedRound() >= 10 || (playedRound() > 0 && new Set(pending.map(row => row.round)).size <= 4));
    rows = eligible ? model.bounds(data.standings, pending, caps, places) : [];
    if (!pending.length && rows.length) rows = rows.map((row, index) => {
      const peers = rows.filter(other => Number(other.points) === Number(row.points) &&
        BRTAStandings.percentage(other) === BRTAStandings.percentage(row));
      const tied = peers.length > 1 && peers.some(peer => rows.indexOf(peer) < places) &&
        peers.some(peer => rows.indexOf(peer) >= places);
      return { ...row, status: tied && !row.officialPosition ? 'Tied at cutoff' :
        (row.officialPosition || index + 1) <= places ? 'Qualified' : 'Eliminated' };
    });
    const preferredTeam = localStorage.getItem('brta-finals-team:' + (data.meta.source_section_code || data.meta.section_code));
    team = rows.find(row => row.team === preferredTeam)?.team || rows[0]?.team;
    report = null;
    const savedRounds = snapshots()[key()] || {};
    selectedRound = savedRounds[playedRound() - 1] ? String(playedRound()) : '';
    planned = 1;
    scenario = {};
    const marker = $('#fixturesList .previous-rounds');
    if (eligible && !data.meta.is_archive && pending.length) {
      for (const card of $$('#fixturesList [data-predict-id]')) {
        const fixture = pending.find(row => row.fixtureId === card.dataset.predictId);
        if (!fixture || !rows.some(row => [fixture.home, fixture.away].includes(row.team) && row.status === 'In contention')) continue;
        card.insertAdjacentHTML('beforeend', '<small class="race-fixture-tag">Finals race implications</small>');
      }
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'race-fixtures-link button secondary';
      button.dataset.raceOpen = '';
      button.innerHTML = '<b>Finals race</b><span>Qualification paths and forecasts ›</span>';
      if (marker) marker.after(button);
      else $('#fixturesList').prepend(button);
    }
    render();
  }

  function cancel() {
    job?.abort.abort();
  }

  async function run() {
    if (job || !pending.length) return;
    close('#raceSetupOverlay');
    const depth = depths[planned];
    const running = job = { abort: new AbortController() };
    try {
      await BRTAActivity.run('Running the Numbers', async task => {
        const fixtures = [];
        let completed = 0;
        let stage = 'Preparing lineups';
        let worker;
        const update = () => {
          task.stage(completed, stage);
        };
        const clock = setInterval(update, 250);
        const timeout = setTimeout(() => running.abort.abort('The forecast timed out.'), 180000);
        const signal = running.abort.signal;
        try {
          for (const fixture of pending) {
            stage = 'Preparing ' + title(fixture);
            update();
            fixtures.push(await compile(fixture, running, depth.variants));
            completed = 15 * fixtures.length / pending.length;
            update();
          }
          if (signal.aborted) return false;
          const result = await new Promise((resolve, reject) => {
            worker = new Worker('web/workers/finals-race-worker.js?v=9121');
            signal.addEventListener('abort', () => reject(Error(signal.reason?.message || signal.reason)), { once: true });
            worker.onerror = event => reject(Error(event.message || 'The simulation worker could not start.'));
            worker.onmessage = ({ data: message }) => {
              if (message.error) reject(Error(message.error));
              if (message.prepared) {
                stage = 'Sampling scorecards';
                completed = 15 + 20 * message.prepared / message.total;
              }
              if (message.completed) {
                stage = message.completed.toLocaleString() + ' seasons simulated';
                completed = 35 + 60 * message.completed / depth.runs;
              }
              update();
              if (message.result) resolve(message.result);
            };
            worker.postMessage({ rows, places, fixtures, runs: depth.runs, sampleSize: depth.samples, options: simulationOptions(),
              seed: crypto.getRandomValues(new Uint32Array(1))[0] });
          });
          stage = 'Preparing forecast cards';
          if (signal.aborted) return false;
          const hasScenario = Object.values(scenario).some(pair => pair.some(Boolean));
          report = { ...result, depth: depth.title, scenario: hasScenario };
          if (!hasScenario && !data.meta.is_custom) {
            const previous = snapshots();
            const history = previous[key()] ||= {};
            history[playedRound()] = { runs: report.runs, teams: report.teams, fixtures: report.fixtures.map((row, i) => ({
              home: pending[i].home, away: pending[i].away, round: pending[i].round,
              score: Object.entries(row.points).sort((a, b) => b[1] - a[1])[0][0], wins: row.wins
            })) };
            try { localStorage.setItem('brta-finals-race-91', JSON.stringify(previous)); } catch {}
          }
          render();
          return true;
        } finally {
          worker?.terminate();
          clearInterval(clock);
          clearTimeout(timeout);
        }
      }, { key: 'finals-race', game: true, priority: 2 });
    } catch (error) {
      if (!running.abort.signal.aborted || typeof running.abort.signal.reason === 'string') {
        for (const host of [inline(), body()]) host?.querySelector('.race-run')?.insertAdjacentHTML('afterend',
          '<p class="notice" role="alert">' + esc(error.message) + '</p>');
      }
    } finally {
      if (job === running) job = null;
    }
  }

  function hint(fixture) {
    if (!rows?.length || !pending.some(row => row.fixtureId === fixture.fixtureId)) return '';
    const forecast = report?.fixtures.find(row => row.id === fixture.fixtureId);
    const affected = rows.filter(row => [fixture.home, fixture.away].includes(row.team) && row.status === 'In contention');
    if (!affected.length && !forecast) return '';
    const summary = forecast ? [fixture.home, fixture.away].map((name, index) => esc(name) + ' win · ' +
      pct(forecast.odds[index], 1)).join(' · ') :
      esc(affected.map(row => row.team).join(' and ')) + ' still in contention';
    return '<p class="small-note">Finals race · ' + summary +
      ' <button class="export-link" type="button" data-race-open>See qualification paths</button></p>';
  }

  function follow(name) {
    team = name;
    localStorage.setItem('brta-finals-team:' + (data.meta.source_section_code || data.meta.section_code), name);
    render();
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-race-open]')) {
      const overlay = $('#finalsRaceOverlay');
      overlay.classList.remove('hidden');
      eightRaise(overlay);
      document.body.classList.add('modal-open');
      overlay.querySelector('button').focus({ preventScroll: true });
    }
    if (event.target.closest('[data-race-close]')) close('#finalsRaceOverlay');
    if (event.target.closest('[data-race-run]')) settings();
    if (event.target.closest('[data-race-setup-close]')) close('#raceSetupOverlay');
    if (event.target.closest('[data-race-start]')) run();
    const depth = event.target.closest('[data-race-depth]');
    if (depth) {
      planned = Number(depth.dataset.raceDepth);
      $$('[data-race-depth]').forEach(button => button.setAttribute('aria-pressed', String(button === depth)));
    }
    const setupTeam = event.target.closest('[data-race-setup-team]');
    if (setupTeam) {
      follow(setupTeam.dataset.raceSetupTeam);
      $$('[data-race-setup-team]').forEach(button => button.setAttribute('aria-pressed', String(button === setupTeam)));
    }
    const edit = event.target.closest('[data-race-edit]');
    if (edit) editLineup(Number(edit.dataset.raceEdit), Number(edit.dataset.side));
    const reset = event.target.closest('[data-race-reset]');
    if (reset) {
      scenario[pending[Number(reset.dataset.raceReset)].fixtureId][Number(reset.dataset.side)] = null;
      settings();
      $('#raceSetupOverlay details').open = true;
    }
    if (event.target.closest('[data-race-editor-back]')) {
      editing = null;
      close('#predictionOverlay');
      settings();
      $('#raceSetupOverlay details').open = true;
    }
    if (event.target.closest('[data-race-pin]') && editing) {
      const { fixture, side } = editing;
      if (!predictionMath(selectedPrediction.home, selectedPrediction.away, false, fixture)) {
        $('#predictionContent [data-race-pin-error]').textContent = 'Choose complete lineups with distinct players.';
        return;
      }
      (scenario[fixture.fixtureId] ||= [null, null])[side] = structuredClone(selectedPrediction[side ? 'away' : 'home']);
      editing = null;
      close('#predictionOverlay');
      settings();
      $('#raceSetupOverlay details').open = true;
    }
    const button = event.target.closest('[data-race-select]');
    if (button) {
      const host = button.closest('.race-panel');
      const sheet = button.closest('.settings-sheet');
      const top = sheet?.scrollTop;
      follow(button.dataset.raceSelect);
      if (top != null) sheet.scrollTop = top;
      const selector = button.classList.contains('race-projection-card') ? '.race-projection-card' : '[data-race-select]';
      [...host.querySelectorAll(selector)].find(item => item.dataset.raceSelect === team)?.focus({preventScroll:true});
    }
  });
  document.addEventListener('change', event => {
    const input = event.target;
    if (input.matches('[data-race-team]')) follow(input.value);
    if (input.matches('[data-race-history]')) { selectedRound = input.value; render(); }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && job) { event.stopImmediatePropagation(); cancel(); }
  }, true);
  window.addEventListener('brta-section-ready', setUp);
  window.addEventListener('popstate', cancel);
  window.BRTAFinalsRace = {
    hint,
    clearEditor() { editing = null; },
    editorControls(match) {
      if (editing?.fixture.fixtureId !== match.fixtureId) return '';
      return '<div class="round-lineup-apply"><button type="button" class="button secondary" data-race-editor-back>Back to forecast setup</button> <button type="button" class="button primary" data-race-pin>Pin ' +
        esc(editing.side ? match.away : match.home) + ' lineup</button><p role="alert" data-race-pin-error></p></div>';
    }
  };
})();
