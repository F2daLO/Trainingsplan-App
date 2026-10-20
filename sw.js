const CACHE_NAME = "mein-training-v6.64";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png",
  "./icon-32.png",
  "./IMPORT_BEISPIEL.csv",
  "./PLANPAKET_BEISPIEL.json",
  "./css/app.css?v=6.64",
  "./js/00-theme.js?v=6.64",
  "./js/01-storage.js?v=6.64",
  "./js/02-sync-core.js?v=6.64",
  "./js/05-demo-data.js?v=6.64",
  "./js/10-core.js?v=6.64",
  "./js/20-overview-plan.js?v=6.64",
  "./js/30-settings.js?v=6.64",
  "./js/40-cloud-sync.js?v=6.64",
  "./js/50-session-ui.js?v=6.64",
  "./js/60-backup-push.js?v=6.64",
  "./js/70-equipment.js?v=6.64",
  "./js/80-realtime-gpt.js?v=6.64",
  "./js/90-workout-package.js?v=6.64",
  "./js/95-coach.js?v=6.64",
  "./js/97-activities.js?v=6.64",
  "./js/98-actual-summary.js?v=6.64",
  "./js/98-late-patches.js?v=6.64",
  "./js/98-device-names-v646.js?v=6.64",
  "./js/98-device-names-v647.js?v=6.64",
  "./js/99-app-examples.js?v=6.64",
  "./js/99-a11y.js?v=6.64"
];
const STATIC_RE = /\.(?:js|css|png|svg|json|csv|ico)$/i;

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  // Nur eigene App-Dateien; Supabase/API/Auth nie cachen (keine Tokens oder Nutzerdaten im Cache)
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (req.mode !== "navigate" && !STATIC_RE.test(url.pathname)) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req).then(r => r || caches.match(req, { ignoreSearch: true })).then(r => r || (req.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
