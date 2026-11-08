'use strict';
// Regression coverage for audit findings subsequent to 8.5.4.1.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Model=require('../web/models/custom-section-model.js');
const Tools=require('../web/models/custom-section-tools.js');
const {sample}=require('./test_custom_sections.js');
const clone=x=>JSON.parse(JSON.stringify(x));

const s=clone(sample());
s.singlesSlots=4;s.doublesSlots=2;
s.players.push(
 {id:'p6',name:'Chris',teamId:'a',order:3},
 {id:'p7',name:'David',teamId:'a',order:4},
 {id:'p8',name:'Eve',teamId:'b',order:3},
 {id:'p9',name:'Frank',teamId:'b',order:4}
);
s.rounds=[{id:'round-audit',number:1,date:'2026-10-18',fixtures:[{
 id:'fixture-audit',homeTeamId:'a',awayTeamId:'b',status:'Completed',
 homeLineup:['p1','p2','p6','p7'],awayLineup:['p3','p4','p8','p9'],
 rubbers:[]
}]}];
const fixture=s.rounds[0].fixtures[0];fixture.rubbers=Tools.generate(s,fixture);
for(const rubber of fixture.rubbers){
 rubber.sets=[{h:6,a:2,mt:false}];rubber.status='Completed';
 if((rubber.type==='Singles'&&rubber.position===4)||(rubber.type==='Doubles'&&rubber.position===2)){
  rubber.home=rubber.home.map(id=>id==='p7'?Model.NO_PLAYER:id);
  rubber.sets=[{h:'',a:'',mt:false}];rubber.status='Forfeit';rubber.winner='away';
 }
}
Model.validate(s);
assert.deepEqual(Model.attendance(fixture,'home').sort(),['p1','p2','p6'],'Planned fourth player is absent despite remaining selected in lineup');
assert.equal(Model.attendance(fixture,'away').length,4);
const inferred=Model.build(s).results[0].fixtures[0];
assert.equal(inferred.homeRubbers,4,'A three-player team can win more rubbers');
assert.equal(inferred.awayRubbers,2);
assert(inferred.awayPoints>inferred.homePoints,'A three-player team must not win the fixture');
assert(inferred.rubbers.some(r=>r.winnerSide==='home'),'Result rows carry explicit winner side');
assert(inferred.rubbers.some(r=>r.winnerSide==='away'),'Forfeit rows carry explicit winning side');
const full=clone(s);full.rounds[0].fixtures[0].homeAttendees=['p1','p2','p6','p7'];
Model.validate(full);
const fullResult=Model.build(full).results[0].fixtures[0];
assert(fullResult.homePoints>fullResult.awayPoints,'Explicit attendance counts as independently recorded evidence');
const recorded=clone(s);recorded.rounds[0].fixtures[0].homeAttendees=['p1','p2','p6'];
assert.equal(Model.build(recorded).results[0].fixtures[0].homePoints,inferred.homePoints);
const invalid=clone(s);invalid.rounds[0].fixtures[0].homeAttendees=['p1','p1'];
assert.throws(()=>Model.validate(invalid),/Matchday attendees/);
const strange=clone(s);strange.rounds[0].fixtures[0].homeAttendees=['no-player'];
assert.throws(()=>Model.validate(strange),/Matchday attendees/);

assert(Model.build(s).meta.competition_label.startsWith('Custom Competitions -'));
const root=path.resolve(__dirname,'..');
const script=p=>fs.readFileSync(path.join(root,p),'utf8');
const creator=script('web/features/custom-sections.js');
assert(creator.includes('data-ca="attendance-player"'),'Creator exposes matchday attendance');
assert(!creator.includes('while Extras is on'),'Creator help must not falsely require Extras');
assert(creator.indexOf("ensureOverlay();$('#customAdminOverlay').classList.remove('hidden');")<
 creator.indexOf("persist(read().filter(s=>s.id!==section.id).concat(M.clone(section)))"),
 'The import must open Creator before emitting a section-change event');
const app=script('web/core/app.js');
assert(app.includes("o.id!=='customAdminOverlay'"),'A stale section load cannot close the Creator');
assert(app.includes('function rubberWinnerSide(r)'),'Scorecards need a winner-side resolver');
const exportUI=script('web/features/export-853.js');
assert(exportUI.includes("BRTAOverlays?.register?.(prompt.id,dismiss)"),'The export prompt must register its Escape callback');
assert(exportUI.includes("replace(/\\.json$/i,'')"),'Results check must resolve legacy filenames');
const workflow=script('.github/workflows/sync-trols.yml');
assert(workflow.includes('.removesuffix(".json")'),'Recorded changed sections must be clean IDs');
console.log('Post-8.5.4.1 audit: actual attendance, winner-side, editor race, overlay, readable sync IDs and terminology passed');
