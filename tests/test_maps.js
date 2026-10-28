const assert=require('node:assert/strict'),M=require('../web/features/maps');
const url=new URL(M.mapURL({latitude:-37.81,longitude:144.96}));
assert.equal(url.origin,'https://www.openstreetmap.org');assert.equal(url.searchParams.get('marker'),'-37.81,144.96');assert.equal(url.searchParams.get('bbox').split(',').length,4);
for(const options of [{latitude:NaN,longitude:0},{latitude:0,longitude:181},{latitude:0,longitude:0,span:-1}])assert.throws(()=>M.mapURL(options),RangeError);
console.log('Map coordinates, marker, bounding box and validation passed.');
