(function(root){
  'use strict';
  const M=root.AmbientParameters;
  const textRecords=new Map(),attributeRecords=new Map(),baseRates=new WeakMap();
  let translated=false,observer,animationTimer,pressure=1,scheduled=false;
  const attributes=['title','aria-label','aria-description','placeholder','alt','label'];
  const exempt=element=>element.closest('script,style,noscript,[data-ms-literal],[data-floating-translator]');
  function transform(){
    scheduled=false;if(!translated)return;
    const names=new Set([...document.querySelectorAll('[data-player],[data-global-player],[data-club-team],[data-tl-open]')].flatMap(e=>[e.dataset.player,e.dataset.globalPlayer,e.dataset.clubTeam,e.dataset.tlOpen]).filter(Boolean));
    const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);
    let node;
    while((node=walker.nextNode())){
      if(!node.parentElement||exempt(node.parentElement)||!node.data.trim())continue;
      const old=textRecords.get(node);if(old&&node.data===old.output)continue;
      const source=node.data,isName=names.has(source.trim())||!!node.parentElement.closest('[data-player],[data-global-player],[data-club-team],[data-tl-open],.tl-roster-name');
      const output=M.translate(source,isName);textRecords.set(node,{source,output});if(source!==output)node.data=output;
    }
    for(const element of document.querySelectorAll('[title],[aria-label],[aria-description],[placeholder],[alt]')){
      if(exempt(element))continue;
      let record=attributeRecords.get(element);if(!record){record={};attributeRecords.set(element,record)}
      for(const key of attributes){const source=element.getAttribute(key);if(source==null||source===record[key]?.output)continue;const output=M.translate(source);record[key]={source,output};if(output!==source)element.setAttribute(key,output)}
    }
    for(const [text]of textRecords)if(!text.isConnected)textRecords.delete(text);
    for(const [element]of attributeRecords)if(!element.isConnected)attributeRecords.delete(element);
  }
  function schedule(){if(translated&&!scheduled){scheduled=true;queueMicrotask(transform)}}
  function language(enabled){
    translated=enabled;document.documentElement.toggleAttribute('data-kavac',enabled);
    if(enabled){document.documentElement.lang='x-kavac';if(!observer)observer=new MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});transform();}
    else{observer?.disconnect();scheduled=false;document.documentElement.lang='en';for(const [node,record]of textRecords)if(node.data===record.output)node.data=record.source;for(const[element,record]of attributeRecords)for(const[key,value]of Object.entries(record))if(element.getAttribute(key)===value.output)element.setAttribute(key,value.source);textRecords.clear();attributeRecords.clear();}
  }
  document.addEventListener('input',event=>{if(event.target.closest('[data-floating-translator]'))return;if(event.target.matches('input,textarea'))event.target.toggleAttribute('data-ms-literal',/^(?:Sid Basa|Siddharth(?: R\.)? Basa)$/i.test(event.target.value));},true);
  function updateAnimations(){
    for(const animation of document.getAnimations()){
      const target=animation.effect?.target;
      if(!target?.closest||target.closest('[data-ms-cutscene],[data-ms-pressure],#modeSwitchOverlay'))continue;
      if(!baseRates.has(animation))baseRates.set(animation,animation.playbackRate||1);
      animation.updatePlaybackRate(baseRates.get(animation)*M.rates(pressure).animation);
    }
  }
  function atmosphere(value){pressure=M.pressure(value);updateAnimations();clearInterval(animationTimer);if(pressure!==1)animationTimer=setInterval(updateAnimations,350)}
  document.addEventListener('wheel',event=>{
    if(pressure===1||event.ctrlKey||event.defaultPrevented||event.target.closest('[data-ms-pressure]'))return;
    const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1);if(!delta)return;
    let element=event.target instanceof Element?event.target:null;
    while(element){const style=getComputedStyle(element);if(/auto|scroll/.test(style.overflowY)&&element.scrollHeight>element.clientHeight+1&&((delta>0&&element.scrollTop<element.scrollHeight-element.clientHeight-1)||(delta<0&&element.scrollTop>0)))break;element=element.parentElement;}
    element=element||document.scrollingElement;
    if(element.scrollHeight<=element.clientHeight)return;
    event.preventDefault();element.scrollTop+=delta*M.rates(pressure).scroll;
  },{passive:false});
  root.AmbientPresentation={language,atmosphere,refresh:schedule};
})(window);
