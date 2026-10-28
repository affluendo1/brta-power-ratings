/* Dormant interactive maps. No iframe or network request exists until mount(). */
(function(root){
 'use strict';
 function mapURL({latitude,longitude,span=.02}){
  if(![latitude,longitude,span].every(Number.isFinite)||Math.abs(latitude)>85||Math.abs(longitude)>180||span<=0||span>30)throw new RangeError('Invalid map coordinates or span');
  const url=new URL('https://www.openstreetmap.org/export/embed.html');
  url.searchParams.set('bbox',[Math.max(-180,longitude-span),Math.max(-85,latitude-span),Math.min(180,longitude+span),Math.min(85,latitude+span)].join(','));
  url.searchParams.set('layer','mapnik');url.searchParams.set('marker',latitude+','+longitude);return url.href;
 }
 function mount(container,options){
  const url=mapURL(options),frame=document.createElement('iframe');frame.title=options.title||'Location map';frame.src=url;frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;frame.style.cssText='display:block;width:100%;height:360px;border:0';container.append(frame);return()=>frame.remove();
 }
 const api=Object.freeze({mapURL,mount});root.BRTAMaps=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
