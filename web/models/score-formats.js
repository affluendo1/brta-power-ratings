/* Shared score semantics for current, historical and custom results. */
(function(root){'use strict';
const weights=Object.freeze({RM3:1,RM3b:2});
function outcomeCode(data,type='Singles'){
 const m=data.meta||data,year=String(m.season_label||m.competition_label||'').match(/\b(20\d{2})/);
 return !m.is_custom&&['AA','UA'].includes(m.competition_code)&&type==='Singles'&&(data.format||m.format)==='rubbers'&&!!year&&+year[1]>=2026;
}
function parse(value,{outcomeCode=false}={}){
 const text=String(value||''),sets=[...text.matchAll(/(\[)?\s*(\d+)\s*[-–:]\s*(\d+)(?:\([^)]*\))?\s*\]?/g)].map(m=>({h:+m[2],a:+m[3],mt:!!m[1],unknown:false}));
 if(sets.length===3){const first=sets.slice(0,2),last=sets[2],split=first.filter(s=>s.h>s.a).length===1&&first.every(s=>s.h!==s.a);if(split&&Math.max(last.h,last.a)>=10&&first.every(s=>Math.max(s.h,s.a)<=7))last.mt=true;if(split&&outcomeCode&&first.every(s=>Math.max(s.h,s.a)===6&&Math.min(s.h,s.a)<=4||Math.max(s.h,s.a)===7&&[5,6].includes(Math.min(s.h,s.a)))&&Math.min(last.h,last.a)===6&&Math.max(last.h,last.a)===7)Object.assign(last,{mt:true,unknown:true,winner:last.h>last.a?'home':'away',h:null,a:null})}
 const marker=text.match(/\[TB\s+([WL])\]/i);if(marker)sets.push({h:null,a:null,mt:true,unknown:true,winner:marker[1].toUpperCase()==='W'?'home':'away'});
 for(const s of sets)if(!s.winner&&s.h!==s.a)s.winner=s.h>s.a?'home':'away';return sets;
}
function format(sets){return sets.map(s=>s.unknown?'[TB '+(s.winner==='home'?'W':'L')+']':s.mt?'['+s.h+'-'+s.a+']':s.h+'-'+s.a).join(' ')}
function flip(text){return String(text||'').replace(/(\d+)\s*([-–:])\s*(\d+)/g,(_,h,d,a)=>a+d+h).replace(/\[TB ([WL])\]/g,(_,v)=>'[TB '+(v==='W'?'L':'W')+']')}
function doublesOnly(data){const m=data.meta||{},rules=m.customRules||m.competition_rules;if(rules?.singlesSlots!=null)return Number(rules.singlesSlots)===0;return !!(data.doublesIndividuals?.length||data.doubles?.length)&&!(data.singles||[]).length&&!(data.results||[]).some(g=>(g.fixtures||[]).some(f=>(f.rubbers||[]).some(r=>r.type==='Singles')))}
function normalise(data){
 for(const group of data.results||[])for(const f of group.fixtures||[])for(const r of f.rubbers||[]){const sets=parse(r.score,{outcomeCode:outcomeCode(data,r.type)});if(sets.some(s=>s.mt)){r.sourceScore=r.sourceScore||r.score;r.score=format(sets);if((data.meta?.scoreSchema||0)<2)data.meta.needsScoreRefit=true}}return data;
}
const api={weights,outcomeCode,parse,format,flip,doublesOnly,normalise};root.BRTAScores=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
