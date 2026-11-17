const assert = require('node:assert/strict');
const standings = require('../web/models/standings');
const { overview } = require('../web/models/matchday');

const tie = (fixtureId, home, away, status, points = []) => ({
  fixtureId, home, away, status, homePoints: points[0], awayPoints: points[1]
});
const group = (round, stage, date, fixtures) => ({ round, stage, date, fixtures });
const regular = [
  group(1, 'regular', '11 Oct 26', [tie('r1', 'A', 'B', 'Completed', [6, 4])]),
  group(2, 'regular', '18 Oct 26', [tie('r2', 'C', 'D', 'Completed', [8, 2])]),
  group(3, 'regular', '25 Oct 26', [tie('r3', 'A', 'D', 'Completed', [10, 0])])
];
const semi = group(5, 'semi_final', '', [
  tie('sf1', 'A', 'D', 'Missing Result'),
  tie('sf2', 'C', 'B', 'Missing Result')
]);
const draw = [...regular, semi];
const rows = ['A', 'C', 'B', 'D'].map((team, i) => ({ team, points: [16, 8, 4, 2][i] }));
const sample = { meta: { regular_season_rounds: 3 }, standings: rows, results: [...regular, semi], upcomingFixtures: draw };

const info = standings.season(sample);
assert(info.complete);
assert.equal(overview(sample).round, 3);
assert.equal(info.lastRound, 3);
assert.equal(info.results.at(-1).date, '2026-11-01');
assert(info.results.at(-1).dateEstimated);
assert(info.fixtures.at(-1).fixtures.every(f => f.status === 'Scheduled'));
assert.equal(semi.fixtures[0].status, 'Missing Result', 'keep source records immutable');
assert.equal(info.playoff({ status: 'Scheduled' }, 'grand_final').date, '2026-11-08');

const partial = structuredClone(sample);
partial.results.at(-1).fixtures[0] = tie('sf1', 'A', 'D', 'Completed', [7, 3]);
const after = standings.prepare(partial);
assert.equal(overview(after).round, 5);
assert.deepEqual(after.upcomingFixtures.at(-1).fixtures.map(f => f.status), ['Completed', 'Missing Result']);
assert.deepEqual(standings.current(after).map(r => r.points), [16, 8, 4, 2]);
assert.deepEqual(standings.at(after, 5).map(r => r.points), [16, 8, 4, 2]);

const archive = { ...partial, meta: { ...partial.meta, is_archive: true }, upcomingFixtures: [group(3, 'regular', '25 Oct 26', [tie('unrelated-draw', 'Other Club', 'Another Club', 'Scheduled')])] };
assert(standings.season(archive).complete);
assert.equal(standings.season(archive).results.at(-1).fixtures[0].date, '2026-11-01');

const incomplete = structuredClone(sample);
incomplete.results[2].fixtures[0].status = 'Missing Result';
assert.equal(standings.season(incomplete).complete, false);
assert.equal(standings.season(incomplete).missing, 1);

const suppliedDate = structuredClone(sample);
suppliedDate.results.at(-1).date = '2 Nov 26';
assert.equal(standings.season(suppliedDate).fixtures.at(-1).date, '2 Nov 26');
assert(!standings.season(suppliedDate).fixtures.at(-1).dateEstimated);
console.log('Playoff season: stage-based dating, scheduled placeholders, partial results, archive handling and frozen ladder passed.');
