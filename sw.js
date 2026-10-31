const CACHE_PREFIX="brta-power-ratings-";
const CACHE_NAME=CACHE_PREFIX+"shell-v831b";
const SHELL_FILES=["web/features/reading-pages.js?v=831b","web/styles/update831.css?v=831b","web/models/rm4.js?v=831b","web/models/rm4-engine.js?v=831b","web/models/rm4-frozen.json?v=831b","web/features/rm4-ui.js?v=831b","web/models/score-formats.js?v=831b","web/models/refinement.js?v=831b", "web/styles/refinement.css?v=831b", "web/features/pair-search.js?v=831b", "web/features/team-explorer.js?v=831b", "web/features/club-foundation.js?v=831b", "web/features/extras-refinement.js?v=831b","web/core/dialogs.js?v=831b","web/models/search-commands.js?v=831b","web/models/theme-studio.js?v=831b","web/features/search-commands.js?v=831b","web/features/theme-studio.js?v=831b","web/optional/deeds-data.js?v=831b","web/optional/deeds.js?v=831b","web/features/club-map.js?v=831b","web/styles/studio.css?v=831b","web/vendor/leaflet/leaflet.js?v=831b","web/vendor/leaflet/leaflet.css?v=831b","web/optional/orthography.js?v=831b","web/optional/lexicon.js?v=831b","web/optional/lexicon.css?v=831b","web/styles/site.css?v=831b","web/styles/style.css?v=831b","web/styles/future.css?v=831b","./","index.html","data.js","manifest.webmanifest","web/workers/rating-worker.js?v=831b","assets/kavac-display.woff?v=831b","assets/sequence-impact.mp3","assets/gong.mp3","assets/brta-icon-180.png?v=831b","assets/brta-icon-192.png?v=831b","manifest.webmanifest?v=831b","web/optional/collection.css?v=831b","web/styles/custom-sections.css?v=831b","web/styles/player-search.css?v=831b","web/styles/team-lab.css?v=831b","web/styles/changelog.css?v=831b","web/optional/ambient.css?v=831b","web/styles/layout.css?v=831b","web/styles/polish.css?v=831b","assets/brta-logo.png?v=831b","data.js?v=831b","web/models/prediction.js?v=831b","web/optional/records.js?v=831b","web/models/rating-history.js?v=831b","web/models/custom-section-model.js?v=831b","web/models/custom-section-tools.js?v=831b","web/features/custom-sections.js?v=831b","web/features/player-search.js?v=831b","web/models/team-lab.js?v=831b","web/features/team-lab-ui.js?v=831b","web/features/changelog-data.js?v=831b","web/features/changelog.js?v=831b","web/optional/parameters.js?v=831b","web/optional/presentation.js?v=831b","web/models/layout-model.js?v=831b","web/features/maps.js?v=831b","web/features/waiting-game.js?v=831b","web/core/app.js?v=831b","web/core/layout.js?v=831b","web/features/confetti.js?v=831b","web/features/archive.js?v=831b","web/optional/sequence.js?v=831b","web/optional/controls.js?v=831b","web/models/lab-model.js?v=831b","web/features/labs.js?v=831b","web/core/polish.js?v=831b","web/core/pwa.js?v=831b","web/models/matchday.js?v=831b","web/features/matchday.js?v=831b","web/features/following.js?v=831b","web/features/share-cards.js?v=831b","web/features/competition-formats.js?v=831b","web/styles/matchday.css?v=831b"];
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
  let cache;
  try{cache=await caches.open(CACHE_NAME)}catch{}
  const cached=async()=>{try{return await cache?.match(request)||await cache?.match(request,{ignoreSearch:true})}catch{return undefined}};
  try{
    const response=await fetch(request);
    if(response.ok){
      // Quota/private-mode cache failures must never discard a valid network response.
      try{await cache?.put(request,response.clone())}catch{}
      return response;
    }
    return await cached()||response;
  }catch{}
  const hit=await cached();if(hit)return hit;
  // HTML is only a navigation fallback. It is never valid JavaScript, CSS or JSON.
  if(request.mode==="navigate"){
    try{const shell=await cache?.match(scopedUrl("index.html"));if(shell)return shell}catch{}
  }
  return new Response("You are offline. Reconnect to open BRTA Power Ratings.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8"}});
}
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  const scope=new URL(self.registration.scope);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
  if(request.mode==="navigate"){event.respondWith(networkFirst(request));return}
  if(!/\.(?:js|json|css|png|jpe?g|webmanifest|woff2?|mp3)$/.test(url.pathname))return;
  event.respondWith(networkFirst(request));
});

