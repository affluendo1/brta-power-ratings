const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

(async()=>{
  let elements=[],pending=[],frames=[];
  const context={window:{},innerHeight:900,Math,requestAnimationFrame:callback=>frames.push(callback),document:{createElement(){
    const values={};let resolve,reject;
    const finished=new Promise((yes,no)=>{resolve=yes;reject=no});
    const piece={style:{setProperty:(key,value)=>values[key]=value},dataset:{},values,remove(){this.removed=true},getAnimations:()=>[{finished}],finish:resolve,cancel:reject};
    elements.push(piece);return piece;
  }}};
  vm.runInNewContext(fs.readFileSync(require.resolve('../confetti.js'),'utf8'),context);
  const C=context.window.BRTAConfetti,parent={append(...pieces){pending.push(...pieces)}};
  const sid=C.create({count:260}),slow=C.create({count:500,slow:4});
  assert.equal(sid.length,260);assert.equal(slow.length,500);
  for(const [i,piece] of [...sid,...slow].entries()){
    assert.equal(piece.className,'royal-confetti');
    assert.equal(piece.values['--confetti-duration'],i<260?'3.2s':'12.8s');
    const x=parseFloat(piece.values['--origin-x']);assert(i%2===0?x>=2&&x<=9:x>=91&&x<=98);
    assert(parseFloat(piece.values['--y'])<0);
  }
  let completed=false;
  const run=C.burst(parent,{count:500,slow:4}).then(()=>completed=true);frames.shift()();
  pending.slice(0,-1).forEach(piece=>piece.finish());await Promise.resolve();await Promise.resolve();
  assert.equal(completed,false,'the final active piece must keep the burst pending');
  pending.at(-1).finish();await run;assert(pending.every(piece=>piece.removed));
  pending=[];completed=false;
  const late=C.burst(parent,{count:1,slow:1.7,tiny:true}).then(()=>completed=true);frames.shift()();
  assert.equal(pending.length,1);assert.equal(pending[0].style.width,'3px');assert.equal(pending[0].style.height,'5px');
  assert.equal(pending[0].dataset.confettiFinal,'');await Promise.resolve();assert.equal(completed,false);
  pending[0].finish();await late;assert.equal(completed,true);assert.equal(pending[0].removed,true);
  // Cancelling a scene must also release its animation wait.
  pending=[];const cancelled=C.burst(parent,{count:1});frames.shift()();pending[0].cancel(new Error('scene removed'));await cancelled;
  console.log('Shared confetti: identical pieces, slowed duration, complete-burst wait, tiny final piece and cancellation passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
