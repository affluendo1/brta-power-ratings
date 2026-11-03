'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),test=require('node:test'),crypto=require('node:crypto');
const O=require('../web/models/orchestra'),J=require('../web/models/orchestra-fit'),M=require('../web/models/rm4'),E=require('../web/models/rm4-engine'),S=require('../web/models/score-formats'),L=require('../web/models/layout-model'),H=require('../web/models/rating-history'),b=require('../web/models/orchestra-bundle.json'),f=require('../web/models/rm4-frozen.json'),history=require('../web/models/orchestra-history.json'),Worker=require('./fixtures/rating-worker.cjs');
const data=S.normalise(JSON.parse(fs.readFileSync('data/site/sections/UA009.json'))),matches=E.prepare(data).map(m=>O.configured(data,m)),target={type:'Singles',home:[matches[0].home[0]],away:[matches[0].away[0]],date:'2026-11-08',round:13,target:6,bestOf:1,green:false,matchTiebreak:false,position:'Singles 1'};
const result=O.recalculate(data,'4.2 Orchestra',b,f,history);
test('new joint fitter preserves all four original calculations with zero prior and no parameter override',()=>{
 for(const name of ['RM3','RM3b','RM4a','RM4b'])for(const pairs of [false,true]){
  const sample=pairs?matches.filter(m=>m.type==='Doubles'):matches,a=J.fit(sample,name,{pairs}),ref=M.fit(sample,name,{pairs});
  assert.deepEqual(a,ref);
 }
});
test('new parameter overrides and native/composite mixture actually affect the fit',()=>{
 const a=O.fitDefinition(matches,b.definitions['Foundation 03 rho75']),r=M.fit(matches,'RM3',{covariance:false});assert.notDeepEqual(a.skills,r.skills);
 const m=O.fitDefinition(matches,b.definitions['Melody 01']);assert.notDeepEqual(m.skills,M.fit(matches,'RM4a',{covariance:false}).skills);
 const l2=J.fit(matches,'RM3',{covariance:false,parameters:{l2:50}});assert.notDeepEqual(l2.skills,r.skills);
});
test('Orchestra supplies every rating view and history without mutating source or changing records',()=>{
 const before=JSON.stringify(data),d=E.display(result);assert.equal(JSON.stringify(data),before);assert.equal(d.meta.predictionModel,'4.2 Orchestra');assert.equal(d.meta.doublesRatingModel,'4choir.2');assert.equal(d.meta.ratingCentre,2000);assert.equal(d.meta.ratingProbabilityScale,765);
 for(const [name,rows]of [['singles',d.singles],['doubles',d.doublesIndividuals],['pairs',d.doubles]]){assert(rows.length>0,name);assert(rows.every(r=>Number.isFinite(r.rating)&&Number.isFinite(r.se)));assert(rows.every((r,i)=>i===0||rows[i-1].rating>=r.rating))}
 assert(H.rowsAt(d,'overall').length>0);assert(Object.keys(d.ratingHistory.tables).length>1);assert.deepEqual(d.results,data.results);assert.deepEqual(d.standings,data.standings);
 const twice=E.display(d);assert.deepEqual(twice.singles,d.singles);assert.deepEqual(twice.orchestra,result.orchestra);
});
test('real worker imports the complete new engine and returns the same tables',async()=>{
 const w=new Worker(),value=await new Promise((resolve,reject)=>{w.onmessage=e=>e.data.error?reject(Error(e.data.error)):resolve(e.data.data);w.postMessage({data,model:'4.2 Orchestra',orchestraBundle:b,history})});w.terminate();assert.deepEqual(JSON.parse(JSON.stringify(value.singles)),result.singles);assert.equal(value.meta.orchestraVersion,b.version);
});
test('Baton produces repeatable forecasts and side reversal with separate discipline weights',()=>{
 const a=O.forecast(result.orchestra,target,b,f),again=O.forecast(result.orchestra,target,b,f),reverse=O.forecast(result.orchestra,{...target,home:target.away,away:target.home},b,f);assert.deepEqual(a,again);assert(Math.abs(a.p+reverse.p-1)<1e-10);if(a.engine==='4harmony.2')assert.deepEqual(a.weights,[.5,0,.25,.25]);else assert.equal(a.engine,'RM4a');
 const d=matches.find(m=>m.type==='Doubles'),m={...target,type:'Doubles',home:d.home,away:d.away};assert.deepEqual(O.forecast(result.orchestra,m,b,f).weights,[.75,0,.25,0]);
});
test('target/future contamination cannot change an earlier forecast or rating-history prefix',()=>{
 const m={...target,date:matches.find(r=>r.round===5).date,round:5},expected=O.forecast(result.orchestra,m,b,f);
 const contaminated=structuredClone(result.orchestra);for(const r of contaminated.matches)if(r.round>=5||r.date>=m.date){[r.hg,r.ag]=[r.ag,r.hg];r.winner=r.winner==='home'?'away':'home';for(const e of r.events){[e.h,e.a]=[e.a,e.h];e.winner=e.winner==='home'?'away':'home'}}
 assert.deepEqual(O.forecast(contaminated,m,b,f),expected);
 const later=structuredClone(data);for(const g of later.results)if(+g.round>3)for(const f of g.fixtures)for(const r of f.rubbers||[]){r.score='6-0';r.winner=r.home}
 const rebuilt=O.recalculate(S.normalise(later),'4.2 Orchestra',b,f,history);assert.deepEqual(rebuilt.ratingHistory.tables[3],result.ratingHistory.tables[3]);
});
test('partly linked history is capped, missing/abbreviated names are not guessed, and invalid snapshots are rejected',()=>{
 assert(!O.eligibleName('J Smith'));assert(!O.eligibleName('[unnamed player — 3]'));assert(O.eligibleName('Jayden Bone'));
 const state=structuredClone(result.orchestra);state.history={competition:'UA',cutoffExclusive:'2026-01-01',latestHistoryDate:'2025-12-01',players:{Singles:{[O.nameKey(target.home[0])]:{skill:1,count:12}},Doubles:{}}};
 const out=O.forecast(state,target,{...b,guard:null},f);assert(out.partial);assert.equal(out.historyCap,.5);assert.equal(out.linked,1);
 const bad=structuredClone(history);bad.seasons[data.meta.season_id].latestHistoryDate='2099-01-01';assert.equal(O.snapshot(data,bad),null);
 const all=O.forecast({...state,history:null},target,b,f);assert(!all.historyUsed);
});
test('outcome fields, invalid dates, duplicate players and corrupt policies are rejected',()=>{
 for(const extra of [{winner:'home'},{y:1},{hg:6},{date:'2026-02-31'},{home:target.away}])assert.throws(()=>O.forecast(result.orchestra,{...target,...extra},b,f));
 const bad=structuredClone(b);bad.schema=0;assert.throws(()=>O.forecast(result.orchestra,target,bad,f));
});
test('known weak specialist contexts delegate exact original probabilities',()=>{
 for(const profile of ['sets.green','junior.rubbers']){const row={experience:4,baseline:{RM4a:.63,RM4b:.59}},out=O.route(row,{type:'Doubles'},profile,b,'4.2 Orchestra',undefined,f);assert.equal(out.p,.63);assert.equal(out.engine,'RM4a');assert.equal(out.fallback,'Frozen context delegation')}
 const out=O.route({experience:2,baseline:{RM4b:.58}},{type:'Singles',target:4,bestOf:1},'adult.extended-set',b,'4.2 Orchestra',undefined,f);assert.equal(out.p,.58);assert.equal(out.engine,'RM4b');
});
test('score shapes preserve routed winner mass and use original latent gap on delegation',()=>{
 const decision=O.forecast(result.orchestra,target,b,f),dist=O.distribution(result.orchestra,target,{...decision,partial:true},b,f);assert.equal(dist.engine,'RM4b');assert(Math.abs(dist.rows.reduce((s,r)=>s+r.probability,0)-1)<1e-10);assert(Math.abs(dist.rows.filter(r=>r.homeWin).reduce((s,r)=>s+r.probability,0)-decision.p)<1e-10);
 assert(dist.rows.every(r=>Number.isFinite(r.probability)&&r.probability>=0));
});
test('all named models are selectable, and unsupported specialists preserve the fallback',()=>{
 assert.equal(O.choices.length,9);for(const name of O.choices){assert(O.isModel(name));const r=O.recalculate(data,name,b,f,null);assert.equal(r.meta.modelChoice,name);const p=O.forecast(r.orchestra,target,b,f);assert(Number.isFinite(p.p));if(['4brass.2','4strings.2','4percussion.2','4woodwind.2'].includes(name))assert.equal(p.engine,'RM4b')}
});
test('section exports preserve chosen model and displayed rating rows',()=>{
 const d=E.display(result),html=L.report(d,H);assert(html.includes('4.2 Orchestra'));assert(html.includes(d.singles[0].player));assert(html.includes(String(d.singles[0].rating)));
});
