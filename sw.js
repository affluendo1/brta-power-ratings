const CACHE_PREFIX="brta-power-ratings-";
const CACHE_NAME=CACHE_PREFIX+"shell-v8211b";
const SHELL_FILES=["web/models/search-commands.js?v=821","web/models/theme-studio.js?v=821","web/features/search-commands.js?v=821","web/features/theme-studio.js?v=821","web/optional/deeds-data.js?v=821","web/optional/deeds.js?v=821","web/features/club-map.js?v=821","web/styles/studio.css?v=821","web/vendor/leaflet/leaflet.js?v=821","web/vendor/leaflet/leaflet.css?v=821","web/optional/orthography.js?v=821","web/optional/lexicon.js?v=821","web/optional/lexicon.css?v=821","web/styles/site.css?v=821","web/styles/style.css?v=821","web/styles/future.css?v=821","./","index.html","data.js","manifest.webmanifest","web/workers/rating-worker.js?v=821","assets/kavac-display.woff?v=821","assets/sequence-impact.mp3","assets/gong.mp3","assets/brta-icon-180.png?v=821","assets/brta-icon-192.png?v=821","manifest.webmanifest?v=821","web/optional/collection.css?v=821","web/styles/custom-sections.css?v=821","web/styles/player-search.css?v=821","web/styles/team-lab.css?v=821","web/styles/changelog.css?v=8211","web/optional/ambient.css?v=821","web/styles/layout.css?v=821","web/styles/polish.css?v=821","assets/brta-logo.png?v=821","data.js?v=821","web/models/prediction.js?v=821","web/optional/records.js?v=821","web/models/rating-history.js?v=821","web/models/custom-section-model.js?v=821","web/models/custom-section-tools.js?v=821","web/features/custom-sections.js?v=821","web/features/player-search.js?v=8211","web/models/team-lab.js?v=821","web/features/team-lab-ui.js?v=821","web/features/changelog-data.js?v=8211","web/features/changelog.js?v=8211","web/optional/parameters.js?v=821","web/optional/presentation.js?v=821","web/models/layout-model.js?v=821","web/features/maps.js?v=821","web/features/waiting-game.js?v=821","web/core/app.js?v=821","web/core/layout.js?v=821","web/features/confetti.js?v=821","web/features/archive.js?v=821","web/optional/sequence.js?v=821","web/optional/controls.js?v=821","web/models/lab-model.js?v=821a","web/features/labs.js?v=821","web/core/polish.js?v=821","web/core/pwa.js?v=821","web/models/matchday.js?v=821","web/features/matchday.js?v=821c","web/features/following.js?v=8211","web/features/share-cards.js?v=821c","web/features/competition-formats.js?v=821","web/styles/matchday.css?v=821d"];
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
