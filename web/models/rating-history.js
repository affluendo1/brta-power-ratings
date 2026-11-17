(function(root){
  'use strict';
  const sorted=rows=>rows.slice().sort((a,b)=>b.rating-a.rating||a.player.localeCompare(b.player));
  function minimum(data){
    const rules=data?.meta?.customRules||data?.meta?.competition_rules;
    const players=Number(rules?.playersPerTeam??(rules?Math.max(rules.singlesSlots,2*rules.doublesSlots):(data?.format??data?.meta?.format)==='rubbers'?2:4));
    return players===2||players===3?3:4;
  }
  function doublesRow(row,data){
    if(minimum(data)!==3||row.qualified||!(row.matches>=3))return row;
    const fixedPair=(data.format??data.meta?.format)==='rubbers';
    if(!fixedPair&&!((row.partner_count??row.partners)>=2&&row.identifiability_exposure<.05))return row;
    return {...row,qualified:true,ranking_status:fixedPair?'Partner-dependent':'Established'};
  }
  function qualified(row,view,data){return view==='overall'||view==='doublesPlayers'?!!row.qualified:row.matches>=(view==='pairs'?2:minimum(data))}
  function overall(singles,doubles,data){
    const sm=new Map(singles.map(x=>[x.player,x])),dm=new Map(doubles.map(x=>[x.player,x]));
    return [...new Set([...sm.keys(),...dm.keys()])].map(player=>{
      const s=sm.get(player),d=dm.get(player),both=s&&d;
      return {player,team:s?.team||d?.team||'',rating:both?Math.round((s.rating+d.rating)/2):(s?.rating??d?.rating??1500),
        se:both?Math.round(Math.hypot(s.se,d.se)/2):(s?.se??d?.se??0),s,d,qualified:!!(s&&s.matches>=minimum(data)&&d?.qualified)};
    });
  }
  function rowsAt(data,view,round=null){
    if(data.meta?.singlesOnly&&view!=='singles')return [];
    if(round==null){
      if(view==='overall')return overall(data.singles||[],(data.doublesIndividuals||[]).map(row=>doublesRow(row,data)),data);
      if(view==='doublesPlayers')return (data.doublesIndividuals||[]).map(row=>doublesRow(row,data));
      return data[view==='pairs'?'doubles':view==='doublesPlayers'?'doublesIndividuals':'singles']||[];
    }
    const singles=data.ratingHistory?.tables?.[round]??Object.entries(data.ratingHistory?.players||{}).flatMap(([player,values])=>{
      const snap=values.filter(x=>Number(x[0])<=round).at(-1);
      return snap?[{player,team:snap[4]||'',rating:snap[1],se:snap[2],matches:snap[3]}]:[];
    });
    const doubles=data.doublesRatingHistory?.tables?.[round];
    if(view==='overall')return overall(singles,(doubles?.doublesPlayers||[]).map(row=>doublesRow(row,data)),data);
    if(view==='doublesPlayers')return (doubles?.doublesPlayers||[]).map(row=>doublesRow(row,data));
    return view==='singles'?singles:(doubles?.[view]||[]);
  }
  function rounds(data,view){
    if(data.meta?.singlesOnly&&view!=='singles')return [];
    return (data.ratingHistory?.rounds||[]).filter(x=>view==='singles'||data.doublesRatingHistory?.tables?.[x.round]);
  }
  function ranked(rows,view,data){let rank=0;return sorted(rows).map(row=>({...row,rank:qualified(row,view,data)?++rank:null}))}
  function withMovement(data,view,round=null){
    const calendar=rounds(data,view).map(x=>Number(x.round)).sort((a,b)=>a-b),target=round==null?calendar.at(-1):Number(round);
    const previousRound=calendar.filter(x=>x<target).at(-1);
    const previous=new Map(previousRound==null?[]:ranked(rowsAt(data,view,previousRound),view,data).filter(x=>x.rank!=null).map(x=>[x.player,x]));
    const previousRatings=new Map(previousRound==null?[]:rowsAt(data,view,previousRound).map(x=>[x.player,x.rating]));
    return ranked(rowsAt(data,view,round),view,data).map(row=>({...row,
      movement:row.rank!=null&&previous.has(row.player)?previous.get(row.player).rank-row.rank:null,
      ratingChange:previousRatings.has(row.player)?row.rating-previousRatings.get(row.player):null,
      isNew:row.rank!=null&&previousRound!=null&&!previous.has(row.player),previousRound}));
  }
  const api={rowsAt,rounds,ranked,withMovement,qualified,minimum};
  root.BRTAHistory=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

