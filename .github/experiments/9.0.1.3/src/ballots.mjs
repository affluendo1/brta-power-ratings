export function castBallots(members, random) {
  return members.map(member => {
    const roll = random();
    const vote = roll < 0.4 ? 'for' : roll < 0.8 ? 'against' : 'abstain';
    return { member, vote };
  });
}
