/* Offline shell only: photos always remain in IndexedDB, never in a network cache. */
const CACHE_NAME='work-camera-shell-v3';
const OWN_CACHE_PREFIX='work-camera-shell-';
const APP_ASSETS=['./','./index.html','./styles.css','./app.js','./local-backup.js','./manifest.webmanifest','./data/apartments.js','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(OWN_CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      const response=await fetch(event.request);
      if(response.ok)await cache.put(event.request,response.clone());
      return response;
    }catch(e){
      const cached=await cache.match(event.request);
      if(cached)return cached;
      if(event.request.mode==='navigate')return cache.match('./index.html')||Response.error();
      return Response.error();
    }
  })());
});
