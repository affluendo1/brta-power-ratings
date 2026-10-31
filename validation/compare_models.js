/* Diagnostic only: no hyperparameter selection or tuning on these outcomes.
 * Usage: node validation/compare_models.js data/site/sections/UA009.json
 */
'use strict';
const fs=require('node:fs'),M=require('../web/models/rm4'),E=require('../web/models/rm4-engine'),Scores=require('../web/models/score-formats'),bundle=require('../web/models/rm4-frozen.json');
function evaluate(data){
 data=Scores.normalise(data);
 const all=E.prepare(data).filter(m=>m.date),records=[],models=['RM3','RM3b','RM4a','RM4b','RM4.1 Ensemble'],cache=new Map();
 function fitsFor(past){const key=past.map(m=>m.fixtureId+':'+m.type+':'+m.position).join('|');if(!cache.has(key))cache.set(key,Object.fromEntries(models.slice(0,4).map(name=>[name,M.fit(past,name,{covariance:false})])));return cache.get(key)}
 for(const round of [...new Set(all.map(m=>m.round))].sort((a,b)=>a-b)){
  const targets=all.filter(m=>m.round===round&&m.type==='Singles');
  for(const date of [...new Set(targets.map(m=>m.date))]){
   const past=all.filter(m=>m.round<round&&m.date<date);
   if(new Set(past.map(m=>m.round)).size<3)continue;
   const fits=fitsFor(past),state={fits,matches:past.map(m=>({...m})),elo:M.elo(past)};
   for(const m of state.matches){const earlier=past.filter(r=>r.round<m.round&&r.date<m.date);if(new Set(earlier.map(r=>r.round)).size<3)continue;const fit=fitsFor(earlier).RM4b;m.preProbability=M.sigmoid(bundle.baseAlpha*M.logit(M.win(M.gap(fit,m),{target:m.target,green:m.green,bestOf:m.bestOf,matchTiebreak:m.matchTiebreak})))}
   for(const m of targets.filter(m=>m.date===date)){
    // Common support: both singles players must already have played a singles match.
    if(![...m.home,...m.away].every(p=>past.some(r=>r.type==='Singles'&&(r.home.includes(p)||r.away.includes(p)))))continue;
    records.push({round,date,y:Number(m.winner==='home'),probabilities:Object.fromEntries(models.map(model=>[model,M.forecast(state,m,bundle,model).p]))});
   }
  }
 }
 const metrics=Object.fromEntries(models.map(model=>{let loss=0,brier=0,correct=0;for(const r of records){const p=Math.min(1-1e-12,Math.max(1e-12,r.probabilities[model]));loss-=r.y*Math.log(p)+(1-r.y)*Math.log(1-p);brier+=(p-r.y)**2;correct+=Number((p>=.5)===!!r.y)}return[model,{n:records.length,correct,accuracy:correct/records.length,logLoss:loss/records.length,brier:brier/records.length}]}));
 return {section:data.meta.section_code,label:data.meta.section_label,firstRound:records[0]?.round,lastRound:records.at(-1)?.round,metrics};
}
if(require.main===module){const files=process.argv.slice(2);if(!files.length)throw Error('Pass section JSON files.');console.log(JSON.stringify({purpose:'Round-frozen diagnostic on already inspected data; not a new untouched holdout. No model tuning.',support:'Singles with both players previously seen in singles, at least three earlier rounds; strictly earlier round AND date. All models use identical targets.',sections:files.map(f=>evaluate(JSON.parse(fs.readFileSync(f,'utf8'))))},null,2))}
module.exports={evaluate};
