/* 파트너스 보고 현황판 - 오프라인 캐시 (Supabase API 는 캐시하지 않음) */
const CACHE = 'pth-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.endsWith('supabase.co')) return;
  const put = r => { if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; };
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(put).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(put)));
  }
});
