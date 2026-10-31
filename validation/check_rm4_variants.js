/* Predeclared small changes. Earlier rounds select; later rounds only assess.
 * No player-specific objectives. This is a diagnostic on inspected seasons,
 * not a replacement for fresh prospective validation or Ensemble retraining.
 */
'use strict';
const fs=require('node:fs'),M=require('../web/models/rm4'),E=require('../web/models/rm4-engine'),S=require('../web/models/score-formats'),bundle=require('../web/models/rm4-frozen.json');
const variants={RM4a:{...M.config.RM4a},'RM4a · weaker coupling':{...M.config.RM4a,rho:.65},'RM4a · lower shrinkage':{...M.config.RM4a,l2:5},RM4b:{...M.config.RM4b},'RM4b · weaker coupling':{...M.config.RM4b,rho:.9},'RM4b · higher shrinkage':{...M.config.RM4b,l2:3.5}};
Object.assign(M.config,variants);
const rows=[];
for(const filename of process.argv.slice(2)){
 const d=S.normalise(JSON.parse(fs.readFileSync(filename,'utf8'))),all=E.prepare(d).filter(m=>m.date);
 for(const round of [...new Set(all.map(m=>m.round))].filter(r=>r>=4).sort((a,b)=>a-b)){
  const targets=all.filter(m=>m.round===round);
  for(const date of [...new Set(targets.map(m=>m.date))]){
   const past=all.filter(m=>m.round<round&&m.date<date);if(new Set(past.map(m=>m.round)).size<3)continue;
   const fits=Object.fromEntries(Object.keys(variants).map(v=>[v,M.fit(past,v,{covariance:false})]));
   for(const m of targets.filter(m=>m.date===date)){
    if(![...m.home,...m.away].every(p=>past.some(r=>r.type===m.type&&(r.home.includes(p)||r.away.includes(p)))))continue;
    const probabilities={};for(const [name,fit]of Object.entries(fits)){const raw=M.win(M.gap(fit,m),{target:m.target,green:m.green,bestOf:m.bestOf,matchTiebreak:m.matchTiebreak,native:true}),alpha=name.startsWith('RM4a')?.8469338499344126:bundle.ensemble.temperatures.RM4b;probabilities[name]=M.sigmoid(alpha*M.logit(raw))}
    rows.push({section:d.meta.section_code,format:d.format,round,type:m.type,y:Number(m.winner==='home'),probabilities});
   }
  }
 }
}
function metrics(rows,name){let loss=0,brier=0,correct=0;for(const r of rows){const p=r.probabilities[name];loss-=r.y*Math.log(p)+(1-r.y)*Math.log1p(-p);brier+=(p-r.y)**2;correct+=Number((p>=.5)===!!r.y)}return{n:rows.length,correct,logLoss:loss/rows.length,brier:brier/rows.length}}
const result={design:'Four small predeclared parameter alternatives; rounds 4–7 select, rounds 8+ assess; strictly earlier dates and rounds; common support within discipline. Frozen probability temperatures retained. No player-specific targets. Already-inspected seasons, not untouched evidence.',variants,cohorts:{}};
for(const [label,filter]of Object.entries({early:r=>r.round<=7,later:r=>r.round>=8,laterSingles:r=>r.round>=8&&r.type==='Singles',laterDoubles:r=>r.round>=8&&r.type==='Doubles',laterSets:r=>r.round>=8&&r.format==='sets',laterRubbers:r=>r.round>=8&&r.format==='rubbers'}))result.cohorts[label]=Object.fromEntries(Object.keys(variants).map(name=>[name,metrics(rows.filter(filter),name)]));
result.sections=[...new Set(rows.map(r=>r.section))];
for(const core of ['RM4a','RM4b']){const options=Object.keys(variants).filter(n=>n.startsWith(core)),selected=options.sort((a,b)=>result.cohorts.early[a].logLoss-result.cohorts.early[b].logLoss)[0];result[core]={selectedOnEarlierRounds:selected,laterLogLossDifference:result.cohorts.later[selected].logLoss-result.cohorts.later[core].logLoss,laterCorrectDifference:result.cohorts.later[selected].correct-result.cohorts.later[core].correct}}
console.log(JSON.stringify(result,null,2));
