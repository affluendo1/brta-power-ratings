(function(root){
'use strict';
function snakeStep(state,random=Math.random){
 const direction=state.next||state.direction,head={x:state.body[0].x+direction.x,y:state.body[0].y+direction.y},eating=head.x===state.food.x&&head.y===state.food.y;
 if(head.x<0||head.y<0||head.x>=20||head.y>=20||state.body.slice(0,eating?undefined:-1).some(p=>p.x===head.x&&p.y===head.y))return{...state,over:true};
 const body=[head,...state.body];if(!eating)body.pop();const free=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(!body.some(p=>p.x===x&&p.y===y))free.push({x,y});
 return{body,direction,next:null,food:eating?(free[Math.floor(random()*free.length)]||head):state.food,score:state.score+Number(eating),over:free.length===0};
}
function mount(overlay){
 const box=overlay.querySelector('.mode-switch-box'),shell=document.createElement('div');shell.className='wg-layout';shell.innerHTML='<div class="wg-left"><button class="button secondary wg-launch hidden" type="button">Play A Game</button></div><section class="wg-game" hidden aria-label="Snake"><output class="wg-score" aria-label="Score: 0">0</output><canvas width="320" height="320" tabindex="0" aria-label="Snake. Use arrow keys, WASD or swipe to turn. Tap or press a direction to restart after a game ends."></canvas></section>';
 const left=shell.querySelector('.wg-left'),launch=shell.querySelector('.wg-launch'),game=shell.querySelector('.wg-game'),canvas=game.querySelector('canvas'),ctx=canvas.getContext('2d');left.prepend(box);overlay.append(shell);
 let state,paused=false,active=false,timer;const reset=()=>{state={body:[{x:7,y:10},{x:6,y:10},{x:5,y:10}],direction:{x:1,y:0},next:null,food:{x:14,y:10},score:0,over:false};paused=false;draw()};
 function draw(){ctx.clearRect(0,0,320,320);ctx.fillStyle='#e8b4a2';ctx.fillRect(state.food.x*16+2,state.food.y*16+2,12,12);state.body.forEach((p,i)=>{ctx.fillStyle=i?'#7b6b9b':'#e5d4ff';ctx.fillRect(p.x*16+1,p.y*16+1,14,14)});const score=game.querySelector('.wg-score');score.textContent=state.score;score.setAttribute('aria-label','Score: '+state.score);}
 const vectors={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
 function turn(name){const v=vectors[name];if(!active||!v)return;if(state.over)reset();if(state.next)return;if(v.x===-state.direction.x&&v.y===-state.direction.y)return;state.next=v;}
 function pause(){paused=!paused;}
 function key(event){if(!active)return;const name=({ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'})[event.key];if(name||event.key===' '){event.preventDefault();event.stopImmediatePropagation();if(name)turn(name);else pause();}}
 const reveal=setTimeout(()=>launch.classList.remove('hidden'),5000);
 launch.onclick=()=>{if(active)return;active=true;game.hidden=false;shell.classList.add('wg-open');launch.hidden=true;reset();canvas.focus();timer=setInterval(()=>{if(!paused&&!state.over){state=snakeStep(state);draw()}},135);};
 let swipe=null;
 canvas.addEventListener('pointerdown',e=>{if(!active||!e.isPrimary||e.button!==0)return;e.preventDefault();canvas.focus();if(state.over)reset();swipe={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!swipe||e.pointerId!==swipe.id)return;e.preventDefault();const dx=e.clientX-swipe.x,dy=e.clientY-swipe.y;if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;turn(Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'));swipe={id:e.pointerId,x:e.clientX,y:e.clientY}});
 function endSwipe(e){if(swipe?.id===e.pointerId)swipe=null;}
 canvas.addEventListener('pointerup',endSwipe);canvas.addEventListener('pointercancel',endSwipe);canvas.addEventListener('lostpointercapture',endSwipe);
 document.addEventListener('keydown',key,true);
 return()=>{clearTimeout(reveal);clearInterval(timer);document.removeEventListener('keydown',key,true);overlay.append(box);shell.remove();};
}
root.BRTAWaitingGame={mount,snakeStep};if(typeof module!=='undefined')module.exports={snakeStep};
})(typeof window==='undefined'?globalThis:window);
