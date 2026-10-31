/* Regression tests for request ordering and service-worker failure paths. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../web/core/app.js'),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no});return{promise,resolve,reject}};
async function sectionRaces(){
  const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',innerHTML:''});return nodes.get(id)};
  const fits=new Map(),requests=new Map(),saved=new Map([['brta-history-selection','old season']]);let renders=0;
  const context=vm.createContext({loadingToken:0,D:null,viewCatalog:[{section_code:'old'},{section_code:'new'}],DATA:{globalSync:{}},window:{},document:{body:{classList:{add(){},remove(){}}}},$:get,$$:()=>[],cancelAuxiliaryReveal(){},layoutApplyModel:p=>{const job=deferred();fits.set(p.meta.section_code,job);return job.promise},normaliseTeamLabels:x=>x,fetch:()=>{throw Error('Use preloaded data')},localStorage:{setItem:(key,value)=>saved.set(key,value),removeItem:key=>saved.delete(key)},activeHistorySeasonId:null,renderChoice(){},sectionCompetitionLabel:()=> 'Sunday',fillSections(){},renderAll(){renders++},esc:x=>x});
  vm.runInContext(source.slice(source.indexOf('async function loadSection('),source.indexOf('\nfunction statusStrip')),context);
  const payload=code=>({meta:{section_code:code,competition_code:'UA',competition_label:'Sunday',section_label:code},singles:[{player:code}],results:[]});
  const old=context.loadSection('old',payload('old')),latest=context.loadSection('new',payload('new'));
  fits.get('new').resolve(payload('new'));assert.equal(await latest,true);fits.get('old').resolve(payload('old'));assert.equal(await old,false);
  assert.equal(saved.has('brta-history-selection'),false);assert.equal(saved.get('brta-section'),'new');
  assert.equal(context.D.meta.section_code,'new');assert.equal(context.singles[0].player,'new');assert.equal(renders,1);
  // A late failure belongs to the superseded request, not the displayed section.
  const bad=context.loadSection('old',payload('old')),good=context.loadSection('new',payload('new'));
  fits.get('new').resolve(payload('new'));await good;get('#statusStrip').innerHTML='new status';fits.get('old').reject(Error('stale failure'));assert.equal(await bad,false);assert.equal(get('#statusStrip').innerHTML,'new status');
  console.log('Section request races: stale successes and stale errors cannot overwrite the latest view.');
}
async function offline(){
  const listeners={};let network,putFails=false,cacheFails=false,lastFetchOptions,precache;const entries=new Map();
  const cache={addAll:async requests=>{precache=requests},match:async key=>entries.get(typeof key==='string'?key:key.url),put:async()=>{if(putFails)throw Error('quota')}};
  const context=vm.createContext({URL,Response,Request,fetch:async(request,options)=>{lastFetchOptions=options;if(network instanceof Error)throw network;return network},caches:{open:async()=>{if(cacheFails)throw Error('private mode');return cache}},self:{registration:{scope:'https://example.test/brta/'},skipWaiting:async()=>{},addEventListener:(name,fn)=>listeners[name]=fn}});
  vm.runInContext(fs.readFileSync(require.resolve('../sw.js'),'utf8'),context);
  let installed;listeners.install({waitUntil:p=>installed=p});await installed;assert(precache.every(r=>r.cache==='reload'));
  const request=(file,mode='cors')=>({url:'https://example.test/brta/'+file,method:'GET',mode});
  network=new Response('<html>current</html>');await context.networkFirst(request('index.html','navigate'));assert.equal(lastFetchOptions.cache,'no-cache');
  putFails=true;network=new Response('fresh');assert.equal(await(await context.networkFirst(request('app.js'))).text(),'fresh');
  cacheFails=true;network=new Response('uncached network');assert.equal(await(await context.networkFirst(request('app.js'))).text(),'uncached network');cacheFails=false;
  entries.set('https://example.test/brta/index.html',new Response('<html>shell</html>'));network=Error('offline');
  assert.equal((await context.networkFirst(request('missing.js'))).status,503);
  assert.equal((await context.networkFirst(request('missing.json'))).status,503);
  assert.equal(await(await context.networkFirst(request('deep','navigate'))).text(),'<html>shell</html>');
  for(const file of ['data/site/sections/UA009.json','assets/gong.mp3','assets/another.mp3']){let reply;listeners.fetch({request:request(file),respondWith:p=>reply=p});assert(reply,file);await reply;}
  let reply;listeners.fetch({request:{url:'https://other.test/file.json',method:'GET'},respondWith:p=>reply=p});assert.equal(reply,undefined);
  console.log('Offline: data/audio routing, navigation-only HTML, quota errors and unavailable caches passed.');
}
(async()=>{await sectionRaces();await offline()})().catch(e=>{console.error(e);process.exitCode=1});

