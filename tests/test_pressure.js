const assert=require('node:assert/strict');
global.BRTAHistory=require('../web/models/rating-history');
const S=require('../web/models/score-formats'),L=require('../web/models/lab-model'),M=require('../web/models/custom-section-model'),Layout=require('../web/models/layout-model');
const meta={competition_code:'UA',season_label:'Spring 2026',format:'rubbers'};
assert.equal(S.format(S.parse('6-4 3-6 6-7',{outcomeCode:S.outcomeCode(meta)})),'6-4 3-6 [TB L]');
assert.equal(S.flip('6-4 3-6 [TB W]'),'4-6 6-3 [TB L]');
assert.equal(S.parse('6-4 3-6 7-6').at(-1).mt,false);
assert.equal(S.parse('6-4 3-6 22-20').at(-1).mt,true);
assert.equal(S.doublesOnly({meta:{customRules:{singlesSlots:0,doublesSlots:3}}}),true);
const d={meta,format:'rubbers',singles:[],doubles:[],doublesIndividuals:[],results:[{round:1,fixtures:[{fixtureId:'r1',home:'A',away:'B',rubbers:[{type:'Singles',home:'Alice',away:'Bob',winner:'Alice',score:'3-6 7-5 [TB W]',position:1}]}]},{round:2,fixtures:[{fixtureId:'r2',home:'A',away:'B',rubbers:[{type:'Singles',home:'Alice',away:'Bob',winner:'Bob',score:'7-6 4-6 [10-12]',position:1}]}]}]};
let matches=L.matches(d,'Alice'),p=L.pressure(matches);
assert.deepEqual(p.afterFirstLost,{wins:1,losses:0,total:1});assert.deepEqual(p.afterFirstWon,{wins:0,losses:1,total:1});assert.deepEqual(p.matchTiebreaks,{wins:1,losses:1,total:2});assert.equal(p.unknownTiebreaks,1);assert.deepEqual(p.closeSets,{wins:2,losses:1,total:3});assert.deepEqual(p.fromFiveAll,{wins:2,losses:0,total:2});assert.deepEqual(p.setTiebreaks,{wins:1,losses:0,total:1});
assert.equal(L.matches(d,'Alice','singles',1).length,1);assert.equal(L.pressure(L.matches(d,'Alice','singles',1)).afterFirstLost.total,1);
assert.equal(L.matches(d,'Bob')[0].score,'6-3 5-7 [TB L]');assert.equal(L.matches(d,'Bob')[0].sets.at(-1).winner,'away');
const o=Layout.observations(d)[0];assert.equal(o.hg,10);assert.equal(o.ag,11);assert.equal(o.hs,2);assert.equal(o.as,1);assert.deepEqual(M.ratingEvidence(o),{home:11,away:11});assert.deepEqual(M.ratingEvidence(o,'V3B'),{home:20,away:13});
const straight={won:true,multiSet:true,sets:S.parse('6-4 6-2')};assert.deepEqual(L.pressure([straight]).straightSets,{wins:1,losses:0,total:1});
console.log('Typed score orientation, outcome-only deciders, bounded RM3/RM3b evidence, comeback/close/tiebreak records and historical cutoffs passed.');

assert.deepEqual(M.ratingEvidence(o,'V3',{matchTiebreakWeight:0}),{home:10,away:11});assert.throws(()=>M.ratingEvidence(o,'V3',{matchTiebreakWeight:-1}),/weight/);assert.throws(()=>M.ratingEvidence(o,'V3',{matchTiebreakMode:'invent'}),/outcome/);

assert.deepEqual(L.pressure([{won:true,sets:S.parse('6-5')}]).fromFiveAll,{wins:1,losses:0,total:1});
