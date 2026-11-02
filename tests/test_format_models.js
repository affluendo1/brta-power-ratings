'use strict';
const assert=require('node:assert/strict'),M=require('../web/models/rm4'),I=require('../web/models/association-import'),F=require('../web/models/competition-formats'),bundle=require('../web/models/rm4-frozen.json');
const target={type:'Singles',home:['A'],away:['B'],date:'2026-02-08',round:2},contracts=[
 {mode:'bestOf',sets:1,regular:{target:8,winBy:2,tiebreakAt:7}},
 {mode:'bestOf',sets:3,regular:{target:8,winBy:2,tiebreakAt:8}},
 {mode:'bestOf',sets:3,regular:{target:6,winBy:2,tiebreakAt:6},decider:{kind:'set',target:8,winBy:2,tiebreakAt:7}},
 {mode:'bestOf',sets:3,regular:{target:4,winBy:2,tiebreakAt:3},decider:{kind:'matchTiebreak',target:7}},
 {mode:'fixedSets',sets:2,regular:{target:8,winBy:1,fixedGames:true}},
 {mode:'bestOf',sets:5,regular:{target:6,winBy:2}},
];
const historyRules={mode:'bestOf',sets:1,regular:{target:6,winBy:1}},history=[{...I.observation({discipline:'singles',home_players:['A'],away_players:['B'],score_components:[{home:6,away:1}]},historyRules),date:'2026-02-01',round:1}],state=I.fitModels(M,history,target);
for(const rules of contracts)for(const model of ['RM4a','RM4b','RM4.1 Ensemble']){
 const a=I.forecast(M,state,target,rules,model,bundle),b=I.forecast(M,state,{...target,home:['B'],away:['A']},rules,model,bundle);
 assert(Math.abs(a.homeWin+a.awayWin+a.draw-1)<1e-10);assert(Math.abs(a.homeWin-b.awayWin)<1e-10);assert(a.homeWin>a.awayWin);assert.equal(a.model,model);
 if(model==='RM4.1 Ensemble'){assert.deepEqual(a.excludedComponents,['ML_transfer']);assert(!a.components.ML_transfer);assert(Math.abs(Object.values(a.components).reduce((s,x)=>s+x.weight,0)-1)<1e-10)}
 if(rules.regular.tiebreakAt!=null||rules.regular.fixedGames){const d=F.matchDistribution(rules,{gameProbability:M.sigmoid(a.eta),setTiebreakProbability:M.tb(.4*a.eta).probability,matchTiebreakProbability:M.tb(.4*a.eta,rules.decider?.target||10).probability});assert(Math.abs(d.reduce((s,x)=>s+x.probability,0)-1)<1e-10)}
}
// Native 4a must recognize an 8–7 set's tiebreak as 7–7 games plus one point event.
const tiebreakRules={mode:'bestOf',sets:1,regular:{target:8,winBy:2,tiebreakAt:7}},m=I.observation({discipline:'singles',home_players:['A'],away_players:['B'],score_components:[{home:8,away:7}]},tiebreakRules),eta=.4,t=M.tb(.4*eta),sig=M.sigmoid(eta),expected=7*Math.log1p(Math.exp(-eta))+7*Math.log1p(Math.exp(eta))-Math.log(t.probability),actual=M.nativeEvidence(m,eta);assert(Math.abs(actual.loss-expected)<1e-10);
const eps=1e-5,gradient=(M.nativeEvidence(m,eta+eps).loss-M.nativeEvidence(m,eta-eps).loss)/(2*eps);assert(Math.abs(actual.gradient-gradient)<1e-6);
// Draws do not become losses or Elo away wins.
const drawRules={mode:'fixedSets',sets:1,regular:{target:8,winBy:1,fixedGames:true}},draw={...I.observation({discipline:'singles',home_players:['A'],away_players:['B'],score_components:[{home:4,away:4}]},drawRules),date:'2026-02-01',round:1};
for(const model of ['RM4a','RM4b']){const fit=M.fit([draw],model);assert(fit.singles.every(r=>r.losses===0&&r.draws===1));assert(Math.abs(M.gap(fit,target))<1e-10)}assert.deepEqual(M.elo([draw]),{'Singles:A':0,'Singles:B':0});
assert.throws(()=>I.forecast(M,state,target,contracts[0],'RM4.1 Ensemble'),/configuration/);
console.log('New-format RM4a/RM4b/Ensemble: six contracts, side reversal, draw mass, native gradient, explicit ML exclusion, frozen weights and original-core draw handling passed.');

const fixedForecast=I.forecast(M,state,target,contracts[4],'RM4.1 Ensemble',bundle),scores=M.distribution(fixedForecast.eta,{formatRules:contracts[4]},fixedForecast);for(const key of ['homeWin','awayWin','draw']){const mass=scores.filter(r=>key==='draw'?r.draw:key==='homeWin'?r.homeWin:!r.homeWin&&!r.draw).reduce((s,r)=>s+r.probability,0);assert(Math.abs(mass-fixedForecast[key])<1e-10)}
assert.throws(()=>I.forecast(M,state,{...target,date:'2026-02-01'},contracts[0],'RM4b',bundle),/cutoff/);
console.log('Explicit score distributions preserve calibrated win/away/draw mass; fit cutoff cannot be reused for an earlier target.');

assert.throws(()=>I.fitModels(M,[{...history[0],winner:'away'}],target),/Contradictory/);assert.throws(()=>I.fitModels(M,history,{...target,date:'2026-02-31'}),/cutoff/);

assert.throws(()=>I.fitModels(M,[{...history[0],events:history[0].events.map(e=>({...e,winner:'away'}))}],target),/Contradictory/);
