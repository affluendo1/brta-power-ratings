const assert=require('assert');
const P=require('../prediction.js');

function approx(actual,expected,tolerance=1e-9){
  assert.ok(Math.abs(actual-expected)<=tolerance,`expected ${actual} ≈ ${expected}`);
}

{
  const distribution=P.shortSetDistribution(.5);
  approx(distribution.reduce((sum,row)=>sum+row.probability,0),1,1e-12);
  approx(P.shortSetWin(.5),.5,1e-12);
}
{
  const p=.63;
  approx(P.shortSetWin(p)+P.shortSetWin(1-p),1,1e-10);
}
{
  const standard=P.shortSetDistribution(.62);
  const green=P.shortSetDistribution(.62,{greenBall:true});
  assert.ok(standard.some(row=>Math.abs(row.margin)===1),'standard sets must include 7-6 / 6-7 paths');
  assert.ok(green.some(row=>Math.abs(row.margin)===1),'Green Ball can finish 6-5 because it is first to six');
  approx(green.reduce((sum,row)=>sum+row.probability,0),1,1e-12);
  const p=.62,q=1-p;
  let direct=0;
  for(let lost=0;lost<=5;lost++){
    let comb=1;
    for(let i=1;i<=lost;i++)comb=comb*(5+i)/i;
    direct+=comb*p**6*q**lost;
  }
  approx(P.shortSetWin(p,{greenBall:true}),direct,1e-12);
  approx(P.shortSetWin(.5,{greenBall:true}),.5,1e-12);
}
{
  assert.strictEqual(P.lineupReady(['A','B','C','D'],['E','F','G','H'],4),true);
  assert.strictEqual(P.lineupReady(['A','B','C'],['E','F','G','H'],4),false);
  assert.strictEqual(P.lineupReady(['A','A','C','D'],['E','F','G','H'],4),false);
}
{
  const fair=Array.from({length:6},()=>({p:.5,scoreDistribution:P.shortSetDistribution(.5)}));
  const result=P.teamOutcome(fair,{gamesDecideTies:true});
  approx(result.homeWin,result.awayWin,1e-12);
  assert.ok(result.draw>0,'exactly level rubbers and games should remain a draw state');
}
{
  const deterministic=[
    {p:1,scoreDistribution:[{homeWin:true,margin:6,probability:1}]},
    {p:1,scoreDistribution:[{homeWin:true,margin:6,probability:1}]},
    {p:1,scoreDistribution:[{homeWin:true,margin:6,probability:1}]},
    {p:0,scoreDistribution:[{homeWin:false,margin:-1,probability:1}]},
    {p:0,scoreDistribution:[{homeWin:false,margin:-1,probability:1}]},
    {p:0,scoreDistribution:[{homeWin:false,margin:-1,probability:1}]},
  ];
  const result=P.teamOutcome(deterministic,{gamesDecideTies:true});
  approx(result.homeWin,1);
  approx(result.awayWin,0);
}
{
  // Sampling the same set model should converge to the projection, including
  // the 5-5 and tiebreak branches used for Sets team margins.
  let seed=4711;
  const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const p=.61,n=30000;
  let wins=0;
  for(let i=0;i<n;i++){
    const set=P.sampleSet(p,{rng});
    wins+=Number(set.homeWon);
    assert.match(set.score,/^(?:[0-7]-[0-7](?:\[\d+\])?)$/);
    if(set.score.includes('['))assert.match(set.score,/^(?:7-6|6-7)\[\d+\]$/);
  }
  approx(wins/n,P.shortSetWin(p),.012);
}
{
  let seed=67891;
  const rng=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
  const ratings=[.62,.55,.57,.48,.65,.53];
  const rubbers=ratings.map((p,i)=>({label:i<4?'Singles '+(i+1):'Doubles '+(i-3),
    home:'Home '+i,away:'Away '+i,gameProbability:p,p:P.shortSetWin(p),
    scoreDistribution:P.shortSetDistribution(p)}));
  const projected=P.teamOutcome(rubbers,{gamesDecideTies:true});
  const counts=[0,0,0],n=25000;
  for(let i=0;i<n;i++){
    const result=P.simulateTie(rubbers,{rng});
    counts[result.winner===1?0:result.winner===-1?1:2]++;
    assert.strictEqual(result.homeRubbers+result.awayRubbers,6);
    assert.strictEqual(result.homePoints+result.awayPoints,
      (result.winner===0?4:4)+6);
  }
  approx(counts[0]/n,projected.homeWin,.014);
  approx(counts[1]/n,projected.awayWin,.014);
  approx(counts[2]/n,projected.draw,.014);
  const tie=P.sampleRubber({label:'Singles 1',gameProbability:.5},{format:'rubbers',rng});
  assert.match(tie.score,/^\d+-\d+ \d+-\d+(?: \[\d+-\d+\])?$/);
}
console.log('prediction engine tests passed');
// Custom sections use their configured set lengths, match lengths and team scoring.
for(const targetGames of [4,6,8])for(const bestOf of [1,3]){
  const rows=P.matchDistribution(.63,{targetGames,bestOf});approx(rows.reduce((n,r)=>n+r.probability,0),1,1e-10);approx(P.matchDistribution(.5,{targetGames,bestOf}).filter(r=>r.homeWin).reduce((n,r)=>n+r.probability,0),.5,1e-10);const mirror=P.matchDistribution(.37,{targetGames,bestOf});approx(rows.filter(r=>r.homeWin).reduce((n,r)=>n+r.probability,0)+mirror.filter(r=>r.homeWin).reduce((n,r)=>n+r.probability,0),1,1e-10);
  const won=P.sampleRubber({label:'Configured',gameProbability:1,bestOf,targetGames},{rng:()=>0});assert.equal(won.homeSets,bestOf===3?2:1);assert.equal(won.awaySets,0);assert.equal(won.homeGames,targetGames*(bestOf===3?2:1));assert.equal(won.awayGames,0);
}
approx(P.matchDistribution(.61,{bestOf:3,targetGames:6}).filter(r=>r.homeWin).reduce((n,r)=>n+r.probability,0),P.rubbersSinglesWin(.61),1e-10);
const customRubbers=[...Array.from({length:2},(_,i)=>({label:'Singles '+i,gameProbability:1,p:1,bestOf:3,targetGames:4})),...Array.from({length:3},(_,i)=>({label:'Doubles '+i,gameProbability:0,p:0,bestOf:1,targetGames:8}))];
const customTie=P.simulateTie(customRubbers,{custom:true,format:'rubbers',rng:()=>.5});assert.equal(customTie.homeRubbers,2);assert.equal(customTie.awayRubbers,3);assert.equal(customTie.homeSets,4);assert.equal(customTie.awaySets,3);assert.equal(customTie.winner,1);assert.equal(customTie.homePoints,5);assert.equal(customTie.awayPoints,3);
const setsTie=P.simulateTie(customRubbers,{custom:true,format:'sets',rng:()=>.5});assert.equal(setsTie.winner,-1);assert.equal(setsTie.homePoints,2);assert.equal(setsTie.awayPoints,7);
const configured=customRubbers.map(r=>({...r,scoreDistribution:P.matchDistribution(r.gameProbability,r)})),projected=P.teamOutcome(configured,{setWinsDecideTies:true,gamesDecideTies:true});assert.equal(projected.homeWin,1);assert.equal(projected.awayWin,0);
console.log('Custom match counts, 4/6/8-game sets, best-of-three distributions, simulation and set-based team scoring: passed');
