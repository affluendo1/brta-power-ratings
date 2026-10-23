const assert=require('assert'),S=require('../player-search.js');
const index={players:['José O’Neill','Other Person'],sections:[
  {seasonKey:'AA:2024',seasonLabel:'Spring 2024',competitionCode:'AA',sectionLabel:'2'},
  {seasonKey:'UA:2026',seasonLabel:'Autumn 2026',competitionCode:'UA',sectionLabel:'1'},
  {seasonKey:'UA:2024',seasonLabel:'Spring 2024',competitionCode:'UA',sectionLabel:'1'}
],entries:[[0,0,'A'],[0,1,'B'],[0,2,'C'],[1,1,'D']]};
assert.deepEqual(S.find(index,'oneill jose').map(r=>r.seasonKey),['UA:2026','AA:2024','UA:2024']);
assert.equal(S.find(index,'JOSÉ O’NEILL').length,3);
assert.equal(S.find(index,'not here').length,0);
assert.equal(S.find(index,'').length,0);
assert.equal(S.find(index,'other')[0].player,'Other Person');
assert.equal(S.find(index,'jose')[0].team,'B');
console.log('All-history name search: accents, apostrophes, name order, both competitions, separate seasons and chronological ordering passed');
