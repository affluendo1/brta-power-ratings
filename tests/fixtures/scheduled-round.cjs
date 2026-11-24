const { counts } = require('../../web/models/standings.js');

// Use a regular-season round so published finals cannot shrink the test draw.
module.exports = function addTestScheduledRound(data) {
  const groups = [...data.results, ...data.upcomingFixtures];
  const round = Math.max(...groups.map(group => Number(group.round)).filter(Number.isFinite)) + 1;
  const teams = new Set(data.teams.map(({ team }) => team));
  const regularRounds = data.results.filter(group => counts(data, group)).map(group => ({
    date: group.date,
    fixtures: group.fixtures.filter(fixture =>
      fixture.status !== 'Bye' && teams.has(fixture.home) && teams.has(fixture.away)),
  }));
  const source = regularRounds.sort((a, b) => b.fixtures.length - a.fixtures.length)[0];
  if (!source?.fixtures.length) throw new Error('No regular-season fixtures for the prediction test');
  const fixtures = source.fixtures.map(({ home, away }, index) => ({
    fixtureId: 'test-scheduled-' + round + '-' + index,
    home,
    away,
    status: 'Scheduled',
  }));
  data.upcomingFixtures = [{ round, date: source.date, fixtures }, ...data.upcomingFixtures];
  return round;
};
/* BRTA Power Ratings 9.9g */
