// npm run test:sw → בדיקה בדפדפן אמיתי (Chromium + Playwright) של beta/sw.js:
// פתיחה מהעותק השמור, הודעת "יש גרסה חדשה" אחרי פריסה, רענון, ועבודה בלי רשת. לא חלק מ-npm test (jsdom לא מריץ service worker).
const http=require('http'),fs=require('fs'),path=require('path');
const R=path.resolve(__dirname,'..');
const {chromium}=require('playwright');const {build}=require('./shots.js');
(async()=>{
  build();
  let html=fs.readFileSync(R+'/shots/beta/index.html','utf8');
  const files=n=>n==='index.html'||n===''?Buffer.from(html):fs.readFileSync(path.join(R,'beta',n));
  const types={html:'text/html; charset=utf-8',js:'text/javascript',png:'image/png',webmanifest:'application/manifest+json'};
  const srv=http.createServer((q,s)=>{
    const u=new URL(q.url,'http://x');const pre='/FinanceTrack/beta/';
    if(!u.pathname.startsWith(pre)){s.writeHead(404);s.end();return;}
    const n=u.pathname.slice(pre.length);
    try{const b=files(n);s.writeHead(200,{'content-type':types[(n||'index.html').split('.').pop()]||'application/octet-stream','cache-control':'max-age=600'});s.end(b);}
    catch(e){s.writeHead(404);s.end();}
  }).listen(0);
  const url='http://localhost:'+srv.address().port+'/FinanceTrack/beta/';
  const b=await chromium.launch(),ctx=await b.newContext({viewport:{width:390,height:844}}),p=await ctx.newPage();
  let fail=0;const ok=(c,m)=>{if(!c)fail++;console.log((c?'   ok   ':'   FAIL ')+m);};
  const ready=()=>p.waitForSelector('.tabbar:not(.hidden)',{timeout:15000});
  const banner=()=>p.evaluate(()=>/יש גרסה חדשה/.test(document.querySelector('#view').textContent));
  const marker=()=>p.evaluate(()=>document.documentElement.outerHTML.includes('MARK-2'));
  await p.goto(url);await ready();
  await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForTimeout(500);
  await p.reload();await ready();await p.waitForTimeout(800);
  ok(await p.evaluate(()=>!!navigator.serviceWorker.controller),'page is controlled by the service worker');
  ok(!(await banner()),'same version: no notice');
  html=html.replace('</body>','<!--MARK-2--></body>').replace(/APP_BUILD='[^']+'/,"APP_BUILD='next'");   // "פריסה" של גרסה חדשה
  await p.reload();await ready();
  ok(!(await marker()),'after a deploy, the first open still shows the saved copy (instant)');
  await p.waitForFunction(()=>/יש גרסה חדשה/.test(document.querySelector('#view').textContent),null,{timeout:8000}).catch(()=>{});
  ok(await banner(),'…and the "new version" notice appears');
  await Promise.all([p.waitForNavigation(),p.click('[data-a="reload"]')]);await ready();await p.waitForTimeout(800);
  ok(await marker(),'"רענון" loads the new version');
  ok(!(await banner()),'…and the notice is gone');
  await ctx.setOffline(true);
  await p.reload();await ready();
  ok(await marker(),'offline: opens from the saved copy');
  await ctx.setOffline(false);
  await b.close();srv.close();
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
