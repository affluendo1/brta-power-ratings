const assert = require('node:assert/strict');
const Career = require('../web/features/career-history');
const Report = require('../web/models/career-report');

const entry = {player: 'Player <One>', team: 'Blue', competitionCode: 'UA', competitionLabel: 'Sunday AM',
  seasonKey: 'UA:25', seasonLabel: 'Spring 2025', sectionCode: 'UA20', sectionLabel: 'Sets 20'};
const moved = {...entry, seasonKey: 'UA:26', seasonLabel: 'Spring 2026', sectionCode: 'UA6', sectionLabel: 'Sets 6'};
const green = {...entry, sectionCode: 'UA-GREEN', sectionLabel: 'Sets 1 Green Ball'};
const rubbers = {...entry, sectionCode: 'UA-R1', sectionLabel: 'Rubbers 1'};
const scale = Career.skillScale;
const record = (row, won, date) => ({entry: row, kind: 'singles', won, date, gf: won ? 6 : 3, ga: won ? 3 : 6});
const history = Career.skillHistory([
  ...Array.from({length:5}, () => record(entry,true,'20 Nov 25')),
  ...Array.from({length:5}, (_,i) => record(moved,i<3,'22 Nov 26')),
  record(green,true,'22 Nov 25'),
],scale);
assert.equal(history.length,2);
assert(history[1].rating > history[0].rating, 'A stronger section can outweigh a lower raw win rate');
assert.deepEqual(history[0].sections.map(row => row.code),['UA20','UA-GREEN']);
assert.equal(scale(green).pool, scale(rubbers).pool, 'Even different formats share their competition series');
assert.notEqual(scale({...entry,competitionCode:'AA'}).pool, scale(entry).pool, 'Different competitions stay separate');
assert(scale(rubbers).baseline > scale({...entry,sectionLabel:'Sets 1'}).baseline);
assert.equal(Career.skillHistory([record(entry,true,'20 Nov 25')],scale,'doubles').length,0);
assert.equal(Career.matchTime('05/09/2021'),Date.UTC(2021,8,5));

const ratedRow = (player, rating) => ({player,team:'Blue',rating,se:60,matches:4});
const finalRow = ratedRow(entry.player, 1560);
const data = {meta:{competition_code:'UA'},format:'sets',singles:[finalRow],doubles:[],doublesIndividuals:[],
  standings:[{team:'Blue',points:20,wins:3,losses:1,draws:0}],knockout:{champion:'Blue',qualifiers:[{team:'Blue'}]},
  ratingHistory:{rounds:[{round:1,date:'15 Nov 25'},{round:2,date:'20 Nov 25'}],
    tables:{1:[ratedRow(entry.player,1500),ratedRow('Opp A',1580)],2:[finalRow]}},
  results:[{round:2,date:'20 Nov 25',fixtures:[{
    fixtureId:'tie-1',stage:'semi_final',home:'Red',away:'Blue',status:'Completed',homeRubbers:1,awayRubbers:2,
    rubbers:[
      {type:'Singles',position:'No. 1',home:'Opp A',away:entry.player,winner:entry.player,score:'3-6',status:'Completed'},
      {type:'Singles',position:'No. 2',home:'Opp B',away:entry.player,winner:'Opp B',score:'3-1 ret.',status:'Retired',valid_for_rating:false},
      {type:'Doubles',position:'No. 1',home:'Opp A / Opp B',away:'Partner / '+entry.player,
        winner:'Partner / '+entry.player,score:'2-6',status:'Completed',awayEmergencies:[false,true]},
      {type:'Singles',position:'No. 3',home:entry.player,away:'Different player',winner:entry.player,score:'6-0',status:'Completed'},
      {type:'Doubles',position:'No. 2',home:'Opp A / Opp B',away:entry.player+' / No Player',
        winner:'Opp A / Opp B',score:'6-0 W/O',status:'Forfeit',valid_for_rating:false}
    ]
  }]}]};
const section = Report.extract(data,entry,data,'RM3');
assert.equal(section.matches.length,4,'Identical names on another team do not add matches');
assert.equal(section.ties.length,1);
assert.equal(section.team.position,1);
assert(section.champion);
const win = section.matches.find(match => match.type==='Singles' && match.won);
assert.equal(win.score,'6-3');
assert.equal(win.sourceScore,'3-6');
assert.equal(win.preOwn,1500);
assert.equal(win.preOpponent,1580);
assert.equal(win.beforeRound,1);
assert(section.matches.some(match => match.status==='Retired' && !match.rated));
assert(section.matches.some(match => match.status==='Forfeit' && !match.rated));
assert(section.matches.some(match => match.partner==='Partner' && match.emergency));
assert.equal(section.ratings.find(series => series.label==='Singles').rounds.length,2);

const person = {name: entry.player, names:[entry.player], teams:['Blue'], linked:true};
const report = Report.compile(person,[section,{...section},{entry:moved,unavailable:true}],scale,'RM3');
assert.equal(report.seasons.length,2);
assert.equal(report.records[0][1].recorded,4);
assert.equal(report.records[0][1].rated,2);
assert.equal(report.missing,1);
assert.equal(report.seasons[0].highlights.find(item => item.upset).upset.opponent,'Opp A');
assert.equal(report.history.overall[0].count,1,'The career export rates the regular result while retaining the emergency match in the record');
const html = Report.html({...report,name:'Test </script><script>alert(1)</script>'});
assert(html.includes('Power history') && html.includes('Team fixtures played') && html.includes('Published section record could not be loaded'));
assert(!html.includes('<script>alert(1)</script>'));
const json = /<script type="application\/json" id="brta-career-data">(.*?)<\/script>/.exec(html)[1];
assert.equal(JSON.parse(json).records[0][1].recorded,4);
console.log('Career skill, records, Power history, season highlights and standalone HTML export passed');

assert.equal(Career.seasonSlot('Spring 2025',Date.UTC(2025,7,20)), Career.seasonSlot('Spring 25',Date.UTC(2025,10,15)));
const weakest = {...entry,sectionLabel:'Sets 90 Green Ball'};
assert(Career.skillHistory([record(weakest,false,'20 Nov 25')])[0].rating>0,'Skill is positive even at the bottom of the scale');

const regular = record({...entry,sectionLabel:'Sets 17'},true,'1 Nov 25');
const emergency = {...record({...entry,sectionCode:'UA001',sectionLabel:'Sets 1'},false,'8 Nov 25'),emergency:true,gf:1,ga:6};
const withEmergency = Career.skillHistory([emergency,regular])[0];
assert.equal(withEmergency.rating,Career.skillHistory([regular])[0].rating);
assert.deepEqual(withEmergency.emergencySections,['Sets 1']);
assert.equal(withEmergency.emergencyOnly,false);
assert.equal(withEmergency.row.sectionCode,regular.entry.sectionCode);
const provisional = Career.skillHistory([emergency])[0];
assert.equal(provisional.emergencyOnly,true);
assert.equal(provisional.count,1);
