const CACHE_NAME = 'el-rancho-redisenado-v5-orden-entrada';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.log('Error en instalación del SW:', error);
      })
  );
  self.skipWaiting();
});

// Activación del Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Estrategia: Cache first, fallback to network
self.addEventListener('fetch', (event) => {
  // Solo cachear GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Si está en caché, devolverlo
        if (response) {
          return response;
        }

        // Si no está en caché, intentar traerlo de la red
        return fetch(event.request)
          .then((response) => {
            // No cachear respuestas inválidas
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // Clonar la respuesta
            const responseToCache = response.clone();

            // Cachear la nueva respuesta
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(() => {
            // Si falla la red, devolver del caché o una página de error
            return caches.match('./index.html');
          });
      })
  );
});

// Sincronización en background (opcional)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    event.waitUntil(
      // Aquí puedes sincronizar datos cuando vuelva la conexión
      Promise.resolve()
    );
  }
});
