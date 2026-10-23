((root)=>{
  const normalise=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/\s+/g,' ').trim();
  const seasonOrder=row=>{const year=Number(row.seasonLabel.match(/\d{4}/)?.[0]||0),term=/spring/i.test(row.seasonLabel)?3:/autumn/i.test(row.seasonLabel)?2:1;return year*10+term};
  function find(index,query){
    const q=normalise(query),tokens=q.split(' ').filter(Boolean);
    if(!q)return [];
    const names=new Map();
    index.players.forEach((name,i)=>{const n=normalise(name);if(tokens.every(t=>n.includes(t)))names.set(i,{name,score:n===q?0:n.startsWith(q)?1:2})});
    return index.entries.filter(row=>names.has(row[0])).map(([nameId,sectionId,team])=>({
      ...index.sections[sectionId],player:names.get(nameId).name,team,score:names.get(nameId).score
    })).sort((a,b)=>a.score-b.score||a.player.localeCompare(b.player)||
      seasonOrder(b)-seasonOrder(a)||
      a.competitionCode.localeCompare(b.competitionCode)||a.sectionLabel.localeCompare(b.sectionLabel,undefined,{numeric:true}));
  }
  const api={normalise,find};root.BRTAPlayerSearch=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
