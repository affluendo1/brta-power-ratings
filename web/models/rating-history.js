(function(root){
  'use strict';
  const sorted=rows=>rows.slice().sort((a,b)=>b.rating-a.rating||a.player.localeCompare(b.player));
  function qualified(row,view){return view==='overall'||view==='doublesPlayers'?!!row.qualified:row.matches>=(view==='pairs'?2:4)}
  function overall(singles,doubles){
    const sm=new Map(singles.map(x=>[x.player,x])),dm=new Map(doubles.map(x=>[x.player,x]));
    return [...new Set([...sm.keys(),...dm.keys()])].map(player=>{
      const s=sm.get(player),d=dm.get(player),both=s&&d;
      return {player,team:s?.team||d?.team||'',rating:both?Math.round((s.rating+d.rating)/2):(s?.rating??d?.rating??1500),
        se:both?Math.round(Math.hypot(s.se,d.se)/2):(s?.se??d?.se??0),s,d,qualified:!!(s&&s.matches>=4&&d?.qualified)};
    });
  }
  function rowsAt(data,view,round=null){
    if(data.meta?.singlesOnly&&view!=='singles')return [];
    if(round==null){
      if(view==='overall')return overall(data.singles||[],data.doublesIndividuals||[]);
      return data[view==='pairs'?'doubles':view==='doublesPlayers'?'doublesIndividuals':'singles']||[];
    }
    const singles=data.ratingHistory?.tables?.[round]??Object.entries(data.ratingHistory?.players||{}).flatMap(([player,values])=>{
      const snap=values.filter(x=>Number(x[0])<=round).at(-1);
      return snap?[{player,team:snap[4]||'',rating:snap[1],se:snap[2],matches:snap[3]}]:[];
    });
    const doubles=data.doublesRatingHistory?.tables?.[round];
    if(view==='overall')return overall(singles,doubles?.doublesPlayers||[]);
    return view==='singles'?singles:(doubles?.[view]||[]);
  }
  function rounds(data,view){
    if(data.meta?.singlesOnly&&view!=='singles')return [];
    return (data.ratingHistory?.rounds||[]).filter(x=>view==='singles'||data.doublesRatingHistory?.tables?.[x.round]);
  }
  function ranked(rows,view){let rank=0;return sorted(rows).map(row=>({...row,rank:qualified(row,view)?++rank:null}))}
  function withMovement(data,view,round=null){
    const calendar=rounds(data,view).map(x=>Number(x.round)).sort((a,b)=>a-b),target=round==null?calendar.at(-1):Number(round);
    const previousRound=calendar.filter(x=>x<target).at(-1);
    const previous=new Map(previousRound==null?[]:ranked(rowsAt(data,view,previousRound),view).filter(x=>x.rank!=null).map(x=>[x.player,x]));
    const previousRatings=new Map(previousRound==null?[]:rowsAt(data,view,previousRound).map(x=>[x.player,x.rating]));
    return ranked(rowsAt(data,view,round),view).map(row=>({...row,
      movement:row.rank!=null&&previous.has(row.player)?previous.get(row.player).rank-row.rank:null,
      ratingChange:previousRatings.has(row.player)?row.rating-previousRatings.get(row.player):null,
      isNew:row.rank!=null&&previousRound!=null&&!previous.has(row.player),previousRound}));
  }
  const api={rowsAt,rounds,ranked,withMovement,qualified};
  root.BRTAHistory=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

