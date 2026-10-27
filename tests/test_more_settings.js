const assert=require('node:assert/strict');
const M=require('../more-settings-model');

assert.equal(M.translate('Sid Basa'),'Sid Basa');
assert.equal(M.translate('Find Sid Basa in 2026').includes('Sid Basa'),true);
assert.equal(M.translate('Siddharth R. Basa'),'Siddharth R. Basa');
assert(!/[0-9]/.test(M.translate('0 1 2 3 4 5 6 7 8 9')));
assert.equal(M.translate('Settings'),M.translate('Settings'));
assert.notEqual(M.translate('Settings'),'Settings');
assert.notEqual(M.translate('Jayden Bone',true),'Jayden Bone');
assert.equal(M.translate('Jayden Bone',true),M.name('Jayden Bone'));
// Names must change their spelling, rather than keeping the same letters with accents.
const formerGlyphs=[...'ąƀçđęƒģħįĵķłɱņøþզŗşŧųṽŵẋŷž'];
for(let i=0;i<26;i++)assert.notEqual(M.name(M.alphabet[i]),formerGlyphs[i]);
assert.notEqual(M.name(M.alphabet),[...M.alphabet].map(letter=>M.name(letter)).join(''));
assert.equal(M.name('Jayden Bone'),M.name('Jayden Bone'));
assert.equal(M.name('Jayden Bone').split(' ')[0],M.name('Jayden'));
assert.equal(M.name("O’Connor-Smith").match(/[’\-]/g).join(''),'’\-');
assert(!/[a-z0-9]/i.test(M.name('Élodie Łukasz 李明 123')));
assert.equal(M.translate('Sid Basa',true),'Sid Basa');
assert.equal(M.pressure(.001),.01);
assert.equal(M.pressure(0),.01);
assert.equal(M.pressure(2.001),2);
assert.equal(M.pressure(2.01),2.01);
assert.equal(M.pressure(999),2.01);
assert.equal(M.pressure(NaN),1);
assert(M.rates(.01).scroll<1&&M.rates(2.01).scroll>1);
assert(M.rates(.01).animation>.9&&M.rates(2.01).animation<1.1);
const original=[0,1,2,3,4];
for(let i=0;i<100;i++){const permutation=M.shuffled(original);assert.deepEqual(permutation.slice().sort(),original);}
assert.deepEqual(original,[0,1,2,3,4]);
// Every return takes the requested duration, progresses forward, and has a new cadence.
const plans=new Set();
for(const duration of [40000,50000,60000])for(let sample=0;sample<30;sample++){
  const plan=M.progressPlan(duration);plans.add(JSON.stringify(plan));
  assert.equal(plan[0].value,0);assert.equal(plan.at(-1).at,duration);assert.equal(plan.at(-1).value,100);
  assert(plan.length>=9&&plan.length<=16);
  for(let i=1;i<plan.length;i++){assert(plan[i].at>plan[i-1].at);assert(plan[i].value>=plan[i-1].value);if(i<plan.length-1)assert(plan[i].value<100);}
}
assert.equal(plans.size,90);
// Fifteen visual cups, but exactly one of each three equal random intervals wins.
assert.equal(M.cupWin(()=>0),true);assert.equal(M.cupWin(()=>1/3-Number.EPSILON),true);
assert.equal(M.cupWin(()=>1/3),false);assert.equal(M.cupWin(()=>.999999),false);
assert.equal(Array.from({length:1500},(_,i)=>M.cupWin(()=>(i+.5)/1500)).filter(Boolean).length,500);
const positions=new Set(Array.from({length:15},(_,i)=>JSON.stringify(M.cupPoint(i,1000,600))));assert.equal(positions.size,15);
const frames=M.cupPath(0,14,1000,600,()=>.8);
assert.equal(frames.length,13);assert.equal(frames[0].offset,0);assert.equal(frames.at(-1).offset,1);
const displacement=frame=>frame.transform.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
assert.deepEqual(displacement(frames[0]),[-800,-372]);assert(displacement(frames.at(-1)).every(n=>Math.abs(n)<1e-9));
const loop=M.cupPath(7,7,1000,600,()=>.8);assert(Math.abs(displacement(loop[6])[1])>200);
assert.notDeepEqual(M.cupPath(0,14,1000,600),M.cupPath(0,14,1000,600));
assert.equal(M.confirmations.length,9);
assert.equal(M.confirmations[2].phrase,'I CONFIRM');
assert.equal(M.confirmations[6].phrase,'I will confirm, regardless of the suffering homeless children.');
assert.equal(M.confirmations[7].yes,'I CONFIRM');
assert.equal(M.confirmations[8].yes,'OKAY');
console.log('More Settings: translation, names, preserved entry phrase, pressure bounds, shuffle permutations and confirmation sequence passed.');
