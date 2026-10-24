const assert=require('assert'),M=require('../team-lab.js');
const roster=['John Smith','Core Two','Core Three','Core Four','Hudson Jones','Guest Emergency'];
const payload={meta:{section_code:'local-demo',is_custom:true,customRules:{singlesSlots:4,doublesSlots:2}},format:'sets',
 customRoster:roster.map((name,i)=>({name,team:'A',teamId:'a',order:i+1,emergency:i===5})),
 singles:roster.map((player,i)=>({player,team:'A',rating:[2100,2000,1900,1800,1500,2500][i],matches:8})),
 doublesIndividuals:roster.map((player,i)=>({player,team:'A',rating:[1900,1800,1800,1600,2300,2600][i]})),
 doubles:[],standings:[{team:'A',points:30,wins:3,losses:1},{team:'B',points:20}],teams:[{team:'A'},{team:'B'}],
 results:[{round:2,date:'8 Jan 26',fixtures:[{fixtureId:'f2',home:'B',away:'A',status:'Completed',rubbers:[
 {type:'Singles',position:'No. 1',home:'Opponent',away:'John Smith',winner:'John Smith',awayEmergency:false},
 {type:'Singles',position:'No. 4',home:'Other',away:'Guest Emergency',winner:'Other',awayEmergency:true},
 {type:'Doubles',position:'No. 1',home:'Opponent / Other',away:'John Smith / Hudson Jones',winner:'John Smith / Hudson Jones',awayEmergencies:[false,false]}
 ]}]},{round:1,date:'1 Jan 26',fixtures:[{fixtureId:'f1',home:'A',away:'B',status:'Completed',rubbers:[
 {type:'Singles',position:'No. 1',home:'John Smith',away:'Opponent',winner:'John Smith'},
 {type:'Doubles',position:'No. 1',home:'John Smith / Hudson Jones',away:'Opponent / Other',winner:'Opponent / Other',homeEmergencies:[false,false]}
 ]}]}],upcomingFixtures:[{round:1,fixtures:[{fixtureId:'f1',home:'A',away:'B',status:'Completed',rubbers:[]}]}]};
let m=M.build(payload,'A');
assert.equal(m.position,1);assert.equal(m.core.length,5);assert.equal(m.emergencies.length,1);assert.equal(m.players.find(p=>p.name==='John Smith').appearances,2,'Singles and doubles on one day count once');
assert.deepEqual(m.days.map(d=>d.round),[1,2]);assert.equal(m.days[1].selected['Guest Emergency'].emergency,true);
assert.deepEqual(m.days[1].selected['John Smith'].roles,['S1','D1']);assert.equal(m.days[0].selected['Core Two'],undefined);
assert.equal(m.pairs[0].matches,2);assert.equal(m.pairs[0].wins,1);assert.equal(m.pairs[0].losses,1,'Pair records come from doubles winner, not team result');
assert.equal(m.emergencies[0].emergencyDays[0].id,'f2');
const best=M.suggest(m),finals=M.suggest(m,true);
assert.equal(best.roster.length,4);assert.equal(finals.roster.length,5);
assert(!finals.singles.includes('Hudson Jones'));assert(finals.pairs.some(p=>p.names.includes('Hudson Jones')));assert(finals.pairs.some(p=>p.names.includes('John Smith')&&p.names.includes('Hudson Jones')));
assert(!finals.roster.includes('Guest Emergency'),'Emergencies cannot displace registered main squad in best-lineup model');
assert.equal(new Set(finals.pairs.flatMap(p=>p.names)).size,4,'Doubles pairs are disjoint');
assert.deepEqual(finals.singles,['John Smith','Core Two','Core Three','Core Four']);
const old=JSON.stringify(payload);M.build(payload,'A');M.suggest(m,true);assert.equal(JSON.stringify(payload),old,'Model is read-only');
const historical=structuredClone(payload);historical.customRoster=historical.customRoster.filter(x=>x.name!=='Hudson Jones');m=M.build(historical,'A');assert(m.historical.some(p=>p.name==='Hudson Jones'));assert(!M.suggest(m,true).roster.includes('Hudson Jones'),'Past custom roster members stay out of future suggestions');
const official=structuredClone(payload);official.meta={section_code:'UA009'};delete official.customRoster;official.teamOrderEvidence={A:{players:roster.map((player,i)=>({player,averagePosition:i+1,emergencyOnly:i===5}))}};m=M.build(official,'A');assert.equal(m.core.length,5);assert(m.emergencies.some(p=>p.name==='Guest Emergency'));
const rubbers=structuredClone(payload);rubbers.meta.customRules={singlesSlots:2,doublesSlots:1};rubbers.format='rubbers';m=M.build(rubbers,'A');assert.equal(M.suggest(m).singles.length,2);assert.equal(M.suggest(m,true).roster.length,3);assert.equal(M.suggest(m,true).pairs.length,1);
const noDoubles=structuredClone(payload);noDoubles.meta.customRules={singlesSlots:2,doublesSlots:0};assert.equal(M.suggest(M.build(noDoubles,'A')).pairs.length,0);
const empty={meta:{},teams:[{team:'Empty'}],standings:[],results:[]};m=M.build(empty,'Empty');assert.equal(m.days.length,0);assert(M.suggest(m).unavailable);
const partial=structuredClone(payload);partial.results[0].fixtures[0].rubbers.push({type:'Doubles',position:'No. 2',home:'Unknown / Other',away:'Core Two / Core Three',winner:'',awayEmergency:true});m=M.build(partial,'A');assert(m.days[1].uncertainEmergency);assert(!m.days[1].selected['Core Two'].emergency,'An aggregate emergency flag must not mark both partners');
console.log('Team Lab model passed: per-day participation, chronological selections, main/emergency/history squads, doubles match records, Power lineup, fifth-player doubles specialist, distinct pairs, custom formats and empty data.');
