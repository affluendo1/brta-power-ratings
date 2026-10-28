(function(root){
  'use strict';
  const alphabet='abcdefghijklmnopqrstuvwxyz';
  const glyphs=[...'şņṽƒŗģħĵøķłžզɱþąŵŧđŷįƀęçųẋ'];
  const numerals=[...'£$%&¤§¥€¢¶'];
  const dictionary=new Map();
  const syllables=['kâ','vą','çë','ņø','şų','žî','ŧę','łå','đü','ŵõ','ģï','þæ'];
  function hash(value){let h=2166136261;for(const c of value){h^=c.codePointAt(0);h=Math.imul(h,16777619)}return h>>>0}
  function name(value){
    return String(value).replace(/[\p{L}\p{M}]+|\d/gu,word=>{
      if(/^\d$/.test(word))return numerals[Number(word)];
      const source=word.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[øłđðþæœßı]/g,c=>({'ø':'o','ł':'l','đ':'d','ð':'d','þ':'t','æ':'a','œ':'o','ß':'s','ı':'i'}[c]));
      let seed=hash(source);
      const letters=shuffled([...source],()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296});
      if(letters.length>1&&letters.join('')===source)letters.push(letters.shift());
      let output=letters.map(c=>glyphs[alphabet.indexOf(c)<0?hash(c)%26:alphabet.indexOf(c)]).join('');
      if(word===word.toUpperCase())output=output.toUpperCase();
      else if(word[0]===word[0].toUpperCase())output=output[0].toUpperCase()+output.slice(1);
      return output;
    });
  }
  function translate(value,isName=false){
    return String(value).split(/(\b(?:Sid Basa|Siddharth(?: R\.)? Basa)\b)/gi).map(part=>/^(?:Sid Basa|Siddharth(?: R\.)? Basa)$/i.test(part)?part:isName?name(part):part.replace(/[\p{L}\p{M}]+|\d/gu,word=>{
      if(/^\d$/.test(word))return numerals[Number(word)];
      if(!dictionary.has(word)){let h=hash(word.toLowerCase()),out='';for(let i=0;i<Math.max(1,Math.ceil(word.length/2));i++){out+=syllables[h%syllables.length];h=Math.imul(h^i,2246822519)>>>0}dictionary.set(word,out)}
      return dictionary.get(word);
    })).join('');
  }
  function shuffled(items,random=Math.random){const result=items.slice();for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
  function pressure(value){const number=Number(value);return Number.isFinite(number)?Math.max(.01,Math.min(2.01,Math.round(number*100)/100)):1}
  function rates(value){const p=pressure(value);return{animation:1+(p-1)*.065,scroll:1+(p-1)*.18}}
  function progressPlan(duration,random=Math.random){
    const count=8+Math.floor(random()*8),times=Array.from({length:count},()=>.1+random()**2*4),advances=Array.from({length:count},()=>.03+random()**3*5);
    const totalTime=times.reduce((a,b)=>a+b,0),totalProgress=advances.reduce((a,b)=>a+b,0),plan=[{at:0,value:0}];
    let elapsed=0,progress=0;
    for(let i=0;i<count;i++){elapsed+=times[i];progress+=advances[i];plan.push({at:i===count-1?duration:elapsed/totalTime*duration,value:i===count-1?100:Math.min(99,Math.floor(progress/totalProgress*100))});}
    return plan;
  }
  function cupWin(random=Math.random){return random()<1/5}
  function cupPoint(slot,width,height){const angle=slot/15*Math.PI*2;return{x:(.5+.42*Math.cos(angle))*width,y:(.5+.35*Math.sin(angle))*height}}
  function cupOrbit(slot,width,height,rotation=0){const origin=cupPoint(slot,width,height),steps=3600;return Array.from({length:steps+1},(_,i)=>{const t=i/steps;let turns;if(t<=.44){const u=t/.44;turns=5*(u-Math.sin(2*Math.PI*u)/(2*Math.PI))+.15*u*u}else{const u=(t-.44)/.56;turns=5.15+51.85*(u-Math.sin(2*Math.PI*u)/(2*Math.PI))+.15*u*(1-u)*(1-u)}const reorient=Math.max(0,Math.min(1,(t-.70)/.04)),angle=(slot/15+turns+rotation/15*(reorient*reorient*(3-2*reorient)))*2*Math.PI,pulse=Math.sin(Math.PI*t)**2;return{offset:t,transform:'translate('+((.5+(.42-.025*pulse)*Math.cos(angle))*width-origin.x)+'px,'+((.5+(.35+.018*pulse)*Math.sin(angle))*height-origin.y)+'px)'}})}
  function progressAt(plan,elapsed){const index=plan.findIndex(p=>p.at>elapsed);if(index<0)return 100;if(index===0)return 0;const a=plan[index-1],b=plan[index],t=(elapsed-a.at)/(b.at-a.at);return a.value+(b.value-a.value)*t;}
  function cupPath(from,to,width,height,random=Math.random){
    const a=cupPoint(from,width,height),b=cupPoint(to,width,height),arcX=(random()-.5)*width*.3,arcY=(random()<.5?-1:1)*height*(.12+random()*.32);
    return Array.from({length:13},(_,i)=>{const t=i/12,s=t*t*(3-2*t),bend=Math.sin(Math.PI*s);return{offset:t,transform:'translate('+((a.x-b.x)*(1-s)+arcX*bend)+'px,'+((a.y-b.y)*(1-s)+arcY*bend)+'px)'}});
  }
  const confirmations=[
    {text:'Are you sure want to confirm?',yes:'YES',no:'NO'},
    {text:'No seriously. No joking this time. Are you confident in your confirmation?',yes:'YES',no:'NO'},
    {text:"I’m still not sure. Type into this box ‘I CONFIRM’. Otherwise click ‘No’ to cancel.",phrase:'I CONFIRM',yes:'YES',no:'NO'},
    {text:'Okay, last confirmation this time. Are you COMPLETELY, UTTERLY, POSITIVE that you want to gain administrative privileges?',yes:'DEFINITELY',no:'MAYBE NOT'},
    {text:'Haha, that was a funny joke. But really. Confirm or no?',yes:'YES!',no:'I CHANGED MY MIND'},
    {text:'You know, confirming also means you take away one meal for a homeless child somewhere. Do you really want to do this? Think about the children…',yes:'OKAY, I WILL BE A BAD HUMAN',no:'I EMPATHIZE FOR THE HOMELESS, CANCEL THE CONFIRMATION'},
    {text:"Wow. Unbelievable. I just want you to confirm this? Type in ‘I will confirm, regardless of the suffering homeless children.’",phrase:'I will confirm, regardless of the suffering homeless children.',yes:'YES, I AGREE',no:"NO, THAT’S HORRIBLE"},
    {text:'As a final measure, this confirmation is different. We just want to make sure you are a human. Clicking [I CONFIRM] results in you cancelling your confirmation, and clicking [I CANCEL MY CONFIRMATION] will confirm your cancellation.',yes:'I CONFIRM',no:'I CANCEL MY CONFIRMATION'},
    {text:'Great! You’ve cancelled your confirmation.',yes:'OKAY'}
  ];
  const api={alphabet,glyphs,numerals,translate,name,shuffled,pressure,rates,progressPlan,progressAt,cupWin,cupPoint,cupPath,cupOrbit,confirmations};
  root.AmbientParameters=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
