importScripts('../models/standings.js?v=91', '../models/prediction.js?v=8521', '../models/finals-race.js?v=91release');

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
      const cumulative = [];
      let weight = 0;
      for (const combination of fixture.combinations) {
        weight += combination.weight;
        cumulative.push(weight);
      }
      // Stratify lineup draws so the scorecard bank tracks lineup weights more closely.
      let cursor = 0;
      const samples = Array.from({ length: sampleSize }, (_, index) => {
        const value = (index + rng()) * weight / sampleSize;
        while (cursor < cumulative.length - 1 && value >= cumulative[cursor]) cursor++;
        const combination = fixture.combinations[cursor];
        const result = BRTAPrediction.simulateTie(combination.rubbers, { ...options, rng });
        return { hp: result.homePoints, ap: result.awayPoints, hg: result.homeGames, ag: result.awayGames,
          h: combination.home, a: combination.away, rubberWinners: result.results.map(row => Number(row.homeWon)) };
      });
      self.postMessage({ prepared: index + 1, total: fixtures.length });
      return { id: fixture.id, home: fixture.home, away: fixture.away, samples,
        rubberLabels: fixture.combinations[0].rubbers.map(row => row.label) };
    });
    self.postMessage({ ready: true });
    const result = BRTAFinalsMath.tally(rows, places, sampled, runs, completed => self.postMessage({ completed }), rng);
    self.postMessage({ result });
  } catch (error) {
    self.postMessage({ error: error.message || 'The forecast failed.' });
  }
};
