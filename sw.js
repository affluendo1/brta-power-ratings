const CACHE_PREFIX="brta-power-ratings-";
const CACHE_NAME=CACHE_PREFIX+"shell-v3";
const SHELL_FILES=[
  "./","index.html","site.css","future.css","style.css","app.js",
  "prediction.js","pwa.js","data.js","manifest.webmanifest",
  "assets/brta-logo.png","assets/brta-icon-180.png",
  "assets/brta-icon-192.png","assets/brta-icon-512.png"
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
  if(!/\.(?:js|css|png|webmanifest)$/.test(url.pathname))return;
  const cachePromise=caches.open(CACHE_NAME);
  const cachedPromise=cachePromise.then(cache=>cache.match(request,{ignoreSearch:true}));
  const updatePromise=cachePromise.then(cache=>fetch(request).then(async response=>{
    if(response.ok)await cache.put(request,response.clone());
    return response;
  })).catch(()=>null);
  event.waitUntil(updatePromise.then(()=>{}));
  event.respondWith(cachedPromise.then(cached=>cached||updatePromise).then(response=>response||new Response("",{status:504})));
});
