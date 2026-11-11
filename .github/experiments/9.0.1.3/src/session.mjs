import { makeAgenda } from './agenda.mjs';
import { castBallots } from './ballots.mjs';
import { committee } from './committee.mjs';
import { buildLedger } from './ledger.mjs';
import { makeManifest } from './manifest.mjs';
import { minuteEntry } from './minutes.mjs';
import { randomFrom } from './random.mjs';
import { tally } from './tally.mjs';

export function rehearse(scenario) {
  const random = randomFrom(scenario.seed);
  const agenda = makeAgenda(scenario.motions);
  const ballots = agenda.map(({ number }) => ({ number, votes: castBallots(committee, random) }));
  const minutes = agenda.map((motion, index) => minuteEntry(motion, tally(ballots[index].votes)));
  const reports = { agenda, ballots, minutes, ledger: buildLedger(minutes) };
  return { session: scenario.name, ...reports, manifest: makeManifest(reports) };
}
