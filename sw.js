var SHELL_CACHE = "antigua-shell-v3";
var TILE_CACHE = "antigua-viewed-tiles-v3";
var OLD_CACHES = ["antigua-shell-v1","antigua-tiles-v2","antigua-shell-v2"];

var SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"
];

self.addEventListener("install", function(event){
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function(cache){
      return Promise.all(SHELL_FILES.map(function(url){
        return fetch(url, {mode:"no-cors"}).then(function(resp){ return cache.put(url, resp); }).catch(function(){});
      }));
    })
  );
});

self.addEventListener("activate", function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(keys.filter(function(k){ return OLD_CACHES.indexOf(k) !== -1; }).map(function(k){ return caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isTileRequest(url){ return url.indexOf("tile.openstreetmap.org") !== -1; }

self.addEventListener("fetch", function(event){
  var url = event.request.url;

  if (isTileRequest(url)){
    event.respondWith(
      caches.open(TILE_CACHE).then(function(cache){
        return cache.match(event.request).then(function(cached){
          if (cached) return cached;
          return fetch(event.request).then(function(resp){
            cache.put(event.request, resp.clone());
            return resp;
          }).catch(function(){
            return new Response("", {status:504, statusText:"Offline, tile not cached"});
          });
        });
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(function(cached){
      if (cached) return cached;
      return fetch(event.request).catch(function(){ return caches.match("./index.html"); });
    })
  );
});
