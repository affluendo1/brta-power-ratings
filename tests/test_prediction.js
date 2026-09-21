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
  assert.ok(!green.some(row=>Math.abs(row.margin)===2&&row.probability>0&&row.homeWin),'Green Ball must not add 7-5 continuation paths');
  approx(green.reduce((sum,row)=>sum+row.probability,0),1,1e-12);
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
console.log('prediction engine tests passed');
