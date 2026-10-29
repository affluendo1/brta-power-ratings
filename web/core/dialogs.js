/* Route keyboard input to the visible front dialog before legacy feature handlers. */
(function(root){
  'use strict';
  const callbacks=new Map(),opened=new Map(),focusCandidates=new WeakMap();
  let previousFocus=document.activeElement;
  const visible=element=>element.isConnected&&!element.hidden&&!element.closest('.hidden,[hidden],[inert]')&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).visibility!=='hidden';
  function layers(){return [...document.querySelectorAll('.overlay:not(.hidden)')].filter(visible).sort((a,b)=>(Number(getComputedStyle(a).zIndex)||0)-(Number(getComputedStyle(b).zIndex)||0));}
  const top=()=>layers().at(-1);
  const controls=overlay=>[...overlay.querySelectorAll('button,input,select,textarea,a[href],summary,[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&visible(e)&&e.getClientRects().length);
  function sync(){
    for(const [overlay,focus] of opened){
      if(overlay.isConnected&&!overlay.classList.contains('hidden'))continue;
      opened.delete(overlay);
      if((document.activeElement===document.body||overlay.contains(document.activeElement))&&focus?.isConnected&&visible(focus))focus.focus({preventScroll:true});
    }
    for(const overlay of document.querySelectorAll('.overlay:not(.hidden)')){
      if(opened.has(overlay)||!visible(overlay))continue;
      opened.set(overlay,focusCandidates.get(overlay)||(overlay.contains(document.activeElement)?previousFocus:document.activeElement));
      focusCandidates.delete(overlay);
      const others=layers().filter(e=>e!==overlay);
      overlay.style.zIndex=String(Math.max(30,...others.map(e=>Number(getComputedStyle(e).zIndex)||0))+2);
      const sheet=overlay.querySelector('section,aside');
      if(sheet&&!sheet.hasAttribute('role')){sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.dataset.dialogAutoLabel='true';}
      if(!overlay.contains(document.activeElement))controls(overlay)[0]?.focus({preventScroll:true});
    }
    for(const sheet of document.querySelectorAll('[data-dialog-auto-label]')){const title=sheet.querySelector('h2');if(title&&sheet.getAttribute('aria-label')!==title.textContent)sheet.setAttribute('aria-label',title.textContent);}
    document.body.classList.toggle('modal-open',!!document.querySelector('.overlay:not(.hidden)'));
  }
  new MutationObserver(sync).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  root.addEventListener('focusin',event=>{const overlay=event.target.closest?.('.overlay');if(overlay&&!opened.has(overlay)&&!focusCandidates.has(overlay))focusCandidates.set(overlay,previousFocus);previousFocus=event.target;},true);
  root.addEventListener('keydown',event=>{
    if(event.target.closest?.('[data-floating-translator]'))return;
    const transition=document.querySelector('#modeSwitchOverlay:not(.hidden)');if(transition&&event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();return}const overlay=top();if(!overlay)return;
    // These scenes have their own keyboard controls, including the narrator.
    if(overlay.id==='moreSettingsOverlay'){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();callbacks.get(overlay.id)?.()}return;}
    if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();
      const callback=callbacks.get(overlay.id);
      if(callback){callback();return;}
      const button=overlay.querySelector('button[data-changelog-close],button[data-layout-close],button[data-82-close],button[data-studio-close],button[data-eight-back],button[data-ca-action="close"],button.close-btn');
      if(button)button.click();
      return;
    }
    if(event.key==='Tab'){
      const nodes=controls(overlay),first=nodes[0],last=nodes.at(-1);
      if(!first){event.preventDefault();return;}
      if(!overlay.contains(document.activeElement)||event.shiftKey&&document.activeElement===first||!event.shiftKey&&document.activeElement===last){event.preventDefault();(event.shiftKey?last:first).focus();}
      // Underlying dialogs must not run their own focus traps.
      event.stopImmediatePropagation();
    }
  },true);
  root.BRTAOverlays={top,register:(id,callback)=>callbacks.set(id,callback)};
})(window);
