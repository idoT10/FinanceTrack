// Service worker: פותח את האפליקציה גם בלי אינטרנט.
// קבצי האתר: קודם מהרשת (כדי שגרסה חדשה תופיע מיד), ואם הרשת איטית או נופלת, מהמטמון.
// ספריות Firebase (גרסה קבועה): קודם מהמטמון. הנתונים עצמם נשמרים במטמון של Firestore, לא כאן.
const CACHE = 'finance-shell-v3';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const CDN_HOSTS = ['www.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const finish = res => { if (!done && res) { done = true; resolve(res); } };
    const timer = setTimeout(() => {
      caches.match(req, {ignoreSearch: true}).then(finish);
    }, 3000);
    fetch(req).then(res => {
      clearTimeout(timer);
      if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      finish(res);
    }).catch(() => {
      clearTimeout(timer);
      caches.match(req, {ignoreSearch: true})
        .then(r => r || caches.match('./'))
        .then(r => { if (!done) { done = true; resolve(r || Response.error()); } });
    });
  });
}
function cacheFirst(req) {
  return caches.open(CACHE).then(async cache => {
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
  if (CDN_HOSTS.includes(url.hostname)) { e.respondWith(cacheFirst(req)); return; }
  // כל השאר (Firestore, Auth) לא עובר דרכנו
});
