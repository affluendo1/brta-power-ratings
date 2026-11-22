(function (root) {
  'use strict';
  const order = label => {
    const m = /(autumn|winter|spring|summer)\s+(\d{4}|\d{2})(?!\d)/i.exec(label || '');
    if (!m) return 0;
    const year = Number(m[2]) + (m[2].length === 2 ? (Number(m[2]) < 70 ? 2000 : 1900) : 0);
    const part = {autumn: 1, winter: 2, spring: 3, summer: 4};
    return year * 10 + part[m[1].toLowerCase()];
  };
  const appearanceKey = row => JSON.stringify([row.seasonKey, row.sectionCode, row.player, row.team]);
  const personKey = row => row.identity ? 'linked:' + row.identity : appearanceKey(row);
  const sorted = rows => [...rows].sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) ||
    order(b.seasonLabel) - order(a.seasonLabel) ||
    a.competitionLabel.localeCompare(b.competitionLabel, undefined, {numeric: true}) ||
    a.sectionLabel.localeCompare(b.sectionLabel, undefined, {numeric: true}));
  function build(index, search) {
    const people = new Map();
    const matches = new Map(), cached = new Map(), byAppearance = new Map();
    for (const [nameId, sectionId, team, identity] of index.entries) {
      if (!index.sections[sectionId] || !index.players[nameId]) continue;
      const row = {...index.sections[sectionId], player: index.players[nameId], team, identity};
      const id = personKey(row);
      if (!people.has(id)) people.set(id, new Map());
      people.get(id).set(appearanceKey(row), row);
      byAppearance.set(appearanceKey(row), id);
      const name = search.normalise(row.player);
      if (!matches.has(name)) matches.set(name, []);
      matches.get(name).push(row);
    }
    function get(id) {
      if (cached.has(id)) return cached.get(id);
      const rows = sorted(people.get(id)?.values() || []);
      if (!rows.length) return null;
      const seasons = [...new Set(rows.map(row => row.seasonLabel))].sort((a, b) => order(b) - order(a));
      const person = {id, rows, seasons, linked: id.startsWith('linked:'),
        names: [...new Set(rows.map(row => row.player))],
        teams: [...new Set(rows.map(row => row.team).filter(Boolean))],
        competitions: [...new Set(rows.map(row => row.competitionCode))]};
      cached.set(id, person);
      return person;
    }
    function inSection(name, meta, team, seasonKey) {
      const candidates = (matches.get(search.normalise(name)) || []).filter(row =>
        row.player === name && row.sectionCode === meta.section_code &&
        row.competitionCode === meta.competition_code &&
        (seasonKey ? row.seasonKey === seasonKey : row.isCurrent));
      const exact = candidates.filter(row => row.team === team);
      const pool = exact.length ? exact : candidates;
      return pool.length === 1 ? get(personKey(pool[0])) : null;
    }
    function find(query, fuzzyOnly = false) {
      const seen = new Set();
      return search.find(index, query, fuzzyOnly).flatMap(row => {
        const id = personKey(row);
        if (seen.has(id)) return [];
        seen.add(id);
        const person = get(id);
        return person ? [{...person, match: row}] : [];
      });
    }
    function named(name) {
      return [...new Set((matches.get(search.normalise(name)) || []).map(personKey))].map(get);
    }
    function reconcileAppearance(row) {
      const id = byAppearance.get(appearanceKey(row));
      if (id && people.get(id)?.get(appearanceKey(row))?.seasonLabel === row.seasonLabel) return get(id);
      if (!row.seasonLabel || !row.competitionCode) return null;
      const matchesInSeason = (matches.get(search.normalise(row.player)) || []).filter(item => item.seasonLabel === row.seasonLabel &&
        item.competitionCode === row.competitionCode && item.team === row.team &&
        (item.sectionCode === row.sectionCode || item.sectionCode.endsWith('-' + row.sectionCode)));
      const ids = [...new Set(matchesInSeason.map(personKey))];
      return ids.length === 1 ? get(ids[0]) : null;
    }
    return {get, inSection, find, named, reconcileAppearance};
  }
  const model = {build, appearanceKey, order};
  root.BRTACareers = model;
  if (typeof module !== 'undefined') module.exports = model;
})(typeof window === 'undefined' ? globalThis : window);
/* BRTA Power Ratings 9.9g */
