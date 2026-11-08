/* Orchestra 8.5: ratings, Choir and deterministic Baton routing.
 * Reuses frozen research components; selection is offline, never target-trained.
 */
(function(root,factory){
 const req=typeof require==='function'?require:null;
 const api=factory(root.BRTARM4||(req&&req('./rm4')),root.BRTARM4Engine||(req&&req('./rm4-engine')),root.BRTAOrchestraFit||(req&&req('./orchestra-fit')));
 if(typeof module==='object'&&module.exports)module.exports=api;else root.BRTAOrchestra=api;
})(typeof globalThis==='undefined'?this:globalThis,function(M,E,J){'use strict';
 const choices=['4.2 Orchestra','4foundation.2','4melody.2','4harmony.2','4brass.2','4woodwind.2','4strings.2','4percussion.2','4choir.2'];
 const ids={'sets.standard':'4harmony.2','sets.green':'4brass.2','junior.rubbers':'4woodwind.2','adult.full-third':'4strings.2','adult.extended-set':'4percussion.2'};
 const avg=a=>a.reduce((s,v)=>s+v,0)/(a.length||1),valid=p=>Number.isFinite(p)&&p>=0&&p<=1;
 const nameKey=s=>String(s).normalize('NFKC').toLowerCase().trim().replace(/\s+/g,' ');
 const eligibleName=s=>/^[\p{L}][\p{L}'’-]+(?: [\p{L}][\p{L}'’-]+)+$/u.test(nameKey(s))&&!/unnamed|unknown|emergency|fill.?in/i.test(s);
 const isModel=n=>n==='Automatic'||choices.includes(n);
 const cache=new WeakMap();
 function configured(data,m){
  const r=data.meta?.customRules||data.meta?.competition_rules,junior=['AA','UA'].includes(data.meta?.competition_code),rubbers=junior&&data.format==='rubbers';
  const bestOf=r?(r[m.type==='Singles'?'singlesBestOf':'doublesBestOf']||1):rubbers&&m.type==='Singles'?3:(m.bestOf||1);
  return{...m,target:r?(m.type==='Singles'?r.setTarget:r.doublesTarget||r.setTarget):rubbers&&m.type==='Doubles'?8:(m.target||6),green:!!data.greenBall,bestOf,matchTiebreak:bestOf===3?(r?r.matchTiebreak!==false:rubbers):false};
 }
 function isCustomJuniorRubbers(data){
  const rules=data.meta?.customRules;
  return !!data.meta?.is_custom&&data.format==='rubbers'&&!!rules&&
    Number(rules.setTarget)===6&&Number(rules.doublesTarget)===8&&
    Number(rules.singlesBestOf)===3&&Number(rules.doublesBestOf)===1;
 }
 function profile(data,m){
  // An exact junior scoring contract matters more than the creator's LOCAL competition code.
  if(isCustomJuniorRubbers(data)||(['AA','UA'].includes(data.meta?.competition_code)&&data.format==='rubbers'))return'junior.rubbers';
  if(m.green&&m.bestOf===1)return'sets.green';
  if(m.bestOf===3)return m.matchTiebreak?'adult.match-tiebreak':'adult.full-third';
  return m.target===6?'sets.standard':'adult.extended-set';
 }
 function definition(bundle,p,kind){
  const long=['junior.rubbers','adult.full-third','adult.extended-set'].includes(p);
  return bundle.definitions[kind==='Foundation'?(p==='sets.green'?'Foundation 04 game-only-cap24':long?'Foundation 04 uncapped':'Foundation 03 rho75'):long?'Melody 04 uncapped':'Melody 01'];
 }
 function snapshot(data,history){
  if(data.meta?.is_custom)return null;
  const s=history?.seasons?.[data.meta?.season_id],competition=data.meta?.competition_code;
  if(!s||s.competition!==competition||!s.cutoffExclusive||!s.latestHistoryDate||s.latestHistoryDate>=s.cutoffExclusive)return null;
  const start=E.prepare(data).map(m=>m.date).filter(Boolean).sort()[0];
  return start&&s.cutoffExclusive<start?s:null;
 }
 function historyEvidence(state,m,past){
  const graph=state.history,level=state.level;
  if(!graph||!Number.isFinite(level)||graph.cutoffExclusive>=m.date)return{linked:0,prior:0,skills:{Singles:{},Doubles:{}}};
  let linked=0;const values={};
  for(const side of ['home','away'])values[side]=m[side].map(player=>{
   const record=eligibleName(player)?graph.players?.[m.type]?.[nameKey(player)]:null;
   if(!record||!Number.isFinite(record.skill)||!Number.isFinite(record.count)||record.count<=0)return 0;
   const n=past.filter(q=>q.type===m.type&&(q.home.includes(player)||q.away.includes(player))).length;
   linked++;return record.count/(record.count+4)/Math.sqrt(n+1)*(record.skill+.08*(level-10));
  });
  return{linked,prior:M.logit(M.win(avg(values.home)-avg(values.away),{target:6,bestOf:1,green:false,matchTiebreak:false})),values};
 }
 function ratingPriors(state,matches){
  const names=[...new Set(matches.flatMap(m=>[...m.home,...m.away]))],result={Singles:{},Doubles:{}};
  if(!state.history||!Number.isFinite(state.level))return result;
  for(const type of ['Singles','Doubles'])for(const player of names){
   const r=eligibleName(player)?state.history.players?.[type]?.[nameKey(player)]:null;if(!r||!Number.isFinite(r.skill)||!Number.isInteger(r.count)||r.count<=0)continue;
   const n=matches.filter(m=>m.type===type&&(m.home.includes(player)||m.away.includes(player))).length;
   result[type][player]=r.count/(r.count+4)/Math.sqrt(n+1)*(r.skill+.08*(state.level-10));
  }
  return result;
 }
 function fitDefinition(matches,d,covariance=false,priorSkills=null,pairs=false){
  const options={parameters:d.parameters,covariance,pairs};
  return J.fit(matches,d.core,{...options,priorSkills:priorSkills||{}});
 }
 function context(state,target,bundle,frozen){
  let memo=cache.get(state);if(!memo){memo=new Map();cache.set(state,memo)}
  const key=target.date+':'+target.round;if(memo.has(key))return memo.get(key);
  const past=state.matches.filter(r=>r.date<target.date&&r.round<target.round),fits={};
  for(const n of ['RM3','RM3b','RM4a','RM4b','RM4.2'])fits[n]=M.fit(past,n,{covariance:false});
  const candidates={};for(const [n,d]of Object.entries(bundle.definitions))candidates[n]=fitDefinition(past,d);
  const earlierCache=new Map(),matches=past.map(m=>{
   const k=m.date+':'+m.round;if(!earlierCache.has(k)){
    const earlier=past.filter(r=>r.date<m.date&&r.round<m.round);
    earlierCache.set(k,new Set(earlier.map(r=>r.round)).size<3?null:M.fit(earlier,'RM4b',{covariance:false}));
   }
   const f=earlierCache.get(k);return{...m,preProbability:f?M.sigmoid(frozen.baseAlpha*M.logit(M.win(M.gap(f,m),m))):undefined};
  });
  const result={fits,candidates,matches,past,elo:M.elo(past)};memo.set(key,result);
  // A session may inspect historical fixtures; bound retained fit contexts.
  if(memo.size>24)memo.delete(memo.keys().next().value);
  return result;
 }
 function calibrated(p,m,n,b){const x=[1,Number(m.type==='Doubles'),Number(m.green),Number(m.bestOf===3),1/Math.sqrt(n+1)];return M.sigmoid(M.logit(p)*Math.max(.35,Math.min(1.6,1+x.reduce((s,v,i)=>s+v*(b?.[i]||0),0))))}
 function advanced(raw,m,experience,elo,oldML,b){
  const names=[...b.names,'Elo','oldML'],ps=names.map(n=>calibrated(n==='Elo'?elo:n==='oldML'?oldML:raw[n],m,experience,b.calibration[n]));
  const logits=ps.map(M.logit),base=b.spec.components==='core'?logits.slice(0,2):logits,x=b.spec.context?[...base,...base.map(v=>v/Math.sqrt(experience+1)),...base.map(v=>v*Number(m.type==='Doubles'))]:base;
  if(x.length!==b.coefficients.length)throw Error('Orchestra feature configuration mismatch');
  return{Foundation:ps[0],Melody:ps[1],Orchestra:M.sigmoid(x.reduce((s,v,i)=>s+v*b.coefficients[i],0))};
 }
 function featureRow(ctx,m,bundle,frozen){
  const original=M.forecast(ctx,m,frozen),reverse=M.forecast(ctx,{...m,home:m.away,away:m.home},frozen),baseline={};
  for(const name of ['RM3','RM3b','RM4a','RM4b','RM4.2'])baseline[name]=M.forecast(ctx,m,frozen,name).p;
  baseline['RM4.1 Ensemble']=original.p;
  const raw=Object.fromEntries(Object.entries(ctx.candidates).map(([name,fit])=>[name,M.win(M.gap(fit,m),{...m,native:bundle.definitions[name].core!=='RM3'})]));
  const experience=Math.min(...[...m.home,...m.away].map(p=>ctx.past.filter(r=>r.type===m.type&&(r.home.includes(p)||r.away.includes(p))).length));
  return{raw,baseline,experience,elo:original.components.Elo_experience192,oldML:(original.components.ML_transfer+1-reverse.components.ML_transfer)/2};
 }
 function symmetric41(row,frozen){
  const e=frozen.ensemble,component={RM3:M.sigmoid(e.temperatures.RM3*M.logit(row.baseline.RM3)),RM3b:M.sigmoid(e.temperatures.RM3b*M.logit(row.baseline.RM3b)),RM4b:row.baseline.RM4b,Score_core:M.sigmoid(e.temperatures.Score_core/.8469338499344126*M.logit(row.baseline.RM4a)),Elo_experience192:row.elo,ML_transfer:row.oldML};
  return e.names.reduce((s,n,i)=>s+e.weights[i]*component[n],0);
 }
 function route(row,m,p,bundle,selected,history={linked:0,prior:0},frozen=null){
  const fallback=reason=>({p:row.baseline['RM4.2'],engine:'RM4.2',fallback:reason});
  if(!valid(row.baseline.RM4b))throw Error('Original fallback unavailable');
  const manual=selected!=='4.2 Orchestra'&&selected!=='Automatic';
  if(!Number.isFinite(row.experience)||row.experience<0)return fallback('Missing current evidence');
  if(manual&&!['4foundation.2','4melody.2','4choir.2',ids[p]].includes(selected))return fallback('Selected specialist does not support this format');
  const partial=history.linked>0&&history.linked<(m.type==='Singles'?2:4),historyCell=history.linked?':'+(partial?'partial':'full'):'',guard=bundle.guard?.winner?.[p+':'+m.type+historyCell]||bundle.guard?.winner?.[p+':'+m.type];
  // A guard is a frozen context decision, never the outcome of this target.
  if((!manual||selected===ids[p])&&guard?.delegate&&valid(row.baseline[guard.delegate]))return{p:row.baseline[guard.delegate],engine:guard.delegate,fallback:'Frozen context delegation',guardSource:guard.source,partial,linked:history.linked,historyUsed:false};
  if(m.target===6&&m.bestOf===1&&!m.green&&p==='sets.standard'){
   const reset=advanced(row.raw,m,row.experience,row.elo,row.oldML,bundle.advanced),partial=history.linked>0&&history.linked<(m.type==='Singles'?2:4),config=bundle.ordinary[m.type],beta=partial?config.partialCap:1;
   const ps=['Foundation','Melody','Orchestra'].map(n=>history.linked?M.sigmoid(M.logit(reset[n])+beta*history.prior):reset[n]);ps.push(row.baseline.RM4b);
   const index=selected==='4foundation.2'?0:['4melody.2','4choir.2'].includes(selected)?1:null;
   const probability=index===null?M.sigmoid(config.temperature*M.logit(ps.reduce((s,v,i)=>s+config.weights[i]*v,0))):ps[index];
   return{p:probability,engine:index===0?'4foundation.2':index===1?selected:'4harmony.2',weights:index===null?config.weights:null,historyUsed:history.linked>0,linked:history.linked,partial,historyCap:beta,fallback:null};
  }
  const rules={target:m.target,bestOf:m.bestOf,matchTiebreak:!!m.matchTiebreak,green:!!m.green},signature=[p,m.type,rules.target,rules.bestOf,Number(rules.matchTiebreak),Number(rules.green)].join('|'),b=bundle.formatRouting;
  if(!b.allowedSignatures.includes(signature))return fallback('General scoring fallback');
  if(manual&&['4foundation.2','4melody.2','4choir.2'].includes(selected)){
   const d=definition(bundle,p,selected==='4foundation.2'?'Foundation':'Melody'),entry=Object.entries(bundle.definitions).find(([,v])=>v===d)?.[0];
   return{p:row.raw[entry],engine:selected,fallback:null};
  }
  if(p==='junior.rubbers'){
   if(!frozen?.ensemble)return fallback('Woodwind configuration unavailable');
   const symmetric=symmetric41(row,frozen);if(!valid(symmetric))return fallback('Woodwind component unavailable');
   return{p:(row.baseline.RM4a+row.baseline.RM4b+symmetric)/3,engine:'4woodwind.2',fallback:null};
  }
  const values=b.experts.map((n,i)=>{const v=b.rawNames[n]?row.raw[b.rawNames[n]]:n==='Elo'?row.elo:n==='oldML'?row.oldML:n==='RM4.1 Ensemble'&&frozen?symmetric41(row,frozen):row.baseline[n];return valid(v)?[0,1,5,6].includes(i)?M.sigmoid(b.scales[i]*M.logit(v)):v:null});
  if(values.some(v=>v===null))return fallback('Specialist component unavailable');
  const method=b.selection[p]?.selected,model=b.models[method];if(!model)return fallback('No matching specialist configuration');
  const cell=p+(method.startsWith('discipline')?':'+m.type:''),weights=model.cells[cell]?.weights||model.globalWeights;
  if(weights.length!==values.length||weights.some(v=>!Number.isFinite(v)||v<0)||Math.abs(weights.reduce((s,v)=>s+v,0)-1)>1e-8)throw Error('Invalid specialist weights');
  return{p:values.reduce((s,v,i)=>s+v*weights[i],0),engine:ids[p],method,weights,fallback:null};
 }
 function forecast(state,input,bundle,frozen,selected=state.model){
  if(bundle.schema!==85||!isModel(selected))throw Error('Unknown Orchestra configuration');
  const allowed=['type','home','away','date','round','target','green','bestOf','matchTiebreak','position','formatRules'];
  if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Outcome or unsupported target input');
  if(!/^\d{4}-\d\d-\d\d$/.test(input.date)||!Number.isFinite(Date.parse(input.date))||new Date(input.date).toISOString().slice(0,10)!==input.date||!Number.isInteger(input.round)||input.round<1)throw Error('Invalid forecast cutoff');
  const n=input.type==='Singles'?1:input.type==='Doubles'?2:0;
  if(!n||input.home?.length!==n||input.away?.length!==n||new Set([...input.home,...input.away]).size!==2*n)throw Error('Distinct forecast players required');
  const m=configured(state.source,input),ctx=context(state,m,bundle,frozen),p=profile(state.source,m);
  if(new Set(ctx.past.map(r=>r.round)).size<3)throw Error('Predictions open after three rounds of current-season evidence.');
  if(m.formatRules){const legacy=M.forecast(ctx,m,frozen,'RM4b');return{...legacy,engine:'RM4b',fallback:'Explicit scoring contract',system:'4.2 Orchestra'}}
  const row=featureRow(ctx,m,bundle,frozen),history=p==='sets.standard'?historyEvidence(state,m,ctx.past):{linked:0,prior:0},decision=route(row,m,p,bundle,selected,history,frozen);
  if(!valid(decision.p))throw Error('Invalid Orchestra probability');
  // Invert the compatible scoring map; calibrated winner mass remains exact.
  let lo=-12,hi=12;for(let i=0;i<55;i++){const mid=(lo+hi)/2;if(M.win(mid,m)<decision.p)lo=mid;else hi=mid}
  return{...decision,eta:(lo+hi)/2,profile:p,system:'4.2 Orchestra',version:bundle.version,components:row.baseline};
 }
 function distribution(state,target,decision,bundle,frozen){
  const m=configured(state.source,target),key=m.type+':'+(decision.partial?'partial':'full'),guard=decision.profile==='sets.standard'?bundle.guard?.scores?.[key]:null;
  const engine=guard?.delegate||(['RM4a','RM4b','RM4.2'].includes(decision.engine)?decision.engine:null);
  const eta=engine?M.gap(context(state,m,bundle,frozen).fits[engine],m):decision.eta;
  return{rows:M.distribution(eta,{target:m.target,green:m.green,bestOf:m.bestOf,matchTiebreak:m.matchTiebreak,...(m.formatRules?{formatRules:m.formatRules}:{}),native:true},decision.p),engine:engine||decision.engine,shapeDelegated:!!engine};
 }
 function recalculate(data,model,bundle,frozen,history){
  if(!isModel(model)||bundle.schema!==85)throw Error('Unknown Orchestra model');
  if(data.meta?.is_custom&&!['4melody.2','4foundation.2'].includes(model))return E.recalculate(data,'RM4.2',frozen);
  const copy=JSON.parse(JSON.stringify(data)),matches=E.prepare(data).filter(m=>m.date&&m.date!=='2000-01-01').map(m=>configured(data,m));
  const levelMatch=String(data.meta?.section_label||'').match(/\d+/),state={schema:85,model:['Automatic','4melody.2','4foundation.2'].includes(model)?'4.2 Orchestra':model,matches,source:{meta:data.meta,format:data.format,greenBall:data.greenBall},history:snapshot(data,history),level:levelMatch?Number(levelMatch[0]):null};
  // Only carry the current section's eligible names back from the worker.
  if(state.history){const names=new Set(matches.flatMap(m=>[...m.home,...m.away]).map(nameKey));state.history={...state.history,players:Object.fromEntries(['Singles','Doubles'].map(type=>[type,Object.fromEntries(Object.entries(state.history.players[type]||{}).filter(([name])=>names.has(name)))]))}}
  const sample=matches[0]||configured(data,{type:'Singles',target:6,bestOf:1}),p=profile(data,sample);if(matches.some(m=>!bundle.formatRouting.allowedSignatures.includes([profile(data,m),m.type,m.target,m.bestOf,Number(m.bestOf===3&&!!m.matchTiebreak),Number(!!m.green)].join('|')))){if(data.meta?.is_custom)throw Error('This specialist does not support this scoring format. Choose RM4.2.');return E.recalculate(data,'RM4.2',frozen);}if(p!=='sets.standard')state.history=null;const d=definition(bundle,p,model==='4foundation.2'?'Foundation':'Melody'),memo=new Map();
  const sort=rows=>rows.sort((a,b)=>b.rating-a.rating||a.player.localeCompare(b.player));
  function merge(original,fitted){const byName=new Map(fitted.map(r=>[r.player,r]));return sort((original||[]).map(r=>({...r,...byName.get(r.player)})))}
  function tables(subset,original){
   const key=subset.length+':'+(subset.at(-1)?.round||0);let result=memo.get(key);
   if(!result){
    const priors=ratingPriors(state,subset),fit=fitDefinition(subset,d,true,priors),pairs=fitDefinition(subset.filter(m=>m.type==='Doubles'),d,true,null,true);
    result={fit,pairs};memo.set(key,result);
   }
   const singles=merge(original.singles,result.fit.singles),doublesPlayers=merge(original.doublesPlayers,result.fit.doubles),powers=new Map(doublesPlayers.map(r=>[r.player,r.rating]));
   const pairs=merge(original.pairs,result.pairs.pairs).map(r=>{const individualAverage=Math.round(avg(r.player.split(' / ').map(n=>powers.get(n)??1500)));return{...r,individualAverage,pairEffect:r.rating-individualAverage}});
   return{singles,doublesPlayers,pairs};
  }
  copy.ratingHistory={...copy.ratingHistory,tables:{},players:{}};copy.doublesRatingHistory={...copy.doublesRatingHistory,tables:{}};
  for(const item of data.ratingHistory?.rounds||[]){
   const round=Number(item.round),old=data.doublesRatingHistory?.tables?.[round],r=tables(matches.filter(m=>m.round<=round),{singles:data.ratingHistory.tables?.[round],doublesPlayers:old?.doublesPlayers,pairs:old?.pairs});
   copy.ratingHistory.tables[round]=r.singles;copy.doublesRatingHistory.tables[round]={doublesPlayers:r.doublesPlayers,pairs:r.pairs};
   for(const row of r.singles)(copy.ratingHistory.players[row.player]??=[]).push([round,row.rating,row.se,row.matches,row.team]);
  }
  const latest=tables(matches,{singles:data.singles,doublesPlayers:data.doublesIndividuals,pairs:data.doubles});
  copy.singles=latest.singles;copy.doublesIndividuals=latest.doublesPlayers;copy.doubles=latest.pairs;
  copy.orchestra=state;delete copy.rm4;
  copy.meta={...copy.meta,modelChoice:model==='Automatic'?'4melody.2':model,predictionModel:['4melody.2','4foundation.2'].includes(model)?'4.2 Orchestra':state.model,ratingModel:model==='4foundation.2'?'4foundation.2':'4melody.2',doublesRatingModel:model==='4foundation.2'?'4foundation.2':'4choir.2',ratingCentre:1500,ratingScale:450,ratingProbabilityScale:450,scoreSchema:2,needsScoreRefit:false,orchestraVersion:bundle.version,automatic:model==='Automatic'||model==='4.2 Orchestra',ratingChoice:model==='4foundation.2'?'4foundation.2':'4melody.2',automaticPolicyVersion:85};
  copy.note='Ratings and forecasts use '+state.model+'.'+(data.meta?.is_custom?' Local result evidence only, without historical priors.':'');
  const powers=new Map(copy.singles.map(r=>[r.player,r.rating]));
  copy.teams=(copy.teams||[]).map(t=>{const rows=copy.singles.filter(r=>r.team===t.team);return{...t,avg:rows.length?avg(rows.map(r=>r.rating)):1500,best4:rows.length?avg(rows.slice(0,4).map(r=>r.rating)):1500}});
  copy.strengthOfSchedule=copy.singles.map(r=>{const opponents=matches.filter(m=>m.type==='Singles'&&(m.home.includes(r.player)||m.away.includes(r.player))).map(m=>powers.get(m.home.includes(r.player)?m.away[0]:m.home[0])).filter(Number.isFinite);return{player:r.player,team:r.team,matches:opponents.length,averageOpponent:Math.round(avg(opponents))}}).sort((a,b)=>b.averageOpponent-a.averageOpponent).map((r,i,a)=>({...r,rank:i+1,total:a.length}));
  for(const r of copy.singles){const row=copy.strengthOfSchedule.find(x=>x.player===r.player);Object.assign(r,{averageOpponent:row?.averageOpponent,scheduleRank:row?.rank,scheduleTotal:row?.total})}
  for(const t of Object.values(copy.teamOrderEvidence||{}))for(const r of t.players||[])if(powers.has(r.player))r.rating=powers.get(r.player);
  copy.resultsExpectation={players:[],matches:[]};copy.playerInsights={};copy.matchupMatrix=null;copy.leader=null;
  if(copy.roundOverview){for(const key of ['topPerformance','biggestUpset','dominantWin','closestMatch'])copy.roundOverview[key]=null;const rounds=(copy.ratingHistory.rounds||[]).map(x=>+x.round).sort((a,b)=>a-b),prior=new Map((copy.ratingHistory.tables[rounds.at(-2)]||[]).map(r=>[r.player,r.rating])),moves=copy.singles.filter(r=>prior.has(r.player)).map(r=>({player:r.player,change:r.rating-prior.get(r.player)})).sort((a,b)=>b.change-a.change);if(copy.roundOverview.summary){copy.roundOverview.summary.topMover=moves[0]||null;copy.roundOverview.summary.biggestDrop=moves.at(-1)||null}}
  return copy;
 }
 return{Melody:{receive:(_irrelevantNumber)=>'huh? what is this?'},choices,isModel,configured,profile,definition,snapshot,eligibleName,nameKey,historyEvidence,ratingPriors,fitDefinition,context,featureRow,symmetric41,advanced,calibrated,route,forecast,distribution,recalculate};
});
