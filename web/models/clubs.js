(function (root) {
  'use strict';

  function key(value) {
    return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function directory(network) {
    const clubs = new Map(network.clubs.map(club => [club.id, club]));
    const names = new Map(network.clubs.map(club => [club.legacy_id, club.id]));
    const venues = new Map(network.venues.map(venue => [venue.id, venue]));
    const teams = new Map(network.teams.map(team => [
      [team.season_id, team.section_code, key(team.name)].join('|'), team
    ]));
    function resolve(name, section = {}, baseName = name) {
      const team = teams.get([section.season_id, section.section_code, key(name)].join('|'));
      if (team && clubs.has(team.club_id)) return team.club_id;
      for (const label of [name, baseName]) {
        const slug = key(label);
        const id = names.get(network.aliases?.[slug]?.club_id || slug);
        if (id) return id;
      }
      return null;
    }
    return { clubs, venues, teams, resolve };
  }

  const finite = n => n !== null && n !== '' && Number.isFinite(Number(n));
  const position = row => finite(row.position) && Number(row.position) > 0 ? Number(row.position) : Infinity;
  function record(row) {
    const values = [row.wins, row.draws, row.losses];
    if (!values.every(finite) || !finite(row.played) ||
        values.reduce((sum, n) => sum + Number(n), 0) !== Number(row.played)) return 'Record incomplete';
    return values.join('–');
  }

  function groupSeasons(rows) {
    const groups = new Map();
    for (const row of rows) {
      const id = row.current ? 'current' : row.season_label;
      const group = groups.get(id) || { label: row.season_label, order: 0, rows: [] };
      group.order = Math.max(group.order, Number(row.season_order) || 0);
      group.rows.push(row);
      groups.set(id, group);
    }
    return [...groups.values()].sort((a, b) => b.order - a.order).map(group => ({
      ...group,
      rows: group.rows.sort((a, b) => position(a) - position(b) ||
        a.section_label.localeCompare(b.section_label, undefined, { numeric: true }) ||
        a.team.localeCompare(b.team))
    }));
  }

  function totals(rows) {
    const sum = field => rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
    const games = sum('games_for') + sum('games_against');
    const known = rows.filter(row => record(row) !== 'Record incomplete');
    return {
      teams: rows.length,
      seasons: new Set(rows.map(row => row.season_label)).size,
      titles: new Set(rows.filter(row => row.champion).map(row => row.section_code)).size,
      played: sum('played'),
      record: known.length ? ['wins', 'draws', 'losses'].map(field =>
        known.reduce((total, row) => total + Number(row[field]), 0)).join('–') : '—',
      recordEntries: known.length,
      gameShare: games ? (100 * sum('games_for') / games).toFixed(1) + '%' : '—'
    };
  }

  function sectionOrder(a, b) {
    const format = row => /rubbers/i.test(row.section_label) ? 0 : /sets/i.test(row.section_label) ? 1 : 2;
    const grade = row => Number(row.section_label.match(/\d+/)?.[0] ?? Infinity);
    return format(a) - format(b) || grade(a) - grade(b) ||
      a.section_label.localeCompare(b.section_label, undefined, { numeric: true }) ||
      a.competition.localeCompare(b.competition) || a.team.localeCompare(b.team);
  }

  function benchmark(rows) {
    const sections = new Map();
    for (const row of rows) {
      const id = [row.competition, row.season_id, row.section_code].join('|');
      if (!sections.has(id)) sections.set(id, []);
      sections.get(id).push(row);
    }
    const result = new Map();
    for (const group of sections.values()) {
      const size = group.length;
      const ranks = group.map(position).sort((a, b) => a - b);
      const distinctTeams = new Set(group.map(row => key(row.team))).size === size;
      const midranks = new Map();
      for (let start = 0; start < size;) {
        const rank = ranks[start];
        if (rank !== start + 1) break;
        let end = start + 1;
        while (ranks[end] === rank) end++;
        midranks.set(rank, (start + 1 + end) / 2);
        start = end;
      }
      if (size < 2 || !distinctTeams || !ranks.every(rank => midranks.has(rank))) continue;
      const titleKnown = !group[0].current && group.filter(row => row.champion).length === 1;
      for (const row of group) result.set(row, {
        score: 100 * (size - midranks.get(position(row))) / (size - 1),
        titleChance: titleKnown ? 1 / size : null
      });
    }
    return result;
  }

  function compare(rows, reference) {
    const past = rows.filter(row => !row.current);
    const eligible = past.filter(row => reference.has(row));
    const score = eligible.length ? eligible.reduce((sum, row) => sum + reference.get(row).score, 0) / eligible.length : null;
    const titles = eligible.filter(row => reference.get(row).titleChance != null);
    return {
      score, sample: eligible.length, eligible,
      expected: titles.reduce((sum, row) => sum + reference.get(row).titleChance, 0),
      won: titles.filter(row => row.champion).length,
      titleSample: titles.length
    };
  }

  const api = { key, directory, position, record, groupSeasons, totals, sectionOrder, benchmark, compare };
  root.BRTAClubData = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
