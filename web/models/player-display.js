/* Present friendly labels without changing the internal TROLS player identity. */
(function(root){
'use strict';
const marker=/\[(?:Unnamed|Unlisted)\s+player(?:\s+[^\]]*)?\]/gi;
function isUnknown(value){return /^\s*(?:\[(?:Unnamed|Unlisted)\s+player[^\]]*\]|TROLS\s+No[\s-]?Code)\s*$/i.test(String(value??''))}
function display(value){return String(value??'').replace(marker,'Unidentified player').replace(/\bTROLS\s+No[\s-]?Code\b/gi,'Unidentified player')}
function scrub(node){
 if(!node)return;
 function update(t){if(!t?.nodeValue||!/(?:\[(?:Unnamed|Unlisted)\s+player|TROLS\s+No[\s-]?Code)/i.test(t.nodeValue))return;const x=display(t.nodeValue);if(x!==t.nodeValue)t.nodeValue=x}
 if(node.nodeType===3){if(!node.parentElement?.closest('script,style,textarea,pre,code'))update(node);return}
 if(node.nodeType!==1||node.closest('script,style,textarea,pre,code'))return;
 // Screen readers and hover tooltips must not leak technical player identifiers either.
 const fixAttrs=el=>{for(const attr of ['title','aria-label','alt']){if(!el.hasAttribute(attr))continue;const raw=el.getAttribute(attr),safe=display(raw);if(raw!==safe)el.setAttribute(attr,safe)}};
 fixAttrs(node);node.querySelectorAll('[title],[aria-label],[alt]').forEach(fixAttrs);
 const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);let n;
 while((n=walker.nextNode()))if(!n.parentElement?.closest('script,style,textarea,pre,code'))update(n);
}
function start(){
 if(!document.body)return;
 scrub(document.body);
 new MutationObserver(records=>{for(const record of records){if(record.type==='characterData')scrub(record.target);else if(record.type==='attributes')scrub(record.target);else for(const n of record.addedNodes)scrub(n)}})
 .observe(document.body,{childList:true,characterData:true,attributes:true,attributeFilter:['title','aria-label','alt'],subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.BRTAPlayerDisplay=Object.freeze({display,isUnknown,scrub});
})(window);
