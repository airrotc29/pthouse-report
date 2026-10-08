/* 파트너스 보고 현황판 - 오프라인 캐시 (Supabase API·Jitsi 는 캐시하지 않음)
   같은 출처 파일은 항상 서버에서 최신본을 먼저 받고(캐시 우회), 실패할 때만 저장본을 씁니다. */
const CACHE = 'pth-v2';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.hostname.endsWith('supabase.co') || url.hostname.endsWith('jit.si')) return;
  const put = r => { if (r && r.ok) { const c = r.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return r; };
  if (url.origin === location.origin) {
    e.respondWith(fetch(req.url, { cache: 'no-store', credentials: 'same-origin' }).then(put).catch(() => caches.match(req).then(r => r || caches.match('./index.html'))));
  } else {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(put)));
  }
});
