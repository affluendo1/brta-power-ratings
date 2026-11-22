((root)=>{
  const normalise=value=>String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/\s+/g,' ').trim();
  const seasonOrder=row=>{const match=/(Spring|Autumn|Winter|Summer)\s+(\d{4}|\d{2})(?!\d)/i.exec(row.seasonLabel);if(!match)return 0;let year=Number(match[2]);if(match[2].length===2)year+=year<70?2000:1900;return year*10+({spring:3,autumn:2,winter:1,summer:4}[match[1].toLowerCase()])};
  function distance(left, right) {
    if (Math.abs(left.length - right.length) > 2) return Infinity;
    let older, previous = Array.from({length: right.length + 1}, (_, i) => i);
    for (let i = 1; i <= left.length; i++) {
      const next = [i];
      for (let j = 1; j <= right.length; j++) {
        const cost = left[i - 1] === right[j - 1] ? 0 : 1;
        next[j] = Math.min(previous[j] + 1, next[j - 1] + 1, previous[j - 1] + cost);
        if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) {
          next[j] = Math.min(next[j], older[j - 2] + 1);
        }
      }
      [older, previous] = [previous, next];
    }
    return previous[right.length];
  }
  function nameScore(name, query, allowTypos = false) {
    const n = normalise(name), q = normalise(query);
    const tokens = q.split(' ').filter(Boolean);
    if (!tokens.length) return Infinity;
    if (tokens.every(token => n.includes(token))) return n === q ? 0 : n.startsWith(q) ? 1 : 2;
    if (!allowTypos || q.length < 4 || tokens.length > 5 || q.length > 90) return Infinity;
    const words = n.split(/[^\p{L}\p{N}-]+/u).filter(Boolean);
    let errors = 0;
    for (const token of tokens) {
      if (n.includes(token)) continue;
      if (token.length < 4) return Infinity;
      const limit = token.length >= 7 ? 2 : 1;
      const edits = Math.min(...words.map(word => distance(token, word)));
      if (edits > limit) return Infinity;
      errors += edits;
      if (errors > 2) return Infinity;
    }
    return 2 + errors;
  }
  function find(index, query, fuzzyOnly = false){
    if (!normalise(query)) return [];
    const names = new Map();
    index.players.forEach((name, i) => {
      const score = nameScore(name, query, fuzzyOnly);
      if (Number.isFinite(score) && (!fuzzyOnly || score > 2)) names.set(i, {name, score});
    });
    // old indexes used global numeric ids, keep those
    // references until the next full archive index build.
    return index.entries.filter(row=>names.has(row[0])).map(([nameId,sectionId,team,identity])=>({
      ...index.sections[sectionId],player:names.get(nameId).name,team,score:names.get(nameId).score,identity
    })).sort((a,b)=>a.score-b.score||a.player.localeCompare(b.player)||
      seasonOrder(b)-seasonOrder(a)||
      a.competitionCode.localeCompare(b.competitionCode)||a.sectionLabel.localeCompare(b.sectionLabel,undefined,{numeric:true}));
  }
  const api={normalise,find,nameScore};root.BRTAPlayerSearch=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
