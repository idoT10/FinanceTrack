// Service worker: פותח את האפליקציה מיד, גם בלי אינטרנט.
// אותו קובץ משמש גם את /beta/. שם המטמון נגזר מהתיקייה, כדי שהייצור והבדיקה לא ימחקו זה לזה את המטמון.
// קבצי האתר: מיד מהעותק השמור, ובמקביל מורידים את החדש ברקע. אם הדף השתנה, מודיעים לאפליקציה ("יש גרסה חדשה").
//   (עד v4: קודם מהרשת, והעותק השמור רק אחרי 3 שניות. ברשת איטית כל פתיחה חיכתה.)
// ספריות Firebase (גרסה קבועה): קודם מהמטמון. הנתונים עצמם נשמרים במטמון של Firestore, לא כאן.
const ENV_TAG = self.registration.scope.includes('/beta/') ? '-beta' : '-prod';
const CACHE = 'finance-shell-v5' + ENV_TAG;
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-180.png', 'icon-192.png', 'icon-512.png'];
const CDN_HOSTS = ['www.gstatic.com'];
// סימון "ירדה גרסה חדשה": מזהה הגרסה של הדף שירד ברקע. האפליקציה קוראת אותו ומשווה לגרסה שלה (אותו שם גם ב-index.html)
const META = 'finance-meta' + ENV_TAG;
const versionOf = html => { const m = html.match(/APP_VERSION='([^']+)',APP_BUILD='([^']+)'/); return m ? m[1] + ' · ' + m[2] : null; };

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  // מוחקים רק מטמונים ישנים של אותה סביבה (ובייצור גם מטמונים מגרסאות לפני ההפרדה)
  const mine = k => k.endsWith(ENV_TAG) || (ENV_TAG === '-prod' && /^finance-shell-v\d+$/.test(k));
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => mine(k) && k !== CACHE && k !== META).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function tellClients() {
  return self.clients.matchAll({type: 'window', includeUncontrolled: true})
    .then(list => list.forEach(c => c.postMessage({type: 'new-version'})));
}
// הדף עצמו (index.html או התיקייה): רק עליו בודקים אם יש גרסה חדשה
const isPage = url => /\/(index\.html)?$/.test(url.pathname);

async function cachedThenUpdate(req, url) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req, {ignoreSearch: true});
  const old = hit && isPage(url) ? hit.clone() : null;
  // no-cache: שואלים את השרת אם הקובץ השתנה, ולא מסתפקים בעותק של הדפדפן
  const update = fetch(req.url, {cache: 'no-cache'}).then(async res => {
    if (!res || !res.ok) return res;
    const copy = res.clone();
    if (old) {
      const [a, b] = await Promise.all([old.text(), res.clone().text()]);
      await cache.put(req, copy);
      const v = versionOf(b);
      if (v) await caches.open(META).then(m => m.put('new-version', new Response(v)));
      if (a !== b) await tellClients();
    } else await cache.put(req, copy);
    return res;
  });
  if (hit) return {response: hit, update: update.catch(() => {})};
  // אין עותק שמור (פתיחה ראשונה): מחכים לרשת, ואם היא נופלת מנסים את דף הבית השמור
  return {response: update.catch(() => cache.match('./').then(r => r || Response.error()))};
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
  if (url.origin === self.location.origin) {
    const job = cachedThenUpdate(req, url);
    e.respondWith(job.then(j => j.response));
    e.waitUntil(job.then(j => j.update));   // ההורדה ברקע ממשיכה גם אחרי שהדף כבר קיבל תשובה
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) { e.respondWith(cacheFirst(req)); return; }
  // כל השאר (Firestore, Auth) לא עובר דרכנו
});
