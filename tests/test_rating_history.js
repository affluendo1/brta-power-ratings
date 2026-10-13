const assert=require('assert');
const H=require('../rating-history.js');
const row=(player,rating,matches=4)=>({player,rating,matches,se:100,team:'Club'});
const data={singles:[row('Alice',1600),row('Bob',1700),row('New',1650),row('Provisional',2000,2)],
  ratingHistory:{rounds:[{round:5},{round:6},{round:7}],tables:{
    5:[row('Alice',1800),row('Bob',1600),row('New',1500,3)],
    6:[row('Alice',1600),row('Bob',1700),row('New',1650),row('Provisional',2000,2)],
    7:[row('Alice',1600),row('Bob',1700),row('New',1650),row('Provisional',2000,2)]}}};
let rows=H.withMovement(data,'singles',6),get=name=>rows.find(x=>x.player===name);
assert.equal(get('Bob').rank,1);assert.equal(get('Bob').movement,1);
assert.equal(get('Alice').rank,3);assert.equal(get('Alice').movement,-2);
assert.equal(get('New').isNew,true);assert.equal(get('New').movement,null);
assert.equal(get('Provisional').rank,null);assert.equal(get('Provisional').movement,null);
rows=H.withMovement(data,'singles',5);assert(rows.every(x=>x.movement===null&&!x.isNew));
rows=H.withMovement(data,'singles',7);assert(rows.filter(x=>x.rank).every(x=>x.movement===0));
rows=H.withMovement(data,'singles');assert(rows.filter(x=>x.rank).every(x=>x.movement===0));
// Identical Power ratings must use the same tie ordering at both dates.
const tied={singles:[row('Zed',1600),row('Amy',1600)],ratingHistory:{rounds:[{round:1},{round:2}],tables:{1:[row('Amy',1600),row('Zed',1600)],2:[row('Zed',1600),row('Amy',1600)]}}};
assert(H.withMovement(tied,'singles').every(x=>x.movement===0));
// Doubles qualification and overall snapshots use as-of-round evidence.
data.doublesIndividuals=[{...row('Bob',1800),qualified:true},{...row('Alice',1500),qualified:true}];
data.doublesRatingHistory={tables:{5:{pairs:[row('A / B',1700,2)],doublesPlayers:[{...row('Bob',1600),qualified:false},{...row('Alice',1800),qualified:true}]},6:{pairs:[row('A / B',1700,3)],doublesPlayers:data.doublesIndividuals},7:{pairs:[row('A / B',1700,3)],doublesPlayers:data.doublesIndividuals}}};
assert.equal(H.withMovement(data,'doublesPlayers',6).find(x=>x.player==='Bob').isNew,true);
assert.equal(H.rowsAt(data,'overall',5).find(x=>x.player==='Bob').qualified,false);
assert.equal(H.rowsAt(data,'overall',6).find(x=>x.player==='Bob').rating,1750);
assert.equal(H.withMovement(data,'pairs',6)[0].movement,0);
console.log('rating history and rank movement tests passed');
