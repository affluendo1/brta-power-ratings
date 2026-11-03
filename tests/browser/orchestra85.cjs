process.env.BRTA_TEST_ORCHESTRA="1";
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs'),path=require('path'),vm=require('vm');
const ROOT=path.resolve(__dirname,'../..');
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.stack));
const dom=new JSDOM(fs.readFileSync(ROOT+'/index.html','utf8'),{url:'https://affluendo1.github.io/brta-power-ratings/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
if(!process.env.BRTA_TEST_ORCHESTRA)w.localStorage.setItem('brta-rating-model','RM4.1 Ensemble');
if(process.env.BRTA_TEST_CLASSIC)w.localStorage.setItem('brta-interface','classic');
if(process.env.BRTA_TEST_LEGACY){w.localStorage.setItem('brta-module-enabled-v1','1');w.localStorage.setItem('brta-more-settings-v1',JSON.stringify({rm1:true,rm2:true}));w.localStorage.setItem('brta-rating-model',process.env.BRTA_TEST_LEGACY)}

w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
w.CSS={supports:()=>true};w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;
w.IntersectionObserver=class {observe(){}unobserve(){}disconnect(){}};
w.ResizeObserver=class {observe(){}disconnect(){}};
Object.defineProperty(w.HTMLElement.prototype,'inert',{get(){return this.hasAttribute('inert')},set(value){this.toggleAttribute('inert',!!value)}});
w.HTMLElement.prototype.getClientRects=function(){return this.closest('.hidden,[hidden]')?[]:[{width:100,height:50}]};
w.HTMLElement.prototype.scrollIntoView=function(){};
w.Element.prototype.getAnimations=()=>[];w.document.getAnimations=()=>[];
w.Element.prototype.animate=function(){return{finished:Promise.resolve(),cancel(){},finish(){}}};
const canvas={clearRect(){},fillRect(){},scale(){},stroke(){},beginPath(){},moveTo(){},lineTo(){},fillText(){},measureText:s=>({width:String(s).length*12}),save(){},restore(){},translate(){},rotate(){}};
w.HTMLCanvasElement.prototype.getContext=()=>canvas;w.HTMLMediaElement.prototype.play=()=>Promise.resolve();w.HTMLMediaElement.prototype.pause=function(){};w.HTMLMediaElement.prototype.load=function(){};
w.confirm=()=>true;
w.localStorage.setItem('brta-following-v1',JSON.stringify({pins:[null,{},false],pending:[null,{}]}));
w.fetch=async url=>{const file=path.join(ROOT,new URL(url,w.location.href).pathname.replace('/brta-power-ratings/',''));if(!fs.existsSync(file))return {ok:false,status:404,json:async()=>null};return{ok:true,json:async()=>JSON.parse(fs.readFileSync(file,'utf8'))}};
w.Worker=require('../fixtures/rating-worker.cjs');
const ctx=dom.getInternalVMContext();
for(const s of [...w.document.scripts]){try{vm.runInContext(s.src?fs.readFileSync(path.join(ROOT,new URL(s.src).pathname.replace('/brta-power-ratings/','')),'utf8'):s.textContent,ctx,{filename:s.src||'bootstrap'})}catch(e){errors.push(e.stack)}}
w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));
const tick=()=>new Promise(r=>setTimeout(r,25));
(async()=>{const assert=require('node:assert/strict'),run=s=>vm.runInContext(s,ctx),click=s=>{const n=w.document.querySelector(s);assert(n,'Missing '+s);n.click()},wait=async()=>{for(let i=0;i<120;i++){await tick();if(!w.document.body.classList.contains('section-loading')&&run('D!==null'))return}throw Error('Section did not finish loading')};
await wait();assert.equal(run('selectedRatingModel()'),'4.2 Orchestra');assert.equal(run('D.meta.ratingModel'),'4melody.2');assert.equal(run('D.meta.doublesRatingModel'),'4choir.2');assert.equal(run('D.meta.ratingCentre'),2000);assert(run('!!D.orchestra&&!D.rm4'));assert(w.document.querySelector('#statusStrip').textContent.includes('4.2 Orchestra'));
click('[data-layout-open="model"]');assert(!w.document.querySelector('#layoutOverlay').classList.contains('hidden'));assert(w.document.querySelector('#settingsOverlay').classList.contains('hidden'));
const options=[...w.document.querySelectorAll('#layoutOverlay [data-rm4-model] option')].map(o=>o.value);for(const name of w.BRTAOrchestra.choices)assert(options.includes(name),name);
for(const name of w.BRTAOrchestra.choices){const select=w.document.querySelector('#layoutOverlay [data-rm4-model]');select.value=name;select.dispatchEvent(new w.Event('change',{bubbles:true}));await wait();assert.equal(run('D.meta.modelChoice'),name);assert(run('D.singles.every(r=>Number.isFinite(r.rating))'));}
const select=w.document.querySelector('#layoutOverlay [data-rm4-model]');select.value='4.2 Orchestra';select.dispatchEvent(new w.Event('change',{bubbles:true}));await wait();run('closeLayoutOverlay()');
for(const view of ['singles','doublesPlayers','pairs','overall']){run('ratingView='+JSON.stringify(view)+';showProv=true;renderRatings()');assert(w.document.querySelectorAll('#ratingBody [data-player]').length>0,view);assert(!/NaN|undefined/.test(w.document.querySelector('#ratingBody').textContent));}
const exported=await run("(async()=>{let content;const old=downloadFile;downloadFile=s=>{content=s};try{await $('#exportCompleteBtn').onclick();return content}finally{downloadFile=old}})()");const parsed=new w.DOMParser().parseFromString(exported,'text/html'),json=JSON.parse([...parsed.querySelectorAll('pre')].at(-1).textContent);assert.equal(json.meta.modelChoice,'4.2 Orchestra');assert.deepEqual(json.singles.map(r=>[r.player,r.rating]),JSON.parse(run('JSON.stringify(D.singles.map(r=>[r.player,r.rating]))')));
run('openPredictionHome()');click('.outlook-fixture');assert.equal(w.document.querySelectorAll('.fixture-rubber').length,6);assert(!/NaN|undefined/.test(w.document.querySelector('#predictionContent').textContent));const predictions=run('predictionMath(selectedPrediction.home,selectedPrediction.away)');for(const r of predictions.rubbers){assert(Math.abs(r.forecastDistribution.reduce((s,x)=>s+x.probability,0)-1)<1e-9);assert(Math.abs(r.forecastDistribution.filter(x=>x.homeWin).reduce((s,x)=>s+x.probability,0)-r.p)<1e-9)}
run("close('#predictionOverlay');openProfile(D.singles[0].player)");assert(w.document.querySelector('#profileContent').textContent.includes(run('D.singles[0].player')));run("close('#profileOverlay');openHistoricalTable(D.ratingHistory.rounds[0].round)");assert(!/NaN|undefined/.test(w.document.querySelector('#roundContent').textContent));run("close('#roundOverlay');simulateRound(13)");await tick();assert.equal(w.document.querySelectorAll('#resultContent .rubber-row').length,6);assert(!/NaN|undefined/.test(w.document.querySelector('#resultContent').textContent));run("close('#resultOverlay');openLayoutOverlay('methodology')");assert(w.document.querySelector('#layoutOverlay').textContent.includes('Orchestra'));assert(!w.document.querySelector('#layoutOverlay').textContent.includes('log loss'));run('closeLayoutOverlay()');
// Save and switch to a manual original, then restore the new default explicitly.
await run("localStorage.setItem('brta-rating-model','RM4b');loadSection(D.meta.section_code)");await wait();assert.equal(run('D.meta.predictionModel'),'RM4b');assert(run('!!D.rm4&&!D.orchestra'));await run("localStorage.setItem('brta-rating-model','Automatic');loadSection(D.meta.section_code)");await wait();assert.equal(run('selectedRatingModel()'),'4.2 Orchestra');assert(run('!!D.orchestra'));
const automatic=await run("layoutApplyModel(D,'Automatic')");assert.equal(automatic.meta.ratingCentre,2000);assert.equal(automatic.meta.predictionModel,'4.2 Orchestra');assert.deepEqual(JSON.parse(JSON.stringify(automatic.singles.map(r=>[r.player,r.rating]))),JSON.parse(run('JSON.stringify(D.singles.map(r=>[r.player,r.rating]))')));
if(errors.length)throw Error(errors.join('\n'));console.log('8.5 default Orchestra: all 9 model choices, real worker, four rating views, home overlay, exports, player/history panels, prediction probabilities/scores, fixture simulation, compact methodology, manual legacy override and Automatic migration passed.');dom.window.close();})().catch(e=>{console.error(e.stack);console.error(errors);dom.window.close();process.exitCode=1});
