const assert=require('node:assert/strict');global.BRTAHistory=require('../web/models/rating-history');const L=require('../web/models/lab-model');
const S=(player,rating,matches=4)=>({player,rating,matches,se:50,team:'A',qualified:true}),D={format:'sets',singles:[S('A',1700),S('B',1600),S('P',1400,1)],doubles:[S('A / C',1650,2)],doublesIndividuals:[S('A',1600),S('B',1400),S('C',1500),S('D',1300)],ratingHistory:{rounds:[{round:1},{round:2}],tables:{1:[S('A',1500,1),S('B',1550,1)],2:[S('A',1700),S('B',1600)]}},doublesRatingHistory:{tables:{1:{pairs:[],doublesPlayers:[S('A',1400,1),S('B',1300,1),S('C',1500,1),S('D',1100,1)]}}},results:[{round:1,fixtures:[{fixtureId:'r1',home:'A',away:'B',rubbers:[{type:'Singles',home:'A',away:'B',winner:'A',score:'6-4',position:1},{type:'Doubles',home:'A / C',away:'B / D',winner:'A / C',score:'6-3',position:1}]}]},{round:2,fixtures:[{fixtureId:'r2',home:'A',away:'B',rubbers:[{type:'Singles',home:'A',away:'B',winner:'B',score:'3-6',position:1}]}]}]};
assert.equal(L.matches(D,'A','singles',1).length,1);assert.equal(L.matches(D,'A','singles',1)[0].preOwn,1500);assert.equal(L.matches(D,'A','singles',1)[0].preOpponent,1500);assert.equal(L.matches(D,'A','singles',1)[0].higher,true); // both started neutral; B higher at selected R1
assert.equal(L.matches(D,'A','singles',2)[1].preOpponent,1550);assert.equal(L.matches(D,'A','singles',2)[1].higher,true);
assert.deepEqual(L.pairPower(D,'D / B',1),{rating:1200,fallback:true});assert.equal(L.matches(D,'C / A','pairs',1).length,1);assert.equal(L.matches(D,'A','doublesPlayers',1)[0].partner,'C');assert.equal(L.history(D,'singles','A',1).length,1);assert.equal(L.rank(D,'singles','A',1),null);assert(!L.schedule(D).some(x=>x.player==='P'));assert(L.schedule(D,1,true).length===2);assert.equal(L.contextData(D,1).results.length,1);
console.log('Lab model: cutoff isolation, pre-match comparisons, round-one tie break, pair identity/fallback, partners, history and provisional schedules passed.');
const doublesOnly=structuredClone(D);doublesOnly.meta={competition_rules:{singlesSlots:0,doublesSlots:4}};doublesOnly.singles=[];doublesOnly.results.forEach(g=>g.fixtures.forEach(f=>f.rubbers=f.rubbers.filter(r=>r.type==='Doubles')));
assert.equal(L.discipline(doublesOnly),'doublesPlayers');assert.equal(L.discipline(doublesOnly,true),'pairs');assert.equal(L.discipline(D),'singles');
const evidence=L.matches(doublesOnly,'A',L.discipline(doublesOnly));assert.equal(evidence.length,1);assert.equal(evidence.filter(m=>m.higher).length+evidence.filter(m=>!m.higher).length,1);assert.equal(evidence[0].partner,'C');
console.log('Doubles-only summary/detail discipline and partner evidence agree.');

global.BRTALayoutModel=require('../web/models/layout-model');
const top=S('Aster',3440),strong=S('Birch',3230),low=S('Cedar',1400,8);
const regular=[3110,2700,2660,2600,2540,2440,2350,2300].map((rating,i)=>S('Player '+i,rating));
const rareRows=[top,strong,...regular,low];
const singlesResult=(round,home,away,winner,score)=>({
 round,fixtures:[{rubbers:[{type:'Singles',home,away,winner,score}]}]
});
const rareData={singles:rareRows,results:[
 singlesResult(1,top.player,regular[2].player,top.player,'6-4'),
 singlesResult(2,strong.player,top.player,top.player,'4-6'),
 ...Array.from({length:8},(_,i)=>singlesResult(i+1,low.player,regular[6].player,regular[6].player,'1-6'))
]};
const modelFor=(round=null,rows=rareRows,data=rareData)=>L.performanceBands(data,'singles',rows,round);
const model=modelFor();
assert.equal(model.order[0],'b18');
assert.equal(model.order.at(-1),'b19');
assert.equal(model.classForEntry(top),'b18');
assert.deepEqual(model.qualificationForEntry(top),{
 band:'b18',minimumPower:3050,opponentMinimum:3158,
 opponent:strong.player,opponentPower:strong.rating,score:'6-4',round:2
});
assert.equal(model.classForEntry(low),'b19');
assert.deepEqual(
 [model.qualificationForEntry(low).wins,model.qualificationForEntry(low).losses,model.qualificationForEntry(low).gamesWon,model.qualificationForEntry(low).gamesPlayed],
 [0,8,8,56]
);
assert(!modelFor(1).order.includes('b18'));
assert(!modelFor(5).order.includes('b19'));
assert(modelFor(6).order.includes('b19'));
const lopsided = {...rareData,results:Array.from({length:6},(_,i)=>
 singlesResult(i+1,low.player,regular[6].player,regular[6].player,i<2?'1-6':'0-6'))};
assert(modelFor(null,rareRows,lopsided).qualificationForEntry(low).scorelineRoute);
assert(!modelFor(null,[{...top,rating:3049},...rareRows.slice(1)]).qualificationForEntry(top));
const eliteWin={...rareData,results:[singlesResult(1,top.player,regular[0].player,top.player,'6-4')]};
assert.equal(modelFor(null,rareRows,eliteWin).classForEntry(top),'b0');
const highEliteRows=rareRows.map(row=>row===regular[0]?{...row,rating:3200}:row);
assert.equal(modelFor(null,highEliteRows,eliteWin).classForEntry(highEliteRows[2]),'b1');
assert.equal(modelFor(null,highEliteRows,eliteWin).classForEntry(top),'b18');
const closerLosses={...rareData,results:rareData.results.map(group=>{
 const rubber=group.fixtures[0].rubbers[0];
 return rubber.home===low.player?singlesResult(group.round,rubber.home,rubber.away,rubber.winner,'2-6'):group;
})};
assert.equal(modelFor(null,rareRows,closerLosses).classForEntry(low),'b7');
console.log('Rare bands use stricter cutoffs, completed results through the selected round and auditable qualifying evidence.');
// A higher-rated severe-loss candidate must not sit beneath a lower-rated
// foundational entry, including a provisional player with less evidence.
const lowerProvisional = {player:'Lower provisional',rating:low.rating-1,matches:1};
const orderedRows = [...rareRows,lowerProvisional];
const orderedBands = modelFor(null,orderedRows,lopsided);
assert.notEqual(orderedBands.classForEntry(low),'b19');
assert.equal(orderedBands.classForEntry(lowerProvisional),'b7');
const tiedProvisional = {...lowerProvisional,rating:low.rating};
const tiedBands = modelFor(null,[...rareRows,tiedProvisional],lopsided);
assert.equal(tiedBands.classForEntry(low),'b19');
for(const through of [null,5,6]){
 const bands=modelFor(through,orderedRows,lopsided);
 const basement=orderedRows.filter(row=>bands.classForEntry(row)==='b19');
 const foundational=orderedRows.filter(row=>bands.classForEntry(row)==='b7');
 assert(basement.every(row=>foundational.every(other=>row.rating<=other.rating)));
}
console.log('Basement stays below every Foundational rating, including provisional entries and round snapshots.');
