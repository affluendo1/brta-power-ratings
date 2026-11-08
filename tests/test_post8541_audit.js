'use strict';
const assert=require('node:assert/strict');
const Model=require('../web/models/custom-section-model.js');
const O=require('../web/models/orchestra.js');
const bundle=require('../web/models/orchestra-bundle.json');
const frozen=require('../web/models/rm4-frozen.json');
const history=require('../web/models/orchestra-history.json');
const {sample}=require('./test_custom_sections.js');
const local=sample();
local.ratingModel='4melody.2';local.format='rubbers';
local.setTarget=6;local.doublesTarget=8;local.singlesBestOf=3;local.doublesBestOf=1;
for(const round of local.rounds)for(const fixture of round.fixtures)for(const match of fixture.rubbers){
 match.sets=match.type==='Singles'?[{h:6,a:2,mt:false},{h:6,a:3,mt:false}]:[{h:8,a:6,mt:false}];
}
Model.validate(local);
const data=Model.build(local);
assert.equal(data.meta.competition_code,'LOCAL');
assert.equal(data.meta.is_custom,true);
for(const model of ['4melody.2','4foundation.2']){
 const fitted=O.recalculate(data,model,bundle,frozen,history);
 assert.equal(fitted.meta.ratingModel,model);
 assert.equal(fitted.meta.predictionModel,'4.2 Orchestra');
 assert(fitted.orchestra,'The junior specialist must fit locally, not fall back to RM4.2');
 assert.equal(fitted.orchestra.history,null);
 assert(fitted.orchestra.matches.some(m=>m.type==='Singles'&&m.bestOf===3&&m.target===6));
 assert(fitted.orchestra.matches.some(m=>m.type==='Doubles'&&m.bestOf===1&&m.target===8));
 const prediction=O.forecast(fitted.orchestra,{type:'Singles',home:['Alice'],away:['Bob'],date:'2026-11-12',round:6,target:6,bestOf:3,matchTiebreak:true},bundle,frozen);
 assert.equal(prediction.profile,'junior.rubbers','LOCAL junior scoring must use the junior router');
}
const broken=JSON.parse(JSON.stringify(data));broken.meta.customRules.doublesTarget=4;
assert.throws(()=>O.recalculate(broken,'4melody.2',bundle,frozen,history),/does not support|Choose RM4\.2/,'Unsupported custom formats must produce an explicit error');
console.log('Post-release Junior Rubbers custom Melody/Foundation routing and unsupported-format guard: passed');
