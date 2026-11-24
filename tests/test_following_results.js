const assert = require('node:assert/strict');
const {collect, track, acknowledge, presentation, performanceLabel} = require('../web/features/following-results');
const row = (player, team, comp, seasonLabel = 'Spring 2026') => ({
  player, team, seasonLabel, competitionCode:comp, sectionCode:comp+'001', dataPath:comp+'.json'
});
const item = row => ({pin:{name:row.player}, current:[row]});
const a = item(row('Alice','Red','UA')), b = item(row('Beth','Blue','UA')), c = item(row('Casey','White','AA'));
const fixture = (id, home, away, players, score='6-3', status='Completed') => ({
  fixtureId:id, status, home, away,
  rubbers: players ? [{type:'Singles',position:1,home:players[0],away:players[1],score,winner:players[0]}] : []
});
const both = fixture('ua1','Red','Blue',['Alice','Beth']);
const solo = fixture('aa1','White','Green',['Casey','Other']);
const ua = {results:[{round:1,fixtures:[both]}]}, aa = {results:[{round:1,fixtures:[solo]}]};
const sections = new Map([['UA.json',ua],['AA.json',aa]]);
let feed = collect([a,b,c],sections);
assert.deepEqual(feed.unread,['Casey','Alice','Beth']);
assert.equal(feed.slides.length,2,'One scorecard for two followed players in the same fixture');
assert.equal(feed.slides.find(card=>card.fixture.fixtureId==='ua1').players.length,2);
track(feed.tracking);
assert.equal(collect([a,b,c],sections).unread.length,3,'Checking results does not mark them read');
ua.results.unshift({round:2,fixtures:[fixture('ua2','Red','Blue',['Reserve','Beth'])]});
feed = collect([a,b,c],sections);
assert.equal(feed.unread.length,3,'A published missed round does not drop an unread older result');
assert(feed.slides.some(card=>card.reason?.includes('No individual result')));
acknowledge(feed.slides);
const remembered = JSON.parse(JSON.stringify([a,b,c]));
feed = collect(remembered,sections);
assert.deepEqual(feed.unread,[],'Seen status survives a reload');
assert(feed.slides.some(card=>card.fixture?.fixtureId==='ua1'),'The last played scorecard remains available');
aa.results.unshift({round:2,fixtures:[fixture('aa2','White','Green',['Casey','Other'])]});
feed = collect(remembered,sections);
assert.deepEqual(feed.unread,['Casey'],'Another competition only refreshes its own alert');
assert(feed.slides.some(card=>card.fixture?.fixtureId==='ua2'));
ua.results[0].fixtures.push(fixture('same-name','Other Red','Other Blue',['Alice','Beth']));
assert.deepEqual(collect(remembered,sections).unread,['Casey'],'Identical names on different teams are ignored');
ua.results[0].fixtures[0].rubbers.push({type:'Doubles',position:1,home:'Alice / Reserve',away:'Beth / Other',score:'6-0'});
assert(collect(remembered,sections).unread.includes('Alice'),'A delayed scorecard in the same round is new');
console.log('Followed scorecards persist per player, competition, section and published round');

const shown = presentation(collect(remembered,sections).slides);
assert.equal(shown.flatMap(slide=>slide.players).length,3,'Only one carousel entry per followed identity');
assert.equal(performanceLabel('home','home',.28),'Upset win');
assert.equal(performanceLabel('away','home',.76),'Below expectation');
assert.equal(performanceLabel('home','home',.72),'Expected win');
