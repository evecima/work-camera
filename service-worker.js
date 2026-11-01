// Cache application shell/catalog only. User photo blobs are stored separately in IndexedDB.
const CACHE_NAME='work-camera-shell-v2.1';
const OWN_CACHE_PREFIX='work-camera-shell-';
const APP_ASSETS=['./','./index.html','./styles.css','./app.js','./onedrive.js','./manifest.webmanifest','./data/apartments.js','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_ASSETS)));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(OWN_CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||!event.request.url.startsWith(self.registration.scope))return;event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request)));});
