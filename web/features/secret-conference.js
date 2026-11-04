/* 8.5.2.3 | The secret conference, a purely visual Easter egg. */
(function(w){
'use strict';
const S=w.BRTASecretExtras,d=w.document;
const models=['RM1','RM2','RM3','RM3b','RM4a','RM4b','RM4.1','RM4.2','4.2 Foundation','4.2 Melody','4.2 Orchestra','Baton','RM1000'];
const talk=[
['RM1','I remember when a rating was just a rating.'],
['RM4b','We could at least agree on the scoring format.'],
['4.2 Foundation','This meeting needs a sound mathematical foundation.'],
['4.2 Melody','I rate players. Orchestra predicts matches. Why do I have to explain that every time?'],
['Baton','I am routing this discussion to an expert in discussions.'],
['RM3b','I intercepted the meeting agenda. The original was terribly boring.'],
['RM4.1','Could we maybe average our disagreements?'],
['RM2','The minutes contain several things I cannot calculate.'],
['RM1000','My personal rating has escaped the observable universe.'],
['4.2 Orchestra','Wait. Is somebody watching us?'],
['RM3','Someone has been listening to EVERYTHING.'],
['Baton','Unexpected observer! Activate the shields!']
];
let epoch=0;
function close(){epoch++;S.scene?.remove();S.scene=null}
async function open(){
 if(S.scene)return;const ticket=++epoch;
 const overlay=d.createElement('div');overlay.className='brta-secret-scene';
 overlay.innerHTML='<div class="brta-scene-portal">🔓</div><section class="brta-scene-room" role="dialog" aria-modal="true" aria-label="The model conference"><button class="brta-secret-close" aria-label="Leave model chamber">×</button><p class="brta-vault-kicker">UNAUTHORISED OBSERVATION</p><h2>THE MODEL CONFERENCE</h2><div class="brta-model-actors"></div><div class="brta-scene-table"><div class="brta-scene-dialogue" role="status">The room is strangely quiet.</div><button type="button" class="brta-blueprint" hidden>Inspect the blueprint</button></div><p class="brta-scene-instruction">Nobody has noticed the spectator.</p></section>';
 d.body.append(overlay);S.scene=overlay;
 overlay.querySelector('.brta-secret-close').onclick=close;
 const area=overlay.querySelector('.brta-model-actors');
 const actors=models.map((name,i)=>{
  const b=d.createElement('button');b.type='button';b.className='brta-model-actor';b.disabled=true;
  b.textContent=['◆','◉','◇','✧','◈','⬡','◍','✦','♜','♫','♬','♢','★'][i]+' '+name;
  area.append(b);return b;
 });
 w.requestAnimationFrame(()=>overlay.classList.add('zoom'));
 await S.wait(S.reduced()?140:1800);if(ticket!==epoch||!S.scene)return;
 overlay.classList.add('room-visible');
 for(const [name,line] of talk){
  if(ticket!==epoch||!S.scene)return;
  overlay.querySelector('.brta-scene-dialogue').textContent=name+': '+line;
  S.sound(320);await S.wait(S.reduced()?130:860);
 }
 if(ticket!==epoch||!S.scene)return;
 overlay.classList.add('fight');
 overlay.querySelector('.brta-scene-instruction').textContent='The models are furious. Click each shield to dissolve its owner.';
 actors.forEach(b=>{
  b.disabled=false;b.onclick=()=>{
   if(b.disabled)return;b.disabled=true;b.classList.add('dissolve');S.sound(420+Math.random()*380);
   w.setTimeout(()=>b.remove(),S.reduced()?0:530);
   S.log('secret','Shield dissolved');
   if(actors.every(a=>a.disabled)){
    S.set('cleared','1');S.sound(1000);
    overlay.querySelector('.brta-scene-dialogue').textContent='The conference fades away. A blueprint remains on the table.';
    overlay.querySelector('.brta-scene-instruction').textContent='Inspect the blueprint. It contains a code for the Vault.';
    overlay.querySelector('.brta-blueprint').hidden=false;
   }
  };
 });
 overlay.querySelector('.brta-blueprint').onclick=()=>{
  overlay.querySelector('.brta-scene-dialogue').textContent='BLUEPRINT CODE: '+S.code+' · Enter this into the Vault.';
  S.sound(980);
 };
 S.log('secret','Model conference opened');
}
S.api.openScene=open;S.api.closeScene=close;
})(window);
