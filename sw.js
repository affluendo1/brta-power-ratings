const CACHE_PREFIX="brta-power-ratings-";
const CACHE_NAME=CACHE_PREFIX+"shell-v8101";
const SHELL_FILES=["web/models/search-commands.js?v=8101","web/models/theme-studio.js?v=8101","web/features/search-commands.js?v=8101","web/features/theme-studio.js?v=8101","web/optional/deeds-data.js?v=8101","web/optional/deeds.js?v=8101","web/features/club-map.js?v=8101","web/styles/studio.css?v=8101","web/vendor/leaflet/leaflet.js?v=8101","web/vendor/leaflet/leaflet.css?v=8101","web/optional/orthography.js?v=8101","web/optional/lexicon.js?v=8101","web/optional/lexicon.css?v=8101","web/styles/site.css?v=8101","web/styles/style.css?v=8101","web/styles/future.css?v=8101","./","index.html","data.js","manifest.webmanifest","web/workers/rating-worker.js?v=8101","assets/kavac-display.woff?v=8101","assets/sequence-impact.mp3","assets/gong.mp3","assets/brta-icon-180.png?v=8101","assets/brta-icon-192.png?v=8101","manifest.webmanifest?v=8101","web/optional/collection.css?v=8101","web/styles/custom-sections.css?v=8101","web/styles/player-search.css?v=8101","web/styles/team-lab.css?v=8101","web/styles/changelog.css?v=8101","web/optional/ambient.css?v=8101","web/styles/layout.css?v=8101","web/styles/polish.css?v=8101","assets/brta-logo.png?v=8101","data.js?v=8101","web/models/prediction.js?v=8101","web/optional/records.js?v=8101","web/models/rating-history.js?v=8101","web/models/custom-section-model.js?v=8101","web/models/custom-section-tools.js?v=8101","web/features/custom-sections.js?v=8101","web/features/player-search.js?v=8101","web/models/team-lab.js?v=8101","web/features/team-lab-ui.js?v=8101","web/features/changelog-data.js?v=8101","web/features/changelog.js?v=8101","web/optional/parameters.js?v=8101","web/optional/presentation.js?v=8101","web/models/layout-model.js?v=8101","web/features/maps.js?v=8101","web/features/waiting-game.js?v=8101","web/core/app.js?v=8101","web/core/layout.js?v=8101","web/features/confetti.js?v=8101","web/features/archive.js?v=8101","web/optional/sequence.js?v=8101","web/optional/controls.js?v=8101","web/models/lab-model.js?v=8101","web/features/labs.js?v=8101","web/core/polish.js?v=8101","web/core/pwa.js?v=8101"];
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
