(function (root) {
  'use strict';

  function summarize(entries) {
    let played = 0, wins = 0, draws = 0, losses = 0, gamesWon = 0, gamesLost = 0;
    let bestLadderPosition = Infinity;
    const seasons = new Set(), titles = new Set(), finals = new Set();
    for (const entry of entries) {
      const section = JSON.stringify([entry.season_id, entry.section_code]);
      seasons.add(entry.season_id);
      if (entry.champion) titles.add(section);
      if (entry.semifinalist || entry.finalist || entry.champion) finals.add(section);
      played += Number(entry.played) || 0;
      wins += Number(entry.wins) || 0;
      draws += Number(entry.draws) || 0;
      losses += Number(entry.losses) || 0;
      gamesWon += Number(entry.games_for) || 0;
      gamesLost += Number(entry.games_against) || 0;
      if (Number(entry.position) > 0) bestLadderPosition = Math.min(bestLadderPosition, Number(entry.position));
    }
    const games = gamesWon + gamesLost;
    return {entries: entries.length, seasons: seasons.size, played, wins, draws, losses, gamesWon, gamesLost,
      gameShare: games ? 100 * gamesWon / games : null,
      bestLadderPosition: Number.isFinite(bestLadderPosition) ? bestLadderPosition : null,
      premierships: titles.size, finalsSections: finals.size};
  }

  async function calculate(name, competitionCode) {
    const query = name?.trim().toLowerCase();
    if (!query) throw Error('Enter a club name.');
    const manifest = await json('data/archive/clubs.json');
    const competition = manifest.competitions?.[competitionCode?.toUpperCase()];
    if (!competition?.path) throw Error('Choose a published competition code, such as UA or AA.');
    const archive = await json(competition.path);
    const club = archive.clubs.find(row => row.name.toLowerCase() === query);
    if (!club) throw Error('That club has no published entries under this competition.');
    return {club: club.name, competition: competition.label, ...summarize(club.entries)};
  }

  async function json(path) {
    const response = await root.fetch(path);
    if (!response.ok) throw Error('Club archive unavailable. Try again when connected.');
    return response.json();
  }

  const api = {calculate, summarize};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BRTAClubsBackend = api;
})(globalThis);
