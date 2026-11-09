/* 8.5.3: portable section exports and edit-ready Section Creator backups. */
(function(root,factory){
'use strict';
const api=factory(root.CustomSectionModel||(typeof require==='function'?require('./custom-section-model.js'):null));
root.BRTAExport853=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(Model){
'use strict';
const clean=s=>String(s??'').trim(),clone=x=>JSON.parse(JSON.stringify(x));
const slug=s=>clean(s).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'section';
const csvCell=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
const date=value=>{
 const s=clean(value);
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
 const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toISOString().slice(0,10):'';
};
const roundNo=v=>Number(v?.round??v?.number??0);
const pos=v=>{const n=Number(String(v??'').match(/\d+/)?.[0]);return Number.isInteger(n)&&n>0?n:1};
const players=text=>Array.isArray(text)?text.map(clean).filter(Boolean):clean(text).split(/\s+\/\s+/).map(clean).filter(Boolean);
function sets(value){
 const out=[],re=/(\[)?\s*(\d{1,2})\s*[-–:]\s*(\d{1,2})\s*(\])?/g;let m;
 while((m=re.exec(clean(value))))out.push({h:Number(m[2]),a:Number(m[3]),mt:!!(m[1]||m[4])});
 return out;
}
function rows(data,technical=false){
 const columns=['record_type','competition','section','date','round','status','home_team','away_team','home_points','away_points','home_rubbers','away_rubbers','home_games','away_games','rubber_type','rubber_position','home_players','away_players','winner','score',...(technical?['match_id','fixture_id']:[])];
 const output=[columns];
 const fixtures=new Map(),key=(round,f)=>String(round.round)+'|'+String(f.fixtureId||f.id||f.home+'|'+f.away);
 for(const round of data.upcomingFixtures||[])for(const f of round.fixtures||[])fixtures.set(key(round,f),{round,f});
 for(const round of data.results||[])for(const f of round.fixtures||[])fixtures.set(key(round,f),{round,f});
 for(const {round,f} of fixtures.values()){
  const base=['Fixture',data.meta?.competition_label,data.meta?.section_label,f.date??round.date,f.round??round.round,f.status,f.home,f.away,f.homePoints,f.awayPoints,f.homeRubbers,f.awayRubbers,f.homeGames,f.awayGames,'','','','','',''];
  const identity=clean(f.fixtureId||f.id);
  output.push(technical?[...base,'',identity]:base);
  for(const m of f.rubbers||[]){
   const line=['Rubber',data.meta?.competition_label,data.meta?.section_label,f.date??round.date,f.round??round.round,m.status||f.status,f.home,f.away,f.homePoints,f.awayPoints,f.homeRubbers,f.awayRubbers,f.homeGames,f.awayGames,m.type,m.position,m.home,m.away,m.winner,m.score];
   // TROLS generally supplies fixture IDs, not distinct per-rubber IDs. Do not fabricate them.
   output.push(technical?[...line,clean(m.matchId||m.match_id),identity]:line);
  }
 }
 return output;
}
function csv(data,technical=false){return '\ufeff'+rows(data,technical).map(r=>r.map(csvCell).join(',')).join('\r\n');}
function markdown(data){
 const meta=data.meta||{};let out='# '+clean(meta.competition_label)+' · '+clean(meta.section_label)+'\n\n';
 out+='Season: '+clean(meta.season_label)+'\n\n';
 const fixtures=new Map(),key=(round,f)=>String(round.round)+'|'+String(f.fixtureId||f.id||f.home+'|'+f.away);
 for(const round of data.upcomingFixtures||[])for(const f of round.fixtures||[])fixtures.set(key(round,f),{round,f});
 for(const round of data.results||[])for(const f of round.fixtures||[])fixtures.set(key(round,f),{round,f});
 const groups=new Map();for(const {round,f} of fixtures.values()){const k=String(round.round);if(!groups.has(k))groups.set(k,{...round,fixtures:[]});groups.get(k).fixtures.push(f)}
 for(const round of [...groups.values()].sort((a,b)=>roundNo(b)-roundNo(a))){
  out+='## '+clean(round.label||'Round '+round.round)+' · '+clean(round.date)+'\n\n';
  for(const f of round.fixtures||[]){
   out+='### '+clean(f.home)+' vs '+clean(f.away)+'\n\n';
   out+='Status: '+clean(f.status)+' · Points: '+(f.homePoints??'—')+'–'+(f.awayPoints??'—')+'\n\n';
   for(const m of f.rubbers||[])out+='- '+clean(m.type)+' '+clean(m.position)+': '+clean(m.home)+' vs '+clean(m.away)+' · '+clean(m.score||m.status)+'\n';
   out+='\n';
  }
 }
 return out;
}
function toBackup(source,now=new Date().toISOString()){
 if(!Model)throw Error('The Section Creator model is unavailable.');
 if(!source?.meta)throw Error('No section metadata was found.');
 const rawFormat=clean(source.format||source.meta.format).toLowerCase();
 if(!['sets','rubbers'].includes(rawFormat))throw Error('This section uses a scoring format the Section Creator does not yet support.');
 const fmt=rawFormat,evidence=source.teamOrderEvidence||{};
 const teams=[],ids=new Map(),roster=[],named=new Map(),orders=new Map(),identityKey=(name,tid)=>String(tid||'unassigned')+'|'+clean(name).toLowerCase();
 const uniqueDisplay=(original,tid)=>{
  const safe=String(original).replace(/\[(?:Unnamed|Unlisted)\s+player[^\]]*\]/gi,'Unidentified player').replace(/\bTROLS\s+No[\s-]?Code\b/gi,'Unidentified player');let display=safe,n=1;
  const club=teams.find(t=>t.id===tid)?.name||'Unassigned';
  while(roster.some(p=>p.name.toLowerCase()===display.toLowerCase()))display=safe+' ('+club+(n++>1?' '+(n-1):'')+')';
  return display;
 };
 const teamId=name=>{
  name=clean(name);
  if(!name||/^(bye|byes)$/i.test(name))return '';
  const k=name.toLowerCase();if(ids.has(k))return ids.get(k);
  const tid='team-'+(teams.length+1);teams.push({id:tid,name});ids.set(k,tid);return tid;
 };
 for(const item of Object.keys(evidence))teamId(item);
 for(const row of source.teams||[])teamId(row.team||row.name);
 const schedule=new Map();
 const add=(r,f,fromResults=false)=>{
  if(!f?.home)return;if(/^byes?$/i.test(clean(f.home))&&clean(f.away))f={...f,home:f.away,away:'Bye',status:'Bye'};const n=roundNo(r),day=date(f.date||r.date);if(!n||!day)return;
  const key=n+'|'+clean(f.home).toLowerCase()+'|'+clean(f.away||'Bye').toLowerCase();
  let gr=schedule.get(n);if(!gr){gr={number:n,date:day,label:Model.roundLabel(r),stage:Model.roundStage({...r,stage:f.stage||r.stage}),fixtures:new Map()};schedule.set(n,gr)}
  if(gr.stage==='regular'&&Model.roundStage(f)!=='regular')gr.stage=Model.roundStage(f);
  let item=gr.fixtures.get(key);
  if(!item){item={...clone(f),_round:n,_date:day,_results:!!fromResults};gr.fixtures.set(key,item);}
  else if(fromResults||!item._results){Object.assign(item,clone(f));item._results=!!fromResults;}
  teamId(f.home);teamId(f.away);
 };
 for(const r of source.upcomingFixtures||[])for(const f of r.fixtures||[])add(r,f,false);
 for(const r of source.results||[])for(const f of r.fixtures||[])add(r,f,true);
 // Preserve registered order when published; infer only where the official record is silent.
 for(const [team,entry] of Object.entries(evidence)){
  const tid=teamId(team);
  for(const [index,p] of (entry.players||[]).entries()){
   const name=clean(p.player||p.name);if(!name)continue;
   const key=identityKey(name,tid);
   if(named.has(key))continue;
   const order=index+1;const id='player-'+(roster.length+1);
   const row={id,name:uniqueDisplay(name,tid),teamId:tid,order,emergency:!!p.emergencyOnly,noCode:/^(?:\[Unnamed |\[Unlisted |No Player\b|TROLS\s*No.?Code\b|No.?Code\b)/i.test(name)};
   roster.push(row);named.set(key,row);
  }
 }
 const register=(name,tid,scope='')=>{
  name=clean(name);if(!name)return '';
  if(/^No Player$/i.test(name))return Model.NO_PLAYER;
  if(name.includes('/'))throw Error('Cannot transfer a player name containing a slash: '+name);
  const noCode=/^(?:\[Unnamed |\[Unlisted |No Player\b|TROLS\s*No.?Code\b|No.?Code\b)/i.test(name);if(noCode&&scope&&!name.startsWith('['))name=name+' · '+scope;const key=identityKey(name,tid);let p=named.get(key);
  if(!p){const order=orders.get(tid)||roster.filter(p=>p.teamId===tid).length;orders.set(tid,order+1);
   p={id:'player-'+(roster.length+1),name:uniqueDisplay(name,tid),teamId:tid,order:order+1,emergency:!tid,noCode};
   roster.push(p);named.set(key,p);}
  return p.id;
 };
 // Derive a format contract before writing match scorecards.
 const rubbers=[...schedule.values()].flatMap(r=>[...r.fixtures.values()]).flatMap(f=>f.rubbers||[]);
 const maxType=kind=>Math.max(0,...rubbers.filter(m=>m.type===kind).map(m=>pos(m.position)));
 const slotsS=source.meta.customRules?.singlesSlots??(maxType('Singles')||(fmt==='sets'?4:2));
 const slotsD=source.meta.customRules?.doublesSlots??(maxType('Doubles')||(fmt==='sets'?2:1));
 if(slotsS>8||slotsD>8)throw Error('The Section Creator can store at most eight matches of each type.');
 const bo=kind=>rubbers.some(m=>m.type===kind&&sets(m.score).length>1)?3:1;
 const singlesBestOf=source.meta.customRules?.singlesBestOf??Math.max(bo('Singles'),fmt==='rubbers'?3:1),doublesBestOf=source.meta.customRules?.doublesBestOf??bo('Doubles');
 const setTarget=source.meta.customRules?.setTarget||6;
 const doublesTarget=source.meta.customRules?.doublesTarget||(fmt==='rubbers'?8:6);
 const nowSafe=/^\d{4}-\d\d-\d\d/.test(now)?now:new Date().toISOString();
 const section={id:'local-'+slug(source.meta.section_code||'import')+'-'+nowSafe.replace(/\D/g,'').slice(0,14),
  name:clean(source.meta.section_label)||'Imported section',season:clean(source.meta.season_label)||'Imported season',
  sourceSectionCode:source.meta.section_code,sourceCompetition:source.meta.competition_label,
  doublesSurnames:false,ratingModel:'RM4.2',format:fmt,
  setTarget:Number(setTarget),doublesTarget:Number(doublesTarget),singlesBestOf,doublesBestOf,
  singlesSlots:slotsS,doublesSlots:slotsD,semifinalPlaces:Math.min(32,Number(source.meta.semifinalPlaces??4)),
  teams,players:roster,rounds:[],updatedAt:nowSafe};
 const finishMatch=(m,f)=>{
  const type=m.type==='Doubles'?'Doubles':'Singles',size=type==='Doubles'?2:1;
  const homeNames=players(m.home),awayNames=players(m.away);
  if(homeNames.length!==size||awayNames.length!==size)return null;
  const home=homeNames.map(name=>register(name,f.homeTeamId,f.sourceFixtureId||f.id));
  const away=awayNames.map(name=>register(name,f.awayTeamId,f.sourceFixtureId||f.id));
  const hs=sets(m.score),status=clean(m.status)||'Completed';
  let stage=['Completed','Unfinished','Retired','Forfeit','No Contest','Scheduled'].includes(status)?status:'Completed';
  const missingHome=home.includes(Model.NO_PLAYER),missingAway=away.includes(Model.NO_PLAYER);
  if(missingHome||missingAway)stage=missingHome&&missingAway?'No Contest':'Forfeit';
  if(!hs.length&&stage==='Completed')stage='Scheduled';
  // Nonstandard incomplete scores are retained without claiming a completed match.
  if(stage==='Completed'){
   const best=type==='Doubles'?doublesBestOf:singlesBestOf;
   const hw=hs.filter(x=>x.h>x.a).length,aw=hs.filter(x=>x.a>x.h).length;
   if(best===3?Math.max(hw,aw)!==2:hs.length!==1)stage='Unfinished';
  }
  const flag=(list,names,side)=>list.map((id,i)=>{
   const p=roster.find(p=>p.id===id);
   return id!==Model.NO_PLAYER&&(!!m[side+'Emergencies']?.[i]||!!m[side+'Emergency']||!!p?.emergency||p?.teamId!==f[side+'TeamId']);
  });
  const winner=missingHome&&missingAway?'':missingHome?'away':missingAway?'home':
   ['home','away'].includes(m.winnerSide)?m.winnerSide:
   (clean(m.winner)===clean(m.home))?'home':(clean(m.winner)===clean(m.away))?'away':'';
  return {id:'rubber-'+f.rubbers.length+'-'+type.toLowerCase(),type,position:pos(m.position),
   home,away,homeEmergencies:flag(home,homeNames,'home'),awayEmergencies:flag(away,awayNames,'away'),
   sets:hs.length?hs:[{h:'',a:'',mt:false}],status:stage,winner:stage==='Retired'||stage==='Forfeit'?winner:'',
   sourceScore:clean(m.score),sourceStatus:status};
 };
 for(const r of [...schedule.values()].sort((a,b)=>a.number-b.number)){
  const round={id:'round-'+r.number,number:r.number,date:r.date,label:r.label,stage:r.stage,fixtures:[]};
  for(const sourceFixture of r.fixtures.values()){
   const home=teamId(sourceFixture.home),away=teamId(sourceFixture.away);
   const status=clean(sourceFixture.status);
   const f={id:'fixture-'+r.number+'-'+(round.fixtures.length+1),sourceFixtureId:sourceFixture.fixtureId||'',
    homeTeamId:home,awayTeamId:away,status:!away?'Bye':['Scheduled','Completed','Wash Out','Forfeited To','Forfeited By'].includes(status)?status:'Scheduled',
    sourceStatus:status,homeLineup:[],awayLineup:[],rubbers:[],autoStatus:false};
   for(const m of sourceFixture.rubbers||[]){
    const converted=finishMatch(m,f);if(!converted)continue;
    f.rubbers.push(converted);
    for(const side of ['home','away'])for(const id of converted[side])if(id!==Model.NO_PLAYER&&!f[side+'Lineup'].includes(id))f[side+'Lineup'].push(id);
   }
   if(f.status==='Completed'){
    const complete=f.rubbers.filter(m=>m.type==='Singles').length===slotsS&&f.rubbers.filter(m=>m.type==='Doubles').length===slotsD&&f.rubbers.every(m=>m.status!=='Scheduled');
    if(!complete)f.status='Scheduled';
   }
   round.fixtures.push(f);
  }
  section.rounds.push(round);
 }
 // Fill team registrations inferred from results after all source fixtures have been visited.
 if(roster.length>256||teams.length>64||section.rounds.length>200)throw Error('This section exceeds the local editor limits.');
 Model.validate(section);
 return {format:'brta-custom-sections',version:1,sections:[section]};
}
return {slug,sets,rows,csv,markdown,toBackup};
});
