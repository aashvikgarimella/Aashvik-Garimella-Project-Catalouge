// lynx service worker — fast loads + offline fallback.
// Never caches API / auth / Supabase (avoids stale or cross-user data).
const CACHE = "lynx-v1";
const PRECACHE = ["/offline.html", "/icon.svg", "/icon-192.png", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // Same-origin only; never intercept API / auth (keep data fresh + private).
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return;

  // Static assets: stale-while-revalidate.
  if (
    url.pathname.startsWith("/_next/static") ||
    /\.(?:png|svg|jpg|jpeg|webp|gif|woff2?|css|js|ico)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Page navigations: network-first, fall back to the offline page.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
  }
});
