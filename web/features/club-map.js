/* Dormant map adapter. Nothing is mounted, fetched or geolocated at startup. */
(function(root){'use strict';
const bounds=[[-38.7,144.3],[-37.1,146.3]];
function inside(c){return c&&Number.isFinite(c.latitude)&&Number.isFinite(c.longitude)&&c.latitude>=bounds[0][0]&&c.latitude<=bounds[1][0]&&c.longitude>=bounds[0][1]&&c.longitude<=bounds[1][1]}
function markers(clubs){return clubs.filter(c=>inside(c.coordinates)).map(c=>({id:c.id,name:c.name,lat:c.coordinates.latitude,lng:c.coordinates.longitude}))}
let loading;
function load(){if(root.L)return Promise.resolve(root.L);if(!loading)loading=new Promise((resolve,reject)=>{const css=document.createElement('link');css.rel='stylesheet';css.href='web/vendor/leaflet/leaflet.css';document.head.append(css);const script=document.createElement('script');script.src='web/vendor/leaflet/leaflet.js';script.onload=()=>resolve(root.L);script.onerror=()=>{loading=null;script.remove();css.remove();reject(Error('The map could not load.'))};document.head.append(script)});return loading}
async function mountNetwork(container,clubs,onClubSelect,{signal,onTileError=()=>{}}={}){
 if(typeof onClubSelect!=='function')throw Error('Supply the Club Zone navigation handler.');
 const L=await load();if(signal?.aborted||!container.isConnected)throw new DOMException('Map closed before loading.','AbortError');
 const map=L.map(container,{maxBounds:bounds,maxBoundsViscosity:1,minZoom:9,maxZoom:19,worldCopyJump:false});let destroyed=false,frame=0;
 const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',bounds,noWrap:true,maxZoom:19}).addTo(map);
 tiles.on('tileerror',onTileError);const points=markers(clubs),color=getComputedStyle(container).getPropertyValue('--primary').trim()||'#327dc9';
 for(const p of points){const label=document.createElement('span');label.textContent=p.name;L.circleMarker([p.lat,p.lng],{radius:8,color,fillOpacity:.8}).addTo(map).bindTooltip(label).on('click',()=>onClubSelect({id:p.id,name:p.name}))}
 if(points.length)map.fitBounds(L.latLngBounds(points.map(p=>[p.lat,p.lng])).pad(.12));else map.fitBounds(bounds);
 const resize=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!destroyed&&container.isConnected){map.invalidateSize({pan:false});map.setMinZoom(Math.max(9,map.getBoundsZoom(L.latLngBounds(bounds),true)))}})};
 const observer=new ResizeObserver(resize);observer.observe(container);resize();
 const destroy=()=>{if(destroyed)return;destroyed=true;cancelAnimationFrame(frame);observer.disconnect();signal?.removeEventListener('abort',destroy);tiles.off('tileerror',onTileError);map.off();map.remove()};
 signal?.addEventListener('abort',destroy,{once:true});return{map,destroy};
}
const api={bounds,inside,markers,mountNetwork};root.BRTAClubMap=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
