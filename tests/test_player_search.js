const assert=require('assert'),S=require('../web/features/player-search.js');
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

const labels=['Winter 2026','Summer 25/26','Winter 2025','Summer 24/25','Winter 2024','Summer 09/10'];
const shortSummer={players:['Test Player'],sections:labels.map(seasonLabel=>({seasonLabel,competitionCode:'AP',sectionLabel:'1'})),entries:labels.map((_,i)=>[0,i,'Team']).reverse()};
assert.deepEqual(S.find(shortSummer,'Test Player').map(r=>r.seasonLabel),labels);
console.log('Short Summer labels sort chronologically in all-history search');
