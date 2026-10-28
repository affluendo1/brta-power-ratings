(function(root){
'use strict';
const key=v=>String(v||'').split(/\s*\/\s*/).sort((a,b)=>a.localeCompare(b)).join(' / ');
const members=v=>String(v||'').split(/\s*\/\s*/).filter(Boolean);
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
function rows(data,view,round=null){
 if(round!=null&&view!=='singles'){const available=Object.keys(data.doublesRatingHistory?.tables||{}).map(Number).filter(r=>r<=round);if(!available.length)return [];round=Math.max(...available)}
 return root.BRTAHistory.rowsAt(data,view,round);
}
function row(data,view,name,round=null){return rows(data,view,round).find(x=>view==='pairs'?key(x.player)===key(name):x.player===name)}
function rank(data,view,name,round=null){return root.BRTAHistory.ranked(rows(data,view,round),view).find(x=>view==='pairs'?key(x.player)===key(name):x.player===name)?.rank??null}
function pairPower(data,pair,round=null){const p=row(data,'pairs',pair,round);if(p)return {rating:p.rating,fallback:false};const values=members(pair).map(n=>row(data,'doublesPlayers',n,round)?.rating);return {rating:values.length===2&&values.every(Number.isFinite)?Math.round(avg(values)):null,fallback:true}}
function matches(data,name,kind='singles',through=null){const isPair=kind==='pairs',double=kind!=='singles',result=[];
 for(const group of data.results||[])for(const f of group.fixtures||[]){const round=Number(f.round??group.round);if(through!=null&&round>through)continue;
  for(const r of f.rubbers||[]){if((r.type==='Doubles')!==double||!r.winner||r.valid_for_rating===false||/ret|forfeit|walkover|unfinished/i.test(r.score||'')||r.status&&r.status!=='Completed')continue;
   const home=isPair?key(r.home)===key(name):members(r.home).includes(name),away=isPair?key(r.away)===key(name):members(r.away).includes(name);if(!home&&!away)continue;
   const own=home?r.home:r.away,opp=home?r.away:r.home,won=key(r.winner)===key(own),sets=[...String(r.score||'').matchAll(/(\[)?(\d+)\s*[-–:]\s*(\d+)(?:\([^)]*\))?\]?/g)].map(m=>({h:+m[2],a:+m[3],mt:!!m[1]}));if(!sets.length)continue;
   if(sets.length===3&&Math.max(sets[2].h,sets[2].a)>=10)sets[2].mt=true;
   const gf=sets.filter(x=>!x.mt).reduce((s,x)=>s+(home?x.h:x.a),0),ga=sets.filter(x=>!x.mt).reduce((s,x)=>s+(home?x.a:x.h),0),pre=round-1;
   const oppPower=double?pairPower(data,opp,pre).rating:row(data,'singles',opp,pre)?.rating??1500,ownPower=double?pairPower(data,own,pre).rating:row(data,'singles',name,pre)?.rating??1500;
   const currentOpp=double?pairPower(data,opp,through).rating:row(data,'singles',opp,through)?.rating,currentOwn=double?pairPower(data,own,through).rating:row(data,'singles',name,through)?.rating;
   const gap=(oppPower??1500)-(ownPower??1500),higher=gap?gap>0:(currentOpp??1500)!==(currentOwn??1500)?currentOpp>currentOwn:(double?key(opp):opp).localeCompare(double?key(own):name)<0;
   const opponent=double?pairPower(data,opp,through):{rating:currentOpp,fallback:false};
   result.push({round,date:f.date||group.date,fixtureId:f.fixtureId,opp,partner:double?members(own).find(n=>n!==name):null,pair:key(own),won,gf,ga,score:home?r.score:String(r.score).replace(/(\d+)\s*([-–:])\s*(\d+)/g,(_,a,d,b)=>b+d+a),oppRating:opponent.rating,fallback:opponent.fallback,preOpponent:oppPower??1500,preOwn:ownPower??1500,gap,higher,position:Number(String(r.position).match(/\d+/)?.[0])||1,team:home?f.home:f.away,emergency:!!r[home?'homeEmergency':'awayEmergency'],performance:Math.round((oppPower??1500)+450*Math.log((gf+.5)/(ga+.5))),close:data.format==='rubbers'?sets.length>=3||sets.some(x=>x.mt):Math.abs(gf-ga)<=2});
  }
 }return result.sort((a,b)=>a.round-b.round||a.position-b.position);
}
function contextData(data,round=null){if(round==null)return data;const filter=groups=>(groups||[]).filter(g=>Number(g.round)<=round);return {...data,singles:rows(data,'singles',round),doubles:rows(data,'pairs',round),doublesIndividuals:rows(data,'doublesPlayers',round),results:filter(data.results),upcomingFixtures:filter(data.upcomingFixtures),teamOrderEvidence:{},playerInsights:{}}}
function schedule(data,round=null,provisional=false){return rows(data,'singles',round).filter(x=>provisional||root.BRTAHistory.qualified(x,'singles')).map(x=>{const m=matches(data,x.player,'singles',round),ratings=m.map(r=>row(data,'singles',r.opp,round)?.rating).filter(Number.isFinite);return {...x,averageOpponent:ratings.length?Math.round(avg(ratings)):null,matches:ratings.length,provisional:!root.BRTAHistory.qualified(x,'singles')}}).filter(x=>x.averageOpponent!=null).sort((a,b)=>b.averageOpponent-a.averageOpponent||a.player.localeCompare(b.player)).map((x,i,all)=>({...x,rank:i+1,total:all.length}))}
function history(data,view,name,through=null){return (data.ratingHistory?.rounds||[]).filter(x=>through==null||x.round<=through).flatMap(x=>{const r=row(data,view,name,x.round);return r?[{round:x.round,rating:r.rating,rank:rank(data,view,name,x.round)}]:[]})}
function discipline(data,pair=false){return pair?'pairs':data.meta?.competition_rules?.singlesSlots===0?'doublesPlayers':'singles'}
const api={discipline,key,members,rows,row,rank,pairPower,matches,contextData,schedule,history};root.BRTALabModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
