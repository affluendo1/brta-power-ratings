const CACHE_PREFIX="brta-power-ratings-";
const CACHE_NAME=CACHE_PREFIX+"shell-v47";
const SHELL_FILES=[
  "./","index.html","site.css","future.css","style.css","archive.css?v=12","app.js?v=46","layout-model.js?v=2","layout.js?v=2","layout.css?v=2","rating-worker.js?v=2","changelog-data.js?v=4","changelog.js?v=2","changelog.css?v=1","more-settings-model.js?v=3","more-settings-effects.js?v=1","more-settings.js?v=4","more-settings.css?v=4","assets/kavac-display.woff?v=2","team-lab.js?v=1","team-lab-ui.js?v=2","team-lab.css?v=1","player-search.js?v=1","player-search.css?v=1","custom-section-model.js?v=3","custom-section-tools.js?v=3","custom-sections.js?v=8","custom-sections.css?v=6","rating-history.js?v=2","auxiliary-module.js?v=3","confetti.js?v=2","archive.js?v=12",
  "prediction.js?v=3","pwa.js","data.js","manifest.webmanifest",
  "assets/brta-logo.png","assets/brta-icon-180.png",
  "assets/brta-icon-192.png","assets/brta-icon-512.png","assets/gong.mp3"
];
const scopedUrl=path=>new URL(path,self.registration.scope).href;
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await cache.addAll(SHELL_FILES.map(scopedUrl));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME).map(name=>caches.delete(name)));
    await self.clients.claim();
  })());
});
async function networkFirst(request){
  const cache=await caches.open(CACHE_NAME);
  try{
    const response=await fetch(request);
    if(response.ok){await cache.put(request,response.clone());return response}
    return await cache.match(request)||await cache.match(request,{ignoreSearch:true})||response;
  }catch{}
  return await cache.match(request,{ignoreSearch:true})
    ||await cache.match(scopedUrl("index.html"))
    ||new Response("You are offline. Reconnect to open BRTA Power Ratings.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
}
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  const scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  if(request.mode==="navigate"){event.respondWith(networkFirst(request));return}
  if(!/\.(?:js|css|png|jpe?g|webmanifest|woff2?)$/.test(url.pathname)&&!url.pathname.endsWith('/assets/gong.mp3'))return;
  event.respondWith(networkFirst(request));
});
