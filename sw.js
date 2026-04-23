const CACHE_NAME = 'aitomo-cache-v2';
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  '../bg_concept.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const cacheAllowlist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheAllowlist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. 외부 API(네이버 지도, Firebase 등)는 서비스 워커가 가로채지 않고 그대로 통과
  if (url.origin !== location.origin) {
    return;
  }

  // 2. GET 요청이 아니면 통과 (POST, PUT 등)
  if (event.request.method !== 'GET') {
    return;
  }

  // 3. HTTP/HTTPS 스킴이 아닌 경우(chrome-extension 등) 통과
  if (!event.request.url.startsWith('http')) {
    return;
  }

  // Network First 전략: 먼저 네트워크에 요청하고 실패하면 캐시 사용
  event.respondWith(
    fetch(event.request).then(response => {
      // 네트워크 응답이 유효하면 캐시에 저장
      if (response && response.status === 200 && response.type === 'basic') {
        const responseToCache = response.clone();
        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });
      }
      return response;
    }).catch(() => {
      // 오프라인이거나 네트워크 에러 시 캐시된 응답 반환
      return caches.match(event.request);
    })
  );
});
