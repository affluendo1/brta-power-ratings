const CACHE_PREFIX="brta-power-ratings-";
const CACHE_NAME=CACHE_PREFIX+"shell-v823a";
const SHELL_FILES=["web/models/score-formats.js?v=823","web/models/refinement.js?v=823", "web/styles/refinement.css?v=823a", "web/features/pair-search.js?v=823", "web/features/team-explorer.js?v=823", "web/features/club-foundation.js?v=823", "web/features/extras-refinement.js?v=823","web/core/dialogs.js?v=823","web/models/search-commands.js?v=823","web/models/theme-studio.js?v=823","web/features/search-commands.js?v=823","web/features/theme-studio.js?v=823","web/optional/deeds-data.js?v=823","web/optional/deeds.js?v=823","web/features/club-map.js?v=823","web/styles/studio.css?v=823","web/vendor/leaflet/leaflet.js?v=823","web/vendor/leaflet/leaflet.css?v=823","web/optional/orthography.js?v=823","web/optional/lexicon.js?v=823","web/optional/lexicon.css?v=823","web/styles/site.css?v=823","web/styles/style.css?v=823","web/styles/future.css?v=823","./","index.html","data.js","manifest.webmanifest","web/workers/rating-worker.js?v=823","assets/kavac-display.woff?v=823","assets/sequence-impact.mp3","assets/gong.mp3","assets/brta-icon-180.png?v=823","assets/brta-icon-192.png?v=823","manifest.webmanifest?v=823","web/optional/collection.css?v=823","web/styles/custom-sections.css?v=823","web/styles/player-search.css?v=823","web/styles/team-lab.css?v=823","web/styles/changelog.css?v=823","web/optional/ambient.css?v=823","web/styles/layout.css?v=823","web/styles/polish.css?v=823","assets/brta-logo.png?v=823","data.js?v=823","web/models/prediction.js?v=823","web/optional/records.js?v=823","web/models/rating-history.js?v=823","web/models/custom-section-model.js?v=823","web/models/custom-section-tools.js?v=823","web/features/custom-sections.js?v=823","web/features/player-search.js?v=823","web/models/team-lab.js?v=823","web/features/team-lab-ui.js?v=823","web/features/changelog-data.js?v=823","web/features/changelog.js?v=823","web/optional/parameters.js?v=823","web/optional/presentation.js?v=823","web/models/layout-model.js?v=823","web/features/maps.js?v=823","web/features/waiting-game.js?v=823","web/core/app.js?v=823","web/core/layout.js?v=823","web/features/confetti.js?v=823","web/features/archive.js?v=823","web/optional/sequence.js?v=823","web/optional/controls.js?v=823","web/models/lab-model.js?v=823","web/features/labs.js?v=823","web/core/polish.js?v=823","web/core/pwa.js?v=823","web/models/matchday.js?v=823","web/features/matchday.js?v=823","web/features/following.js?v=823","web/features/share-cards.js?v=823","web/features/competition-formats.js?v=823","web/styles/matchday.css?v=823"];
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
