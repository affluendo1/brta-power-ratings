(function () {
  'use strict';

  const model = BRTAFinalsMath;
  const depths = [
    { title: 'Quick', runs: 2500, samples: 400, variants: 2, seconds: 2, description: 'Likely lineups' },
    { title: 'Standard', runs: 12000, samples: 1800, variants: 5, seconds: 5, description: 'Recent lineups and substitutions' },
    { title: 'Deep', runs: 50000, samples: 6500, variants: 10, seconds: 10, description: 'Lineup and rubber-level analysis' },
    { title: 'Maximum', runs: 150000, samples: 18000, variants: 22, seconds: 25, description: 'Broadest roster and doubles coverage' }
  ];
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  let editing;
  let data, pending, rows, places, caps, team, report, job, selectedRound, planned, scenario = {};
  let pools = new Map(), compiled = new Map(), rubberCache = new Map();
  const snapshots = () => {
    try { return JSON.parse(localStorage.getItem('brta-finals-race-91') || '{}'); } catch { return {}; }
  };
  const key = () => [data.meta.season_id, data.meta.source_section_code || data.meta.section_code, (data.meta.modelChoice || data.meta.predictionModel)].join(':');
  const pct = (value, total) => total ? (100 * value / total).toFixed(1).replace(/\.0$/, '') + '%' : '—';
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
  function pool(teamName, round, size) {
    const key = JSON.stringify([teamName, round]);
    if (pools.has(key)) return pools.get(key).slice(0, size);
    const max = depths.at(-1).variants;
    const recorded = BRTALineups.configurations(data, teamName, round)
      .filter(lineup => lineup.players.every(name => !/^(no player|bye)$/i.test(name)));
    const roster = teamRoster(teamName);
    const variants = recorded.slice(0, max).map(lineup => ({
      side: BRTALineups.side(lineup),
      label: lineup.singles.length ? lineup.singles.join(', ') : lineup.players.join(', '),
      weight: lineup.count * (1 + .08 * Math.max(0, 5 - (round - lineup.latest)))
    }));
    if (!variants.length) variants.push({ side: defaultSide(teamName, predictionNeeded(), round), label: 'Suggested lineup', weight: 1 });
    const original = variants[0].side;
    const seen = new Set(variants.map(({ side }) => signature(side)));
    function add(side, weight, label) {
      const key = signature(side);
      if (seen.has(key)) return;
      seen.add(key);
      variants.push({ side, weight, label });
    }
    const substitutes = roster.filter(row => !original.draft.includes(row.player));
    for (const [slot, outgoing] of original.draft.entries()) {
      for (const player of substitutes) {
        const substitute = name => name === outgoing ? player.player : name;
        const side = { draft: original.draft.map(substitute), singles: original.singles.map(substitute),
          doubles: original.doubles.map(pair => pair.map(substitute)), manualOrder: false, manualPairs: true };
        normaliseSide(teamName, side, predictionNeeded());
        add(side, (player.emergencyOnly ? .11 : .32) / (1 + slot * .18),
          (player.emergencyOnly ? 'Emergency · ' : 'Substitute · ') + player.player + ' for ' + outgoing);
      }
    }
    if (original.draft.length === 4 && original.doubles.length === 2) {
      const [a,b,c,d] = original.draft;
      for (const doubles of [[[a,c],[b,d]], [[a,d],[b,c]]]) {
        add({ ...original, doubles, manualPairs: true }, .28, doubles.map(pair => pair.join(' / ')).join(' · '));
      }
    }
    for (const [i, first] of substitutes.entries()) for (const second of substitutes.slice(i + 1)) {
      if (original.draft.length < 2 || variants.length >= max * 3) break;
      const names = original.draft.slice(-2);
      const swap = name => name === names[0] ? first.player : name === names[1] ? second.player : name;
      const side = { draft: original.draft.map(swap), singles: original.singles.map(swap),
        doubles: original.doubles.map(pair => pair.map(swap)), manualPairs: true };
      normaliseSide(teamName, side, predictionNeeded());
      add(side, first.emergencyOnly || second.emergencyOnly ? .025 : .075, first.player + ' + ' + second.player);
    }
    variants.sort((a,b) => b.weight - a.weight);
    const emergency = variants.find(({ side }) => side.draft.some(name => roster.some(row => row.player === name && row.emergencyOnly)));
    if (emergency && variants.indexOf(emergency) >= max) variants.splice(max - 1, 0, ...variants.splice(variants.indexOf(emergency), 1));
    pools.set(key, variants);
    return variants.slice(0, size);
  }

  async function compile(fixture, size, running) {
    const variants = [pool(fixture.home, fixture.round, size), pool(fixture.away, fixture.round, size)];
    const locks = scenario[fixture.fixtureId] || [];
    for (const [index, side] of locks.entries()) if (side) variants[index] = [{ side, label: 'Pinned · ' + side.draft.join(', '), weight: 1 }];
    const combinations = [];
    let evaluations = 0;
    for (const [i, home] of variants[0].entries()) {
      for (const [j, away] of variants[1].entries()) {
        if (home.side.draft.some(name => away.side.draft.includes(name))) continue;
        const key = JSON.stringify([fixture.fixtureId, signature(home.side), signature(away.side)]);
        if (!compiled.has(key)) {
          if (++evaluations % 8 === 1) await pause(0);
          if (running.abort.signal.aborted) throw Error("Forecast stopped.");
          compiled.set(key, BRTAForecastRubbers(home.side, away.side, fixture, rubberCache));
        }
        const rubbers = compiled.get(key);
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
    const rivals = pending.filter(fixture => !own.includes(fixture) && [fixture.home, fixture.away].some(name =>
      opponents.slice(Math.max(0, places - 2), places + 1).some(row => row.team === name)));
    const metric = (label, value, tone = '') => '<div data-tone="' + tone + '"><span>' + label + '</span><strong>' + esc(value ?? '—') + '</strong></div>';
    const fixtures = (label, list) => list.length ? '<section><h4>' + label + '</h4>' + list.map(fixture =>
      '<div class="race-mini-fixture"><span>' + esc(roundLabel(fixture)) + '</span><b>' + esc(title(fixture)) + '</b></div>').join('') + '</section>' : '';
    return '<section class="race-team-summary"><header><div><span class="kicker">Team outlook</span><h3>' + teamName(team) +
      '</h3></div><span class="race-status-chip" data-status="' + esc(selected.status) + '">' + esc(selected.status) + '</span></header>' +
      '<div class="race-metrics">' + metric('Current points', selected.points, 'current') +
      (own.length && selected.ceiling != null ? metric('Most possible points', selected.ceiling, 'ceiling') : '') +
      (report ? metric('Chance of making finals', pct(report.teams[teamIndex()].qualifies, report.runs), 'odds') : '') + '</div>' +
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

  function decisiveRubbers(fixture, source, index, runs) {
    const qualified = report.teams[index].qualifies;
    const rows = fixture.rubbers.filter(row => row.homeWins > 0 && row.homeWins < runs).map(row => {
      const home = row.qualifiesWhenHomeWins[index] / row.homeWins;
      const away = (qualified - row.qualifiesWhenHomeWins[index]) / (runs - row.homeWins);
      return { label: row.label, home, away, difference: Math.abs(home - away) };
    }).sort((a, b) => b.difference - a.difference).slice(0, 3);
    return rows.length ? '<h4>Individual matches to watch</h4><div class="race-lineup-conditions">' + rows.map(row =>
      '<div><b>' + esc(row.label) + '</b><ul><li><span>If ' + esc(source.home) + ' wins</span><strong>' + pct(row.home, 1) +
      '</strong></li><li><span>If ' + esc(source.away) + ' wins</span><strong>' + pct(row.away, 1) + '</strong></li></ul></div>').join('') + '</div>' : '';
  }

  function reportHTML() {
    if (!report) return '';
    const index = teamIndex();
    const projected = report.teams.map(row => ({ ...row, mean: row.points / report.runs }))
      .sort((a, b) => b.mean - a.mean);
    const projectionCards = projected.map((row, position) => {
      const chance = 100 * row.qualifies / report.runs, seed = row.counts.indexOf(Math.max(...row.counts)) + 1;
      return '<article class="race-projection-card' + (row.name === team ? ' selected' : '') + '" data-chance="' +
        (chance >= 80 ? 'high' : chance >= 35 ? 'live' : 'low') + '"><header><span>#' + (position + 1) + ' projected</span><b>' + teamName(row.name) +
        '</b></header><div class="race-projection-number"><strong>' + chance.toFixed(chance < 10 ? 1 : 0) + '%</strong><span>qualify</span></div>' +
        '<div class="race-probability-track" aria-label="' + esc(row.name + ' qualification chance ' + chance.toFixed(1) + ' percent') + '"><i style="width:' + chance.toFixed(2) + '%"></i></div>' +
        '<footer><span>' + Math.round(row.mean) + ' expected pts</span><span>Most often #' + seed + '</span></footer></article>';
    }).join('');
    const outcome = report.fixtures.map((fixture, i) => {
      const source = pending[i], variants = report.variants[i];
      const score = Object.entries(fixture.points).sort((a, b) => b[1] - a[1])[0];
      const samples = fixture.wins.reduce((a, b) => a + b, 0);
      const conditions = [source.home + ' win', source.away + ' win', 'Draw'];
      const split = fixture.wins.map((count, j) => count ? [conditions[j], pct(fixture.conditions[index][j], count), count] : null).filter(Boolean);
      return { source, variants, score, fixture, samples, split, swing: Math.max(0, ...split.map(row => parseFloat(row[1]))) -
        Math.min(...(split.length ? split.map(row => parseFloat(row[1])) : [0])) };
    }).sort((a, b) => b.swing - a.swing);
    return '<section class="race-report"><header class="race-report-head"><div><span class="kicker">Simulation complete</span><h3>' + (report.scenario ? 'Lineup scenario' : 'Forecast') +
      '</h3></div><p><b>' + report.runs.toLocaleString() + '</b> seasons<br><small>' + esc(report.depth) + ' · ' + esc(modelDisplayName(data.meta.modelChoice || data.meta.predictionModel)) + '</small></p></header>' +
      '<div class="race-projection-grid">' + projectionCards + '</div>' +
      '<div class="race-effects-heading"><h3>Fixtures to watch for ' + esc(team) + '</h3><p>See how each result could change their chance of making finals.</p></div><div class="race-fixture-grid">' +
      outcome.map(({ source, score, fixture, samples, split, variants }) => '<details><summary><b>' + esc(title(source)) +
        '</b><span>' + esc(roundLabel(source)) + ' · most likely score ' + esc(score[0]) + '</span></summary>' +
        '<h4>' + esc(team) + '’s chance of making finals</h4><ul class="race-outcome-bars">' + split.map(([label, chance]) =>
          '<li><span>' + esc(label) + '</span><meter aria-label="' + esc(label) + '" min="0" max="100" value="' + parseFloat(chance) + '"></meter><b>' + chance + '</b></li>').join('') + '</ul>' +
        (report.deep ? decisiveRubbers(fixture, source, index, samples) + '<h4>Chance by lineup</h4><div class="race-lineup-conditions">' + fixture.lineups.map((lineups, side) =>
          '<div><b>' + esc(source[side ? 'away' : 'home']) + '</b><ul>' +
          Object.entries(lineups).sort((a,b) => b[1].count - a[1].count).map(([variant, entry]) => '<li><span>' + esc(variants[side][variant]) + '</span><strong>' +
            pct(entry.qualifies[index], entry.count) + '</strong></li>').join('') + '</ul></div>').join('') + '</div>' : '') +
        '</details>').join('') + '</div>' +
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
        '</b><strong>~' + depth.seconds + 's</strong><small>' + depth.runs.toLocaleString() + ' seasons</small><span>' +
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

  function setUp() {
    cancel();
    data = D;
    pools = new Map();
    compiled = new Map();
    rubberCache = new Map();
    pending = model.remaining(data);
    places = Number(data.meta?.semifinalPlaces ?? 4);
    caps = model.pointsCap(data);
    const eligible = data.standings?.length > places && places > 0 &&
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
    planned = 2;
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
    const start = performance.now();
    const minimum = depth.seconds * 1000;
    try {
      await BRTAActivity.run('Running the Numbers', async task => {
        const fixtures = [];
        let completed = 0;
        let stage = 'Preparing lineups';
        let worker;
        const update = () => {
          const remaining = Math.max(0, minimum - (performance.now() - start));
          task.stage(completed, stage + ' · ' + (remaining ? '~' + Math.ceil(remaining / 1000) + 's remaining' : 'still working'));
        };
        const clock = setInterval(update, 250);
        const timeout = setTimeout(() => running.abort.abort('The forecast timed out.'), 90000);
        const signal = running.abort.signal;
        try {
          for (const fixture of pending) {
            stage = 'Preparing ' + title(fixture);
            update();
            fixtures.push(await compile(fixture, depth.variants, running));
            completed = 15 * fixtures.length / pending.length;
            update();
          }
          if (signal.aborted) return false;
          const result = await new Promise((resolve, reject) => {
            worker = new Worker('web/workers/finals-race-worker.js?v=91release');
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
          await pause(Math.max(0, minimum - (performance.now() - start)));
          if (signal.aborted) return false;
          const hasScenario = Object.values(scenario).some(pair => pair.some(Boolean));
          report = { ...result, variants: fixtures.map(fixture => fixture.variants), depth: depth.title,
            deep: depth.variants >= 10 || hasScenario, scenario: hasScenario };
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
      pct(forecast.wins[index], report.runs)).join(' · ') :
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
    if (button) follow(button.dataset.raceSelect);
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
