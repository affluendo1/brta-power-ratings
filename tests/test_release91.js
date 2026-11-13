const assert = require('node:assert/strict');
global.BRTAScores = require('../web/models/score-formats.js');
const layout = require('../web/models/layout-model.js');
require('../web/models/standings.js');
const finals = require('../web/models/finals-race.js');
const routes = require('../web/models/site-routes.js');
const current = require('../data/site/sections/UA009.json');
const section = {
  meta: { competition_code: 'UA', season_label: 'Spring 2026', section_label: 'Sets 6' },
  format: 'sets',
  standings: [['Victory Park', 102], ['Lauriston', 86], ['Kooyong', 81], ['Coatesville', 66], ['Kings Park', 61], ['BLTC', 60], ['St James', 33], ['Beaumaris CC', 31]].map(([team, points]) => ({ team, points })),
  upcomingFixtures: [{ round: 14, stage: 'regular', fixtures: [['Lauriston', 'Kings Park'], ['BLTC', 'Kooyong'],
    ['Beaumaris CC', 'Coatesville'], ['Victory Park', 'St James']].map(([home, away]) => ({ home, away, status: 'Scheduled' })) }]
};
assert(Array.isArray(finals.remaining(current)));
const fixtures = finals.remaining(section);

const byeSection = structuredClone(section);
byeSection.upcomingFixtures[0].fixtures.push({ home: 'St James', away: 'Bye', status: 'Scheduled', fixtureId: 'malformed-bye' });
assert(!finals.remaining(byeSection).some(row => row.fixtureId === 'malformed-bye'));
assert.equal(finals.bounds(byeSection.standings, [...fixtures, { home: 'St James', away: 'Bye', status: 'Bye' }], 10, 4)
  .find(row => row.team === 'St James').ceiling, 43);

assert(fixtures.some(row => row.home === 'Lauriston' && row.away === 'Kings Park'));
assert(fixtures.every(row => row.stage === 'regular'));
assert.equal(finals.pointsCap(section), 10);
const bounds = finals.bounds(section.standings, fixtures, 10, 4);
assert.equal(bounds.find(row => row.team === 'Victory Park').status, 'Clinched');
assert.equal(bounds.find(row => row.team === 'Kings Park').status, 'In contention');
assert.equal(bounds.find(row => row.team === 'St James').status, 'Eliminated');
const paths = finals.finalRoundPaths(section.standings, fixtures, 4, 'Kings Park');
assert(paths.find(row => row.points === 0).eliminated > 0);
assert(paths.find(row => row.points === 10).clear > 0);
assert.equal(paths.reduce((n, row) => n + row.total, 0), 9 ** fixtures.length);

const start = ['A', 'B', 'C'].map(team => ({ team, points: 0, gamesFor: 0, gamesAgainst: 0 }));
const result = finals.tally(start, 1, [{ id: 'ab', home: 'A', away: 'B', samples: [{ hp: 5, ap: 5, hg: 18, ag: 18, h: 0, a: 1 }] }], 100, null, () => 0);
assert.deepEqual(result.teams.map(row => row.qualifies), [50, 50, 0]);
assert.equal(result.unresolvedCutoffs, 100);
assert.equal(result.fixtures[0].lineups[1][1].count, 100);

const undatedFinal = {
  results: [
    { round: 14, date: '1 Sep 24', label: 'Round 14', fixtures: [{ fixtureId: 'r14', date: '1 Sep 24', home: 'A', away: 'B', rubbers: [{ type: 'Singles', home: 'Alpha One', away: 'Beta Two', winner: 'Alpha One', score: '6-4', status: 'Completed' }] }] },
    { round: 16, date: '', label: 'Semi-final', stage: 'semi_final', fixtures: [{ fixtureId: 'sf', date: '', home: 'A', away: 'C', rubbers: [{ type: 'Singles', home: 'Alpha One', away: 'Charlie Three', winner: 'Charlie Three', score: '4-6', status: 'Completed' }] }] },
    { round: 17, date: '', label: 'Grand final', stage: 'grand_final', fixtures: [{ fixtureId: 'gf', date: '', home: 'C', away: 'D', rubbers: [{ type: 'Singles', home: 'Charlie Three', away: 'Delta Four', winner: 'Charlie Three', score: '6-3', status: 'Completed' }] }] }
  ]
};
const finalEvidence = layout.observations(undatedFinal);
assert.deepEqual(finalEvidence.map(row => [row.fixtureId, row.date]), [['r14', '2024-09-01'], ['sf', '2024-09-08'], ['gf', '2024-09-15']]);

const route = routes.parse('/history/spring2024/s9/fixtures/Kings_Park_vs_Lauriston');
assert.equal(route.page, 'fixtures');
assert(routes.sameSeason('Spring 2024', route.season));
assert(routes.sectionMatches({ section_label: 'Section 9' }, route.section));
const fixturesWithRematch = [{ home: 'Kings Park', away: 'Lauriston', round: 7, fixtureId: 'first' },
  { home: 'Kings Park', away: 'Lauriston', round: 14, fixtureId: 'second' }];
assert.equal(routes.findFixture(fixturesWithRematch, route.detail), null);
assert.equal(routes.findFixture(fixturesWithRematch, ['r14', ...route.detail]).fixtureId, 'second');
assert.match(routes.path(section.meta, 'fixtures', { fixture: fixtures[0] }), /^current\/sunday-am\/sets-6\/fixtures\/r14\//);
assert.match(routes.path({ ...section.meta, is_archive: true }, 'fixtures', { fixture: fixtures[0] }), /^history\/spring-2026\/sunday-am\/sets-6\/fixtures\/r14\//);
assert.equal(routes.path({ is_custom: true }, 'ratings'), '');
assert.equal(routes.parse('/history/spring-2026/sunday-am/sets-6/clubs/kings-park/participation/').detail[1], 'participation');
assert.equal(routes.parse('/secret/vault'), null);
const index = require('../data/archive/scorelines.json');
assert(index.sections > 1500);
assert(index.scores['6-4'][0] > 1000);
assert(index.scores['6-4'][1][0] < index.scores['6-4'][2][0]);
console.log('Finals race math, exact routes and scoreline index passed');
