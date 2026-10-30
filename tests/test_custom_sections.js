const assert=require('assert'),M=require('../web/models/custom-section-model.js'),H=require('../web/models/rating-history.js');
const copy=x=>JSON.parse(JSON.stringify(x));
function sample(){return {id:'local-test',name:'My league',season:'Spring 2026',format:'sets',setTarget:6,doublesTarget:6,singlesBestOf:1,doublesBestOf:1,singlesSlots:2,doublesSlots:1,updatedAt:'2026-10-18T04:00:00Z',teams:[{id:'a',name:'A'},{id:'b',name:'B'}],players:[{id:'p1',name:'Alice',teamId:'a',order:1},{id:'p2',name:'Amy',teamId:'a',order:2},{id:'p3',name:'Bob',teamId:'b',order:1},{id:'p4',name:'Ben',teamId:'b',order:2},{id:'p5',name:'Emergency',teamId:'',order:1,emergency:true}],rounds:[1,2,3,4,5].map(number=>({id:'round-'+number,number,date:'2026-10-'+String(number*2).padStart(2,'0'),fixtures:[{id:'match-'+number,homeTeamId:'a',awayTeamId:'b',status:number===5?'Scheduled':'Completed',homeLineup:['p1','p2'],awayLineup:['p3','p4'],rubbers:number===5?[]:[
  {type:'Singles',position:1,status:'Completed',home:['p1'],away:['p3'],sets:[{h:6,a:2}],homeEmergencies:[false],awayEmergencies:[false]},
  {type:'Doubles',position:1,status:'Completed',home:['p1','p2'],away:['p3','p4'],sets:[{h:4,a:6}],homeEmergencies:[false,false],awayEmergencies:[false,false]},
  {type:'Singles',position:2,status:'Completed',home:['p2'],away:['p4'],sets:[{h:6,a:3}],homeEmergencies:[false],awayEmergencies:[false]},
]}]}))}}
if(require.main===module){
const source=sample(),before=JSON.stringify(source),data=M.build(source);
assert.equal(JSON.stringify(source),before,'Building must not mutate the saved section.');
assert.equal(data.meta.doublesSurnames,false);
const surnameSection=sample();surnameSection.doublesSurnames=true;const surnameData=M.build(surnameSection);assert.equal(surnameData.meta.doublesSurnames,true);assert.deepEqual(surnameData.results,data.results,'The display preference must not alter scores or winners.');assert.deepEqual(surnameData.doubles,data.doubles,'The display preference must not alter ratings.');surnameSection.doublesSurnames='false';assert.throws(()=>M.validate(surnameSection),/on or off/);
assert.equal(data.results.length,4);assert.equal(data.upcomingFixtures.length,5);
assert.equal(data.results[0].fixtures[0].homePoints,6);assert.equal(data.results[0].fixtures[0].awayPoints,1);
assert.equal(data.standings[0].team,'A');assert.equal(data.standings[0].points,24);
assert.equal(data.singles.find(x=>x.player==='Alice').matches,4);
assert.equal(data.ratingHistory.tables[1].find(x=>x.player==='Alice').matches,1);
assert.equal(data.doublesRatingHistory.tables[2].pairs[0].matches,2);
assert(data.doublesIndividuals.every(x=>!x.qualified),'Fixed partnerships must remain unidentifiable.');
assert.deepEqual(data.results[0].fixtures[0].rubbers.map(x=>x.type),['Singles','Doubles','Singles'],'Manual match order must survive.');
assert(H.withMovement(data,'singles').some(x=>x.isNew));
let s=sample();s.rounds[0].fixtures[0].rubbers[0].away=['p5'];assert.throws(()=>M.build(s),/emergency/);s.rounds[0].fixtures[0].rubbers[0].awayEmergencies=[true];assert(M.build(s).results.at(-1).fixtures[0].rubbers[0].awayEmergency);
s=sample();s.rounds[0].fixtures[0].rubbers[0].sets=[{h:6,a:6}];assert.throws(()=>M.build(s),/winning score/);
s=sample();s.rounds[0].fixtures[0].rubbers[0].sets=[{h:6,a:''}];assert.throws(()=>M.build(s),/both sides/);
s=sample();s.players[1].name='Alice';assert.throws(()=>M.validate(s),/unique name/);
s=sample();s.teams[0].id='bad\" onclick=\"alert(1)';assert.throws(()=>M.validate(s),/ID/);
s=sample();s.players[0].name='__proto__';assert.throws(()=>M.validate(s),/unique name/);
s=sample();s.rounds[0].date='2026-02-31';assert.throws(()=>M.validate(s),/valid date/);
s=sample();s.rounds[0].fixtures.push(copy(s.rounds[0].fixtures[0]));s.rounds[0].fixtures[1].id='different';assert.throws(()=>M.validate(s),/two fixtures/);
s=sample();s.rounds[0].fixtures[0].rubbers[0].home=['p3'];assert.throws(()=>M.validate(s),/emergency|themselves/);
s=sample();s.rounds[0].fixtures[0].rubbers[0].status='Scheduled';assert.throws(()=>M.validate(s),/Finish every match/);
const r={status:'Completed',type:'Singles',sets:[{h:6,a:4},{h:4,a:6},{h:10,a:8,mt:true}]};
assert.deepEqual(M.score(r,{format:'rubbers',setTarget:6,singlesBestOf:3}),{hg:10,ag:10,hs:2,as:1,winner:'home',score:'6-4 4-6 [10-8]'});
assert.throws(()=>M.score({...r,sets:[{h:10,a:8,mt:true}]},{format:'rubbers',setTarget:6,singlesBestOf:3}),/deciding third/);
const forfeit=M.score({status:'Forfeit',type:'Singles',sets:[],winner:'away'},{format:'rubbers',setTarget:6,singlesBestOf:3});assert.equal(forfeit.as,2);assert.equal(forfeit.ag,0);
s=sample();s.rounds[0].fixtures[0].status='Forfeited To';s.rounds[0].fixtures[0].rubbers=[];const forfeited=M.build(s).results.at(-1).fixtures[0];assert.equal(forfeited.homePoints,0);assert.equal(forfeited.awayPoints,7);
s=sample();s.rounds[0].fixtures[0].status='Wash Out';s.rounds[0].fixtures[0].rubbers=[];assert.equal(M.build(s).results.at(-1).fixtures[0].homePoints,3.5);
const strong=M.fit([{home:['A'],away:['B'],hg:6,ag:0,date:'2026-10-01',homeTeam:'X',awayTeam:'Y',winner:'home'}]);assert(strong[0].rating>1500);assert(strong[1].rating<1500);assert.equal(strong[0].rating+strong[1].rating,3000);
const changingPairs=Array.from({length:6},(_,i)=>{const sides=[[['A','B'],['C','D']],[['A','C'],['B','D']],[['A','D'],['B','C']]][i%3];return {home:sides[0],away:sides[1],hg:6,ag:3,date:'2026-10-01',homeTeam:'X',awayTeam:'Y',winner:'home'}});
assert(M.fit(changingPairs,true).every(x=>x.qualified&&x.partner_count===3));
assert.equal(M.score({type:'Doubles',status:'Completed',sets:[{h:8,a:6}]},{format:'rubbers',setTarget:6,doublesTarget:8,doublesBestOf:1}).winner,'home');
assert.equal(M.score({type:'Singles',status:'Unfinished',sets:[{h:3,a:2}]},{format:'sets',setTarget:6}).winner,'');
assert.throws(()=>M.score({type:'Singles',status:'Retired',sets:[{h:3,a:2}]},{format:'sets',setTarget:6}),/winning side/);
s=sample();s.rounds[0].fixtures[0].homePointsOverride=9;s.rounds[0].fixtures[0].awayPointsOverride=1;assert.equal(M.build(s).results.at(-1).fixtures[0].homePoints,9);
s=sample();s.rounds[0].fixtures[0].homePointsOverride=9;assert.throws(()=>M.validate(s),/both competition-point/);
// V3B uses extra outcome evidence without changing actual results or game statistics.
const observation={home:['A'],away:['B'],hg:10,ag:10,hs:2,as:1,winner:'home',matchTiebreaks:[{h:10,a:8}],date:'2026-10-01',homeTeam:'X',awayTeam:'Y'};
assert.deepEqual(M.ratingEvidence(observation),{home:11,away:10});
const composite=M.ratingEvidence(observation,'V3B');assert(Math.abs(composite.home-(10+4+4+20/18))<1e-10);assert(Math.abs(composite.away-(10+2+16/18))<1e-10);
assert.deepEqual(M.fit([observation]),M.fit([observation],false,false,'V3'));
const power=(match,model)=>M.fit(Array(4).fill(match),false,false,model).find(p=>p.player==='A').rating;
assert(power(observation,'V3')>1500);assert(power(observation,'V3B')>1500);
assert(power({...observation,winner:'home'},'V3B')>power({...observation,winner:'away'},'V3B'),'Match wins contribute.');
assert(power({...observation,hs:2,as:1},'V3B')>power({...observation,hs:1,as:2},'V3B'),'Set wins contribute.');
assert(power({...observation,matchTiebreaks:[{h:10,a:2}]},'V3B')>power({...observation,matchTiebreaks:[{h:10,a:8}]},'V3B'),'Tiebreak score margins contribute.');
const extended=M.ratingEvidence({...observation,matchTiebreaks:[{h:50,a:48}]},'V3B');assert(Math.abs(extended.home+extended.away-composite.home-composite.away)<1e-10,'Extended tiebreaks keep the same total weight.');
const reverse={...observation,home:observation.away,away:observation.home,hg:observation.ag,ag:observation.hg,hs:observation.as,as:observation.hs,winner:'away',matchTiebreaks:[{h:8,a:10}],homeTeam:'Y',awayTeam:'X'};assert.deepEqual(M.fit([observation],false,false,'V3B'),M.fit([reverse],false,false,'V3B'),'Home/away reversal must not change ratings.');
const bestOf=sample();bestOf.singlesBestOf=bestOf.doublesBestOf=3;for(const round of bestOf.rounds)for(const m of round.fixtures[0].rubbers)m.sets=[{h:6,a:4},{h:4,a:6},{h:10,a:8,mt:true}];
const originalV3=M.build(bestOf);bestOf.ratingModel='V3B';const v3bBefore=JSON.stringify(bestOf),v3b=M.build(bestOf);assert.equal(JSON.stringify(bestOf),v3bBefore);assert.equal(v3b.meta.ratingModel,'V3B');assert.deepEqual(v3b.meta.ratingWeights,M.V3B_WEIGHTS);assert.deepEqual(v3b.results,originalV3.results);assert.deepEqual(v3b.standings,originalV3.standings);assert.deepEqual(v3b.singlesMatches,originalV3.singlesMatches);assert(v3b.singles.find(p=>p.player==='Alice').rating>1500);assert(v3b.doubles.find(p=>p.team==='A').rating>1500);assert(v3b.doublesIndividuals.find(p=>p.player==='Alice').rating>1500);
for(const p of v3b.singles){const old=originalV3.singles.find(x=>x.player===p.player);for(const key of ['gf','ga','matches','wins','losses'])assert.equal(p[key],old[key]);}
const prefix=copy(bestOf);prefix.rounds=prefix.rounds.filter(r=>r.number<=3);const prefixData=M.build(prefix);for(const n of [1,2,3]){assert.deepEqual(v3b.ratingHistory.tables[n],prefixData.ratingHistory.tables[n]);assert.deepEqual(v3b.doublesRatingHistory.tables[n],prefixData.doublesRatingHistory.tables[n]);}
bestOf.ratingModel='V3';assert.deepEqual(M.build(bestOf),originalV3,'Switching back restores V3 exactly.');bestOf.ratingModel='unknown';assert.throws(()=>M.validate(bestOf),/V3 or V3B/);
const retiredSection=sample();retiredSection.ratingModel='V3B';for(const round of retiredSection.rounds)for(const m of round.fixtures[0].rubbers)if(m.type==='Singles'&&m.position===1){m.status='Retired';m.winner='away';m.sets=[{h:3,a:2}];}const retiredData=M.build(retiredSection);assert(!retiredData.singles.some(p=>p.player==='Alice'),'Retirements stay outside the rating evidence.');
console.log('V3B outcome weights, tiebreak margins, symmetry, unchanged results/stats, all rating types, round history and V3 rollback: passed');
console.log('Custom section validation, scorecards, emergencies, team points, model, snapshots and match order: passed');
if(process.argv.includes('--json'))console.log(JSON.stringify(data));
}
module.exports={sample};

{const section=sample();section.semifinalPlaces=2;assert.equal(M.build(section).meta.semifinalPlaces,2);section.semifinalPlaces=0;assert.equal(M.build(section).meta.semifinalPlaces,0);section.semifinalPlaces=-1;assert.throws(()=>M.validate(section));}
