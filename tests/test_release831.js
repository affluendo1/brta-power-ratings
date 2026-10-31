'use strict';
const assert=require('node:assert/strict'),L=require('../web/models/layout-model'),E=require('../web/models/rm4-engine'),P=require('../web/models/prediction'),C=require('../web/models/custom-section-model');
const ranked=Array.from({length:43},(_,i)=>({player:'P'+i,rating:1100+i*22,qualified:true}));
const provisional={player:'New',rating:1660,qualified:false},a=L.bands(ranked,r=>r.qualified),b=L.bands([...ranked,provisional,{rating:9000,qualified:false}],r=>r.qualified);
assert.equal(a.names.length,8);assert.deepEqual(a.cuts,b.cuts);assert.equal(b.classFor(provisional.rating),b.classFor(1660));
assert.equal(a.classFor(a.cuts[0]),'b0');assert.equal(a.classFor(a.cuts.at(-1)-1),'b7');assert.equal(L.bands([{rating:1500},{rating:1500}]).classFor(1500),'b4');
assert.equal(L.bands([{rating:1700,qualified:false}],r=>r.qualified).bounds.length,8);
const transformed=L.bands(ranked.map(r=>({...r,rating:2000+1.7*(r.rating-1500)})));
for(const r of ranked)assert.equal(a.classFor(r.rating),transformed.classFor(2000+1.7*(r.rating-1500)));
const data={meta:{predictionModel:'RM4.1 Ensemble',ratingCentre:1500,ratingScale:450,ratingProbabilityScale:450},singles:[{player:'A',rating:1800,se:100,lo:1604,hi:1996,ratingChange:20},{player:'B',rating:1200,se:80}],doubles:[{rating:1650,individualAverage:1600,pairEffect:50}],ratingHistory:{players:{A:[[1,1700,100,4,'Red']]},tables:{1:[{rating:1700,se:100}]}},rm4:{fits:{RM4b:{skills:{Singles:{A:2/3,B:-2/3}}}}}};
const expanded=E.centre(data,2000);assert.equal(expanded.singles[0].rating,2510);assert.equal(expanded.singles[0].se,170);assert.equal(expanded.singles[0].ratingChange,34);assert.equal(expanded.doubles[0].pairEffect,85);assert.deepEqual(expanded.ratingHistory.players.A[0].slice(1,3),[2340,170]);assert.equal(expanded.meta.ratingScale,765);assert.deepEqual(expanded.rm4,data.rm4);assert.deepEqual(E.centre(expanded,2000),expanded);
const lowered=E.centre(expanded,1500);assert.equal(lowered.singles[0].rating,2010);assert.equal(lowered.singles[0].se,170);assert.equal(lowered.meta.ratingScale,765);
const p=P.gameProbability(1800,1200),q=P.gameProbability(expanded.singles[0].rating,expanded.singles[1].rating,expanded.meta.ratingProbabilityScale);assert(Math.abs(p-q)<1e-12);
// Independent reference: original Python RM2 at commit 6388eeb, scipy L-BFGS-B.
const matches=[[1,'A','B',6,1],[2,'B','C',6,3],[3,'C','A',6,4],[4,'A','C',7,5],[5,'B','A',6,4],[6,'C','B',6,0]].map(([round,h,a,hg,ag])=>({round,date:'2026-09-0'+round,home:[h],away:[a],hg,ag,winner:'home',homeTeam:'Red',awayTeam:'Blue'}));
const original={A:1006.7518030005,B:963.618552991,C:1029.6296440085},legacy=C.fit(matches,false,false,'V2');
for(const row of legacy){assert.equal(row.rating,Math.round(original[row.player]+500));assert(Number.isFinite(row.se)&&row.se>0)}
const shifted=C.fit(matches.map(m=>({...m,round:m.round+20})),false,false,'V2');assert.deepEqual(legacy,shifted);
const old=E.centre({meta:{predictionModel:'RM2',ratingScale:250,ratingProbabilityScale:187.5},singles:legacy},2000);assert.equal(old.meta.ratingScale,250);assert.equal(old.singles[0].rating,legacy[0].rating+500);
console.log('8.3.1: eight robust bands, provisional boundaries, affine consistency, Ensemble units/history/uncertainty, unchanged probabilities, and original Python RM2 parity passed.');

for(const values of [[.526,.436,.038],[1/3,1/3,1/3],[1,0,0],[.499,.499,.002]]){const rounded=P.roundedChances(values);assert.equal(rounded.reduce((a,b)=>a+b),100);rounded.forEach((v,i)=>assert(Math.abs(v-100*values[i])<1))}
console.log('Displayed team chances add to 100% without changing model probabilities.');
