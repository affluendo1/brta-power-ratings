const assert=require('assert'),fs=require('fs'),vm=require('vm');
const M=require('../web/optional/orthography.js');
for(const name of ['Anne Anne / Anne Anne','Ashleigh Lee / Anna Brown','李 明 / José Silva']){
 const a=M.analysePair(name);
 assert.equal(a.score,a.members.reduce((n,m)=>n+m.score,0));
 assert.equal(a.score,a.parts.reduce((n,p)=>n+p.points,0));
 assert.equal(a.grossScore-a.penaltyPoints,a.score);
 assert(!('composition' in a),'Pair must not masquerade as a combined-name analysis');
 for(const m of a.members){assert.equal(m.score,M.analyse(m.name).score);assert.deepEqual(m.composition,M.analyse(m.name).composition)}
 assert.equal(a.quadgraphs.reduce((n,p)=>n+p.points,0),a.parts.filter(p=>p.key==='quadgraphs').reduce((n,p)=>n+p.points,0));
}
const rows=M.rank([{player:'Zane / Bob',team:'A'},{player:'Bob / Zane',team:'B'},{player:'Al / Al',team:'C'}],M.analysePair);
assert.equal(rows[0].rank,1);assert.equal(rows[1].rank,1);assert.equal(rows[2].rank,3);
assert.equal(M.highest(rows).length,2);
assert.equal(M.rank(rows,M.analysePair).find(r=>r.team==='B').rank,1,'Lab and table use the same tie ranking');
for(const scope of ['section','all','history'])assert.equal(M.pairScope(scope),'section');
// Exercise actual optional-view wiring without an external DOM dependency.
const scopes=['section','all','history'].map(searchScope=>({dataset:{searchScope}}));
let contextmenu;
const tabs={addEventListener(type,fn){contextmenu=fn}};
const pairTab={after(){}};
const box={window:{BRTAOrthography:M,addEventListener(){}},ratingView:'orthographicPairs',ratingScope:'all',ratingInfo:{},activePage:'ratings',auxiliaryEnabled:()=>true,renderRatings(){},renderRatingOptions(){},eightMethodologyHTML:()=>'',applyProfilePosition(){},document:{addEventListener(){},createElement:()=>({dataset:{},animate:()=>({finished:Promise.resolve()})})},$:s=>s==='#ratingTabs'?tabs:s==='#ratingTabs [data-rating="pairs"]'?pairTab:null,$$:()=>scopes};
vm.createContext(box);vm.runInContext(fs.readFileSync(require.resolve('../web/optional/lexicon.js'),'utf8'),box);
box.renderRatingOptions();assert.equal(box.ratingScope,'section');assert(scopes[1].disabled&&scopes[2].disabled);assert(!scopes[0].disabled);
contextmenu({target:{closest:s=>s==='[data-rating="pairs"]'?{}:null},preventDefault(){}});
assert(box.eightMethodologyHTML().includes('Doubles pairs.'),'Pair-first reveal must expose methodology');
box.ratingView='singles';box.renderRatingOptions();assert(scopes.every(b=>!b.disabled),'Normal scopes must be restored');
console.log('Pair regressions: independent totals/composition, quadgraphs, ties, highest-score, honest scopes, pair-first methodology and scope restoration passed');
