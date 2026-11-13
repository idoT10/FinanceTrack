// npm run test:sdk → בדיקה בדפדפן אמיתי (Chromium + Playwright) של טעינת Firebase SDK האמיתי, בלי להחליף את D.init().
// להריץ לפני כל שינוי של FB_VER. לא חלק מ-npm test: מוריד את חבילת firebase מ-npm (www.gstatic.com חסום בסביבת Claude),
// ומגיש את הקבצים שלה במקום gstatic. שרתי Firebase עצמם חסומים, ולכן האפליקציה אמורה להגיע למסך הכניסה.
//
// בודק: (1) הבטא (beta/index.html) נטענת עם הגרסה שלה ומגיעה למסך הכניסה; (2) לבטא מטמון מקומי נפרד מהייצור;
// (3) הייצור (index.html בשורש), שנפתח אחרי הבטא באותו דפדפן, עדיין משתמש במטמון המקומי שלו.
//     גרסה חדשה של ה-SDK משדרגת את מבנה המטמון (10.14.1: מבנה 17; מ-11.8.0: מבנה 18), וגרסה ישנה לא יכולה לפתוח מטמון משודרג.
const http=require('http'),fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const ROOT=path.resolve(__dirname,'..');
const verOf=f=>(fs.readFileSync(path.join(ROOT,f),'utf8').match(/const FB_VER = '([^']+)'/)||[])[1];
const prevOf=f=>(fs.readFileSync(path.join(ROOT,f),'utf8').match(/const FB_VER_PREV = '([^']+)'/)||[])[1];
const TMP=path.join(os.tmpdir(),'financetrack-sdk');
function sdkDir(v){
  const d=path.join(TMP,v);
  if(!fs.existsSync(path.join(d,'package','firebase-firestore.js'))){
    fs.mkdirSync(d,{recursive:true});
    cp.execFileSync('npm',['pack','firebase@'+v,'--silent'],{cwd:d,stdio:'ignore'});
    cp.execFileSync('tar',['xzf','firebase-'+v+'.tgz','package/firebase-app.js','package/firebase-auth.js','package/firebase-firestore.js'],{cwd:d});
    fs.unlinkSync(path.join(d,'firebase-'+v+'.tgz'));
  }
  return path.join(d,'package');
}
(async()=>{
  const {chromium}=require('playwright');
  const vBeta=verOf('beta/index.html'),vProd=verOf('index.html');
  console.log('beta: '+vBeta+' · production: '+vProd+'\n');
  const types={html:'text/html; charset=utf-8',js:'text/javascript',png:'image/png',webmanifest:'application/manifest+json'};
  const srv=http.createServer((q,s)=>{
    const u=new URL(q.url,'http://x');let n=u.pathname.replace(/^\/FinanceTrack\//,'');if(n===''||n.endsWith('/'))n+='index.html';
    if(/sw\.js$/.test(n)){s.writeHead(404);s.end();return;}   // בלי service worker: בודקים את ה-SDK עצמו
    try{const b=fs.readFileSync(path.join(ROOT,n));s.writeHead(200,{'content-type':types[n.split('.').pop()]||'application/octet-stream'});s.end(b);}
    catch(e){s.writeHead(404);s.end();}
  }).listen(0);
  const base='http://localhost:'+srv.address().port+'/FinanceTrack/';
  const b=await chromium.launch(),ctx=await b.newContext({viewport:{width:390,height:844}});
  let block=null;   // גרסה שמדמים שהיא לא זמינה
  await ctx.route('https://www.gstatic.com/firebasejs/**',r=>{
    const m=r.request().url().match(/firebasejs\/([^/]+)\/(.+)$/);
    if(m[1]===block){r.fulfill({status:404,body:''});return;}
    try{r.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(path.join(sdkDir(m[1]),m[2]))});}catch(e){r.fulfill({status:404,body:''});}
  });
  await ctx.route(u=>!/localhost|www\.gstatic\.com/.test(u.hostname),r=>r.abort());
  let fail=0;const ok=(c,m)=>{if(!c)fail++;console.log((c?'   ok   ':'   FAIL ')+m);};
  // תמונת מצב שמורה גורמת לבטא להתחיל להאזין לנתונים עוד לפני ההתחברות, וכך המטמון המקומי שלה נפתח גם בלי משתמש
  await ctx.addInitScript(()=>{try{localStorage.setItem('fin-snap-beta',JSON.stringify({v:1,uid:'sdk-test',email:'t@example.com',t:1,cats:[],tx:[],assets:[],liabs:[],hist:[],rec:[]}));}catch(e){}});
  // פותח את המטמון המקומי של האפליקציה שבדף (כמו שקורה אחרי התחברות), דרך אותה ספרייה שהדף טען
  const touch=(p,v)=>p.evaluate(async v=>{
    const base='https://www.gstatic.com/firebasejs/'+v+'/';
    const [app,fs]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-firestore.js')]);
    const db=fs.getFirestore(app.getApps()[0]);
    await fs.disableNetwork(db);
    await new Promise(r=>fs.onSnapshot(fs.collection(db,'users','sdk-test','tx'),()=>r()));
  },v);
  async function open(url,v){
    const p=await ctx.newPage(),logs=[],errs=[];
    p.on('console',m=>{if(/warn|error/.test(m.type()))logs.push(m.text());});p.on('pageerror',e=>errs.push(e.message));
    await p.goto(url);
    const gate=await p.waitForSelector('#g-em',{timeout:20000}).then(()=>true).catch(()=>false);
    if(gate&&v)await touch(p,v).catch(e=>errs.push('touch: '+e.message));
    await p.waitForTimeout(1200);
    const idb=(await p.evaluate(()=>indexedDB.databases())).map(d=>d.name+' v'+d.version).sort();
    return{p,gate,logs,errs,idb,fallback:logs.some(l=>/newer version of the Firestore SDK|Falling back to memory cache/.test(l))};
  }
  const A=await open(base+'beta/',vBeta);
  ok(A.gate&&!A.errs.length,'beta loads SDK '+vBeta+' and reaches the sign-in screen'+(A.errs.length?' ('+A.errs[0]+')':''));
  ok(!A.fallback,'beta uses its local cache');
  ok(A.idb.some(n=>/^firestore\/beta\//.test(n))&&!A.idb.some(n=>/^firestore\/\[DEFAULT\]\//.test(n)),'beta has its own local cache: '+A.idb.filter(n=>/^firestore/.test(n)).join(', '));
  await A.p.close();
  const P=await open(base,vProd);
  ok(P.gate&&!P.errs.length,'production (SDK '+vProd+') opens after beta in the same browser');
  ok(!P.fallback&&P.idb.some(n=>/^firestore\/\[DEFAULT\]\//.test(n)),'…and still uses its local cache (not downgraded to memory)');
  console.log('        local caches: '+P.idb.filter(n=>/^firestore/.test(n)).join(', '));
  await P.p.close();
  const prev=prevOf('beta/index.html');
  if(prev&&prev!==vBeta){
    block=vBeta;
    const F=await open(base+'beta/');
    ok(F.gate,'if SDK '+vBeta+' cannot be loaded, beta falls back to '+prev+' and still opens');
    await F.p.close();block=null;
  }
  await b.close();srv.close();
  process.exit(fail?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
