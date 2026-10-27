(function(root){
  'use strict';
  const palette=['#fff7d2','#f4c650','#bc7827','#5f99ff','#f15b65','#75d3c8','#ffe9a1'];
  function create({count=260,slow=1,tiny=false}={}){
    const pieces=[];
    for(let i=0;i<count;i++){
      const piece=document.createElement('i'),leftSide=i%2===0,edge=leftSide?Math.round(2+Math.random()*7):Math.round(91+Math.random()*7),outward=leftSide?-1:1;
      piece.className='royal-confetti';
      piece.style.setProperty('--origin-x',edge+'vw');piece.style.setProperty('--origin-y',Math.round(66+Math.random()*29)+'vh');
      piece.style.setProperty('--x',outward*Math.round(18+Math.random()*105)+'px');piece.style.setProperty('--y',Math.round(-innerHeight*(.32+Math.random()*.72))+'px');
      piece.style.setProperty('--r',Math.round((Math.random()-.5)*1280)+'deg');piece.style.setProperty('--delay',Math.random()*.52*slow+'s');
      piece.style.setProperty('--confetti-duration',3.2*slow+'s');piece.style.setProperty('--confetti-color',palette[i%palette.length]);
      if(tiny){piece.style.width='3px';piece.style.height='5px';piece.dataset.confettiFinal='';}
      pieces.push(piece);
    }
    return pieces;
  }
  async function burst(parent,options){
    const pieces=create(options);parent.append(...pieces);
    // Query the actual shared animation, including its delay and reduced-motion treatment.
    await new Promise(resolve=>requestAnimationFrame(resolve));
    await Promise.all(pieces.flatMap(piece=>piece.getAnimations().map(animation=>animation.finished.catch(()=>{}))));
    pieces.forEach(piece=>piece.remove());
  }
  function trajectory(width,height,small=false,random=Math.random){
    const start=height*.85,end=height+30,apex=height*(small?.55:.2+random()*.12),v=-2*(start-apex+Math.sqrt((start-apex)*(end-apex))),g=end-start-v;
    return{target:width*(.04+random()*.92),v,g,start,duration:1800+random()*200,delay:random()*100,color:palette[Math.floor(random()*palette.length)],rotation:random()*Math.PI*2,spin:(random()-.5)*8,size:small?3:4+random()*4};
  }
  async function cups(parent,{reduced=false,isActive=()=>true}={}){
    if(reduced)return;
    const canvas=document.createElement('canvas');canvas.className='ms-confetti-canvas';canvas.setAttribute('aria-hidden','true');parent.append(canvas);
    const width=innerWidth,height=innerHeight,scale=Math.min(devicePixelRatio||1,1.5);canvas.width=width*scale;canvas.height=height*scale;
    const ctx=canvas.getContext('2d');ctx.scale(scale,scale);
    const run=count=>new Promise(resolve=>{const particles=Array.from({length:count},()=>trajectory(width,height,count===5)),start=performance.now();
      function frame(now){if(!isActive()){resolve();return}ctx.clearRect(0,0,width,height);let active=false;for(const p of particles){const t=(now-start-p.delay)/p.duration;if(t<0){active=true;continue}if(t>=1)continue;active=true;const x=width*.5+(p.target-width*.5)*t,y=p.start+p.v*t+p.g*t*t;ctx.save();ctx.translate(x,y);ctx.rotate(p.rotation+p.spin*t);ctx.fillStyle=p.color;ctx.fillRect(-p.size/2,-p.size,p.size,p.size*1.6);ctx.restore()}if(active)requestAnimationFrame(frame);else{ctx.clearRect(0,0,width,height);resolve()}}requestAnimationFrame(frame);
    });
    await run(200);if(isActive()){await new Promise(resolve=>setTimeout(resolve,1000));if(isActive())await run(5)}canvas.remove();
  }
  root.BRTAConfetti=Object.freeze({create,burst,cups,trajectory});
})(window);
