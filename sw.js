// 班级学习工具箱 - 离线缓存
const CACHE_NAME = 'class-toolbox-v1';
const CORE = [
  './',
  './index.html',
  './style.css?v=1',
  './app.js?v=1',
  './manifest.json',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(CORE.map((url) => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => (n === CACHE_NAME ? null : caches.delete(n)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.url.startsWith('blob:') || request.url.startsWith('data:')) return;
  if (url.origin !== self.location.origin) return;

  // 同源：网络优先，离线回退缓存，避免旧文件挡住更新
  event.respondWith(
    fetch(request)
      .then((resp) => {
        if (resp && resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return resp;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
  );
});
