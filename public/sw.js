/*
  Service worker mínimo y deliberadamente conservador.

  Reglas:
  - Assets de /_next/static: cache-first. Llevan hash en el nombre, así que
    nunca sirven contenido viejo y ahorran toda la descarga en 3G.
  - Navegaciones: red primero con timeout corto, y si no hay señal cae al
    shell cacheado. Es preferible una app que abre a una pantalla de error.
  - Todo lo demás (Firestore, teselas del mapa): pasa directo. Firestore trae
    su propia caché persistente y cachear sus respuestas rompería el tiempo real.
*/

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const NAV_TIMEOUT_MS = 4000;

const SHELL_URLS = [
  "/",
  "/necesito/",
  "/ayudar/",
  "/mis-reportes/",
  "/manifest.webmanifest",
  "/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      // `reload` evita quedarse con una copia rancia del navegador.
      .then((cache) =>
        cache.addAll(SHELL_URLS.map((u) => new Request(u, { cache: "reload" }))),
      )
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== SHELL && k !== STATIC)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC);
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await withTimeout(fetch(request), NAV_TIMEOUT_MS);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = (await cache.match(request)) || (await cache.match("/"));
    if (cached) return cached;
    return new Response(
      "<!doctype html><meta charset=utf-8><title>Sin conexión</title>" +
        '<body style="background:#000;color:#fff;font-family:system-ui;padding:24px">' +
        "<h1>Sin conexión</h1><p>Vuelve a intentar cuando tengas señal.</p>",
      { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
    );
  }
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
