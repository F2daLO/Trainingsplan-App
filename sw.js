const CACHE="training-v6-6-4-default-equipment-label";
const ASSETS=["./","./index.html","./manifest.json","./icon.svg"];

self.addEventListener("install",event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

/*
  IMPORTANT:
  - Never intercept cross-origin requests (e.g. Supabase Edge Functions).
  - Never intercept POST/OPTIONS requests.
  - Only provide an offline fallback for same-origin GET/navigation requests.
*/
self.addEventListener("fetch",event=>{
  const request=event.request;

  if(request.method!=="GET") return;

  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then(response=>response)
      .catch(async()=>{
        const cached=await caches.match(request);
        if(cached) return cached;

        if(request.mode==="navigate"){
          const fallback=await caches.match("./index.html");
          if(fallback) return fallback;
        }

        return new Response("Offline",{
          status:503,
          statusText:"Offline",
          headers:{"Content-Type":"text/plain; charset=utf-8"}
        });
      })
  );
});

self.addEventListener("push",event=>{
  let data={};
  try{data=event.data?event.data.json():{}}catch{data={title:"Training",body:event.data?.text()||"Neue Erinnerung"}}
  const title=data.title||"Training";
  const options={
    body:data.body||"",
    icon:"./icon.svg",
    badge:"./icon.svg",
    tag:data.tag||"training-reminder",
    data:{url:data.url||"./",sessionId:data.sessionId||null},
    renotify:false
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const url=event.notification.data?.url||"./";
  event.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
      for(const client of list){
        if("focus" in client){client.navigate?.(url);return client.focus()}
      }
      return clients.openWindow?clients.openWindow(url):undefined;
    })
  );
});
