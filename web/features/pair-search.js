/* Shared normal/optional partnership scopes. Complete indexes load only on demand. */
(function(root){'use strict';const R=BRTARefinement,cache=new Map();let limit=150,signature='',openRequest=0;
function source(view='pairs'){
 if(ratingScope==='section')return{rows:BRTAHistory.withMovement(D,view==='pairs'?'pairs':'singles',ratingRound)};
 const file=view==='pairs'?'pair-search.json':'singles-search.json';let entry=cache.get(file);
 if(!entry){entry={rows:null,error:null};cache.set(file,entry);fetch('data/archive/'+file+'?v='+encodeURIComponent(DATA.globalSync.checkedAt||''),{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('The complete search index is not available yet.');return r.json()}).then(data=>{entry.rows=R.decodeIndex(data);renderRatings()}).catch(error=>{entry.error=error.message;renderRatings()})}
 if(entry.error)return{rows:[],notice:entry.error};if(!entry.rows)return{rows:[],notice:'Loading partnerships and section history…'};
 let rows=R.scoped(entry.rows,{scope:ratingScope,seasonKey:activeHistorySeasonId,sectionCodes:viewCatalog.map(s=>s.section_code)});
 if(ratingScope==='all'&&!activeHistorySeasonId&&window.CustomSections)for(const meta of CustomSections.catalog()){const data=CustomSections.payload(meta.section_code);rows=rows.concat(((view==='pairs'?data.doubles:data.singles)||[]).map(r=>({...r,sectionCode:meta.section_code,sectionLabel:meta.section_label,isCurrent:true,dataPath:null,isCustom:true}))) }
 return{rows};
}
async function openRow(row,pair=true){const request=++openRequest;
 try{if(R.needsSection(row,D.meta.section_code,activeHistorySeasonId)){let season=null;if(row.seasonKey){const catalog=await ensureHistoryCatalog();season=catalog.seasons.find(s=>s.id===row.seasonKey)}const data=row.isCustom?CustomSections.payload(row.sectionCode):await fetch(row.dataPath,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Section unavailable');return r.json()});if(request!==openRequest)return;activeHistorySeasonId=season&&!season.is_current?season.id:null;viewCatalog=activeHistorySeasonId?historySeasonSections(season):currentCatalog();setupSelectors();if(await loadSection(row.sectionCode,data)===false)return;switchPage('ratings')}
 if(request!==openRequest)return;if(pair)lab8Open(row.player,null,true);else openProfile(row.player);
 }catch(error){BRTA82.modal('Could not open section','<p>'+esc(error.message)+'</p>')}
}
const base=renderRatings;renderRatings=function(){if(ratingView!=='pairs'||ratingScope==='section'){base();return}const src=source(),q=$('#search').value.trim(),sig=ratingScope+'|'+q+'|'+activeHistorySeasonId;if(sig!==signature){signature=sig;limit=150}let rows=src.rows.filter(r=>showProv||r.qualified),command=BRTASearchCommands.select(rows,q);rows=command||R.search(rows,q);if(!q)rows=[];$('#ratingsTitle').textContent=(ratingScope==='history'?'All history':'All sections')+' · Doubles pairs';$('#ratingsDesc').textContent='Search either partner to find their partnerships.';$('#ratingsHint').textContent='Ratings are fitted within each section.';$('#teamFilter').disabled=true;renderBandInfo({bounds:[]});$('#ratingHead').innerHTML='<tr><th>Pair</th><th>Team</th><th>Section / season</th><th>Power</th><th>W–L</th><th>Matches</th></tr>';root.BRTAPairSource.visible=rows;
$('#ratingBody').innerHTML=rows.slice(0,limit).map((r,i)=>'<tr><td><button class="person" data-wide-pair="'+i+'">'+esc(r.player)+'</button></td><td>'+teamName(r.team)+'</td><td>'+esc([r.sectionLabel,r.seasonLabel,r.competitionLabel].filter(Boolean).join(' · '))+'</td><td><b>'+r.rating+'</b></td><td>'+(r.wins??0)+'–'+(r.losses??0)+'</td><td>'+(r.matches??'—')+'</td></tr>').join('')+(rows.length>limit?'<tr><td colspan="6"><button class="export-link" data-wide-pair-more>Show more partnerships</button></td></tr>':'')||'<tr><td colspan="6">'+esc(src.notice||(!q?'Type either partner’s name.':'No matching partnerships.'))+'</td></tr>';
};
document.addEventListener('click',e=>{const p=e.target.closest('[data-wide-pair]');if(p){openRow(root.BRTAPairSource.visible[+p.dataset.widePair]);return}if(e.target.closest('[data-wide-pair-more]')){limit+=150;renderRatings()}});
root.BRTAPairSource={source,openRow,visible:[]};
// Resolve render handlers at event time, after optional views have decorated them.
$('#teamFilter').onchange=()=>renderRatings();$('#search').oninput=()=>renderRatings();
})(window);
