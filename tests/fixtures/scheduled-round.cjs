// Keep prediction coverage independent of when TROLS publishes the real fixtures.
module.exports = function addTestScheduledRound(data) {
  const groups = [...data.results, ...data.upcomingFixtures];
  const round = Math.max(...groups.map(group => Number(group.round)).filter(Number.isFinite)) + 1;
  const source = data.results.find(group => group.fixtures.every(fixture => fixture.status === 'Completed'));
  const fixtures = source.fixtures.map(({ home, away }, index) => ({
    fixtureId: 'test-scheduled-' + round + '-' + index,
    home,
    away,
    status: 'Scheduled',
  }));
  data.upcomingFixtures = [{ round, date: source.date, fixtures }, ...data.upcomingFixtures];
  return round;
};
