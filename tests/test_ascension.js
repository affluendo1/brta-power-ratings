'use strict';
const assert=require('node:assert/strict'),E=require('../web/models/rm4-engine'),M=require('../web/models/rm4'),bundle=require('../web/models/rm4-frozen.json');
const data=require('../data/site/sections/UA009.json'),before=JSON.stringify(data),original=E.recalculate(data,'RM4.1 Ensemble',bundle),joke=E.ascension(data,bundle),base=E.display(original),shown=E.display(joke);
assert.equal(shown.meta.noveltyModel,true);assert.equal(shown.meta.ratingScale,base.meta.ratingScale);assert.equal(shown.meta.ratingCentre,2000);
const originalRatings=new Map(base.singles.map(r=>[r.player,r.rating]));for(const row of shown.singles){assert(Math.abs(row.rating+originalRatings.get(row.player)-4000)<=1);if(Number.isFinite(row.lo)&&Number.isFinite(row.hi))assert(row.lo<=row.hi)}
assert(shown.singles.every((r,i,a)=>!i||a[i-1].rating>=r.rating));
const target=E.prepare(data)[0],real=M.forecast(joke.rm4,target,bundle,'RM4.1 Ensemble'),fake=M.forecast(joke.rm4,target,bundle,'RM1000 Ascension');assert((real.p-.5)*(fake.p-.5)<=0);assert(Math.abs(fake.p-.5)>=Math.abs(real.p-.5)-1e-10);assert.equal(JSON.stringify(data),before);
console.log('Ascension: opt-in novelty, original spread, reversed ranking and deliberately inverted predictions passed.');
