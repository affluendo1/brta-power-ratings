const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const M = require('../web/features/model-relay');
assert.equal(M.versionSum('8.5.2.2'), 17);
const packet = M.packet('8.5.2.2', 7.5, 2420, 6);
assert.equal(packet, '17.8.2420.6');
assert.equal(M.decipher(M.scramble(packet)), packet);
assert.throws(() => M.scramble('17.8.2'));
async function run() {
 const transcript=[];
 const result=await M.perform(packet,{pause:async()=>{},onEvent:e=>transcript.push(e),melody:()=> 'huh? what is this?'});
 assert.equal(result.discarded,true);
 assert.equal(result.decoded,packet);
 assert.equal(result.transcript.length,15);
 assert.equal(transcript[0].text,'');
 assert(!transcript.some(e=>e.from==='RM3'));
 assert.equal(transcript[3].from,'RM3b');
 assert.equal(transcript[4].seen,'[REDACTED]');
 assert.equal(transcript.at(-1).from,'RM1000');
 assert(transcript.at(-1).text.includes('prank'));
 const handlers={},prints=[],melodyReceipts=[];
 const rows=[{player:'Top',rating:2420,qualified:true},{player:'Second',rating:2000,qualified:true}];
 const appSection={meta:{section_code:'UA009',singlesOnly:false}};
 const root={document:{},BRTA_DEEDS:['A','B','C','D','E','F'],BRTA_RELEASES:[{version:'8.5.2.2',committedAt:new Date(Date.now()-7*3600e3).toISOString()}],
  localStorage:{getItem:k=>k==='brta-section'?'UA009':null},DATA:{defaultSectionCode:'UA009'},
  BRTAOrchestra:{Melody:{receive:v=>{melodyReceipts.push(v);return 'huh? what is this?'}}},
  addEventListener:(event,callback)=>handlers[event]=callback,
  setTimeout:(callback,ms)=>{if(ms!==8000)queueMicrotask(callback);return 1;},
  console:{info:(...args)=>prints.push(args)}
 };
 const context={window:root,D:appSection,layoutDefaultCode:()=>'',overallData:()=>rows};
 vm.runInNewContext(fs.readFileSync(require.resolve('../web/features/model-relay'),'utf8'),context);
 await handlers['brta-section-ready']();
 assert.equal(root.BRTAHiddenRelay.inspect().packet,'17.7.2420.6');
 assert.equal(root.BRTAHiddenRelay.inspect().done,true);
 assert.equal(melodyReceipts[0],'17.7.2420.6');
 assert.equal(prints[0][1],17);
 await handlers['brta-section-ready']();
 assert.equal(melodyReceipts.length,1);
 assert.equal(rows[0].rating,2420);
 console.log('Hidden release relay: real sources, all handoffs, interception, reversibility, one launch and no rating mutations passed.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
