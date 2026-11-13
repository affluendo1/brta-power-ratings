(function (root) {
  'use strict';
  const competitions = { AA: 'saturday-am', AP: 'saturday-pm', UA: 'sunday-am', TA: 'tuesday-am', TN: 'tuesday-night', WA: 'wednesday-am', HA: 'thursday-am' };
  const pages = { results: 'results', standings: 'standings', ratings: 'ratings', teams: 'clubs', fixtures: 'fixtures' };
  const views = { singles: 'singles', pairs: 'doubles-pairs', doublesPlayers: 'doubles-players', overall: 'overall' };
  const slug = value => String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const keyFor = (table, value) => Object.keys(table).find(key => table[key] === value);
  function sectionMatches(row, token) {
    const number = String(row.section_label).match(/^(?:sets|section) (\d+)$/i)?.[1];
    return [slug(row.section_label), slug(row.section_code), slug(row.source_section_code),
      ...(number ? ['s' + number, 'sets-' + number, 'section-' + number] : [])].includes(token);
  }
  const sameSeason = (label, token) => slug(label).replace(/-/g, '') === token.replace(/-/g, '');
  const roundKey = fixture => ({ semifinal: 'semifinal', semi_final: 'semifinal', final: 'final', grand_final: 'final', 'grand-final': 'final' })[fixture.stage] || 'r' + fixture.round;
  const fixtureKey = fixture => slug(fixture.home) + '-v-' + slug(fixture.away);

  function parse(path) {
    const [scope, ...parts] = path.toLowerCase().split('/').filter(Boolean);
    if (!['current', 'history'].includes(scope) || parts.some(part => !/^[a-z0-9][a-z0-9_-]*$/.test(part))) return null;
    const season = scope === 'history' ? parts.shift() : null;
    const competition = keyFor(competitions, parts[0]) || Object.keys(competitions).find(key => key.toLowerCase() === parts[0]);
    if (competition) parts.shift();
    const [section, pageName = 'results', ...detail] = parts;
    const page = keyFor(pages, pageName) || (pageName === 'teams' ? 'teams' : null);
    if (!section || !page || (scope === 'history' && !season) || detail.length > 2) return null;
    if (page === 'ratings' && (detail.length > 1 || (detail.length && !keyFor(views, detail[0])))) return null;
    if (page === 'teams' && (detail.length > 2 || (detail.length === 2 && !['overview', 'stats', 'participation'].includes(detail[1])))) return null;
    if (!['ratings', 'results', 'fixtures', 'teams'].includes(page) && detail.length) return null;
    return { season, competition, section, page, detail };
  }

  function path(meta, page, { view, fixture, club, panel, fixtureId = false } = {}) {
    if (!meta || meta.is_custom || !competitions[meta.competition_code] || !pages[page]) return '';
    // Current-season payloads still carry a season label for display. Only an
    // archive payload belongs under /history/; otherwise returning home can
    // leave the section trapped behind an archive-looking URL.
    const season = meta.is_archive ? slug(meta.season_label) : '';
    const parts = [season ? 'history' : 'current'];
    if (season) parts.push(season);
    parts.push(competitions[meta.competition_code], slug(meta.section_label), pages[page]);
    if (page === 'ratings' && views[view] && view !== 'singles') parts.push(views[view]);
    if (page === 'teams' && club) parts.push(slug(club), panel || 'overview');
    if (fixture && ['results', 'fixtures'].includes(page)) parts.push(roundKey(fixture), fixtureId ? slug(fixture.fixtureId) : fixtureKey(fixture));
    return parts.join('/') + '/';
  }

  function findFixture(fixtures, detail) {
    const [first, second] = detail;
    const token = slug(second || first);
    const named = row => [fixtureKey(row), slug(row.home) + '-vs-' + slug(row.away)].includes(token);
    const candidates = fixtures.filter(row => second ? roundKey(row) === first && (named(row) || slug(row.fixtureId) === token) :
      named(row) || slug(row.fixtureId) === token);
    return candidates.length === 1 ? candidates[0] : null;
  }

  const api = { parse, path, slug, sectionMatches, sameSeason, findFixture, views };
  root.BRTASiteRoutes = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
