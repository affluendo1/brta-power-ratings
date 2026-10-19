(function(root){
  'use strict';
  const clone=x=>JSON.parse(JSON.stringify(x)),sum=x=>x.reduce((a,b)=>a+b,0),mean=x=>sum(x)/(x.length||1);
  const sorted=rows=>rows.sort((a,b)=>b.rating-a.rating||a.player.localeCompare(b.player));
  const pair=names=>names.slice().sort((a,b)=>a.localeCompare(b)).join(' / ');
  function fail(message){throw Error(message)}
  function score(r,section){
    if((r.sets||[]).some(s=>(s.h==='')!==(s.a==='')))fail('Enter both sides of each set score.');
    const bestOf=Number(section[r.type==='Doubles'?'doublesBestOf':'singlesBestOf']||(section.format==='rubbers'&&r.type==='Singles'?3:1)),targetGames=Number(r.type==='Doubles'?(section.doublesTarget||section.setTarget):section.setTarget);
    const sets=(r.sets||[]).filter(s=>s.h!==''&&s.a!=='');let hg=0,ag=0,hs=0,as=0;
    const text=[];
    for(const [i,s] of sets.entries()){
      const h=Number(s.h),a=Number(s.a),mt=!!s.mt;
      if(!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h>99||a>99)fail('Scores must be whole numbers from 0 to 99.');
      if(mt&&(!(hs===1&&as===1)||i!==sets.length-1||bestOf!==3))fail('A match tiebreak must be the deciding third set at one set all.');
      if(r.status==='Completed'){
        const target=mt?10:targetGames,hi=Math.max(h,a),lo=Math.min(h,a);
        if(h===a||hi<target||!((hi-lo>=2)||(hi===target+1&&lo===target&&!mt)))fail('A completed set needs a winning score (for example 6–4, 7–5 or 7–6).');
        if(hs===2||as===2)fail('Remove sets entered after the match was already won.');
      }
      if(!mt){hg+=h;ag+=a}hs+=h>a?1:0;as+=a>h?1:0;text.push(mt?'['+h+'-'+a+']':h+'-'+a);
    }
    let winner=hs>as?'home':as>hs?'away':'';
    if(r.status==='Forfeit'||r.status==='Retired')winner=r.winner||'';if(r.status==='Unfinished')winner='';
    if(r.status==='Completed'&&(!sets.length||(bestOf===3?Math.max(hs,as)!==2:sets.length!==1)))fail(bestOf===3?'Completed best-of-three matches need two sets won.':'A completed one-set match needs exactly one set.');
    if(r.status==='Forfeit'&&!sets.length){hs=winner==='home'?(bestOf===3?2:1):0;as=winner==='away'?(bestOf===3?2:1):0;}
    if((r.status==='Forfeit'||r.status==='Retired')&&!['home','away'].includes(winner))fail('Select the winning side for a forfeited or retired match.');
    return {hg,ag,hs,as,winner,score:text.join(' ')+(r.status==='Forfeit'?' W/O':r.status==='Retired'?' ret.':r.status==='Unfinished'?' unfinished':'')};
  }
  function validate(section){
    if(!section||typeof section!=='object'||!section.id?.startsWith('local-'))fail('This is not a custom-section backup.');
    if(!String(section.name||'').trim())fail('Give the section a name.');
    if(!['sets','rubbers'].includes(section.format)||![4,6].includes(Number(section.setTarget)))fail('Choose a valid scoring format.');
    if(section.doublesTarget!=null&&![4,6,8].includes(Number(section.doublesTarget)))fail('Choose a doubles set length of 4, 6 or 8 games.');
    for(const key of ['singlesBestOf','doublesBestOf'])if(section[key]!=null&&![1,3].includes(Number(section[key])))fail('Choose one set or best of three.');
    for(const key of ['singlesSlots','doublesSlots'])if(!Number.isInteger(Number(section[key]))||Number(section[key])<0||Number(section[key])>8)fail('Choose 0–8 singles and doubles matches per fixture.');
    if(Number(section.singlesSlots)+Number(section.doublesSlots)===0)fail('A fixture needs at least one match.');
    if(section.ratingModel!=null&&!['V3','V3B'].includes(section.ratingModel))fail('Choose V3 or V3B as the rating model.');
    if(section.doublesSurnames!=null&&typeof section.doublesSurnames!=='boolean')fail('The doubles surname setting must be on or off.');
    if(!Array.isArray(section.teams)||!Array.isArray(section.players)||!Array.isArray(section.rounds))fail('The section is missing its teams, players or rounds.');
    if(section.players.length>256||section.teams.length>64||section.rounds.length>200)fail('This browser editor supports up to 256 players, 64 teams and 200 rounds per section.');
    if(!/^[a-zA-Z0-9-]+$/.test(section.id))fail('Invalid section ID.');
    const unique=(rows,label)=>{const ids=new Set(),names=new Set();for(const r of rows){if(typeof r.id!=='string'||!/^[a-zA-Z0-9-]+$/.test(r.id)||ids.has(r.id))fail('Invalid or duplicate '+label+' ID.');ids.add(r.id);if(label==='player'||label==='team'){const name=String(r.name||'').trim();if(!name||name.length>150||['__proto__','constructor','prototype'].includes(name.toLowerCase())||name.includes('/')||names.has(name.toLowerCase()))fail('Each '+label+' needs a unique name without a slash (maximum 150 characters).');names.add(name.toLowerCase())}}};
    unique(section.teams,'team');unique(section.players,'player');unique(section.rounds,'round');
    const teams=new Set(section.teams.map(t=>t.id)),players=new Map(section.players.map(p=>[p.id,p]));
    for(const p of section.players){if(p.teamId&&!teams.has(p.teamId))fail('A player references a team that no longer exists.');if(!Number.isInteger(Number(p.order))||Number(p.order)<1)fail('Every player needs a positive registered order.');}
    const roundNumbers=new Set(),fixtureIds=new Set();
    for(const round of section.rounds){
      if(!Number.isInteger(Number(round.number))||Number(round.number)<1||roundNumbers.has(Number(round.number)))fail('Round numbers must be unique positive integers.');roundNumbers.add(Number(round.number));
      if(!/^\d{4}-\d{2}-\d{2}$/.test(round.date)||!Number.isFinite(Date.parse(round.date))||new Date(round.date).toISOString().slice(0,10)!==round.date)fail('Give every round a valid date.');
      const scheduled=new Set();
      for(const f of round.fixtures||[]){
        if(typeof f.id!=='string'||!/^[a-zA-Z0-9-]+$/.test(f.id)||fixtureIds.has(f.id))fail('Invalid or duplicate fixture ID.');fixtureIds.add(f.id);
        if(!Array.isArray(f.rubbers))fail('A fixture must contain a scorecard list.');
        for(const side of ['home','away']){const lineup=f[side+'Lineup']||[];if(!Array.isArray(lineup)||new Set(lineup).size!==lineup.length||lineup.some(pid=>!players.has(pid)))fail('Lineups must contain different registered players.');}
        if(!teams.has(f.homeTeamId)||f.awayTeamId&&(!teams.has(f.awayTeamId)||f.homeTeamId===f.awayTeamId))fail('Choose two different teams, or one team with a bye.');
        for(const id of [f.homeTeamId,f.awayTeamId].filter(Boolean)){if(scheduled.has(id))fail('A team cannot have two fixtures in the same round.');scheduled.add(id)}
        if(!['Scheduled','Completed','Wash Out','Forfeited To','Forfeited By','Bye'].includes(f.status))fail('Choose a valid fixture status.');
        if((!f.awayTeamId)!==(f.status==='Bye'))fail('A bye fixture must have exactly one team.');
        if((f.homePointsOverride!=null&&f.homePointsOverride!=='')!==(f.awayPointsOverride!=null&&f.awayPointsOverride!==''))fail('Enter both competition-point overrides, or leave both blank.');
        for(const key of ['homePointsOverride','awayPointsOverride'])if(f[key]!=null&&f[key]!==''&&(!Number.isFinite(Number(f[key]))||Number(f[key])<0||Number(f[key])>1000))fail('Competition points must be between 0 and 1000.');
        const positions=new Set();
        for(const r of f.rubbers||[]){
          if(!['Singles','Doubles'].includes(r.type)||!['Scheduled','Completed','Unfinished','Retired','Forfeit'].includes(r.status))fail('Invalid match type or status.');
          const key=r.type+':'+r.position;if(!Number.isInteger(Number(r.position))||Number(r.position)<1||positions.has(key))fail('Match positions must be positive and unique within singles or doubles.');positions.add(key);
          const needed=r.type==='Singles'?1:2;
          for(const side of ['home','away']){
            const ids=r[side]||[];
            if(ids.length!==needed||ids.some(id=>!players.has(id))||new Set(ids).size!==needed){if(r.status!=='Scheduled')fail('Select '+needed+' different player'+(needed===1?'':'s')+' on each side of every played match.');continue}
            const registered=r[side+'RegisteredTeams'];if(registered!=null&&(!Array.isArray(registered)||registered.length!==needed||registered.some(id=>id&&!teams.has(id))))fail('Invalid historical team registration.');ids.forEach((id,i)=>{const p=players.get(id),team=registered?.[i]??p.teamId;if(team!==(side==='home'?f.homeTeamId:f.awayTeamId)&&!r[side+'Emergencies']?.[i])fail(p.name+' is outside this team; mark them as an emergency.');});
          }
          if((r.home||[]).some(id=>(r.away||[]).includes(id)))fail('A player cannot play against themselves.');
          if(r.status!=='Scheduled')score(r,section);
        }
        if(f.status==='Completed'){
          for(const [type,count] of [['Singles',section.singlesSlots],['Doubles',section.doublesSlots]])if((f.rubbers||[]).filter(r=>r.type===type).length!==Number(count))fail('A completed fixture must contain the configured number of singles and doubles matches.');
          if((f.rubbers||[]).some(r=>r.status==='Scheduled'))fail('Finish every match before marking the fixture Completed.');
        }
      }
    }
    return section;
  }
  function invert(matrix){
    const n=matrix.length,a=matrix.map((row,i)=>row.concat(Array.from({length:n},(_,j)=>i===j?1:0)));
    for(let c=0;c<n;c++){let p=c;for(let i=c+1;i<n;i++)if(Math.abs(a[i][c])>Math.abs(a[p][c]))p=i;if(Math.abs(a[p][c])<1e-12)fail('Rating matrix could not be fitted.');[a[c],a[p]]=[a[p],a[c]];const k=a[c][c];a[c]=a[c].map(x=>x/k);for(let i=0;i<n;i++)if(i!==c){const k=a[i][c];for(let j=0;j<2*n;j++)a[i][j]-=k*a[c][j]}}
    return a.map(row=>row.slice(n));
  }
  const V3B_WEIGHTS=Object.freeze({game:1,setWin:2,matchWin:4,matchTiebreak:2});
  // Composite evidence in game-equivalent units. A deciding tiebreak contributes
  // a fixed total weight split by points, so extended tiebreaks cannot dominate.
  function ratingEvidence(m,model='V3'){
    if(!['V3','V3B'].includes(model))fail('Choose V3 or V3B as the rating model.');
    let home=m.hg,away=m.ag;
    if(model==='V3B'){
      home+=V3B_WEIGHTS.setWin*(m.hs||0)+V3B_WEIGHTS.matchWin*Number(m.winner==='home');
      away+=V3B_WEIGHTS.setWin*(m.as||0)+V3B_WEIGHTS.matchWin*Number(m.winner==='away');
      for(const tb of m.matchTiebreaks||[]){const total=Number(tb.h)+Number(tb.a);if(total>0){home+=V3B_WEIGHTS.matchTiebreak*Number(tb.h)/total;away+=V3B_WEIGHTS.matchTiebreak*Number(tb.a)/total;}}
    }
    return {home,away};
  }
  function fit(matches,individual=false,rubbers=false,ratingModel='V3'){
    if(!matches.length)return [];
    const labels=m=>individual?m.home.concat(m.away):[pair(m.home),pair(m.away)],names=[...new Set(matches.flatMap(labels))].sort(),ix=new Map(names.map((p,i)=>[p,i])),n=names.length;
    const ref=Math.max(...matches.map(m=>Date.parse(m.date))),design=matches.map(m=>{const d=Array(n).fill(0);if(individual){m.home.forEach(p=>d[ix.get(p)]+=.5);m.away.forEach(p=>d[ix.get(p)]-=.5)}else{d[ix.get(pair(m.home))]=1;d[ix.get(pair(m.away))]=-1}return d}),weights=matches.map(m=>2**(-Math.max(0,(ref-Date.parse(m.date))/86400000)/365));
    const counts=matches.map(m=>ratingEvidence(m,ratingModel));
    let theta=Array(n).fill(0),H;
    for(let iter=0;iter<100;iter++){
      const grad=theta.map(x=>5*x);H=Array.from({length:n},(_,i)=>Array.from({length:n},(_,j)=>i===j?5:0));
      matches.forEach((m,k)=>{const d=design[k],p=1/(1+Math.exp(-sum(d.map((x,i)=>x*theta[i]))/.75)),g=weights[k]*((counts[k].home+counts[k].away)*p-counts[k].home)/.75,c=weights[k]*(counts[k].home+counts[k].away)*p*(1-p)/(.75*.75);for(let i=0;i<n;i++){if(!d[i])continue;grad[i]+=g*d[i];for(let j=0;j<n;j++)if(d[j])H[i][j]+=c*d[i]*d[j]}});
      if(Math.max(...grad.map(Math.abs))<1e-8)break;
      const inv=invert(H),step=inv.map(row=>sum(row.map((x,i)=>x*grad[i]))),scale=Math.min(1,1/(Math.max(...step.map(Math.abs))||1));theta=theta.map((x,i)=>x-scale*step[i]);
    }
    const inv=invert(H),rowMeans=inv.map(mean),grand=mean(rowMeans),centre=mean(theta),stats=new Map(names.map(p=>[p,{matches:0,wins:0,gf:0,ga:0,partners:new Set(),team:''}]));
    matches.forEach(m=>{for(const side of ['home','away']){const entities=individual?m[side]:[pair(m[side])];entities.forEach(p=>{const s=stats.get(p),home=side==='home';s.matches++;s.wins+=Number(m.winner===side);s.gf+=home?m.hg:m.ag;s.ga+=home?m.ag:m.hg;s.team=home?m.homeTeam:m.awayTeam;if(individual)m[side].filter(x=>x!==p).forEach(x=>s.partners.add(x))})}});
    // Orthonormalise the centred design rows. Missing centred directions
    // measure the same extra-nullspace exposure used by the Python model.
    const basis=[];if(individual)for(const d of design){let v=d.slice();for(const b of basis){const dot=sum(v.map((x,i)=>x*b[i]));v=v.map((x,i)=>x-dot*b[i])}const len=Math.hypot(...v);if(len>1e-9)basis.push(v.map(x=>x/len))}
    return sorted(names.map((player,i)=>{const s=stats.get(player),rating=Math.round(1500+600*(theta[i]-centre)),se=Math.round(600*Math.sqrt(Math.max(0,inv[i][i]-2*rowMeans[i]+grand))),out={player,team:s.team,rating,se,lo:Math.round(rating-1.96*se),hi:Math.round(rating+1.96*se),matches:s.matches,wins:s.wins,losses:s.matches-s.wins,gf:s.gf,ga:s.ga};if(individual){const exposure=Math.sqrt(Math.max(0,1-1/n-sum(basis.map(b=>b[i]*b[i])))),count=s.partners.size,qualified=s.matches>=4&&(rubbers||(count>=2&&exposure<0.05));Object.assign(out,{partners:count,partner_count:count,qualified,network_rank:basis.length,identifiability_exposure:exposure,ranking_status:qualified?(rubbers?'Partner-dependent':'Established'):(exposure>=0.05||s.matches>=4&&count<2?'Partner-dependent':'Provisional')})}return out}));
  }
  function teamInsights(section,results){
    const output=Object.fromEntries(section.teams.map(t=>[t.name,{completedTies:0,lineupCount:0,lineupStability:null,lineups:[],pairs:[]}])) ,rowsByTeam=new Map(section.teams.map(t=>[t.name,[]]));
    for(const round of results)for(const f of round.fixtures){if(f.status!=='Completed')continue;const hs=f.homeSets??f.homeRubbers,as=f.awaySets??f.awayRubbers,winner=hs!==as?(hs>as?'home':'away'):f.homeGames!==f.awayGames?(f.homeGames>f.awayGames?'home':'away'):'';
      for(const side of ['home','away']){const other=side==='home'?'away':'home',rubbers=f.rubbers.slice().sort((a,b)=>(a.type==='Singles'?0:1)-(b.type==='Singles'?0:1)||Number(String(a.position).match(/\d+/)?.[0])-Number(String(b.position).match(/\d+/)?.[0])),lineup=[...new Set(rubbers.flatMap(m=>m[side].split(' / ')))],pairs=[...new Set(rubbers.filter(m=>m.type==='Doubles').map(m=>pair(m[side].split(' / '))))];rowsByTeam.get(f[side])?.push({fixtureId:f.fixtureId,round:round.round,date:round.date,opponent:f[other],result:winner?(winner===side?'W':'L'):'D',gamesFor:f[side+'Games'],gamesAgainst:f[other+'Games'],score:f[side+'Rubbers']+'–'+f[other+'Rubbers'],lineup,pairs});}
    }
    const summary=rows=>({matches:rows.length,wins:rows.filter(r=>r.result==='W').length,losses:rows.filter(r=>r.result==='L').length,draws:rows.filter(r=>r.result==='D').length,gamesFor:sum(rows.map(r=>r.gamesFor)),gamesAgainst:sum(rows.map(r=>r.gamesAgainst)),rows:rows.slice().sort((a,b)=>a.round-b.round||a.fixtureId.localeCompare(b.fixtureId))});
    for(const [team,rows] of rowsByTeam){const lg=new Map(),pg=new Map();for(const row of rows){if(row.lineup.length){const key=JSON.stringify(row.lineup);if(!lg.has(key))lg.set(key,[]);lg.get(key).push(row);}for(const name of row.pairs){if(!pg.has(name))pg.set(name,[]);pg.get(name).push(row);}}const lineups=[...lg].map(([key,group])=>({players:JSON.parse(key),...summary(group)})).sort((a,b)=>b.matches-a.matches||b.wins-a.wins||a.players.join().localeCompare(b.players.join())),pairs=[...pg].map(([name,group])=>({pair:name,...summary(group)})).sort((a,b)=>b.matches-a.matches||b.wins-a.wins||a.pair.localeCompare(b.pair));output[team]={completedTies:rows.length,lineupCount:lineups.length,lineupStability:lineups.length?Math.round(1000*lineups[0].matches/rows.length)/10:null,lineups,pairs};}
    return output;
  }
  function build(section){
    validate(section);const ratingModel=section.ratingModel||'V3',tm=new Map(section.teams.map(t=>[t.id,t.name])),pm=new Map(section.players.map(p=>[p.id,p.name])),singles=[],doubles=[],results=[],upcomingFixtures=[],standings=new Map(section.teams.map(t=>[t.name,{team:t.name,played:0,wins:0,draws:0,losses:0,rubbersFor:0,rubbersAgainst:0,gamesFor:0,gamesAgainst:0,points:0}]));
    const dateLabel=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit',timeZone:'UTC'}).replace(/ /g,' '),calendar=section.rounds.slice().sort((a,b)=>a.number-b.number);
    for(const round of calendar){const group={round:Number(round.number),date:dateLabel(round.date),label:round.label||'Round '+round.number,stage:'regular',fixtures:[]};
      for(const fixture of round.fixtures){const f={fixtureId:fixture.id,round:group.round,date:group.date,label:group.label,stage:'regular',home:tm.get(fixture.homeTeamId),away:tm.get(fixture.awayTeamId)||'Bye',status:fixture.status,rubbers:[],homeRubbers:0,awayRubbers:0,homeGames:0,awayGames:0,homeSets:section.format==='rubbers'?0:null,awaySets:section.format==='rubbers'?0:null};
        for(const [order,r] of (fixture.rubbers||[]).entries()){if(r.status==='Scheduled')continue;const x=score(r,section),home=r.home.map(id=>pm.get(id)),away=r.away.map(id=>pm.get(id));const rb={type:r.type,position:'No. '+r.position,order,home:r.type==='Singles'?home[0]:home.join(' / '),away:r.type==='Singles'?away[0]:away.join(' / '),winner:x.winner?(x.winner==='home'?(r.type==='Singles'?home[0]:home.join(' / ')):(r.type==='Singles'?away[0]:away.join(' / '))):'',score:x.score,homeEmergency:!!r.homeEmergencies?.some(Boolean),awayEmergency:!!r.awayEmergencies?.some(Boolean),homeEmergencies:r.homeEmergencies||[],awayEmergencies:r.awayEmergencies||[]};f.rubbers.push(rb);f.homeGames+=x.hg;f.awayGames+=x.ag;f.homeRubbers+=Number(x.winner==='home');f.awayRubbers+=Number(x.winner==='away');if(section.format==='rubbers'){f.homeSets+=x.hs;f.awaySets+=x.as}
          if(r.status==='Completed'&&fixture.status!=='Scheduled'&&fixture.status!=='Bye'&&fixture.status!=='Forfeited To'&&fixture.status!=='Forfeited By'){
            const evidence={home,away,hg:x.hg,ag:x.ag,hs:x.hs,as:x.as,matchTiebreaks:(r.sets||[]).filter(s=>s.mt&&s.h!==''&&s.a!=='').map(s=>({h:Number(s.h),a:Number(s.a)})),winner:x.winner,homeTeam:f.home,awayTeam:f.away,date:round.date,round:group.round,dateLabel:group.date,fixtureId:f.fixtureId,position:r.position,score:x.score,homeEmergencies:rb.homeEmergencies,awayEmergencies:rb.awayEmergencies};(r.type==='Singles'?singles:doubles).push(evidence);
          }
        }
        const scheduledSets=Number(section.singlesSlots)*(Number(section.singlesBestOf|| (section.format==='rubbers'?3:1))===3?2:1)+Number(section.doublesSlots)*(Number(section.doublesBestOf||1)===3?2:1),teamBonus=section.format==='rubbers'?1:4,drawBonus=teamBonus/2;
        let winner='';if(f.status==='Completed'){const h=section.format==='rubbers'?f.homeSets:f.homeRubbers,a=section.format==='rubbers'?f.awaySets:f.awayRubbers;winner=h!==a?(h>a?'home':'away'):f.homeGames!==f.awayGames?(f.homeGames>f.awayGames?'home':'away'):'';f.homePoints=(section.format==='rubbers'?f.homeSets:f.homeRubbers)+(winner==='home'?teamBonus:winner?0:drawBonus);f.awayPoints=(section.format==='rubbers'?f.awaySets:f.awayRubbers)+(winner==='away'?teamBonus:winner?0:drawBonus)}
        else if(f.status==='Wash Out')f.homePoints=f.awayPoints=scheduledSets/2+drawBonus;
        else if(f.status==='Forfeited To'||f.status==='Forfeited By'){winner=f.status==='Forfeited To'?'away':'home';f.homePoints=winner==='home'?scheduledSets+teamBonus:0;f.awayPoints=winner==='away'?scheduledSets+teamBonus:0}
        if(fixture.homePointsOverride!=null&&fixture.homePointsOverride!==''&&f.status!=='Scheduled'&&f.status!=='Bye'){f.homePoints=Number(fixture.homePointsOverride);f.awayPoints=Number(fixture.awayPointsOverride);}
        if(f.homePoints!=null&&f.away!=='Bye'){for(const side of ['home','away']){const s=standings.get(f[side]),other=side==='home'?'away':'home';s.played++;s.wins+=Number(winner===side);s.losses+=Number(!!winner&&winner!==side);s.draws+=Number(!winner);s.points+=f[side+'Points'];s.rubbersFor+=f[side+'Rubbers'];s.rubbersAgainst+=f[other+'Rubbers'];s.gamesFor+=f[side+'Games'];s.gamesAgainst+=f[other+'Games']}}
        group.fixtures.push(f);
      }
      upcomingFixtures.push(group);if(group.fixtures.some(f=>f.status!=='Scheduled'&&f.status!=='Bye'))results.unshift({...group,fixtures:group.fixtures.filter(f=>f.status!=='Scheduled'&&f.status!=='Bye')});
    }
    const ratingHistory={players:{},rounds:[],tables:{}},doublesRatingHistory={tables:{}},latest=results[0]?.round||0;let sr=[],dr=[],pr=[];
    for(const round of calendar.filter(r=>Number(r.number)<=latest)){
      const rnd=Number(round.number),sm=singles.filter(m=>m.round<=rnd),dm=doubles.filter(m=>m.round<=rnd);sr=fit(sm,false,false,ratingModel);dr=fit(dm,true,section.format==='rubbers',ratingModel);pr=fit(dm,false,false,ratingModel);const powers=new Map(dr.map(x=>[x.player,x.rating]));pr.forEach(p=>{p.individualAverage=Math.round(mean(p.player.split(' / ').map(n=>powers.get(n)||1500)));p.pairEffect=p.rating-p.individualAverage});ratingHistory.tables[rnd]=sr;doublesRatingHistory.tables[rnd]={pairs:pr,doublesPlayers:dr};ratingHistory.rounds.push({round:rnd,date:dateLabel(round.date),players:sr.length});sr.forEach(p=>(ratingHistory.players[p.player]??=[]).push([rnd,p.rating,p.se,p.matches,p.team]));
    }
    const rows=[...standings.values()].sort((a,b)=>b.points-a.points||(b.gamesAgainst?b.gamesFor/b.gamesAgainst:b.gamesFor?Infinity:0)-(a.gamesAgainst?a.gamesFor/a.gamesAgainst:a.gamesFor?Infinity:0)||a.team.localeCompare(b.team));
    const meta={section_code:section.id,section_label:section.name,competition_code:'LOCAL',competition_label:'My sections - '+(section.season||'Custom season'),season_id:section.id,season_label:section.season||'Custom season',format:section.format,customRules:{singlesSlots:Number(section.singlesSlots),doublesSlots:Number(section.doublesSlots),singlesBestOf:Number(section.singlesBestOf||(section.format==='rubbers'?3:1)),doublesBestOf:Number(section.doublesBestOf||1),setTarget:Number(section.setTarget),doublesTarget:Number(section.doublesTarget||section.setTarget)},ratingModel,ratingWeights:ratingModel==='V3B'?{...V3B_WEIGHTS}:{game:1,setWin:0,matchWin:0,matchTiebreak:0},doublesSurnames:!!section.doublesSurnames,is_custom:true,latest_round:latest};
    const customRoster=section.players.filter(p=>!p.archived).map(p=>({...p,team:tm.get(p.teamId)||'',rating:sr.find(x=>x.player===p.name)?.rating??dr.find(x=>x.player===p.name)?.rating??1500}));
    const teamRows=section.teams.map(t=>{const registered=new Set(customRoster.filter(p=>p.teamId===t.id).map(p=>p.name)),players=sr.filter(x=>registered.has(x.player)),four=players.slice(0,4);return {team:t.name,avg:mean(players.map(x=>x.rating))||1500,best4:mean(four.map(x=>x.rating))||1500,modelled:players.length,ladder:standings.get(t.name).points}});
    const orderEvidence={};section.teams.forEach(t=>orderEvidence[t.name]={players:section.players.filter(p=>p.teamId===t.id&&!p.archived).sort((a,b)=>a.order-b.order).map(p=>({player:p.name,rating:sr.find(x=>x.player===p.name)?.rating||1500,appearances:singles.filter(m=>m.home.includes(p.name)||m.away.includes(p.name)).length,averagePosition:p.order,emergencyOnly:!!p.emergency})),precedence:[]});
    const last=results[0],roundOverview=last?{round:last.round,label:last.label,date:last.date,fixtures:last.fixtures,summary:{completedFixtures:last.fixtures.filter(f=>f.status==='Completed').length,singlesRubbers:singles.filter(m=>m.round===last.round).length,doublesRubbers:doubles.filter(m=>m.round===last.round).length,averageSinglesMargin:Math.round(mean(singles.filter(m=>m.round===last.round).map(m=>Math.abs(m.hg-m.ag)))*10)/10}}:null;
    return {meta,singles:sr,doubles:pr,doublesIndividuals:dr,singlesMatches:singles.map(m=>[m.round,m.dateLabel,m.home[0],m.away[0],m.hg,m.ag,m.winner==='home'?m.home[0]:m.away[0],m.score,m.fixtureId]),ratingHistory,doublesRatingHistory,teams:teamRows,standings:rows,results,upcomingFixtures,format:section.format,greenBall:false,knockout:{source:'none'},sync:{checkedAt:section.updatedAt,latestRound:latest,validation:'passed',missingFixtures:0},note:'Custom section saved on this device. Ratings use '+ratingModel+(ratingModel==='V3B'?' composite game, set, match and match-tiebreak evidence':' game evidence')+' on completed played matches.',teamOrderEvidence:orderEvidence,customRoster,teamInsights:teamInsights(section,results),playerInsights:{},strengthOfSchedule:[],resultsExpectation:{players:[],matches:[]},roundOverview};
  }
  const api={validate,score,fit,build,clone,ratingEvidence,V3B_WEIGHTS};root.CustomSectionModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
