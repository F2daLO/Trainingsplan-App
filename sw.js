const CACHE="training-v6-3-reminders-push";const ASSETS=["./","./index.html","./manifest.json","./icon.svg"];self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==CACHE).map(x=>caches.delete(x)))).then(()=>self.clients.claim())));self.addEventListener("fetch",e=>e.respondWith(fetch(e.request).catch(()=>caches.match(e.request))));
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
