importScripts('../models/standings.js?v=91', '../models/prediction.js?v=8521', '../models/finals-race.js?v=9121');

function randomWithSeed(seed) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

self.onmessage = ({ data }) => {
  try {
    const { rows, places, fixtures, runs, options, sampleSize, seed } = data;
    const rng = randomWithSeed(seed);
    const sampled = fixtures.map((fixture, index) => {
      const odds = [0, 0, 0];
      let weight = 0;
      const cumulative = fixture.combinations.map(pair => (weight += pair.weight ?? 1));
      const samples = [];
      let pairing = 0;
      for (let trial = 0; trial < sampleSize; trial++) {
        const draw = (trial + rng()) * weight / sampleSize;
        while (pairing < cumulative.length - 1 && draw >= cumulative[pairing]) pairing++;
        const combination = fixture.combinations[pairing];
        const result = BRTAPrediction.simulateTie(combination.rubbers, { ...options, rng });
        odds[result.homePoints > result.awayPoints ? 0 : result.homePoints < result.awayPoints ? 1 : 2]++;
        samples.push({ hp: result.homePoints, ap: result.awayPoints, hg: result.homeGames, ag: result.awayGames,
          h: combination.home, a: combination.away, rubberWinners: result.results.map(row => Number(row.homeWon)) });
      }
      self.postMessage({ prepared: index + 1, total: fixtures.length });
      return { id: fixture.id, home: fixture.home, away: fixture.away, samples,
        odds: odds.map(count => count / sampleSize),
        rubberLabels: fixture.combinations[0].rubbers.map(row => row.label) };
    });
    self.postMessage({ ready: true });
    const result = BRTAFinalsMath.tally(rows, places, sampled, runs, completed => self.postMessage({ completed }), rng);
    for (const fixture of result.fixtures) fixture.odds = sampled.find(row => row.id === fixture.id)?.odds;
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error.message || 'The forecast failed.' });
  }
};
/* BRTA Power Ratings 9.9g */
