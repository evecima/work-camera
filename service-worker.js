/* Work Camera shell cache only. IndexedDB photo blobs are never touched by updates. */
const CACHE_NAME='work-camera-shell-v3.5.0';
const OWN_CACHE_PREFIX='work-camera-shell-';
const APP_ASSETS=[
  './','./index.html','./styles.css?v=3.5.0','./app.js?v=3.5.0',
  './local-backup.js?v=3.5.0','./gallery-bulk.js?v=3.5.0','./data/apartments.js?v=3.5.0',
  './manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k.startsWith(OWN_CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k))
  )));
  self.clients.claim();
});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    try{
      // Online updates must bypass HTTP cache; offline still uses the shell cache.
      const response=await fetch(event.request,{cache:'no-store'});
      if(response.ok){
        if(event.request.mode==='navigate'){
          await cache.put('./index.html',response.clone());
        }else{
          await cache.put(event.request,response.clone());
        }
      }
      return response;
    }catch(error){
      const cached=await cache.match(event.request);
      if(cached)return cached;
      if(event.request.mode==='navigate')return (await cache.match('./index.html'))||Response.error();
      return Response.error();
    }
  })());
});
