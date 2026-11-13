// npm run shots → צילומי מסך של כל המסכים ברוחב 390px (בהיר וכהה) לתיקייה shots/ (לא נכנסת ל-git).
// טוען את beta/index.html האמיתי עם ה-Firestore המדומה ועם נתוני הדוגמה, כשהשעון קבוע על תאריך הדוגמה.
// דורש Playwright עם Chromium (מותקן בסביבת Claude Code; לא חלק מ-npm install).
const fs=require('fs'),path=require('path');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,'shots');
const DEMO=path.join(__dirname,'fixtures','finance-backup-demo.json');
const NOW=new Date(JSON.parse(fs.readFileSync(DEMO,'utf8')).exportedAt);

// בונה עותק של האפליקציה שבו רק D.init() הוחלף (כמו tests/lib/harness.js). התיקייה נקראת beta כדי שהקוד יזהה סביבת בדיקה
function build(){
  let html=fs.readFileSync(path.join(ROOT,process.env.TARGET||'beta/index.html'),'utf8');
  const re=/  async init\(\)\{[\s\S]*?\n  \},\n  onAuth/;
  if(!re.test(html))throw new Error('shots: D.init() not found');
  html=html.replace(re,"  async init(){this.A=window.__FAKE.auth;this.F=window.__FAKE.fs;this.db={};this.auth={};},\n  onAuth");
  const fake=fs.readFileSync(path.join(__dirname,'lib','fakefs.js'),'utf8');
  html=html.replace('<script type="module">','<script>(function(){const module={exports:{}};'+fake+
    ';const m=module.exports;window.__FAKE=m.makeFake(m.makeShared(),{uid:"u1",email:"demo@example.com",emailVerified:true});})();</script><script type="module">');
  const dir=path.join(OUT,'beta');fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
  return 'file://'+file;
}
// דף פתוח עם נתוני הדוגמה. scheme: 'light' | 'dark'
async function openDemo(browser,scheme,url){
  const p=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,colorScheme:scheme,locale:'he-IL'});
  p.on('pageerror',e=>console.log('  page error: '+e.message));
  await p.clock.setFixedTime(NOW);
  await p.goto(url);await p.waitForSelector('.tabbar:not(.hidden)');
  await p.setInputFiles('#file',DEMO);
  await p.waitForFunction(()=>/נוספו/.test(document.querySelector('#toast').textContent),null,{timeout:20000});
  await p.waitForTimeout(2600);   // עד שההודעה נעלמת
  return p;
}
async function main(){
  const {chromium}=require('playwright');
  const url=build(),browser=await chromium.launch();
  for(const scheme of ['light','dark']){
    const p=await openDemo(browser,scheme,url);
    const shot=(name,full)=>p.screenshot({path:path.join(OUT,scheme+'-'+name+'.png'),fullPage:!!full});
    for(const v of ['home','tx','nw','settings']){
      await p.click('.tab[data-v="'+v+'"]');await p.waitForTimeout(300);
      await shot(v);          // מה שרואים בלי לגלול
      await shot(v+'-full',true);
    }
    await p.click('.tab[data-v="home"]');await p.click('[data-a="fab"]');await p.waitForTimeout(450);await shot('add');
    await p.click('[data-a="sheet-close"]');await p.click('.tab[data-v="nw"]');await p.click('[data-a="nw-bulk"]');await p.waitForTimeout(450);await shot('bulk');
    await p.click('[data-a="sheet-close"]');await p.click('[data-a="asset-edit"]');await p.waitForTimeout(450);await shot('account');
    await p.click('[data-a="sheet-close"]');await p.click('.tab[data-v="settings"]');
    for(const v of ['rec','cats']){await p.click('[data-a="set"][data-v="'+v+'"]');await p.waitForTimeout(300);await shot('settings-'+v,true);await p.click('[data-a="set-back"]');}
    await p.click('[data-a="set"][data-v="theme"]');await p.waitForTimeout(450);await shot('settings-theme');
    await p.close();
  }
  await browser.close();
  console.log('saved to '+OUT);
}
module.exports={build,openDemo};
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1);});
