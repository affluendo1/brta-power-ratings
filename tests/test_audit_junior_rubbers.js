'use strict';
const assert=require('node:assert/strict');
const O=require('../web/models/orchestra');
const S=require('../web/models/score-formats');
const bundle=require('../web/models/orchestra-bundle.json');
const E=require('../web/models/rm4-engine');
const frozen=require('../web/models/rm4-frozen.json');
const history=require('../web/models/orchestra-history.json');
const original=S.normalise(require('../data/site/sections/UA001.json'));
const source=JSON.stringify(original);
const data=structuredClone(original);
data.meta={...data.meta,competition_code:'LOCAL',is_custom:true,customRules:{
 singlesSlots:2,doublesSlots:1,setTarget:6,doublesTarget:8,singlesBestOf:3,doublesBestOf:1
}};
const signatures=new Set(bundle.formatRouting.allowedSignatures);
for(const m of E.prepare(data).slice(0,15)){
 const configured=O.configured(data,m);
 assert.equal(O.profile(data,configured),'junior.rubbers','LOCAL must route using the recognised scoring contract');
 const signature=[O.profile(data,configured),configured.type,configured.target,configured.bestOf,Number(configured.bestOf===3&&!!configured.matchTiebreak),Number(!!configured.green)].join('|');
 assert(signatures.has(signature),'A compatible custom Junior Rubbers match must have a frozen signature: '+signature);
}
const single=O.configured(data,{type:'Singles',target:6,bestOf:3});
const double=O.configured(data,{type:'Doubles',target:8,bestOf:1});
assert.equal(O.profile(data,single),'junior.rubbers');
assert.equal(O.profile(data,double),'junior.rubbers');
for(const engine of ['4melody.2','4foundation.2']){
 const fitted=O.recalculate(data,engine,bundle,frozen,history);
 assert.equal(fitted.meta.ratingModel,engine);
 assert.equal(fitted.meta.predictionModel,'4.2 Orchestra');
 assert(fitted.orchestra,'Custom specialist fit must be active');
 assert.equal(fitted.orchestra.history,null,'Custom specialists must not borrow historical priors');
}
const unsupported=structuredClone(data);
unsupported.meta.customRules={...unsupported.meta.customRules,doublesTarget:6};
assert.notEqual(O.profile(unsupported,O.configured(unsupported,double)),'junior.rubbers');
assert.throws(()=>O.recalculate(unsupported,'4melody.2',bundle,frozen,history),/does not support this scoring format/);
assert.equal(JSON.stringify(original),source,'Custom fitting must not mutate the original');
console.log('Post-release audit: LOCAL Junior Rubbers frozen routing, Melody/Foundation and no-prior checks passed');
