// Service worker mínimo: cachea el shell para que el hub abra rápido
// y funcione (parcialmente) sin conexión. No cachea las herramientas
// completas para evitar mostrar datos de precios/créditos desactualizados.
const CACHE_NAME = 'byd-hub-shell-v3';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Solo interceptamos el shell del hub (index/manifest/icons).
  // El resto (gestor_precios.html, calculadora_creditos.html, links externos)
  // siempre va a la red para asegurar datos actualizados.
  const isShellFile = SHELL_FILES.some((f) => url.pathname.endsWith(f.replace('./', '')));
  if (isShellFile) {
    // Network-first: siempre intenta traer la versión más nueva.
    // Si no hay conexión, recién ahí usa lo cacheado.
    // cache:'no-store' es clave acá — sin esto, fetch() puede devolver una
    // respuesta vieja del caché HTTP normal del navegador (no del caché de
    // este Service Worker), y esa version vieja termina guardándose de
    // nuevo, perpetuando el problema aunque el archivo en GitHub ya se haya
    // actualizado.
    event.respondWith(
      fetch(event.request.url, { cache: 'no-store' })
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
