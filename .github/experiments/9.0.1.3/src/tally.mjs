import { quorum } from './quorum.mjs';

export function tally(ballots) {
  const totals = { for: 0, against: 0, abstain: 0 };
  for (const { vote } of ballots) totals[vote]++;
  const votesCast = totals.for + totals.against;
  const decision = votesCast < quorum(ballots.length)
    ? 'deferred'
    : totals.for > totals.against ? 'carried' : 'returned for review';
  return { totals, decision };
}
