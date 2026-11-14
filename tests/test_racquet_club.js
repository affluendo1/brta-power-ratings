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

// Split-wheel totals and conditional odds reproduce the original model at any luck.
for (const [luck,mutation] of [[1,1],[50,1.8]]) {
  const weights=M.probabilities(luck,mutation), wheel=M.wheel(weights);
  assert.equal(wheel.length,27);
  assert(Math.abs(wheel.reduce((sum,entry)=>sum+entry.weight,0)-1)<1e-14);
  for(const entry of wheel.filter(x=>x.key)){
    const game=M.initial(), key=M.makeKey(game,entry.tier,weights,now);
    assert(Math.abs(key.weights.reduce((sum,r)=>sum+r.weight,0)-1)<1e-14);
    for(const r of key.weights) assert(Math.abs(entry.weight*r.weight-weights[r.id-1])<1e-15);
  }
}
const game=M.initial();
game.cash=1e6;
game.balls=2;
assert(M.buyFuel(game,'gel'));
assert(M.buyFuel(game,'gel'));
assert(M.craft(game,'match'));
assert.equal(game.fuel.gel,0);
assert(M.activate(game,'match',now));
const keyRoll=M.spin(game,.9999999,now);
assert.equal(keyRoll.tier,7);
assert.equal(keyRoll.key,true);
assert.equal(game.balls,1);
assert.equal(game.spins,1);
assert.equal(game.boosts.luck,undefined);
assert.equal(Object.keys(game.items).length,0);
const saved=JSON.parse(JSON.stringify(game));
const key=saved.keys[0];
assert.equal(key.acquired,now);
assert(Math.abs(key.weights[1].weight-3/7)<1e-14);
assert(M.buyFuel(saved,'training'));
assert(M.activate(saved,'training',now));
assert(M.buy(saved,'graphite',true));
const pull=M.redeem(saved,key.id,.99,now+60000);
assert.equal(pull.id,60);
assert.equal(pull.odds,key.weights[1].weight);
assert.equal(saved.balls,1);
assert.equal(saved.spins,1);
assert.equal(saved.boosts.luck.remaining,5);
assert.equal(M.redeem(saved,key.id,.99,now),null);
assert.equal(saved.keysRedeemed,1);
assert.equal(M.spin(saved,0,now).id,1);
assert.equal(saved.boosts.luck.remaining,4);
assert.equal(M.spin(saved,0,now),null);
assert.equal(saved.boosts.luck.remaining,4);
assert(M.buyFuel(saved,'electrolyte'));
assert.equal(M.activate(saved,'electrolyte',now),false);
assert(M.activate(saved,'electrolyte',now,true));
assert.equal(M.next(saved,now+599999).effectiveLuck,1.5);
assert.equal(M.next(saved,now+600000).effectiveLuck,1);
assert(M.buy(saved,'alu',true));
assert(M.buy(saved,'gold',true));
assert(M.buyFuel(saved,'slam'));
assert(M.activate(saved,'slam',now,true));
saved.spins=9;
assert.equal(M.next(saved,now).uncappedLuck,100);
assert.equal(M.next(saved,now).effectiveLuck,50);
assert(M.buyFuel(saved,'shake'));
assert(M.activate(saved,'shake',now));
assert.equal(M.sell(saved,60,1,true,now),150000);
assert.equal(saved.boosts.sale.remaining,2);

const cart=M.initial();
cart.cash=250000;
assert(M.buy(cart,'basket',true));
for(let i=0;i<5;i++) M.reward(cart,'tab','tab-'+i,now+3000*i);
assert.equal(cart.balls,6);
assert.equal(cart.ballRemainder,0);
assert.equal(M.reward(cart,'tab','tab-5',now+15000),0);
for(const [id,recipe] of Object.entries(M.recipes)){
  const total=recipe.fee+Object.entries(recipe.ingredients).reduce((sum,[ingredient,count])=>sum+M.fuelItem(ingredient).price*count,0);
  assert(total<M.fuelItem(id).price,id);
}
console.log('Key odds, durable snapshots, redemption, fuel crafting, expiry, sales and fractional earnings passed.');
