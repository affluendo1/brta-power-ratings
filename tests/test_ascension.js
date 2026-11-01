'use strict';
const assert=require('node:assert/strict'),E=require('../web/models/rm4-engine'),M=require('../web/models/rm4'),bundle=require('../web/models/rm4-frozen.json');
const data=require('../data/site/sections/UA009.json'),before=JSON.stringify(data),original=E.recalculate(data,'RM4.1 Ensemble',bundle),joke=E.ascension(data,bundle),base=E.display(original),shown=E.display(joke);
assert.equal(shown.meta.noveltyModel,true);assert.equal(shown.meta.ratingScale,base.meta.ratingScale);assert.equal(shown.meta.ratingCentre,2000);
const natural=base.singles.map(r=>r.player),chaos=shown.singles.map(r=>r.player);assert.notDeepEqual(chaos,natural);assert.notDeepEqual(chaos,[...natural].reverse());assert(shown.singles.every((r,i,a)=>!i||a[i-1].rating>=r.rating));
const t=E.prepare(data)[0],p=M.forecast(joke.rm4,t,bundle,'RM1000 Ascension'),flip=M.forecast(joke.rm4,{...t,home:t.away,away:t.home},bundle,'RM1000 Ascension');assert(Math.abs(p.p+flip.p-1)<1e-10);assert.deepEqual(p,M.forecast(joke.rm4,t,bundle,'RM1000 Ascension'));assert.equal(JSON.stringify(data),before);console.log('Ascension: deterministic scrambled rankings, scale, side symmetry and input isolation passed.');
