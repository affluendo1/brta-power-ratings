(function(root){
'use strict';
function snakeStep(state,random=Math.random){
 const direction=state.next||state.direction,head={x:state.body[0].x+direction.x,y:state.body[0].y+direction.y},eating=head.x===state.food.x&&head.y===state.food.y;
 if(head.x<0||head.y<0||head.x>=20||head.y>=20||state.body.slice(0,eating?undefined:-1).some(p=>p.x===head.x&&p.y===head.y))return{...state,over:true};
 const body=[head,...state.body];if(!eating)body.pop();const free=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(!body.some(p=>p.x===x&&p.y===y))free.push({x,y});
 return{body,direction,next:null,food:eating?(free[Math.floor(random()*free.length)]||head):state.food,score:state.score+Number(eating),over:free.length===0};
}
function mount(overlay){
 const box=overlay.querySelector('.mode-switch-box'),shell=document.createElement('div');shell.className='wg-layout';shell.innerHTML='<div class="wg-left"><button class="button secondary wg-launch hidden" type="button">Play A Game</button></div><section class="wg-game" hidden aria-label="Snake"><h2>Snake</h2><p>Arrow keys or WASD · Space to pause</p><canvas width="320" height="320" tabindex="0" aria-label="Snake game. Use arrow keys or the direction buttons."></canvas><p class="wg-score" aria-live="polite"></p><div class="wg-controls"><button data-direction="up" aria-label="Move up">↑</button><button data-direction="left" aria-label="Move left">←</button><button data-direction="down" aria-label="Move down">↓</button><button data-direction="right" aria-label="Move right">→</button></div><div class="wg-actions"><button class="button secondary" data-restart>Restart</button><button class="button secondary" data-pause>Pause</button></div><small>Your settings will return automatically when loading finishes.</small></section>';
 const left=shell.querySelector('.wg-left'),launch=shell.querySelector('.wg-launch'),game=shell.querySelector('.wg-game'),canvas=game.querySelector('canvas'),ctx=canvas.getContext('2d');left.prepend(box);overlay.append(shell);
 let state,paused=false,active=false,timer;const reset=()=>{state={body:[{x:7,y:10},{x:6,y:10},{x:5,y:10}],direction:{x:1,y:0},next:null,food:{x:14,y:10},score:0,over:false};paused=false;game.querySelector('[data-pause]').textContent='Pause';draw()};
 function draw(){ctx.fillStyle='#07050c';ctx.fillRect(0,0,320,320);ctx.fillStyle='#e8b4a2';ctx.fillRect(state.food.x*16+2,state.food.y*16+2,12,12);state.body.forEach((p,i)=>{ctx.fillStyle=i?'#7b6b9b':'#e5d4ff';ctx.fillRect(p.x*16+1,p.y*16+1,14,14)});game.querySelector('.wg-score').textContent='Score: '+state.score+(state.over?' · Game over':paused?' · Paused':'');}
 const vectors={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}};
 function turn(name){const v=vectors[name];if(!active||!v||state.next||state.over)return;if(v.x===-state.direction.x&&v.y===-state.direction.y)return;state.next=v;}
 function pause(){paused=!paused;game.querySelector('[data-pause]').textContent=paused?'Resume':'Pause';draw()}
 function key(event){if(!active)return;const name=({ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'})[event.key];if(name||event.key===' '){event.preventDefault();event.stopImmediatePropagation();if(name)turn(name);else pause();}}
 const reveal=setTimeout(()=>launch.classList.remove('hidden'),5000);
 launch.onclick=()=>{if(active)return;active=true;game.hidden=false;shell.classList.add('wg-open');launch.disabled=true;reset();canvas.focus();timer=setInterval(()=>{if(!paused&&!state.over){state=snakeStep(state);draw()}},135);};
 game.addEventListener('click',e=>{const direction=e.target.closest('[data-direction]')?.dataset.direction;if(direction)turn(direction);if(e.target.closest('[data-restart]')){reset();canvas.focus()}if(e.target.closest('[data-pause]'))pause()});
 document.addEventListener('keydown',key,true);
 return()=>{clearTimeout(reveal);clearInterval(timer);document.removeEventListener('keydown',key,true);overlay.append(box);shell.remove();};
}
root.BRTAWaitingGame={mount,snakeStep};if(typeof module!=='undefined')module.exports={snakeStep};
})(typeof window==='undefined'?globalThis:window);
