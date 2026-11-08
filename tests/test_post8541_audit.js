'use strict';
const assert=require('node:assert/strict');
const Model=require('../web/models/custom-section-model.js');
const O=require('../web/models/orchestra.js');
const bundle=require('../web/models/orchestra-bundle.json');
const frozen=require('../web/models/rm4-frozen.json');
const history=require('../web/models/orchestra-history.json');
const {sample}=require('./test_custom_sections.js');
const local=sample();
local.ratingModel='4melody.2';local.format='rubbers';
local.setTarget=6;local.doublesTarget=8;local.singlesBestOf=3;local.doublesBestOf=1;
for(const round of local.rounds)for(const fixture of round.fixtures)for(const match of fixture.rubbers){
 match.sets=match.type==='Singles'?[{h:6,a:2,mt:false},{h:6,a:3,mt:false}]:[{h:8,a:6,mt:false}];
}
Model.validate(local);
const data=Model.build(local);
assert.equal(data.meta.competition_code,'LOCAL');
assert.equal(data.meta.is_custom,true);
for(const model of ['4melody.2','4foundation.2']){
 const fitted=O.recalculate(data,model,bundle,frozen,history);
 assert.equal(fitted.meta.ratingModel,model);
 assert.equal(fitted.meta.predictionModel,'4.2 Orchestra');
 assert(fitted.orchestra,'The junior specialist must fit locally, not fall back to RM4.2');
 assert.equal(fitted.orchestra.history,null);
 assert(fitted.orchestra.matches.some(m=>m.type==='Singles'&&m.bestOf===3&&m.target===6));
 assert(fitted.orchestra.matches.some(m=>m.type==='Doubles'&&m.bestOf===1&&m.target===8));
 const prediction=O.forecast(fitted.orchestra,{type:'Singles',home:['Alice'],away:['Bob'],date:'2026-11-12',round:6,target:6,bestOf:3,matchTiebreak:true},bundle,frozen);
 assert.equal(prediction.profile,'junior.rubbers','LOCAL junior scoring must use the junior router');
}
const broken=JSON.parse(JSON.stringify(data));broken.meta.customRules.doublesTarget=4;
assert.throws(()=>O.recalculate(broken,'4melody.2',bundle,frozen,history),/does not support|Choose RM4\.2/,'Unsupported custom formats must produce an explicit error');
console.log('Post-release Junior Rubbers custom Melody/Foundation routing and unsupported-format guard: passed');

const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const siteApp=source('web/core/app.js'),start=siteApp.indexOf('function rubberWinnerSide('),end=siteApp.indexOf('function resultDetailHTML(',start);
assert(start>0&&end>start,'Winner-side resolver must exist');
const side=vm.runInNewContext(siteApp.slice(start,end)+'\nrubberWinnerSide');
assert.equal(side({home:'Alex',away:'Alex',winner:'Alex',score:'6-2'}),'home');
assert.equal(side({home:'Alex',away:'Alex',winner:'Alex',score:'2-6'}),'away');
assert.equal(side({home:'Alex',away:'Alex',winner:'Alex',winnerSide:'away',score:'6-2'}),'away','Explicit result must override name and score');
assert.equal(side({home:'Alex',away:'Alex',winner:'',score:'6-2'}),'','Do not guess an unrecorded result');

const attendance=sample();
attendance.ratingModel='RM4.2';attendance.singlesSlots=4;attendance.doublesSlots=2;
attendance.players.push(
 {id:'p6',name:'Carla',teamId:'a',order:3},{id:'p7',name:'Dana',teamId:'a',order:4},
 {id:'p8',name:'Evan',teamId:'b',order:3},{id:'p9',name:'Finlay',teamId:'b',order:4});
const played=(type,position,home,away,h=6,a=0)=>({type,position,status:'Completed',home,away,
  homeEmergencies:home.map(()=>false),awayEmergencies:away.map(()=>false),sets:[{h,a,mt:false}]});
const fixture={id:'f-attendance',homeTeamId:'a',awayTeamId:'b',status:'Completed',autoStatus:false,
 homeLineup:['p1','p2','p6','p7'],awayLineup:['p3','p4','p8','p9'],rubbers:[
 played('Singles',1,['p1'],['p3']),played('Singles',2,['p2'],['p4']),
 played('Singles',3,['p6'],['p8']),
 {type:'Singles',position:4,status:'Forfeit',winner:'away',home:[Model.NO_PLAYER],away:['p9'],
  homeEmergencies:[false],awayEmergencies:[false],sets:[{h:'',a:'',mt:false}]},
 played('Doubles',1,['p1','p2'],['p3','p4']),played('Doubles',2,['p1','p6'],['p8','p9'])
]};
attendance.rounds=[{id:'r-attendance',number:1,date:'2026-10-18',fixtures:[fixture]}];
assert.equal(Model.matchdayAttendance(fixture,'home',attendance.players).size,3,'A fourth selected but absent player does not count as attending');
assert.equal(Model.matchdayAttendance(fixture,'away',attendance.players).size,4);
Model.validate(attendance);
const shortTie=Model.build(attendance).results[0].fixtures[0];
assert.equal(shortTie.homeRubbers,5);
assert.equal(shortTie.awayRubbers,1);
assert.equal(shortTie.homePoints,5,'Three attendees cannot receive winning bonus');
assert.equal(shortTie.awayPoints,5,'Receiving team gets winning bonus under existing contract');
fixture.homeAttendance=['p1','p2','p6','p7'];
assert.equal(Model.matchdayAttendance(fixture,'home',attendance.players).size,4,'Explicit verified attendance is authoritative');
const fullTie=Model.build(attendance).results[0].fixtures[0];
assert.equal(fullTie.homePoints,9,'Four explicitly present players unlock winning team points');
fixture.homeAttendance=[Model.NO_PLAYER];assert.throws(()=>Model.validate(attendance),/Attendance/);
assert(source('.github/workflows/sync-trols.yml').includes('Path(part[3]).stem'),'Sync must record section codes rather than .json filenames');
assert(source('web/features/export-853.js').includes("register?.('export853ImportPrompt',dismiss)"),'Escape must dismiss export prompt through overlay manager');
assert(source('web/features/custom-sections.js').includes('pendingEditorView=null;open();persist(next);render();return true;'),'Import overlay must open before triggering catalog change');
assert(Model.build(sample()).meta.competition_label.startsWith('Custom Competitions'),'Locally built metadata must use the new term');
console.log('Post-release attendance, explicit winners, labels, prompt Escape and sync naming: passed');
