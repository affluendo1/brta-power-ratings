(function(root){
  'use strict';
  const M=root.CustomSectionModel||(typeof require==='function'?require('./custom-section-model.js'):null),copy=x=>JSON.parse(JSON.stringify(x)),normal=x=>String(x??'').trim().replace(/\s+/g,' ').toLowerCase();
  const uuid=()=>root.crypto?.randomUUID?.()||'import-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  function date(value){const text=String(value||'').trim();if(!text)return '';let d;if(/^\d{4}-\d{2}-\d{2}$/.test(text))d=text;else{const m=text.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/);if(m)d=(m[3].length===2?'20'+m[3]:m[3])+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');else{const t=Date.parse(text);if(!Number.isFinite(t))throw Error('Invalid round date: '+text);d=new Date(t).toISOString().slice(0,10)}}if(!Number.isFinite(Date.parse(d))||new Date(d).toISOString().slice(0,10)!==d)throw Error('Invalid round date: '+text);return d}
  function plusDays(d,days){const t=new Date(d+'T12:00:00Z');t.setUTCDate(t.getUTCDate()+days);return t.toISOString().slice(0,10)}
  function scoreSets(value){const text=String(value||'').trim();if(!text)return [];const pattern=/\[?\s*(\d+)\s*[-–:]\s*(\d+)\s*\]?/g,result=[];let m;while((m=pattern.exec(text)))result.push({h:Number(m[1]),a:Number(m[2]),mt:m[0].includes('[')});if(!result.length||text.replace(pattern,'').replace(/[\s,;]/g,''))throw Error('Use scores such as 6-4 or 6-4 4-6 [10-8].');return result}
  function finish(f,section){
    if(f.autoStatus===false)return;
    for(const m of f.rubbers||[]){if(!['Scheduled','Completed'].includes(m.status))continue;try{M.score({...m,status:'Completed'},section);if(m.home.every(Boolean)&&m.away.every(Boolean))m.status='Completed'}catch(e){m.status='Scheduled'}}
    if(!['Scheduled','Completed'].includes(f.status))return;
    const matches=f.rubbers||[],counts=matches.filter(x=>x.type==='Singles').length===Number(section.singlesSlots)&&matches.filter(x=>x.type==='Doubles').length===Number(section.doublesSlots);
    f.status=counts&&matches.length&&matches.every(x=>x.status!=='Scheduled')?'Completed':'Scheduled';
  }
  function lineup(section,f,side,selected){const current=f[side+'Lineup']||[],team=f[side+'TeamId'],set=new Set(selected);f[side+'Lineup']=current.filter(id=>set.has(id));const extra=section.players.filter(p=>set.has(p.id)&&!f[side+'Lineup'].includes(p.id)).sort((a,b)=>(a.teamId!==team)-(b.teamId!==team)||a.order-b.order||a.name.localeCompare(b.name));f[side+'Lineup'].push(...extra.map(p=>p.id));if(!f[side+'OrderEdited'])f[side+'Lineup'].sort((a,b)=>{const pa=section.players.find(p=>p.id===a),pb=section.players.find(p=>p.id===b);return (pa.teamId!==team)-(pb.teamId!==team)||pa.order-pb.order||pa.name.localeCompare(pb.name)});if(f[side+'DoublesPairs'])f[side+'DoublesPairs']=f[side+'DoublesPairs'].map(pair=>pair.filter(id=>set.has(id)));return f[side+'Lineup']}
  function makeMatch(section,f,type,position,home,away){const flags=(ids,side)=>ids.map(id=>{const p=section.players.find(p=>p.id===id);return !!p&&(p.emergency||p.teamId!==f[side+'TeamId'])});return {id:uuid(),type,position,home:home.slice(),away:away.slice(),homeEmergencies:flags(home,'home'),awayEmergencies:flags(away,'away'),sets:[{h:'',a:'',mt:false}],status:home.includes(M.NO_PLAYER)&&away.includes(M.NO_PLAYER)?'No Contest':(home.includes(M.NO_PLAYER)||away.includes(M.NO_PLAYER))?'Forfeit':'Scheduled',winner:home.includes(M.NO_PLAYER)&&away.includes(M.NO_PLAYER)?'':home.includes(M.NO_PLAYER)?'away':away.includes(M.NO_PLAYER)?'home':''}}
  function doublesPairs(section,f,side){
    const ids=f[side+'Lineup']||[],chosen=f[side+'DoublesPairs'];
    const slots=Array.from({length:Number(section.doublesSlots)},(_,i)=>{
      const previous=(f.rubbers||[]).find(m=>m.type==='Doubles'&&Number(m.position)===i+1)?.[side]||[];
      return [...new Set((chosen?.[i]??previous).filter(id=>id!==M.NO_PLAYER&&ids.includes(id)))].slice(0,2);
    });
    const used=new Set(slots.flat()),available=ids.filter(id=>!used.has(id));
    return slots.map((pair,i)=>chosen?.[i]?pair:pair.concat(available.splice(0,2-pair.length)));
  }
  function hasEnteredResults(f){
    return (f.rubbers||[]).some(m=>{
      if((m.sets||[]).some(s=>s.h!==''&&s.h!=null||s.a!==''&&s.a!=null))return true;
      if(m.status==='Retired')return true;
      // generated short-handed fixtures must stay editable as the squad fills up.
      if(['Forfeit','No Contest'].includes(m.status)){
        const absent=(m.home||[]).includes(M.NO_PLAYER)||(m.away||[]).includes(M.NO_PLAYER);
        return !absent||f.autoStatus===false;
      }
      return false;
    });
  }
  const enteredScore=m=>(m.sets||[]).some(s=>[s.h,s.a].some(value=>value!==''&&value!=null));
  const hasPlayed=f=>(f.rubbers||[]).some(m=>enteredScore(m)||['Completed','Retired','Unfinished'].includes(m.status));
  const noPlayWashout=f=>f.status==='Wash Out'&&!f.rubbers.length&&!f.homeLineup?.length&&!f.awayLineup?.length;
  function washOut(f,section,noPlay=false){
    if(noPlay){
      if(hasPlayed(f))throw Error('This fixture has play recorded. Keep the matches for a mid-fixture washout.');
      for(const side of ['home','away']){
        f[side+'Lineup']=[];
        for(const key of ['DoublesPairs','Attendees','OrderEdited'])delete f[side+key];
      }
      f.rubbers=[];
    }else{
      const updates=(f.rubbers||[]).filter(m=>m.status==='Scheduled'&&enteredScore(m)).map(m=>{
        const result={...m,status:'Completed'};
        try{M.score(result,section)}catch{result.status='Unfinished';M.score(result,section)}
        return [m,result.status];
      });
      for(const [match,status] of updates)match.status=status;
    }
    f.status='Wash Out';
    f.autoStatus=false;
  }
  function fillMissing(section,f){
    if(!(f.rubbers||[]).length)return 0;
    let fresh;
    try{fresh=generate(section,f)}catch{return 0}
    let changes=0;
    for(const m of f.rubbers){
      if((m.sets||[]).some(s=>s.h!==''&&s.h!=null||s.a!==''&&s.a!=null)||m.status==='Retired')continue;
      if(f.autoStatus===false&&['Forfeit','No Contest'].includes(m.status))continue;
      const wanted=fresh.find(x=>x.type===m.type&&Number(x.position)===Number(m.position));
      if(!wanted)continue;
      let changed=false;
      for(const side of ['home','away']){
        const current=m[side]||[],replacement=wanted[side]||[];
        if(!current.includes(M.NO_PLAYER))continue;
        const used=new Set(current.filter(id=>id!==M.NO_PLAYER));
        const available=replacement.filter(id=>id!==M.NO_PLAYER&&!used.has(id));
        const next=current.map(id=>id===M.NO_PLAYER&&available.length?available.shift():id);
        if(next.some((id,i)=>id!==current[i])){
          m[side]=next;
          m[side+'Emergencies']=next.map(id=>{const p=section.players.find(p=>p.id===id);return !!p&&(p.emergency||p.teamId!==f[side+'TeamId'])});
          if(m[side+'RegisteredTeams'])m[side+'RegisteredTeams']=next.map(id=>section.players.find(p=>p.id===id)?.teamId||'');
          changed=true;
        }
      }
      if(changed){
        const absentHome=m.home.includes(M.NO_PLAYER),absentAway=m.away.includes(M.NO_PLAYER);
        m.status=absentHome&&absentAway?'No Contest':absentHome||absentAway?'Forfeit':'Scheduled';
        m.winner=absentHome&&absentAway?'':absentHome?'away':absentAway?'home':'';
        m.sets=[{h:'',a:'',mt:false}];delete m.quickWinner;changes++;
      }
    }
    if(changes)finish(f,section);
    return changes;
  }
  function generate(section,f){
    const sentinel=M.NO_PLAYER,h=f.homeLineup||[],a=f.awayLineup||[],hp=doublesPairs(section,f,'home'),ap=doublesPairs(section,f,'away'),matches=[];
    if(!h.length&&!a.length)throw Error('Select at least one player for either team.');
    for(let i=0;i<Number(section.singlesSlots);i++)
      matches.push(makeMatch(section,f,'Singles',i+1,[h[i]||sentinel],[a[i]||sentinel]));
    const fullPair=pair=>[pair[0]||sentinel,pair[1]||sentinel];
    for(let i=0;i<Number(section.doublesSlots);i++)
      matches.push(makeMatch(section,f,'Doubles',i+1,fullPair(hp[i]),fullPair(ap[i])));
    return matches;
  }
  function reconcileSquad(section,before,next,side){
    const hasSquad=f=>f.homeLineup?.length||f.awayLineup?.length;
    const key=match=>match.type+':'+Number(match.position);
    const samePlayers=(a,b)=>JSON.stringify(a.slice().sort())===JSON.stringify(b.slice().sort());
    const oldDefaults=new Map((hasSquad(before)?generate(section,before):[]).map(m=>[key(m),m]));
    const defaults=hasSquad(next)?generate(section,next):[];
    const wanted=new Map(defaults.map(m=>[key(m),m]));
    const removed=new Set((before[side+'Lineup']||[]).filter(id=>!next[side+'Lineup']?.includes(id)));
    const cleared=[];
    const matches=[];
    for(const old of before.rubbers||[]){
      const target=wanted.get(key(old)),previous=oldDefaults.get(key(old));
      wanted.delete(key(old));
      const affectsPlayers=old[side].some(id=>removed.has(id));
      const shifted=target&&(!previous||!samePlayers(previous[side],target[side]));
      const replacement=target?.[side]||old[side].map(id=>removed.has(id)?M.NO_PLAYER:id);
      if((affectsPlayers||shifted)&&!samePlayers(old[side],replacement)){
        const updated=makeMatch(section,next,old.type,old.position,
          side==='home'?replacement:old.home,side==='away'?replacement:old.away);
        const other=side==='home'?'away':'home';
        updated.id=old.id;
        updated[other+'Emergencies']=old[other+'Emergencies']??updated[other+'Emergencies'];
        if(old[other+'RegisteredTeams'])updated[other+'RegisteredTeams']=old[other+'RegisteredTeams'];
        if(hasEnteredResults({rubbers:[old],autoStatus:before.autoStatus}))cleared.push(key(old));
        matches.push(updated);
      }else{
        matches.push(copy(old));
      }
    }
    next.rubbers=matches.concat([...wanted.values()]);
    if(next.status==='Completed'&&next.rubbers.some(m=>m.status==='Scheduled'))next.status='Scheduled';
    finish(next,section);
    return cleared;
  }
  function scheduledFixture(homeTeamId,awayTeamId){
    return {id:uuid(),homeTeamId,awayTeamId,status:awayTeamId?'Scheduled':'Bye',
      homeLineup:[],awayLineup:[],rubbers:[]};
  }
  function completeDraw(section){
    const teamCount=section.teams.length,legLength=teamCount-(teamCount%2===0?1:0);
    const regular=section.rounds.filter(r=>M.roundStage(r)==='regular').sort((a,b)=>a.number-b.number);
    const summary={returnFixtures:0,semifinals:0};
    if(teamCount<2||regular.length<legLength)return summary;

    const start=Number(regular[0].number),firstLeg=regular.slice(0,legLength);
    const isFullRound=(round,offset)=>Number(round.number)===start+offset&&
      round.fixtures.filter(f=>f.awayTeamId).length===Math.floor(teamCount/2);
    if(!firstLeg.every(isFullRound))return summary;
    const firstMatches=firstLeg.flatMap(r=>r.fixtures).filter(f=>f.awayTeamId);
    const pair=f=>JSON.stringify([f.homeTeamId,f.awayTeamId].sort());
    const matchKey=f=>JSON.stringify([f.homeTeamId,f.awayTeamId||'']);
    if(new Set(firstMatches.map(pair)).size!==teamCount*(teamCount-1)/2)return summary;

    const byNumber=new Map(section.rounds.map(r=>[Number(r.number),r]));
    const regularEnd=start+2*legLength-1;
    if(regular.some(r=>Number(r.number)>regularEnd))return summary;
    const day=86400000,firstTime=Date.parse(firstLeg[0].date),lastTime=Date.parse(firstLeg.at(-1).date);
    const shiftDays=Math.round((lastTime-firstTime)/day)+7;
    const plans=firstLeg.map(r=>{
      const number=Number(r.number)+legLength;
      const target=byNumber.get(number);
      const reversed=r.fixtures.map(f=>f.awayTeamId
        ?{homeTeamId:f.awayTeamId,awayTeamId:f.homeTeamId}
        :{homeTeamId:f.homeTeamId,awayTeamId:''});
      const keys=new Set(reversed.map(matchKey));
      const compatible=!target||(M.roundStage(target)==='regular'&&target.fixtures.every(f=>keys.has(matchKey(f))));
      return {number,target,reversed,compatible,date:plusDays(r.date,shiftDays)};
    });
    // A manually arranged return leg can use a different round order.
    if(plans.every(plan=>plan.compatible)){
      for(const {number,target,reversed,date} of plans){
        const round=target||{id:uuid(),number,date,stage:'regular',fixtures:[]};
        const existing=new Set(round.fixtures.map(matchKey));
        for(const fixture of reversed){
          if(existing.has(matchKey(fixture)))continue;
          round.fixtures.push(scheduledFixture(fixture.homeTeamId,fixture.awayTeamId));
          summary.returnFixtures++;
        }
        if(!target){section.rounds.push(round);byNumber.set(number,round);}
      }
    }

    const secondLeg=Array.from({length:legLength},(_,i)=>byNumber.get(start+legLength+i));
    if(!secondLeg.every((round,i)=>round&&M.roundStage(round)==='regular'&&isFullRound(round,legLength+i)))return summary;
    const returnMatches=secondLeg.flatMap(r=>r.fixtures).filter(f=>f.awayTeamId);
    const returnKeys=new Set(returnMatches.map(matchKey));
    if(returnKeys.size!==firstMatches.length||firstMatches.some(f=>
      !returnKeys.has(matchKey({homeTeamId:f.awayTeamId,awayTeamId:f.homeTeamId}))))return summary;
    if(firstMatches.concat(returnMatches).some(f=>f.status==='Scheduled'))return summary;

    const semiNumber=regularEnd+1,existingSemi=byNumber.get(semiNumber);
    if(section.rounds.some(r=>M.roundStage(r)==='semi_final'&&(r!==existingSemi||r.fixtures.length)))return summary;
    if(existingSemi&&M.roundStage(existingSemi)!=='semi_final')return summary;
    const count=Math.min(section.semifinalPlaces??4,teamCount);
    if(count<2||count%2)return summary;
    const teams=new Map(section.teams.map(t=>[t.name,t.id]));
    const seeds=M.build(section,{standingsOnly:true}).slice(0,count).map(row=>teams.get(row.team));
    const semi=existingSemi||{id:uuid(),number:semiNumber,date:plusDays(secondLeg.at(-1).date,7),stage:'semi_final',fixtures:[]};
    semi.fixtures=seeds.slice(0,count/2).map((home,i)=>scheduledFixture(home,seeds[count-1-i]));
    if(!existingSemi)section.rounds.push(semi);
    summary.semifinals=semi.fixtures.length;
    return summary;
  }
  function delimited(text,separator){const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++}else quoted=!quoted}else if(!quoted&&c===separator){row.push(field.trim());field=''}else if(!quoted&&(c==='\n'||c==='\r')){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field.trim());if(row.some(Boolean))rows.push(row);row=[];field=''}else field+=c}if(quoted)throw Error('Unclosed quotation mark in the imported table.');row.push(field.trim());if(row.some(Boolean))rows.push(row);return rows}
  function parse(text,section,defaults={}){
    if(typeof text!=='string'||!text.trim())throw Error('Paste fixtures or choose a file first.');if(text.length>2*1024*1024)throw Error('Import up to 2 MB at a time.');
    const teams=new Map(section.teams.map(t=>[normal(t.name),t])),players=new Map(section.players.map(p=>[normal(p.name),p])),rounds=[],baseRound=Number(defaults.number)||1,baseDate=date(defaults.date)||new Date().toISOString().slice(0,10);let current=null,lastFixture=null;
    const getRound=(number,day,label='',stage)=>{const n=Number(number);if(!Number.isInteger(n)||n<1)throw Error('Every round needs a positive round number.');const existing=section.rounds.find(r=>Number(r.number)===n),imported=rounds.find(r=>r.number===n),d=date(day)||imported?.date||existing?.date||plusDays(baseDate,(n-baseRound)*7);let r=rounds.find(r=>r.number===n);if(r&&r.date!==d)throw Error('Round '+n+' has conflicting dates.');if(!r){r={id:existing?.id||uuid(),number:n,date:d,label:label||existing?.label||'',stage:stage??existing?.stage,fixtures:[]};rounds.push(r)}current=r;lastFixture=null;return r};
    const addFixture=(home,away,status)=>{if(!current)getRound(baseRound,baseDate);const ht=teams.get(normal(home)),bye=!normal(away)||['bye','byes'].includes(normal(away)),at=bye?null:teams.get(normal(away));if(!ht)throw Error('Unknown home team “'+home+'”. Use a team from Teams & players.');if(!bye&&!at)throw Error('Unknown away team “'+away+'”. Use a team from Teams & players.');if(ht.id===at?.id)throw Error('A team cannot play itself.');if(current.fixtures.some(f=>[f.homeTeamId,f.awayTeamId].some(id=>id===ht.id||at&&id===at.id)))throw Error('A team appears twice in Round '+current.number+'.');const statuses=new Map([['scheduled','Scheduled'],['completed','Completed'],['wash out','Wash Out'],['washout','Wash Out'],['forfeited to','Forfeited To'],['forfeited by','Forfeited By'],['bye','Bye']]);if(status&&!statuses.has(normal(status)))throw Error('Unknown fixture status: '+status);lastFixture={id:uuid(),homeTeamId:ht.id,awayTeamId:at?.id||'',status:bye?'Bye':statuses.get(normal(status))||'Scheduled',homeLineup:[],awayLineup:[],rubbers:[]};current.fixtures.push(lastFixture);return lastFixture};
    const addMatch=(value)=>{if(!lastFixture||lastFixture.status==='Bye')throw Error('Place each match after its team fixture.');const code=String(value.code||value.type||'').trim(),type=/^(d|double)/i.test(code)?'Doubles':/^(s|single)/i.test(code)?'Singles':null;if(!type)throw Error('Use S1, S2… or D1, D2… for individual matches.');const position=Number(value.position||code.match(/\d+/)?.[0]||lastFixture.rubbers.filter(r=>r.type===type).length+1),names=side=>Array.isArray(value[side])?value[side]:String(value[side]||'').split(/\s*\/\s*/);const resolve=side=>names(side).map(name=>{const p=players.get(normal(name));if(!p)throw Error('Unknown player “'+name+'”. Register them before importing matches.');return p.id});const h=resolve('home'),a=resolve('away'),n=type==='Singles'?1:2;if(h.length!==n||a.length!==n)throw Error(type+' requires '+n+' player(s) on each side.');const r=makeMatch(section,lastFixture,type,position,h,a);r.sets=Array.isArray(value.sets)?copy(value.sets):scoreSets(value.score);r.status=value.status||(r.sets.length?'Completed':'Scheduled');if(value.winner)r.winner=value.winner;for(const side of ['home','away'])if(Array.isArray(value[side+'Emergencies']))r[side+'Emergencies']=value[side+'Emergencies'].map(Boolean);if(r.status!=='Scheduled')M.score(r,section);lastFixture.rubbers.push(r);for(const side of ['home','away'])for(const id of r[side])if(!lastFixture[side+'Lineup'].includes(id))lastFixture[side+'Lineup'].push(id)};
    const trimmed=text.trim().replace(/^\uFEFF/,'');
    if(trimmed.startsWith('{')||trimmed.startsWith('[')){let parsed;try{parsed=JSON.parse(trimmed)}catch(e){throw Error('The JSON is not valid.')}const source=Array.isArray(parsed)?(parsed.every(x=>Array.isArray(x.fixtures))?parsed:[{number:baseRound,date:baseDate,fixtures:parsed}]):Array.isArray(parsed.rounds)?parsed.rounds:Array.isArray(parsed.fixtures)?[{...parsed,number:parsed.number??parsed.round??baseRound,date:parsed.date||baseDate}]:null;if(!Array.isArray(source))throw Error('JSON must contain a rounds list.');for(const r of source){getRound(r.number??r.round,r.date,r.label,r.stage);if(!Array.isArray(r.fixtures))throw Error('Each JSON round needs a fixtures list.');for(const f of r.fixtures){addFixture(f.home,f.away,f.status);for(const m of f.matches||[])addMatch(m)}}}
    else {
      const first=trimmed.split(/\r?\n/)[0],separator=first.includes('\t')?'\t':',',table=delimited(trimmed,separator),header=table[0]?.map(normal),homeIndex=header?.findIndex(x=>['home','home team'].includes(x)),awayIndex=header?.findIndex(x=>['away','away team'].includes(x));
      if(homeIndex>=0&&awayIndex>=0){const index=labels=>header.findIndex(x=>labels.includes(x)),ri=index(['round','round number']),di=index(['date','round date']),si=index(['status']);for(const [i,row] of table.slice(1).entries()){try{getRound(ri>=0&&row[ri]?String(row[ri]).replace(/^(?:round|rd\.?|r)\s*/i,''):baseRound,di>=0?row[di]:'');addFixture(row[homeIndex],row[awayIndex],si>=0?row[si]:'')}catch(e){throw Error('Table row '+(i+2)+': '+e.message)}}}
      else for(const [i,line] of trimmed.split(/\r?\n/).entries()){
        const value=line.trim();if(!value||value.startsWith('#'))continue;
        try{const heading=value.match(/^(?:round|rd\.?|r)\s*(\d+)\s*(?:[|,:\-]\s*(.*))?$/i);if(heading){getRound(heading[1],heading[2]);continue}
          const cells=value.split('|').map(x=>x.trim());if(/^[SD]\s*\d+$/i.test(cells[0])&&cells.length>=3){addMatch({code:cells[0].replace(/\s/g,''),home:cells[1],away:cells[2],score:cells[3]||''});continue}
          let sides;if(cells.length>=2)sides=cells;else{sides=value.split(/\s+(?:v(?:s\.?)?|versus)\s+/i);if(sides.length<2)sides=value.split('\t');}if(sides.length<2)throw Error('Use “Home team v Away team” or “Home team | Away team”.');addFixture(sides[0],sides[1],sides[2]);
        }catch(e){throw Error('Line '+(i+1)+': '+e.message)}
      }
    }
    if(!rounds.length||!rounds.some(r=>r.fixtures.length))throw Error('No fixtures found.');if(rounds.length>200)throw Error('Import up to 200 rounds at a time.');
    for(const r of rounds)for(const f of r.fixtures){if(f.status==='Completed'){const full=f.rubbers.filter(m=>m.type==='Singles').length===Number(section.singlesSlots)&&f.rubbers.filter(m=>m.type==='Doubles').length===Number(section.doublesSlots)&&f.rubbers.every(m=>m.status!=='Scheduled');if(!full)throw Error('Round '+r.number+': a Completed fixture needs its full scorecard. Omit Status to import fixtures only.')}finish(f,section)}
    const draft={...copy(section),rounds};M.validate(draft);return rounds.sort((a,b)=>a.number-b.number);
  }
  function merge(section,rounds,{replace=false,numbers=rounds.map(r=>r.number)}={}){
    const next=copy(section),chosen=rounds.filter(r=>numbers.includes(Number(r.number)));if(!chosen.length)throw Error('Select at least one round to import.');
    for(const r of chosen){const old=next.rounds.find(x=>Number(x.number)===Number(r.number));if(old&&!replace){if(old.date!==r.date)throw Error('Round '+r.number+' already has a different date. Choose Replace selected rounds to change it.');if(M.roundStage(old)!==M.roundStage(r))throw Error('Round '+r.number+' has a different stage. Choose Replace selected rounds to change it.');old.fixtures.push(...copy(r.fixtures));}else if(old){Object.assign(old,copy(r),{id:old.id})}else next.rounds.push(copy(r));}
    M.validate(next);return next;
  }
  function rosterPlayers(section){const teams=new Map(section.teams.map((t,i)=>[t.id,i]));return section.players.filter(p=>!p.archived).slice().sort((a,b)=>(teams.get(a.teamId)??1e9)-(teams.get(b.teamId)??1e9)||a.order-b.order||a.name.localeCompare(b.name));}
  function rosterText(section){const teams=new Map(section.teams.map(t=>[t.id,t.name]));return rosterPlayers(section).map(p=>[p.name,teams.get(p.teamId)||'',p.order,p.emergency?'E':''].join(' | ')).join('\n');}
  function playerReferences(section){const refs=new Set();for(const round of section.rounds)for(const f of round.fixtures)for(const side of ['home','away']){for(const id of f[side+'Lineup']||[])refs.add(id);for(const pair of f[side+'DoublesPairs']||[])for(const id of pair)refs.add(id);for(const m of f.rubbers)for(const id of m[side]||[])if(id)refs.add(id);}return refs;}
  function replaceRoster(section,text,{replace=true,renumber=false}={}){
    if(typeof text!=='string'||text.length>200000)throw Error('Paste a roster smaller than 200 KB.');
    const next=copy(section),old=new Map(section.players.map(p=>[normal(p.name),p])),teams=new Map(next.teams.map(t=>[normal(t.name),t])),seen=new Set(),counts=new Map(),usedIds=new Set(),refs=playerReferences(section),rows=[],summary={retained:[],added:[],updated:[],reactivated:[],archived:[],removed:[],teamsAdded:[]};
    if(old.size!==section.players.length)throw Error('Some existing names differ only by spaces. Make those names distinct before replacing the roster.');if(teams.size!==section.teams.length)throw Error('Some team names differ only by spaces. Make those names distinct first.');
    for(const [lineNumber,line] of text.split(/\r?\n/).entries()){
      if(!line.trim())continue;
      try{
        const cells=line.split('|').map(x=>x.trim());if(cells.length>4)throw Error('Use Name | Team | Order | E.');
        const [name,teamName='',order='',em='']=cells,key=normal(name);if(!key)throw Error('Enter a player name.');if(seen.has(key))throw Error('Duplicate player name: '+name);seen.add(key);
        if(em&&!/^(e|yes|true|no|false|0)$/i.test(em))throw Error('Use E for an emergency, or leave it blank.');
        let team=teamName?teams.get(normal(teamName)):null;if(teamName&&!team){team={id:uuid(),name:teamName};teams.set(normal(teamName),team);next.teams.push(team);summary.teamsAdded.push(teamName);}
        const existing=old.get(key);if(!replace&&existing&&!existing.archived)throw Error(name+' already exists. Use Replace current roster to edit existing players.');
        const teamId=team?.id||'',position=(counts.get(teamId)||0)+1;counts.set(teamId,position);
        let registered=renumber||!order?position:Number(order);if(!replace&&!order&&!renumber)registered=Math.max(0,...next.players.filter(p=>p.teamId===teamId&&!p.archived).map(p=>p.order),...rows.filter(p=>p.teamId===teamId).map(p=>p.order))+1;
        if(!Number.isInteger(registered)||registered<1)throw Error('Order must be a positive whole number.');
        const p={...existing,id:existing?.id||uuid(),name,teamId,order:registered,emergency:/^(e|yes|true)$/i.test(em)};delete p.archived;rows.push(p);usedIds.add(p.id);
        if(!existing)summary.added.push(name);else{summary.retained.push(name);if(existing.archived)summary.reactivated.push(name);if(existing.name!==p.name||existing.teamId!==p.teamId||existing.order!==p.order||!!existing.emergency!==p.emergency)summary.updated.push(name);}
      }catch(e){throw Error('Line '+(lineNumber+1)+': '+e.message);}
    }
    if(!replace&&!rows.length)throw Error('Paste at least one player.');
    // retain stable IDs for names. omitted players with scorecards or saved squads
    // remain historical identities, outside the active roster and future pickers.
    if(replace){for(const p of section.players)if(!usedIds.has(p.id)){if(refs.has(p.id)){rows.push({...p,archived:true});if(!p.archived)summary.archived.push(p.name);}else summary.removed.push(p.name);}next.players=rows;}
    else next.players=next.players.filter(p=>!usedIds.has(p.id)).concat(rows);
    // A transfer must not turn an old appearance into a retroactive emergency.
    const current=new Map(next.players.map(p=>[p.id,p])),prior=new Map(section.players.map(p=>[p.id,p]));
    for(const round of next.rounds)for(const f of round.fixtures)for(const m of f.rubbers)for(const side of ['home','away'])if((m[side]||[]).some(id=>prior.get(id)?.teamId!==current.get(id)?.teamId))m[side+'RegisteredTeams']=(m[side]||[]).map((id,i)=>m[side+'RegisteredTeams']?.[i]??prior.get(id)?.teamId??'');
    M.validate(next);return {section:next,summary};
  }
  const api={parse,merge,completeDraw,scheduledFixture,finish,lineup,generate,reconcileSquad,makeMatch,scoreSets,date,plusDays,doublesPairs,hasEnteredResults,hasPlayed,noPlayWashout,washOut,fillMissing,rosterPlayers,rosterText,replaceRoster,playerReferences};root.CustomSectionTools=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
/* BRTA Power Ratings 9.9g */
