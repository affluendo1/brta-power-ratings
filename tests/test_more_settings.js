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
for(const duration of [40000,50000,60000]){const plan=M.progressPlan(duration);assert.equal(plan.at(-1).at,duration);assert.equal(plan.at(-1).value,100);for(let i=1;i<plan.length;i++){assert(plan[i].at>=plan[i-1].at);assert(plan[i].value>=plan[i-1].value);}assert(plan[5].at-plan[4].at<=2000);assert(duration-plan[5].at>=10000);}
assert.equal(M.confirmations.length,9);
assert.equal(M.confirmations[2].phrase,'I CONFIRM');
assert.equal(M.confirmations[6].phrase,'I will confirm, regardless of the suffering homeless children.');
assert.equal(M.confirmations[7].yes,'I CONFIRM');
assert.equal(M.confirmations[8].yes,'OKAY');
console.log('More Settings: translation, names, preserved entry phrase, pressure bounds, shuffle permutations and confirmation sequence passed.');
