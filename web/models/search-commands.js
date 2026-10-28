(function(root){
'use strict';
const commands={':highest-rating':['rating',-1,1],':highest-ratings':['rating',-1,10],':lowest-rating':['rating',1,1],':lowest-ratings':['rating',1,10],':best-wl':['record',-1,1],':worst-wl':['record',1,1],':highest-game-percentage':['games',-1,1],':lowest-game-percentage':['games',1,1],':highest-score':['rating',-1,1],':highest-scores':['rating',-1,10]};
function select(rows,command){const spec=commands[String(command).trim().toLowerCase()];if(!spec)return null;const [metric,direction,limit]=spec;
 const value=r=>metric==='rating'?r.rating:metric==='record'?(r.wins+r.losses>0?r.wins/(r.wins+r.losses):null):(r.gf+r.ga>0?100*r.gf/(r.gf+r.ga):null);
 const valid=rows.filter(r=>Number.isFinite(value(r))).map(r=>({...r,commandValue:value(r)})).sort((a,b)=>direction*(a.commandValue-b.commandValue)||(metric==='record'?(direction<0?b.wins-a.wins:b.losses-a.losses):0)||a.player.localeCompare(b.player));
 if(limit===10)return valid.slice(0,10);if(!valid.length)return[];const top=valid[0];return valid.filter(r=>r.commandValue===top.commandValue&&(metric!=='record'||(direction<0?r.wins:r.losses)===(direction<0?top.wins:top.losses)));
}
const api={commands,select};root.BRTASearchCommands=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
