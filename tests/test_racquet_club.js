'use strict';
const assert = require('node:assert/strict');
const M = require('../web/models/racquet-club');
const odds = M.probabilities();
assert.equal(M.racquets.length,60);
assert.equal(new Set(M.racquets.map(r=>r.id)).size,60);
assert.equal(M.racquets.filter(r=>r.parent).length,9);
assert.equal(M.racquets.filter(r=>r.parent && !M.racquet(r.parent)).length,0);
assert(odds.every(p=>Number.isFinite(p)&&p>0));

// Use a common denominator to check the underlying fractions exactly.
const denominators = M.racquets.slice(1).map(r=>BigInt(r.denominator));
const whole = denominators.reduce((a,b)=>a*b,1n);
const tails = denominators.map(x=>whole/x);
const remainder = whole-tails.reduce((a,b)=>a+b,0n);
assert.equal([remainder,...tails].reduce((a,b)=>a+b,0n),whole);
assert(Math.abs(Number(remainder)/Number(whole)-odds[0])<1e-14);
assert(Math.abs(odds.reduce((a,b)=>a+b,0)-1)<1e-14);
let before=0;
for(const r of M.racquets){
  assert.equal(M.pick(odds,before+odds[r.id-1]/2).id,r.id);
  before+=odds[r.id-1];
}
let seed=12345;
const sampleSize=500000,sample=Array(8).fill(0);
for(let i=0;i<sampleSize;i++){
  seed=(Math.imul(1664525,seed)+1013904223)>>>0;
  sample[M.pick(odds,seed/2**32).tier]++;
}
M.tiers.forEach((_,tier)=>{
  const expected=M.racquets.filter(r=>r.tier===tier).reduce((n,r)=>n+r.base,0);
  assert(Math.abs(sample[tier]-sampleSize*expected)<6*Math.sqrt(sampleSize*expected*(1-expected))+2);
});
const state=M.initial();
assert.equal(M.spin(state,0,123),null);
const now=Date.parse('2026-11-14T00:00:00+11:00');
assert.equal(M.reward(state,'player','One',now),2);
assert.equal(M.reward(state,'player','Two',now+10),0);
assert.equal(M.reward(state,'player','One',now+2000),0);
assert.equal(M.reward(state,'player','One',now+86400000),2);
const capped=M.initial();
for(let i=0;i<20;i++){
  for(const kind of Object.keys(M.config.rewards)) M.reward(capped,kind,kind+i,now+10000*i);
}
assert.equal(capped.earned,M.config.dailyLimit);
state.balls=10;
for(let n=1;n<=10;n++){
  const last=M.spin(state,0,n);
  assert.equal(last.bonusSpin,n===10);
  assert.equal(last.effectiveLuck,n===10?2:1);
}
assert.equal(state.balls,0);
assert.equal(state.bonusSpins,1);
assert.equal(state.items[1].count,10);
state.items[1].locked=true;
assert.equal(M.sellDuplicates(state),0);
state.items[1].locked=false;
assert.equal(M.sellDuplicates(state),72);
assert.equal(state.items[1].count,1);
assert.equal(M.sell(state,1,1),8);
assert.equal(state.items[1].count,0);
assert.equal(state.items[1].pulled,10);
state.items[60]={count:1,pulled:1,first:1,last:1};
assert.equal(M.sell(state,60,1),0);
assert.equal(M.sell(state,60,1,true),120000);
assert.equal(M.buy(state,'gold'),false);
state.cash=500000;
for(const id of ['alu','prime','stopper','gold']) assert(M.buy(state,id,true));
assert.equal(M.buy(state,'alu',true),false);
assert(M.buy(state,'lynx',true));
assert(state.gear.alu);
assert(M.equip(state,'alu'));
state.spins=19;
const next=M.next(JSON.parse(JSON.stringify(state)));
assert.equal(next.effectiveLuck,20);
assert.equal(next.duration,2.5);
assert.equal(next.mutation,1.1);
const boosted=M.probabilities(next.effectiveLuck,next.mutation);
assert(boosted[59]>odds[59]);
assert(Math.abs(boosted.reduce((a,b)=>a+b,0)-1)<1e-14);
console.log('Racquet Club catalog, exact odds, 500,000 sample spins, rewards, sales, gear and bonus spins passed.');
