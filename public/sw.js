/*
  Service worker mínimo y deliberadamente conservador.

  Reglas:
  - Assets de /_next/static: cache-first. Llevan hash en el nombre, así que
    nunca sirven contenido viejo y ahorran toda la descarga en 3G.
  - Navegaciones: red primero con timeout corto, y si no hay señal cae al
    shell cacheado. Es preferible una app que abre a una pantalla de error.
  - Teselas del mapa: cache-first con tope. Un mapa muestra las mismas teselas
    una y otra vez, y sin caché cada visita las vuelve a pedir todas. Cachearlas
    hace tres cosas a la vez: ahorra datos caros, baja de golpe el tráfico que
    haría que el proveedor nos bloquee, y deja el mapa utilizable sin señal en
    las zonas ya vistas.
  - Todo lo demás (Firestore): pasa directo. Trae su propia caché persistente y
    cachear sus respuestas rompería el tiempo real.
*/

// Subir esta versión invalida todas las cachés en el próximo despliegue.
const VERSION = "v4";
const SHELL = `shell-${VERSION}`;
const STATIC = `static-${VERSION}`;
const TILES = `tiles-${VERSION}`;
const NAV_TIMEOUT_MS = 4000;

/**
 * Reconoce una tesela XYZ por la forma de su ruta (…/z/x/y.png), sin importar
 * el proveedor. Así seguir sirviendo si cambiamos de proveedor por variable de
 * entorno, sin tener que tocar y redesplegar este archivo.
 */
const TILE_PATTERN = /\/\d{1,2}\/\d{1,6}\/\d{1,6}(@\dx)?\.(png|jpe?g|webp|avif)$/;

/**
 * Tope de teselas guardadas. Unas 25 KB cada una: 600 son ~15 MB, suficiente
 * para varios barrios y lejos de irritar al navegador.
 */
const TILE_CACHE_LIMIT = 600;

const SHELL_URLS = [
  "/",
  "/necesito/",
  "/ayudar/",
  "/necesidad/",
  "/mis-reportes/",
  "/recuperar/",
  "/como-usar/",
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
            .filter((k) => k !== SHELL && k !== STATIC && k !== TILES)
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

  // Antes del corte por origen: las teselas viven en otro dominio.
  if (TILE_PATTERN.test(url.pathname)) {
    event.respondWith(tileCacheFirst(request));
    return;
  }

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

/**
 * Teselas: primero la copia guardada, y si no está se pide y se guarda.
 *
 * Una tesela de mapa no cambia de un día para otro, así que servir la copia
 * vieja no tiene ningún costo. Sin conexión, esto es lo que hace que el mapa
 * siga mostrando la zona que la persona ya había mirado en vez de un rectángulo
 * gris.
 */
async function tileCacheFirst(request) {
  const cache = await caches.open(TILES);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  // `ok` descarta también las respuestas opacas: guardarlas sería llenar el
  // disco con errores que no podemos distinguir de teselas buenas.
  if (response.ok) {
    await cache.put(request, response.clone());
    trimCache(cache, TILE_CACHE_LIMIT);
  }
  return response;
}

/**
 * Recorta la caché a su tope. `keys()` devuelve en orden de inserción, así que
 * borrar desde el principio descarta lo más antiguo. Se deja correr sin await
 * para no demorar la tesela que el usuario está esperando.
 */
async function trimCache(cache, limit) {
  const keys = await cache.keys();
  const sobran = keys.length - limit;
  for (let i = 0; i < sobran; i++) await cache.delete(keys[i]);
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL);
  try {
    // `no-store` salta la caché HTTP del navegador. Sin esto, un HTML con
    // max-age vigente hace que este "network first" nunca llegue a la red y
    // los usuarios queden congelados en una versión vieja justo cuando se
    // está corrigiendo algo en plena emergencia.
    const fresh = new Request(request.url, {
      cache: "no-store",
      credentials: "same-origin",
      headers: request.headers,
      mode: "same-origin",
      redirect: "follow",
    });
    const response = await withTimeout(fetch(fresh), NAV_TIMEOUT_MS);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    // `ignoreSearch` es lo que salva los enlaces compartidos. La página real es
    // /necesidad/?id=xxx y en caché solo está /necesidad/; sin esto la búsqueda
    // falla y el usuario termina en el inicio, sin entender por qué el enlace
    // que le pasaron por WhatsApp no lleva a ninguna parte. El shell es el
    // mismo para cualquier id: la página lee la query al montarse.
    const cached =
      (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match("/"));
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
