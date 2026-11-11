export function makeAgenda(motions) {
  return motions.map((title, index) => ({
    number: index + 1,
    title,
    allocatedMinutes: title.length % 9 + 2,
  }));
}
