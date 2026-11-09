const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { directory, benchmark, compare } = require('../web/models/clubs');
const foundation = require('../data/current/club-foundation.json');
const archive = require('../data/archive/catalog.json');
const registry = require('../scraper/club_aliases.json');

assert.deepEqual(foundation.aliases, registry, 'The published aliases must match the reviewed registry');
const model = directory(foundation);
const seasons = new Map(archive.seasons.map(season => [season.id, {
  ...season, codes: new Set(season.sections.map(section => section.section_code))
}]));
const source = path.resolve(__dirname, '../data/archive/club-participation');
const stAndrews = model.resolve('St Andrews MB');
let checked = 0, variants = 0;
for (const file of fs.readdirSync(source).filter(name => name.endsWith('.json.gz'))) {
  const rows = JSON.parse(gunzipSync(fs.readFileSync(path.join(source, file))));
  for (const row of rows) {
    if (row.current || !row.historyKey) continue;
    const season = seasons.get(row.historyKey);
    assert.equal(season?.is_current, false);
    assert.equal(season.season_id, row.season_id);
    assert.equal(season.competition_code, row.competition);
    assert(season.codes.has(row.section_code), 'A Participation entry must link to its exact section');
    checked++;
    if (/^St Andrews MB (RA|BG)$/.test(row.team)) {
      assert.equal(model.resolve(row.team, row, row.club), stAndrews);
      variants++;
    }
  }
}
assert(checked > 1000 && variants > 0);
assert.notEqual(model.resolve('St James'), stAndrews);
assert.equal(model.resolve('Old'), null, 'Ambiguous historical club names remain provisional');

const entry = (season_id, section_code, team, position) => ({ season_id, section_code, competition: 'UA', team, position, current: false });
const club = [entry('one', 'A', 'Club Gold', 1), entry('one', 'B', 'Club Green', 1), entry('two', 'C', 'Club', 2)];
const others = [entry('one', 'A', 'Opponent', 2), entry('one', 'B', 'Opponent', 2), entry('two', 'C', 'Opponent', 1)];
const result = compare(club, benchmark([...club, ...others]));
assert.equal(result.sample, 3);
assert.equal(result.score, 200 / 3, 'The published benchmark weights each eligible team entry once');
console.log('Clubs 9.0.1: audited ' + checked + ' archive destinations, team variants and benchmark weighting');
