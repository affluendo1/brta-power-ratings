const CACHE_PREFIX="brta-power-ratings-";
const CACHE_NAME=CACHE_PREFIX+"shell-v82r2";
const SHELL_FILES=["web/models/search-commands.js?v=82","web/models/theme-studio.js?v=82","web/features/search-commands.js?v=82","web/features/theme-studio.js?v=82","web/optional/deeds-data.js?v=82","web/optional/deeds.js?v=82","web/features/club-map.js?v=82","web/styles/studio.css?v=82","web/vendor/leaflet/leaflet.js?v=82","web/vendor/leaflet/leaflet.css?v=82","web/optional/orthography.js?v=82","web/optional/lexicon.js?v=82","web/optional/lexicon.css?v=82","web/styles/site.css?v=82","web/styles/style.css?v=82","web/styles/future.css?v=82","./","index.html","data.js","manifest.webmanifest","web/workers/rating-worker.js?v=82","assets/kavac-display.woff?v=82","assets/sequence-impact.mp3","assets/gong.mp3","assets/brta-icon-180.png?v=82","assets/brta-icon-192.png?v=82","manifest.webmanifest?v=82","web/optional/collection.css?v=82","web/styles/custom-sections.css?v=82","web/styles/player-search.css?v=82","web/styles/team-lab.css?v=82","web/styles/changelog.css?v=82","web/optional/ambient.css?v=82","web/styles/layout.css?v=82","web/styles/polish.css?v=82","assets/brta-logo.png?v=82","data.js?v=82","web/models/prediction.js?v=82","web/optional/records.js?v=82","web/models/rating-history.js?v=82","web/models/custom-section-model.js?v=82","web/models/custom-section-tools.js?v=82","web/features/custom-sections.js?v=82","web/features/player-search.js?v=82","web/models/team-lab.js?v=82r2","web/features/team-lab-ui.js?v=82","web/features/changelog-data.js?v=82","web/features/changelog.js?v=82","web/optional/parameters.js?v=82","web/optional/presentation.js?v=82","web/models/layout-model.js?v=82","web/features/maps.js?v=82","web/features/waiting-game.js?v=82","web/core/app.js?v=82","web/core/layout.js?v=82","web/features/confetti.js?v=82","web/features/archive.js?v=82","web/optional/sequence.js?v=82","web/optional/controls.js?v=82","web/models/lab-model.js?v=82","web/features/labs.js?v=82r2","web/core/polish.js?v=82","web/core/pwa.js?v=82","web/models/matchday.js?v=82","web/features/matchday.js?v=82","web/features/following.js?v=82","web/features/share-cards.js?v=82r1","web/features/competition-formats.js?v=82","web/styles/matchday.css?v=82r1"];
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
