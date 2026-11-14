// 1.0.6 · b6: a server read that gets no answer (stuck connection on mobile data) is retried once after reconnecting.
const {openApp,makeShared,sleep,P_BETA}=require('./lib/harness');
const pad=n=>String(n).padStart(2,'0');
const now=new Date(),D1=now.getFullYear()+'-'+pad(now.getMonth()+1)+'-01';
function seed(sh){
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  sh.store.set(P_BETA+'categories/food',{name:'אוכל',icon:'🍔',type:'expense',color:'#888888',ord:1});
  sh.store.set(P_BETA+'tx/t1',{type:'expense',amount:50,categoryId:'food',catName:'אוכל',date:D1,note:'',createdAt:1});
}
// the first `hang` calls of getDocsFromServer never answer
const stuck=hang=>w=>{
  w.__NET_WAIT=[150,250];
  const fs=w.__FAKE.fs,real=fs.getDocsFromServer.bind(fs);let n=0;w.__calls=()=>n;
  fs.getDocsFromServer=(...a)=>n++<hang?new Promise(()=>{}):real(...a);
};
const stats=A=>JSON.parse(A.w.localStorage.getItem('fin-retry-beta')||'{}');
const reconnects=sh=>sh.log.filter(x=>x[0]==='enableNetwork').length;

module.exports=async t=>{
  // ---- no answer the first time: reconnect, try again, succeed ----
  let sh=makeShared();seed(sh);
  let A=openApp(sh,{beforeParse:stuck(1)});await sleep(200);
  A.tab('settings');A.set('bk');A.click(A.$$('[data-a="bk"]')[0]);
  await sleep(80);
  t.ok(!A.sheetOpen()&&/מכין גיבוי/.test(A.toast()),'export waits for the answer');
  await sleep(150);
  t.ok(/מנסה שוב/.test(A.toast())||A.sheetOpen(),'no answer: says it is trying again');
  await sleep(250);
  t.ok(A.sheetOpen()&&/הגיבוי מוכן/.test(A.$('#sheet').textContent),'the second try succeeds and the backup is ready');
  t.ok(reconnects(sh)===1&&A.w.__calls()===2,'it reconnected once and asked again');
  t.ok(stats(A).n===1&&stats(A).ok===1,'the retry is counted');
  A.click(A.$('[data-a="sheet-close"]'));A.tab('settings');await sleep(20);
  t.ok(/ניסיונות חוזרים[^<]*: 1 \(הצליחו 1/.test(A.$('.foot').textContent),'beta settings show the retry count');
  t.ok(!A.errors.length,'no script errors'+(A.errors.length?': '+A.errors[0]:''));

  // ---- no answer twice: a clear message, with "timeout" in beta ----
  sh=makeShared();seed(sh);
  A=openApp(sh,{beforeParse:stuck(99)});await sleep(200);
  A.tab('settings');A.set('bk');A.click(A.$$('[data-a="bk"]')[0]);
  await sleep(600);
  t.ok(!A.sheetOpen()&&/אין חיבור/.test(A.toast())&&/\(timeout\)/.test(A.toast()),'still no answer: error message, tagged "timeout" in beta');
  t.ok(reconnects(sh)===1&&stats(A).n===1&&!stats(A).ok,'only one retry, counted as failed');

  // ---- an answer in time: nothing extra happens ----
  sh=makeShared();seed(sh);
  A=openApp(sh,{beforeParse:stuck(0)});await sleep(200);
  A.tab('settings');A.set('bk');A.click(A.$$('[data-a="bk"]')[0]);await sleep(120);
  t.ok(A.sheetOpen()&&!reconnects(sh)&&!stats(A).n,'a normal answer: no reconnect, nothing counted');
};
