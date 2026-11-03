'use strict';
// Operational release audit, not a forecast-accuracy assessment.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../../../..'),read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const O=require(root+'/web/models/orchestra'),E=require(root+'/web/models/rm4-engine'),S=require(root+'/web/models/score-formats');
const bundle=read('web/models/orchestra-bundle.json'),frozen=read('web/models/rm4-frozen.json'),history=read('web/models/orchestra-history.json');
const report={purpose:'Operational checks only; no predictive superiority claim',version:bundle.version,sections:[],ratingRows:0,singlesHistoryRows:0,scoreRows:0,forecasts:0,historyLinkedAppearances:0,historyCandidateAppearances:0};
for(const entry of read('data/current/catalog.json').sections){
 const data=S.normalise(read('data/site/sections/'+entry.section_code+'.json')),start=performance.now(),before=JSON.stringify(data);
 const result=O.recalculate(data,'4.2 Orchestra',bundle,frozen,history),display=E.display(result),state=result.orchestra;
 assert.equal(JSON.stringify(data),before);assert.deepEqual(result.results,data.results);assert.deepEqual(result.standings,data.standings);
 const tables=[display.singles,display.doublesIndividuals,display.doubles];
 for(const table of tables){assert(table.every(r=>Number.isFinite(r.rating)&&Number.isFinite(r.se)));assert(table.every((r,i)=>!i||table[i-1].rating>=r.rating));report.ratingRows+=table.length}
 let sectionHistoryRows=0;
 for(const table of Object.values(display.ratingHistory.tables)){assert(table.every(r=>Number.isFinite(r.rating)&&Number.isFinite(r.se)));sectionHistoryRows+=table.length}
 report.singlesHistoryRows+=sectionHistoryRows;
 const links={};for(const type of ['Singles','Doubles']){
  const names=[...new Set(state.matches.filter(m=>m.type===type).flatMap(m=>[...m.home,...m.away]))];
  links[type]={candidates:names.length,linked:names.filter(n=>O.eligibleName(n)&&state.history?.players?.[type]?.[O.nameKey(n)]).length};
  if(state.history){report.historyCandidateAppearances+=names.length;report.historyLinkedAppearances+=links[type].linked}
 }
 const forecasts=[];
 for(const type of ['Singles','Doubles']){
  const sample=state.matches.find(m=>m.type===type);if(!sample)continue;
  const last=state.matches.map(m=>m.date).sort().at(-1),target={type,home:sample.home,away:sample.away,date:new Date(Date.parse(last)+86400000).toISOString().slice(0,10),round:Math.max(...state.matches.map(m=>m.round))+1};
  const decision=O.forecast(state,target,bundle,frozen),reverse=O.forecast(state,{...target,home:target.away,away:target.home},bundle,frozen);
  assert(Number.isFinite(decision.p)&&decision.p>=0&&decision.p<=1);assert(Math.abs(decision.p+reverse.p-1)<1e-9);
  const scores=O.distribution(state,target,decision,bundle,frozen).rows;
  assert(scores.every(r=>Number.isFinite(r.probability)&&r.probability>=0));assert(Math.abs(scores.reduce((s,r)=>s+r.probability,0)-1)<1e-9);
  assert(Math.abs(scores.filter(r=>r.homeWin).reduce((s,r)=>s+r.probability,0)-decision.p)<1e-9);
  report.scoreRows+=scores.length;report.forecasts++;forecasts.push({type,profile:decision.profile,engine:decision.engine,historyUsed:!!decision.historyUsed,linked:decision.linked||0,scoreRows:scores.length});
 }
 const item={section:entry.section_code,ratingRows:tables.reduce((s,t)=>s+t.length,0),singlesHistoryRows:sectionHistoryRows,history:!!state.history,links,forecasts,milliseconds:Math.round(performance.now()-start)};
 report.sections.push(item);console.log(entry.section_code,item.milliseconds+'ms',forecasts.map(r=>r.type+':'+r.engine).join(' '));
}
assert.equal(report.sections.length,79);
const destination=process.argv[2];if(destination){fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify({...report,sections:report.sections.length}));
