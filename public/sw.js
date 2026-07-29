const CACHE_PREFIX = "pallettrack-";
const CACHE = `${CACHE_PREFIX}shell-v1`;
const PRECACHE = [
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

function offlineResponse() {
  return new Response(
    `<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#1d4ed8"><title>Offline - PalletTrack Pro</title><body><main><div class="icon">!</div><h1>You are offline</h1><p>PalletTrack needs a network connection to scan pallets and save operational updates.</p><a href="/">Try again</a></main><style>*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font-family:system-ui,sans-serif}main{min-height:100vh;min-height:100dvh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:24px;padding-bottom:max(24px,env(safe-area-inset-bottom))}.icon{display:grid;place-items:center;width:64px;height:64px;border-radius:24px;background:#e2e8f0;color:#475569;font-size:28px;font-weight:800}h1{margin:18px 0 8px;font-size:28px}p{max-width:360px;margin:0;color:#475569;font-size:15px;line-height:1.6}a{margin-top:22px;min-height:44px;display:inline-flex;align-items:center;border-radius:12px;background:#2563eb;color:white;padding:10px 20px;text-decoration:none;font-size:14px;font-weight:700}</style></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(offlineResponse)
    );
    return;
  }

  if (url.pathname.startsWith("/icons/") || url.pathname === "/manifest.webmanifest") {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
