/* Standings snapshots and hypothetical results; source data stays immutable. */
(function(root){'use strict';
 const percentage=r=>r.gamesAgainst?100*r.gamesFor/r.gamesAgainst:r.gamesFor?Infinity:0;
 function order(rows){return rows.sort((a,b)=>(b.points??-Infinity)-(a.points??-Infinity)||percentage(b)-percentage(a)||a.team.localeCompare(b.team)).map((r,i,all)=>({...r,position:i+1,ambiguousPosition:all.some((x,j)=>j!==i&&x.points===r.points&&percentage(x)===percentage(r))}))}
 function blank(team){return{team,played:0,wins:0,draws:0,losses:0,gamesFor:0,gamesAgainst:0,rubbersFor:0,rubbersAgainst:0,points:0}}
 function add(rows,f){if(!f||['Scheduled','Bye','Missing Result'].includes(f.status))return;const scored=Number.isFinite(f.homePoints)&&Number.isFinite(f.awayPoints);if(!scored&&f.status!=='Completed')return;const result=scored?f.homePoints-f.awayPoints:(Number(f.homeSets??f.homeRubbers)||0)-(Number(f.awaySets??f.awayRubbers)||0)||(Number(f.homeGames)||0)-(Number(f.awayGames)||0);for(const side of ['home','away']){const r=rows.get(f[side]);if(!r)continue;const other=side==='home'?'away':'home',outcome=side==='home'?result:-result;r.played++;r.wins+=Number(outcome>0);r.losses+=Number(outcome<0);r.draws+=Number(outcome===0);r.points+=scored?f[side+'Points']:0;r.gamesFor+=Number(f[side+'Games'])||0;r.gamesAgainst+=Number(f[other+'Games'])||0;r.rubbersFor+=Number(f[side+'Rubbers'])||0;r.rubbersAgainst+=Number(f[other+'Rubbers'])||0}}

 const pending=f=>['Scheduled','Missing Result','Pending'].includes(f.status);
 const bye=f=>f.status==='Bye'||[f.home,f.away].some(team=>/^byes?$/i.test(String(team).trim()));
 function stage(data,g){
  const named=[g.stage,g.label].map(value=>String(value||'').replace(/[_–—-]+/g,' '));
  if(named.some(value=>/^(?:semi ?finals?|s\.?f\.?)(?:\b|$)/i.test(value)))return 'semi_final';
  if(named.some(value=>/^(?:grand ?finals?|finals?|g\.?f\.?)(?:\b|$)/i.test(value)))return 'grand_final';
  if(!data.meta?.is_custom&&!data.meta?.competition_rules&&Number(g.round)>(Number(data.meta?.regular_season_rounds)||14))
   return Number(g.round)===(Number(data.meta?.regular_season_rounds)||14)+1?'semi_final':'grand_final';
  return 'regular';
 }
 const counts=(data,g)=>stage(data,g)==='regular'&&!/playoff|knockout/i.test([g.stage,g.label].join(' '));
 const withGroup=(g,f)=>({...f,round:f.round??g.round,stage:f.stage||g.stage,label:f.label||g.label,date:f.date||g.date});
 const fixtureKey=f=>JSON.stringify([String(f.round),...[f.home,f.away].sort()]);
 const cache=new WeakMap();
 function season(data){
  if(cache.has(data))return cache.get(data);
  const results=data.results||[],draw=data.upcomingFixtures||[],all=[...draw,...results];
  const regularFixtures=groups=>groups.flatMap(g=>(g.fixtures||[]).map(f=>withGroup(g,f)).filter(f=>counts(data,f)));
  const regularResults=regularFixtures(results);
  // Old TROLS draw links can point at the current season for the same section code.
  const regular=data.meta?.is_archive&&regularResults.length?regularResults:regularFixtures(all);
  const played=new Set(regularResults.filter(f=>!pending(f)).map(fixtureKey));
  const missing=regular.filter(f=>!bye(f)&&pending(f)&&!played.has(fixtureKey(f)));
  const lastRound=Math.max(0,...regular.map(f=>Number(f.round)||0));
  const expected=Number(data.meta?.regular_season_rounds)||(data.meta?.is_custom||data.meta?.competition_rules?lastRound:Math.max(14,lastRound));
  const k=data.knockout||{};
  const playoffFixtures=all.flatMap(g=>(g.fixtures||[]).map(f=>withGroup(g,f)).filter(f=>!counts(data,f)&&!bye(f)));
  const roundCount=new Set(regularResults.filter(f=>!pending(f)).map(f=>String(f.round))).size;
  const hasResults=regularResults.some(f=>!pending(f)&&!bye(f));
  const complete=!missing.length&&hasResults&&(k.regularSeasonComplete||roundCount>=expected||
   (lastRound>=expected&&regular.some(f=>Number(f.round)===lastRound)&&draw.length>0)||
   (data.meta?.is_archive&&(playoffFixtures.length||data.standings?.some(r=>r.standingsSource==='TROLS'))));
  const iso=root.BRTAMatchday?.iso||(typeof require==='function'?require('./matchday').iso:()=> '');
  const days=new Map();
  for(const f of regular){const date=iso(f.date);if(date&&Number.isFinite(Number(f.round)))days.set(Number(f.round),Date.parse(date));}
  const day=86400000,dates=[...days].sort((a,b)=>a[0]-b[0]);
  const intervals=dates.slice(1).map(([round,date],i)=>Math.round((date-dates[i][1])/day/(round-dates[i][0]))).filter(n=>n>0).sort((a,b)=>a-b);
  const last=dates.at(-1),interval=intervals[Math.floor((intervals.length-1)/2)]||7;
  const estimate=phase=>last&&!data.meta?.is_custom?new Date(last[1]+day*interval*(lastRound-last[0]+(phase==='semi_final'?1:2))).toISOString().slice(0,10):'';
  const phaseDates=new Map(playoffFixtures.filter(f=>iso(f.date)).map(f=>[stage(data,f),f.date]));
  for(const event of data.calendarEvents||[]){
   const phase=stage(data,event);
   if(phase!=='regular'&&iso(event.date)&&!phaseDates.has(phase))phaseDates.set(phase,event.date);
  }
  const posted=new Set(playoffFixtures.filter(f=>!pending(f)).map(f=>stage(data,f)));
  function playoff(f,phase=stage(data,f)){
   if(phase==='regular')return f;
   const date=f.date||phaseDates.get(phase)||estimate(phase);
   return {...f,stage:phase,date,dateEstimated:f.dateEstimated??(!!date&&!f.date&&!phaseDates.has(phase)),
    status:pending(f)?(posted.has(phase)?'Missing Result':'Scheduled'):f.status};
  }
  function normalize(groups,preferResults=false){
   return groups.map(g=>{
    if(counts(data,g))return g;
    const fixtures=(g.fixtures||[]).map(f=>{
     const entry=withGroup(g,f);
     const result=preferResults?playoffFixtures.findLast(p=>stage(data,p)===stage(data,entry)&&fixtureKey(p)===fixtureKey(entry)&&!pending(p)):null;
     return playoff(result?{...entry,...result}:entry);
    });
    const dated=fixtures.find(f=>f.date);
    return {...g,stage:stage(data,g),date:g.date||dated?.date,dateEstimated:!g.date&&dated?.dateEstimated,fixtures};
   });
  }
  const info={complete:Boolean(complete),lastRound,missing:new Set(missing.map(fixtureKey)).size,playoff,results:normalize(results),fixtures:normalize(draw,true)};
  cache.set(data,info);
  return info;
 }
 function prepare(data){
  const info=season(data),output={...data,results:info.results,upcomingFixtures:info.fixtures};
  cache.set(output,info);
  return output;
 }
 function current(data){const calendar=(data.results||[]).filter(g=>counts(data,g)).filter(g=>(g.fixtures||[]).some(f=>!['Scheduled','Bye','Missing Result'].includes(f.status))).sort((a,b)=>Number(a.round)-Number(b.round)),latest=calendar.at(-1),past=new Map((data.standings||[]).map(r=>[r.team,blank(r.team)]));for(const g of calendar.filter(g=>Number(g.round)<Number(latest?.round)))for(const f of g.fixtures||[])if(counts(data,{...g,...f}))add(past,f);const before=new Map(order([...past.values()]).map(r=>[r.team,r]));return(data.standings||[]).map((r,i)=>{const prior=before.get(r.team),position=r.officialPosition||i+1;return{...r,position,positionChange:calendar.length>1&&!prior?.ambiguousPosition?prior.position-position:null,pointsChange:latest?Number(r.points)-Number(prior?.points||0):null}})}
 function project(data,fixtures){fixtures=fixtures.filter(f=>counts(data,f));const source=current(data);if(!fixtures.length)return source.map(r=>({...r,positionChange:0,pointsChange:0}));const rows=new Map(source.map(r=>[r.team,{...blank(r.team),...r,officialWins:undefined,officialDraws:undefined,officialLosses:undefined,officialPercentage:undefined,officialPosition:undefined}])),prior=new Map(source.map(r=>[r.team,r]));for(const f of fixtures)add(rows,f);const known=fixtures.every(f=>Number.isFinite(f.homePoints)&&Number.isFinite(f.awayPoints));return order([...rows.values()]).map(r=>({...r,position:known?r.position:null,points:known?r.points:null,pointsChange:known?r.points-prior.get(r.team).points:null,positionChange:known&&!r.ambiguousPosition?prior.get(r.team).position-r.position:null}))}
 function rounds(data){return(data.results||[]).filter(g=>counts(data,g)&&(g.fixtures||[]).some(f=>!['Scheduled','Bye','Missing Result'].includes(f.status))).map(g=>({round:Number(g.round),date:g.date,label:g.label||'Round '+g.round})).sort((a,b)=>a.round-b.round)}
 function at(data,round){const names=(data.standings||[]).map(r=>r.team),calendar=rounds(data).filter(g=>g.round<=round),now=calendar.at(-1)?.round,previous=calendar.at(-2)?.round;function snapshot(limit){const rows=new Map(names.map(team=>[team,blank(team)]));let known=true;for(const g of data.results||[])if(Number(g.round)<=limit&&counts(data,g))for(const f of g.fixtures||[])if(counts(data,{...g,...f})){if(!['Scheduled','Bye','Missing Result'].includes(f.status)&&(!Number.isFinite(f.homePoints)||!Number.isFinite(f.awayPoints)))known=false;add(rows,f)}return order([...rows.values()]).map(r=>({...r,points:known?r.points:null,position:known?r.position:null}))}const old=new Map(snapshot(previous??0).map(r=>[r.team,r]));return snapshot(now??0).map(r=>{const before=old.get(r.team);return{...r,positionChange:previous!=null&&r.position!=null&&before.position!=null&&!before.ambiguousPosition?before.position-r.position:null,pointsChange:r.points!=null&&before.points!=null?r.points-before.points:null}})}
 const api={percentage,order,current,project,counts,stage,season,prepare,pending,rounds,at};root.BRTAStandings=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
