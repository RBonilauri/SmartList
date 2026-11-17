// Incrémenter VERSION à chaque mise en ligne pour renouveler le cache.
const VERSION = "courses-v13";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png", "icons/badge-96.png"];

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

// Notification « liste à acheter » envoyée par la fonction sl-notify.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "SmartList", {
    body: d.body || "",
    icon: "icons/icon-192.png",
    badge: "icons/badge-96.png",
    tag: d.tag || "smartlist",
    renotify: true,
    lang: "fr",
    data: { url: d.url || "./" },
  }));
});

// Toucher la notification ouvre l'appli sur la liste concernée.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
    for (const w of wins) {
      if (w.url.startsWith(self.registration.scope)) {
        w.postMessage({ type: "open-list", url });
        return w.focus();
      }
    }
    return self.clients.openWindow(url);
  }));
});
