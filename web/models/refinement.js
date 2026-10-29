/* Shared 8.2.2 presentation decisions; pure functions for tables and exports. */
(function(root){'use strict';
const blend=(ultra,singles)=>Number.isFinite(ultra)&&Number.isFinite(singles)?Math.round((ultra+singles)/2):null;
function decodeIndex(data){const fields=['player','team','rating','wins','losses','gf','ga','matches','se','qualified','pairEffect','individualAverage'];return(data.entries||[]).map(entry=>({...data.sections[entry[0]],...Object.fromEntries(fields.map((f,i)=>[f,entry[i+1]]))}))}
function scoped(rows,{scope,seasonKey,sectionCodes=[]}){if(scope==='history')return rows;const codes=new Set(sectionCodes);return rows.filter(r=>codes.has(r.sectionCode)&&(seasonKey?r.seasonKey===seasonKey:r.isCurrent))}
function search(rows,query){const tokens=String(query||'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().split(/[\s/]+/).filter(Boolean);return rows.filter(r=>tokens.every(t=>r.player.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().includes(t)))}
const layouts={square:{w:1200,h:1200,header:.24,footer:.92,columns:1},portrait:{w:1080,h:1440,header:.24,footer:.93,columns:1},story:{w:1080,h:1920,header:.25,footer:.90,columns:1},landscape:{w:1600,h:1000,header:.27,footer:.91,columns:2}};
const api={blend,decodeIndex,scoped,search,layouts};root.BRTARefinement=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
