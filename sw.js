const CACHE_NAME = 'aitomo-cache-v1';
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

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // 캐시에 있으면 반환, 없으면 네트워크 요청
        return response || fetch(event.request).catch(err => {
          console.warn('[SW] 네트워크 요청 실패:', event.request.url, err);
          throw err;
        });
      })
  );
});
