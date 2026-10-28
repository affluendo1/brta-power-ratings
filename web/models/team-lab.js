((root)=>{
  const known=name=>!!name&&!/^\[|^No Player\b/i.test(name);
  const names=value=>Array.isArray(value)?value:String(value||'').split(' / ').map(x=>x.trim()).filter(Boolean);
  const pairKey=pair=>[...pair].sort((a,b)=>a.localeCompare(b)).join(' / ');
  const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))?Number(value):null;
  const strength=(p,kind='singles')=>finite(p[kind+'Power']);
  const powerSort=kind=>(a,b)=>(strength(b,kind)??-Infinity)-(strength(a,kind)??-Infinity)||b.appearances-a.appearances||a.name.localeCompare(b.name);
  function rules(data){const r=data.meta?.customRules||data.meta?.competition_rules;return{singles:r?.singlesSlots??(data.format==='rubbers'?2:4),doubles:r?.doublesSlots??(data.format==='rubbers'?1:2)}}
  function teamNames(data){return [...new Set([...(data.standings||[]).map(x=>x.team),...(data.teams||[]).map(x=>x.team),...(data.customRoster||[]).map(x=>x.team)].filter(Boolean))]}
  function fixtures(data,team){
    const map=new Map();
    // Results contain the authoritative scorecards; the schedule adds washouts/byes.
    for(const collection of [data.results||[],data.upcomingFixtures||[]])for(const group of collection)for(const f of group.fixtures||[]){
      if(f.home!==team&&f.away!==team)continue;
      if(f.status==='Scheduled')continue;
      const key=f.fixtureId||[group.round,f.home,f.away].join('|');
      if(map.has(key))continue;
      const side=f.home===team?'home':'away',other=side==='home'?'away':'home';
      map.set(key,{id:f.fixtureId||'',openable:(data.results||[]).some(g=>(g.fixtures||[]).some(r=>r.fixtureId===f.fixtureId)),round:Number(group.round??f.round)||0,label:group.label||f.label||'Round '+group.round,date:group.date||f.date||'',status:f.status,side,opponent:f[other],rubbers:f.rubbers||[],raw:f,selected:{},unknown:[]});
    }
    return [...map.values()].sort((a,b)=>a.round-b.round||String(a.date).localeCompare(String(b.date))||a.id.localeCompare(b.id));
  }
  function build(data,team){
    const singleMap=new Map((data.singles||[]).map(x=>[x.player,x])),doubleMap=new Map((data.doublesIndividuals||[]).map(x=>[x.player,x]));
    const registry=(data.customRoster||[]).filter(x=>x.team===team),registered=new Map(registry.map(x=>[x.name,x]));
    const evidence=data.teamOrderEvidence?.[team]||{},players=new Map(),pairMap=new Map(),days=fixtures(data,team),custom=!!data.meta?.is_custom;
    function player(name){
      if(!known(name))return null;
      if(!players.has(name)){
        const s=singleMap.get(name),d=doubleMap.get(name),r=registered.get(name),e=evidence.players?.find(x=>x.player===name);
        players.set(name,{name,order:finite(r?.order),singlesPower:finite(s?.rating),doublesPower:finite(d?.rating),singlesEvidence:s?.matches||0,doublesEvidence:d?.matches||0,appearances:0,singles:0,doubles:0,wins:0,losses:0,emergencyDays:[],regularDays:[],slots:{},partners:{},registered:!!r,registeredEmergency:!!r?.emergency,evidenceEmergency:!!e?.emergencyOnly,averagePosition:finite(e?.averagePosition),historical:custom&&!r});
      }
      return players.get(name);
    }
    registry.forEach(r=>player(r.name));
    if(!custom){for(const row of evidence.players||[])player(row.player);for(const row of [...(data.singles||[]),...(data.doublesIndividuals||[])])if(row.team===team)player(row.player)}
    for(const day of days){
      const selected=new Map();
      for(const rubber of day.rubbers){
        const doubles=String(rubber.type).toLowerCase()==='doubles',own=names(rubber[day.side]),winner=names(rubber.winner),position=Number(String(rubber.position||'').match(/\d+/)?.[0])||1;
        const flags=rubber[day.side+'Emergencies'],aggregate=!!rubber[day.side+'Emergency'];
        if(doubles&&aggregate&&!Array.isArray(flags))day.uncertainEmergency=true;
        const won=winner.length?pairKey(winner)===pairKey(own):null;
        for(const [i,name] of own.entries()){
          const p=player(name);if(!p){day.unknown.push(name);continue}
          const marked=Array.isArray(flags)?!!flags[i]:!doubles&&aggregate;
          const selection=selected.get(name)||{roles:[],emergency:false};selection.roles.push((doubles?'D':'S')+position);selection.emergency||=marked;selected.set(name,selection);
          p[doubles?'doubles':'singles']++;
          if(won!==null)p[won?'wins':'losses']++;
          if(!doubles)p.slots[position]=(p.slots[position]||0)+1;
          else for(const partner of own.filter(n=>n!==name&&known(n)))p.partners[partner]=(p.partners[partner]||0)+1;
        }
        if(doubles&&own.length===2&&own.every(known)&&new Set(own).size===2){
          const key=pairKey(own),pair=pairMap.get(key)||{key,names:[...own].sort(),matches:0,wins:0,losses:0,unfinished:0,rounds:[],fixtureIds:[]};
          pair.matches++;if(won===null)pair.unfinished++;else pair[won?'wins':'losses']++;
          pair.rounds.push(day.round);pair.fixtureIds.push(day.id);pairMap.set(key,pair);
        }
      }
      for(const [name,selection] of selected){const p=players.get(name);p.appearances++;p[selection.emergency?'emergencyDays':'regularDays'].push({round:day.round,label:day.label,id:day.id,date:day.date,opponent:day.opponent});day.selected[name]={...selection,roles:[...new Set(selection.roles)]}}
    }
    const list=[...players.values()];
    for(const p of list){
      p.usualSlot=Object.keys(p.slots).sort((a,b)=>p.slots[b]-p.slots[a]||Number(a)-Number(b))[0]||null;
      p.bestPartner=Object.keys(p.partners).sort((a,b)=>p.partners[b]-p.partners[a]||a.localeCompare(b))[0]||null;
      p.emergencyOnly=custom?p.registeredEmergency||p.historical&&p.emergencyDays.length>0&&p.regularDays.length===0:(p.emergencyDays.length>0&&p.regularDays.length===0)||p.evidenceEmergency;
    }
    const core=list.filter(p=>!p.emergencyOnly&&!p.historical).sort((a,b)=>(a.order??a.averagePosition??99)-(b.order??b.averagePosition??99)||a.name.localeCompare(b.name));
    const emergencies=list.filter(p=>p.emergencyOnly||p.emergencyDays.length>0).sort(powerSort('singles'));
    const historical=list.filter(p=>p.historical&&!p.emergencyOnly).sort((a,b)=>(a.averagePosition??99)-(b.averagePosition??99)||a.name.localeCompare(b.name));
    const pairs=[...pairMap.values()].sort((a,b)=>b.matches-a.matches||b.wins-a.wins||a.key.localeCompare(b.key));
    const ladder=data.standings||[],index=ladder.findIndex(x=>x.team===team),standing=ladder[index]||null;
    return{team,custom,rules:rules(data),players:list,core,emergencies,historical,days,pairs,standing,position:standing?.officialPosition??(index>=0?index+1:null),strongest:[...core].sort(powerSort('singles'))[0]||null,mostPresent:[...core].sort((a,b)=>b.appearances-a.appearances)[0]||null,data};
  }
  function pairProjection(model,names){
    const players=names.map(name=>model.players.find(x=>x.name===name)),base=players.map(p=>p?.doublesPower??p?.singlesPower),observed=model.pairs.find(x=>x.key===pairKey(names));
    const fitted=(model.data.doubles||[]).find(x=>pairKey(x.player.split(' / '))===pairKey(names));
    if(base.some(x=>x==null))return {names,power:null,observed:observed?.matches||0};
    const effect=finite(fitted?.pairEffect)??0,count=observed?.matches||0;
    return{names,power:Math.round((base[0]+base[1])/2+effect*count/(count+3)),observed:count,fallback:players.some(p=>p?.doublesPower==null)};
  }
  function bestPairs(model,pool,count){
    if(count===0)return{pairs:[],score:0,evidence:0};if(pool.length<2*count)return null;
    if(count>3){
      const options=[];for(let i=0;i<pool.length;i++)for(let j=i+1;j<pool.length;j++)options.push(pairProjection(model,[pool[i],pool[j]]));
      options.sort((a,b)=>(b.power??-Infinity)-(a.power??-Infinity)||b.observed-a.observed);
      const used=new Set(),pairs=[];for(const pair of options)if(pair.power!=null&&pair.names.every(n=>!used.has(n))){pairs.push(pair);pair.names.forEach(n=>used.add(n));if(pairs.length===count)break}
      return pairs.length===count?{pairs,score:pairs.reduce((n,p)=>n+p.power,0),evidence:pairs.reduce((n,p)=>n+p.observed,0)}:null;
    }
    let best=null;
    function visit(remaining,pairs,score,evidence){
      if(pairs.length===count){if(!best||score>best.score||score===best.score&&evidence>best.evidence)best={pairs,score,evidence};return}
      if(remaining.length<2*(count-pairs.length))return;
      const first=remaining[0],rest=remaining.slice(1);
      // This player may be a singles-only member of the squad.
      if(rest.length>=2*(count-pairs.length))visit(rest,pairs,score,evidence);
      for(let i=0;i<rest.length;i++){
        const pair=pairProjection(model,[first,rest[i]]);if(pair.power==null)continue;
        visit(rest.filter((_,j)=>j!==i),pairs.concat(pair),score+pair.power,evidence+pair.observed);
      }
    }
    visit(pool,[],0,0);return best;
  }
  function suggest(model,finals=false){
    const {singles,doubles}=model.rules,eligible=model.core.filter(p=>!p.registeredEmergency),ranked=[...eligible].sort(powerSort('singles')),chosen=ranked.slice(0,singles);
    if(singles===0){
      const roster=[...eligible].sort(powerSort('doubles')).slice(0,4).map(p=>p.name),observed=model.pairs.filter(p=>p.names.every(n=>roster.includes(n)));
      if(roster.length<4||!observed.length)return{unavailable:true,reason:'More doubles evidence is needed to suggest a lineup.'};
      const pairs=Array.from({length:doubles},(_,i)=>pairProjection(model,observed[i%observed.length].names));
      return{singles:[],pairs,roster,finals,limited:true,attempts:1,provisional:false,estimatedPairs:pairs.some(p=>p.fallback),score:pairs.reduce((n,p)=>n+(p.power||0),0)};
    }
    if(chosen.length<singles)return{unavailable:true,reason:'Not enough recorded squad players for this format.'};
    if(chosen.some(p=>p.singlesPower==null))return{unavailable:true,reason:'More singles results are needed to suggest a Power lineup.'};
    const base=chosen.map(p=>p.name),minimum=Math.max(singles,2*doubles),max=minimum+(finals?1:0),extra=eligible.filter(p=>!base.includes(p.name)).sort(powerSort('doubles'));
    // Standard Sets and Rubbers are searched in full. Very large custom formats
    // use a bounded candidate list so a browser never enumerates millions of squads.
    const required=Math.max(0,minimum-base.length),limit=minimum>6?Math.max(12,required+1):extra.length,candidates=extra.slice(0,limit);
    let best=null,attempts=0;
    function evaluate(additions){
      const draft=base.concat(additions.map(p=>p.name)),result=bestPairs(model,draft,doubles);attempts++;
      if(result&&(!best||result.score>best.score||result.score===best.score&&result.evidence>best.evidence))best={draft,...result};
    }
    function combinations(start,needed,additions){
      if(needed===0){evaluate(additions);return}
      for(let i=start;i<=candidates.length-needed;i++)combinations(i+1,needed-1,additions.concat(candidates[i]));
    }
    for(let n=required;n<=Math.min(max-base.length,candidates.length);n++)combinations(0,n,[]);
    if(!best)return{unavailable:true,reason:'Not enough rated players to form distinct doubles pairs for this format.'};
    const used=new Set([...base,...best.pairs.flatMap(p=>p.names)]),roster=[...used];
    if(finals&&roster.length<max){const reserve=ranked.find(p=>!used.has(p.name));if(reserve)roster.push(reserve.name)}
    const order=[...chosen].sort((a,b)=>(a.order??a.averagePosition??99)-(b.order??b.averagePosition??99)||a.name.localeCompare(b.name));
    return{singles:order.map(p=>p.name),pairs:best.pairs,roster,finals,limited:limit<extra.length||doubles>3,attempts,provisional:chosen.some(p=>p.singlesEvidence<4),estimatedPairs:best.pairs.some(p=>!p.observed||p.fallback),score:best.score};
  }
  const api={build,teamNames,rules,pairKey,suggest,pairProjection};root.BRTATeamLab=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
