// Service worker : jeu jouable hors ligne (appli installée sur PC, tablette, téléphone).
const VERSION = "gmtcg-v13";
const SHELL = ["./", "index.html", "css/style.css", "js/app.js", "js/state.js", "js/cards.js", "js/cards-data.js", "js/cardview.js", "js/opening.js", "js/friends.js", "js/pvp.js", "js/pvp-net.js", "js/sound.js", "js/account.js", "js/config.js", "js/duel-ui.js", "js/engine/core.js", "js/engine/effects.js", "js/engine/ai.js", "js/engine/deck.js",
  "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.includes("/cartes/") || url.pathname.includes("/boosters/")) {
    // Images des cartes : cache d'abord (elles ne changent pas).
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res;
    })));
    return;
  }
  // Code du jeu : réseau d'abord pour avoir la dernière version, cache si hors ligne.
  e.respondWith(fetch(e.request, { cache: "no-cache" }).then((res) => {
    const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return res;
  }).catch(() => caches.match(e.request)));
});
