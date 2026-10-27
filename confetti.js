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
  root.BRTAConfetti=Object.freeze({create,burst});
})(window);
