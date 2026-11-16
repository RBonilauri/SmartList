// Incrémenter VERSION à chaque mise en ligne pour renouveler le cache.
const VERSION = "courses-v2";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const put = (res) => {
    if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
    return res;
  };
  if (req.mode === "navigate") {
    // Réseau d'abord pour recevoir les mises à jour, cache si hors ligne.
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then((r) => r || caches.match("index.html"))));
    return;
  }
  // Reste (icônes, polices) : cache d'abord.
  e.respondWith(caches.match(req).then((r) => r || fetch(req).then(put)));
});
