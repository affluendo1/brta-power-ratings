(function(root){
'use strict';
const Scores=root.BRTAScores||(typeof require==='function'?require('./score-formats'):null);
const names=['Apex','Elite','Advanced','Strong','Middle Class','Developing','Struggling','Basement'];
function bands(rows,qualified=()=>true){
 // Qualified entries anchor the distribution. Provisional entries use the same boundaries.
 let values=rows.filter(qualified).map(r=>r.rating).filter(Number.isFinite).sort((a,b)=>a-b);
 if(!values.length)values=rows.map(r=>r.rating).filter(Number.isFinite).sort((a,b)=>a-b);
 if(!values.length)return{names,bounds:[],cuts:[],classFor:()=>''};
 const quantile=q=>{const at=(values.length-1)*q,lo=Math.floor(at);return values[lo]+(values[Math.ceil(at)]-values[lo])*(at-lo)},median=quantile(.5);
 // IQR resists isolated extremes; unlike percentile buckets, rare bands need not be filled.
 const spread=(quantile(.75)-quantile(.25))/1.349||Math.sqrt(values.reduce((n,v)=>n+(v-median)**2,0)/values.length)||100;
 const cuts=[2,1.25,.6,.1,-.5,-1.1,-1.8].map(z=>Math.ceil(median+z*spread));
 for(let i=cuts.length-2;i>=0;i--)cuts[i]=Math.max(cuts[i],cuts[i+1]+1);
 const bounds=names.map((_,i)=>i===0?'≥ '+cuts[0]:i===names.length-1?'< '+cuts.at(-1):cuts[i]+'–'+(cuts[i-1]-1));
 return{names,bounds,cuts,median,spread,classFor:rating=>Number.isFinite(rating)?'b'+cuts.filter(c=>rating<c).length:''};
}
function percentage(row){return row.officialPercentage!=null?Number(row.officialPercentage):row.gamesAgainst?100*row.gamesFor/row.gamesAgainst:row.gamesFor?Infinity:0}
function sourceDate(value){
 const text=String(value||''),iso=text.match(/^(\d{4})-(\d{2})-(\d{2})$/),named=text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{2,4})$/);
 let year,month,day;if(iso){[,year,month,day]=iso;year=+year;month=+month;day=+day}else if(named){day=+named[1];month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[2].slice(0,3).toLowerCase())+1;year=+named[3]+(named[3].length===2?2000:0)}else return null;
 const date=new Date(Date.UTC(year,month-1,day));return year>=1000&&date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.toISOString().slice(0,10):null;
}
function observations(data){const result=[];
 for(const round of data.results||[])for(const f of round.fixtures||[])for(const r of f.rubbers||[]){
  if(r.valid_for_rating===false||r.status&&r.status!=='Completed'||!r.winner||/ret|forfeit|walkover|unfinished/i.test(r.score||''))continue;
  const home=String(r.home||'').split(/\s*\/\s*/),away=String(r.away||'').split(/\s*\/\s*/);if(!home[0]||!away[0])continue;
  const sets=Scores.parse(r.score,{outcomeCode:Scores.outcomeCode(data,r.type)});if(!sets.length)continue;
  const regular=sets.filter(s=>!s.mt),hs=sets.filter(s=>s.winner==='home').length,as=sets.filter(s=>s.winner==='away').length;
  result.push({home,away,type:r.type,hg:regular.reduce((n,s)=>n+s.h,0),ag:regular.reduce((n,s)=>n+s.a,0),hs,as,matchTiebreaks:sets.filter(s=>s.mt).map(s=>s.unknown?s:{h:s.h,a:s.a,mt:true}),winner:r.winner===r.home?'home':'away',date:sourceDate(f.date||round.date),round:Number(round.round),homeTeam:f.home,awayTeam:f.away,events:sets,fixtureId:f.fixtureId,position:r.position});
 }return result;
}
function recalculate(data,model,engine){
 if(model!=='RM1'&&model!=='RM2'&&model!=='RM3b'&&data.meta?.ratingModel!=='V3B'&&!data.meta?.needsScoreRefit)return data;const fitModel=['RM1','RM2'].includes(model)?'V2':model==='RM3b'?'V3B':'V3';
 const all=observations(data),copy={...data,meta:{...data.meta,ratingModel:model==='RM1'?'V1':fitModel,predictionModel:model,ratingCentre:1500,ratingScale:['RM1','RM2'].includes(model)?250:600,ratingProbabilityScale:['RM1','RM2'].includes(model)?187.5:450,scoreSchema:2,needsScoreRefit:false},ratingHistory:{...data.ratingHistory,tables:{},players:{}},doublesRatingHistory:{...data.doublesRatingHistory,tables:{}}};
 const merge=(base,fitted)=>{const byName=new Map(fitted.map(r=>[r.player,r]));return(base||[]).map(r=>{const f=byName.get(r.player);return f?{...r,rating:f.rating,se:f.se,lo:f.lo,hi:f.hi,gf:f.gf,ga:f.ga}:r}).sort((a,b)=>b.rating-a.rating||a.player.localeCompare(b.player));};
 function calculate(round,baseS,baseD,baseP){const subset=round==null?all:all.filter(m=>m.round<=round),reference=subset.map(m=>m.date).filter(Boolean).sort().at(-1)||'2000-01-01',matches=subset.map(m=>({...m,date:m.date||reference})),s=engine.fit(matches.filter(m=>m.type==='Singles'),false,false,fitModel),d=engine.fit(matches.filter(m=>m.type==='Doubles'),true,data.format==='rubbers',fitModel),p=engine.fit(matches.filter(m=>m.type==='Doubles'),false,false,fitModel),powers=new Map(d.map(r=>[r.player,r.rating]));p.forEach(r=>{r.individualAverage=Math.round(r.player.split(' / ').reduce((n,p)=>n+(powers.get(p)||1500),0)/2);r.pairEffect=r.rating-r.individualAverage});return{singles:merge(baseS,s),doublesPlayers:merge(baseD,d),pairs:merge(baseP,p).map(r=>{const f=p.find(x=>x.player===r.player);return f?{...r,individualAverage:f.individualAverage,pairEffect:f.pairEffect}:r})};}
 for(const item of data.ratingHistory?.rounds||[]){const n=+item.round,b=data.doublesRatingHistory?.tables?.[n],r=calculate(n,data.ratingHistory?.tables?.[n]||[],b?.doublesPlayers||[],b?.pairs||[]);copy.ratingHistory.tables[n]=r.singles;copy.doublesRatingHistory.tables[n]={doublesPlayers:r.doublesPlayers,pairs:r.pairs};r.singles.forEach(p=>(copy.ratingHistory.players[p.player]??=[]).push([n,p.rating,p.se,p.matches,p.team]));}
 const latest=calculate(null,data.singles,data.doublesIndividuals,data.doubles);copy.singles=latest.singles;copy.doublesIndividuals=latest.doublesPlayers;copy.doubles=latest.pairs;
 const powers=new Map(copy.singles.map(r=>[r.player,r.rating]));
 copy.teams=(copy.teams||[]).map(t=>{const rows=copy.singles.filter(r=>r.team===t.team);return{...t,avg:rows.length?rows.reduce((n,r)=>n+r.rating,0)/rows.length:1500,best4:rows.length?rows.slice(0,4).reduce((n,r)=>n+r.rating,0)/Math.min(4,rows.length):1500}});
 copy.strengthOfSchedule=copy.singles.map(r=>{const opponents=all.filter(m=>m.type==='Singles'&&(m.home.includes(r.player)||m.away.includes(r.player))).map(m=>powers.get(m.home.includes(r.player)?m.away[0]:m.home[0])).filter(Number.isFinite);return{player:r.player,team:r.team,matches:opponents.length,averageOpponent:opponents.length?Math.round(opponents.reduce((n,v)=>n+v,0)/opponents.length):null}}).sort((a,b)=>(b.averageOpponent||0)-(a.averageOpponent||0)).map((r,i,a)=>({...r,rank:i+1,total:a.length}));
 for(const r of copy.singles){const row=copy.strengthOfSchedule.find(x=>x.player===r.player);Object.assign(r,{averageOpponent:row?.averageOpponent,scheduleRank:row?.rank,scheduleTotal:row?.total})}
 for(const team of Object.values(copy.teamOrderEvidence||{}))for(const p of team.players||[])if(powers.has(p.player))p.rating=powers.get(p.player);
 copy.playerInsights={};copy.resultsExpectation={players:[],matches:[]};copy.matchupMatrix=null;copy.leader=null;
 if(copy.roundOverview){for(const k of ['topPerformance','biggestUpset','dominantWin','closestMatch'])copy.roundOverview[k]=null;const rounds=(copy.ratingHistory.rounds||[]).map(x=>+x.round).sort((a,b)=>a-b),prior=new Map((copy.ratingHistory.tables[rounds.at(-2)]||[]).map(r=>[r.player,r.rating])),moves=(copy.ratingHistory.tables[rounds.at(-1)]||[]).filter(r=>prior.has(r.player)).map(r=>({player:r.player,change:r.rating-prior.get(r.player)})).sort((a,b)=>b.change-a.change);copy.roundOverview.summary={...copy.roundOverview.summary,topMover:moves[0]||null,biggestDrop:moves.at(-1)||null}}return copy;
}
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function report(data,history){
 const table=(rows,columns)=>'<div class="scroll"><table><thead><tr>'+columns.map(([key,label])=>'<th>'+escape(label)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+columns.map(([key])=>'<td>'+escape(row[key])+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 const statKeys=[['rank','#'],['player','Player / pair'],['team','Team'],['rating','Power'],['band','Band'],['wins','Wins'],['losses','Losses'],['matches','Matches'],['gf','Games won'],['ga','Games lost'],['percentage','Game %'],['movement','Position change'],['ratingChange','Power change'],['se','Uncertainty ±'],['lo','95% low'],['hi','95% high'],['partner_count','Partners'],['ranking_status','Status'],['individualAverage','Individual average'],['pairEffect','Pair effect'],['singlesPower','Singles Power'],['doublesPower','Doubles Power']];
 let body='<h1>'+escape(data.meta.competition_label)+' · '+escape(data.meta.section_label)+'</h1><p>Complete section · '+escape(data.meta.season_label||'')+' · '+escape(data.meta.predictionModel||(data.meta.ratingModel==='V3B'?'RM3b':'RM3'))+'</p>';
 for(const [view,title]of [['singles','Singles'],['doublesPlayers','Doubles players'],['pairs','Doubles pairs'],['overall','Overall']]){const rows=history.withMovement(data,view),b=bands(rows,r=>history.qualified(r,view));body+='<h2>'+title+'</h2>'+table(rows.map(r=>({...r,ranking_status:r.ranking_status||(r.rank==null?'Provisional':'Ranked'),band:names[+b.classFor(r.rating).slice(1)]||'—',percentage:r.gf+r.ga?(100*r.gf/(r.gf+r.ga)).toFixed(2)+'%':'—',singlesPower:r.s?.rating,doublesPower:r.d?.rating})),statKeys);}
 body+='<h2>Standings</h2>'+table((data.standings||[]).map((r,i)=>({...r,position:r.officialPosition||i+1,percentage:Number.isFinite(percentage(r))?percentage(r).toFixed(2)+'%':'∞'})),[['position','#'],['team','Team'],['played','Played'],['wins','Wins'],['draws','Draws'],['losses','Losses'],['gamesFor','Games for'],['gamesAgainst','Games against'],['percentage','%'],['points','Points']]);
 body+='<h2>Full fixture list</h2>'+table((data.upcomingFixtures||[]).flatMap(r=>(r.fixtures||[]).map(f=>({...f,round:r.label||r.round,date:f.date||r.date}))),[['round','Round'],['date','Date'],['home','Home'],['away','Away'],['status','Status']]);
 body+='<h2>All results and individual matches</h2>';
 for(const round of [...(data.results||[])].reverse()){body+='<h3>'+escape(round.label||'Round '+round.round)+' · '+escape(round.date)+'</h3>';for(const f of round.fixtures||[]){body+='<h4>'+escape(f.home)+' v '+escape(f.away)+'</h4><p>'+escape(f.status)+' · Points '+escape(f.homePoints)+'–'+escape(f.awayPoints)+' · Rubbers '+escape(f.homeRubbers)+'–'+escape(f.awayRubbers)+' · Games '+escape(f.homeGames)+'–'+escape(f.awayGames)+'</p>'+table(f.rubbers||[],[['type','Type'],['position','Order'],['home','Home players'],['away','Away players'],['winner','Winner'],['score','Score'],['status','Status']]);}}
 for(const item of data.ratingHistory?.rounds||[]){body+='<details><summary>Ratings after Round '+escape(item.round)+'</summary>';for(const [view,title]of [['singles','Singles'],['doublesPlayers','Doubles players'],['pairs','Doubles pairs'],['overall','Overall']])body+='<h3>'+title+'</h3>'+table(history.withMovement(data,view,+item.round),statKeys);body+='</details>';}
 body+='<details><summary>Additional section data</summary><pre>'+escape(JSON.stringify({knockout:data.knockout,teamInsights:data.teamInsights,playerInsights:data.playerInsights,strengthOfSchedule:data.strengthOfSchedule,resultsExpectation:data.resultsExpectation,roundOverview:data.roundOverview,roster:data.customRoster},null,2))+'</pre></details>';
 body+='<details><summary>Complete section data (JSON)</summary><pre>'+escape(JSON.stringify(data,null,2))+'</pre></details>';
 return'<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Complete section</title><style>body{font:15px/1.5 Arial,sans-serif;margin:32px;color:#202b35}h1{font-size:26px}h2{border-bottom:2px solid #43596b;margin-top:32px}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{padding:8px;text-align:left;border:1px solid #cbd2d9;white-space:nowrap}th{background:#e9edf1}tr:nth-child(even){background:#f7f8fa}.scroll{overflow:auto}details{margin:16px 0;padding:12px;border:1px solid #cbd2d9}pre{white-space:pre-wrap;overflow-wrap:anywhere}@media print{body{margin:0}.scroll{overflow:visible}table{font-size:9px}th,td{white-space:normal;padding:3px}}</style>'+body+'</html>';
}
const api={names,bands,percentage,sourceDate,observations,recalculate,report};root.BRTALayoutModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);

