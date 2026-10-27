(function(root){
  'use strict';
  const alphabet='abcdefghijklmnopqrstuvwxyz';
  const glyphs=[...'ąƀçđęƒģħįĵķłɱņøþզŗşŧųṽŵẋŷž'];
  const numerals=[...'£$%&¤§¥€¢¶'];
  const dictionary=new Map();
  const syllables=['kâ','vą','çë','ņø','şų','žî','ŧę','łå','đü','ŵõ','ģï','þæ'];
  function hash(value){let h=2166136261;for(const c of value){h^=c.codePointAt(0);h=Math.imul(h,16777619)}return h>>>0}
  function name(value){return String(value).replace(/[a-z0-9]/gi,c=>/\d/.test(c)?numerals[Number(c)]:(c===c.toUpperCase()?glyphs[alphabet.indexOf(c.toLowerCase())].toUpperCase():glyphs[alphabet.indexOf(c)]));}
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
    const late=duration-10000,burst=late*(.2+random()*.55),jump=burst+500+random()*1500;
    return[{at:0,value:0},{at:burst*.15,value:2+Math.floor(random()*5)},{at:burst*.45,value:9+Math.floor(random()*6)},{at:burst*.8,value:18+Math.floor(random()*5)},{at:burst,value:25},{at:jump,value:97},{at:late+random()*4000,value:98},{at:duration-500-random()*2000,value:99},{at:duration,value:100}];
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
  const api={alphabet,glyphs,numerals,translate,name,shuffled,pressure,rates,progressPlan,confirmations};
  root.MoreSettingsModel=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
