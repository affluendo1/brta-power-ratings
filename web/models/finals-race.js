(function (root) {
  'use strict';

  const bye = fixture => fixture?.status === 'Bye' || /^(?:bye|byes)$/i.test(String(fixture?.home || '').trim()) ||
    /^(?:bye|byes)$/i.test(String(fixture?.away || '').trim()) || !fixture?.home || !fixture?.away;

  function remaining(data) {
    const results = new Map();
    for (const group of data.results || []) {
      for (const fixture of group.fixtures || []) {
        if (['Scheduled', 'Bye', 'Missing Result'].includes(fixture.status)) continue;
        results.set(JSON.stringify([group.round, fixture.home, fixture.away]), fixture);
      }
    }
    return (data.upcomingFixtures || []).filter(group => root.BRTAStandings.counts(data, group))
      .flatMap(group => group.fixtures.map(fixture => ({ ...group, fixtures: undefined, ...fixture })))
      .filter(fixture => !bye(fixture) && ['Scheduled', 'Missing Result'].includes(fixture.status) &&
        root.BRTAStandings.counts(data, fixture) && !results.has(JSON.stringify([fixture.round, fixture.home, fixture.away])));
  }

  function pointsCap(data) {
    const rules = data.meta?.customRules || data.meta?.competition_rules;
    if (rules?.teamPoints === 'published only' || data.meta?.singlesOnly) return null;
    if (rules) {
      const slots = (kind, bestOf) => Number(rules[kind + 'Slots']) * (data.meta.is_custom && data.format !== 'rubbers' ? 1 : Number(bestOf));
      return (data.format === 'rubbers' ? data.meta.is_custom ? 1 : 2 : 4) +
        slots('singles', rules.singlesBestOf) + slots('doubles', rules.doublesBestOf);
    }
    return data.format === 'rubbers' ? 7 : 10;
  }

  function bounds(rows, fixtures, cap, places) {
    const games = new Map(rows.map(row => [row.team, 0]));
    for (const fixture of fixtures.filter(fixture => !bye(fixture))) for (const team of [fixture.home, fixture.away]) {
      games.set(team, (games.get(team) || 0) + 1);
    }
    const limits = rows.map(row => {
      const remaining = games.get(row.team);
      return { ...row, remaining, ceiling: cap == null || row.points == null ? null : Number(row.points) + remaining * cap };
    });
    return limits.map(row => {
      if (row.ceiling == null || limits.some(other => other.ceiling == null)) return { ...row, status: 'Undetermined' };
      const rivals = limits.filter(other => other !== row);
      if (rivals.filter(other => Number(other.points) > row.ceiling).length >= places) return { ...row, status: 'Eliminated' };
      if (rivals.filter(other => other.ceiling >= Number(row.points)).length < places) return { ...row, status: 'Clinched' };
      return { ...row, status: 'In contention' };
    });
  }

  // Exhaust final-round points scores for ordinary Sets. Exact points ties
  // remain open until games percentage is known.
  function finalRoundPaths(rows, fixtures, places, team) {
    fixtures = fixtures.filter(fixture => !bye(fixture));
    if (fixtures.length > 5 || fixtures.length === 0 || new Set(fixtures.map(fixture => fixture.round)).size !== 1) return null;
    const activeTeams = fixtures.flatMap(fixture => [fixture.home, fixture.away]);
    if (new Set(activeTeams).size !== activeTeams.length) return null;
    const points = new Map(rows.map(row => [row.team, Number(row.points)]));
    if (!points.has(team) || rows.some(row => row.points == null) ||
        fixtures.some(fixture => !points.has(fixture.home) || !points.has(fixture.away))) return null;
    const own = fixtures.findIndex(fixture => [fixture.home, fixture.away].includes(team));
    if (own < 0) return null;
    const cap = 10;
    const scores = [0, 1, 2, 3, 5, 7, 8, 9, 10];
    const chosen = [];
    const paths = new Map();
    function visit(index) {
      const fixture = fixtures[index];
      if (!fixture) {
        const current = points.get(team);
        const rivals = [...points].filter(([name]) => name !== team).map(([, value]) => value);
        const ahead = rivals.filter(value => value > current).length;
        const tied = rivals.filter(value => value === current).length;
        const ownPoints = fixtures[own].home === team ? chosen[own] : cap - chosen[own];
        const entry = paths.get(ownPoints) || { points: ownPoints, total: 0, clear: 0, tie: 0, eliminated: 0, example: null };
        entry.total++;
        if (ahead >= places) entry.eliminated++;
        else if (ahead + tied >= places) entry.tie++;
        else entry.clear++;
        if (ahead < places && (!entry.example || (!tied && entry.example.tied))) entry.example = { scores: [...chosen], tied: ahead + tied >= places };
        paths.set(ownPoints, entry);
        return;
      }
      const home = points.get(fixture.home), away = points.get(fixture.away);
      for (const score of scores) {
        chosen[index] = score;
        points.set(fixture.home, home + score);
        points.set(fixture.away, away + cap - score);
        visit(index + 1);
      }
      points.set(fixture.home, home);
      points.set(fixture.away, away);
    }
    visit(0);
    return [...paths.values()].sort((a, b) => a.points - b.points);
  }

  function rank(rows, order) {
    return order.map((_, index) => index).sort((a, b) => {
      const pa = rows[a], pb = rows[b];
      return pb.points - pa.points || root.BRTAStandings.percentage(pb) - root.BRTAStandings.percentage(pa);
    });
  }

  function tally(rows, places, fixtureList, runs, onProgress, rng = Math.random) {
    const names = rows.map(row => row.team);
    const source = rows.map(row => ({ points: Number(row.points), gamesFor: Number(row.gamesFor) || 0, gamesAgainst: Number(row.gamesAgainst) || 0 }));
    const indices = new Map(names.map((name, i) => [name, i]));
    const fixtures = fixtureList.filter(fixture => !bye(fixture) && indices.has(fixture.home) && indices.has(fixture.away))
      .map(fixture => ({ ...fixture, home: indices.get(fixture.home), away: indices.get(fixture.away) }));
    const teams = names.map(name => ({ name, counts: Array(names.length).fill(0), qualifies: 0, points: 0 }));
    const stats = fixtures.map(fixture => ({ id: fixture.id, points: {}, wins: [0, 0, 0],
      conditions: Array.from({ length: names.length }, () => [0, 0, 0]), lineups: [{}, {}],
      rubbers: (fixture.rubberLabels || []).map(label => ({ label, homeWins: 0, qualifiesWhenHomeWins: Array(names.length).fill(0) })) }));
    const order = names.map((_, i) => i);
    let unresolvedCutoffs = 0;
    for (let run = 0; run < runs; run++) {
      const ladder = source.map(row => ({ ...row }));
      const outcomes = fixtures.map(fixture => {
        const sample = fixture.samples[Math.floor(rng() * fixture.samples.length)];
        const home = ladder[fixture.home], away = ladder[fixture.away];
        home.points += sample.hp;
        away.points += sample.ap;
        home.gamesFor += sample.hg;
        home.gamesAgainst += sample.ag;
        away.gamesFor += sample.ag;
        away.gamesAgainst += sample.hg;
        return sample;
      });
      const finish = rank(ladder, order);
      const qualifies = Array(names.length).fill(0);
      for (let start = 0; start < finish.length;) {
        let end = start + 1;
        const first = ladder[finish[start]];
        while (end < finish.length && ladder[finish[end]].points === first.points &&
          root.BRTAStandings.percentage(ladder[finish[end]]) === root.BRTAStandings.percentage(first)) end++;
        if (start < places && end > places) unresolvedCutoffs++;
        const share = Math.max(0, Math.min(end, places) - start) / (end - start);
        for (let position = start; position < end; position++) {
          const team = finish[position];
          qualifies[team] = share;
          teams[team].qualifies += share;
          teams[team].points += ladder[team].points;
          for (let seed = start; seed < end; seed++) teams[team].counts[seed] += 1 / (end - start);
        }
        start = end;
      }
      for (let i = 0; i < fixtures.length; i++) {
        const outcome = outcomes[i], entry = stats[i], result = outcome.hp > outcome.ap ? 0 : outcome.hp < outcome.ap ? 1 : 2;
        const score = outcome.hp + '–' + outcome.ap;
        entry.wins[result]++;
        entry.points[score] = (entry.points[score] || 0) + 1;
        for (let j = 0; j < names.length; j++) entry.conditions[j][result] += qualifies[j];
        for (const [rubber, won] of (outcome.rubberWinners || []).entries()) {
          if (!won) continue;
          const record = entry.rubbers[rubber];
          record.homeWins++;
          for (let j = 0; j < names.length; j++) record.qualifiesWhenHomeWins[j] += qualifies[j];
        }
        for (const [side, variant] of [outcome.h, outcome.a].entries()) {
          const key = String(variant);
          const record = entry.lineups[side][key] ||= { count: 0, qualifies: Array(names.length).fill(0) };
          record.count++;
          for (let j = 0; j < names.length; j++) record.qualifies[j] += qualifies[j];
        }
      }
      if ((run + 1) % 100 === 0 || run === runs - 1) onProgress?.(run + 1);
    }
    return { runs, teams, fixtures: stats, unresolvedCutoffs };
  }

  const api = { bye, remaining, pointsCap, bounds, finalRoundPaths, tally };
  root.BRTAFinalsMath = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
