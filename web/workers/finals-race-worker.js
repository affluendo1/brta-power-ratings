importScripts('../models/standings.js?v=91', '../models/prediction.js?v=8521', '../models/finals-race.js?v=9113');

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
      const perPairing = Math.max(24, Math.ceil(sampleSize / fixture.combinations.length));
      const odds = [0, 0, 0];
      const total = perPairing * fixture.combinations.length;
      // Every pairing contributes the same number of trials to the displayed
      // odds. Keep a bounded, evenly sampled bank for the season simulation.
      const samples = [];
      const stride = total / sampleSize;
      let next = Math.floor(rng() * stride);
      for (let trial = 0; trial < total; trial++) {
        const combination = fixture.combinations[Math.floor(trial / perPairing)];
        const result = BRTAPrediction.simulateTie(combination.rubbers, { ...options, rng });
        odds[result.homePoints > result.awayPoints ? 0 : result.homePoints < result.awayPoints ? 1 : 2]++;
        if (trial !== next) continue;
        samples.push({ hp: result.homePoints, ap: result.awayPoints, hg: result.homeGames, ag: result.awayGames,
          h: combination.home, a: combination.away, rubberWinners: result.results.map(row => Number(row.homeWon)) });
        next = Math.floor((samples.length + rng()) * stride);
      }
      self.postMessage({ prepared: index + 1, total: fixtures.length });
      return { id: fixture.id, home: fixture.home, away: fixture.away, samples,
        odds: odds.map(count => count / total),
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
