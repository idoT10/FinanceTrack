// 1.0.6 · b4: instant open from a snapshot saved on the phone, before sign-in is confirmed.
// In the real app nothing arrives from Firestore until Auth finishes (1.5–2.3 s on a phone), so here both are delayed.
const {openApp,makeShared,sleep,keys,P_BETA}=require('./lib/harness');
const pad=n=>String(n).padStart(2,'0');
const now=new Date(),MK=now.getFullYear()+'-'+pad(now.getMonth()+1),D1=MK+'-01';
const KEY='fin-snap-beta',DELAY=350;
function seed(sh){
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  sh.store.set(P_BETA+'categories/food',{name:'אוכל',icon:'🍔',type:'expense',color:'#888888',ord:1});
  sh.store.set(P_BETA+'assets/c1',{name:'עו"ש',category:'checking',value:1000,updatedAt:1});
  sh.store.set(P_BETA+'tx/t1',{type:'expense',amount:50,categoryId:'food',catName:'אוכל',date:D1,note:'ראשונה',createdAt:1});
}
// like a phone: the saved snapshot is in localStorage; sign-in and data arrive only after DELAY
const slow=(snap,user)=>w=>{
  if(snap)w.localStorage.setItem(KEY,snap);
  const fs=w.__FAKE.fs,real=fs.onSnapshot.bind(fs);
  fs.onSnapshot=(...a)=>{let un=null,dead=false;const t=setTimeout(()=>{if(!dead)un=real(...a);},DELAY);return()=>{dead=true;clearTimeout(t);if(un)un();};};
  w.__FAKE.auth.onAuthStateChanged=(x,cb)=>{setTimeout(()=>cb(user),DELAY);return()=>{};};
};
const USER={uid:'u1',email:'me@x.com',emailVerified:true};
const visible=A=>!A.$('.tabbar').classList.contains('hidden');
const homeText=A=>A.$('#view').textContent;

module.exports=async t=>{
  const sh=makeShared();seed(sh);
  // ---- first run: no snapshot yet; one is saved after the data loads ----
  let A=openApp(sh);await sleep(250);
  await sleep(1000);
  const snap=A.w.localStorage.getItem(KEY),o=JSON.parse(snap||'null');
  t.ok(o&&o.uid==='u1'&&o.tx.length===1&&o.assets.length===1&&o.cats.length===1,'a snapshot of the screen data is saved on the phone');

  // meanwhile another device adds a transaction
  sh.store.set(P_BETA+'tx/t2',{type:'expense',amount:70,categoryId:'food',catName:'אוכל',date:D1,note:'ממכשיר אחר',createdAt:2});

  // ---- second run: the screen is drawn at once from the snapshot ----
  A=openApp(sh,{beforeParse:slow(snap,USER)});await sleep(120);
  t.ok(visible(A)&&/ראשונה/.test(homeText(A))&&!A.$('.skel'),'opens at once from the snapshot, before sign-in is confirmed');
  t.ok(!/ממכשיר אחר/.test(homeText(A)),'…showing what was saved last time');
  // adding a transaction during the wait
  await A.addExpense(33);
  t.ok(/33/.test(homeText(A)),'a transaction can be added during the wait');
  await sleep(DELAY+250);
  const amounts=keys(sh,P_BETA+'tx/').map(k=>sh.store.get(k).amount).sort((a,b)=>a-b);
  t.ok(String(amounts)==='33,50,70','…and it is saved');
  t.ok(/ממכשיר אחר/.test(homeText(A))&&/ראשונה/.test(homeText(A))&&A.$$('#view .tx-row').length===3,'the real data replaces the snapshot, no duplicates');
  t.ok(sh.store.get(P_BETA+'assets/c1').value===1000,'balances are untouched');
  A.tab('settings');await sleep(20);
  t.ok(/מסך \d+ · התחברות \d+/.test(A.$('.foot').textContent),'beta shows when the screen appeared and when sign-in finished');
  await sleep(900);
  t.ok(JSON.parse(A.w.localStorage.getItem(KEY)).tx.length===3,'the snapshot is refreshed');
  t.ok(!A.errors.length,'no script errors'+(A.errors.length?': '+A.errors[0]:''));

  // ---- the saved sign-in is no longer valid ----
  let B=openApp(sh,{beforeParse:slow(snap,null)});await sleep(120);
  t.ok(visible(B)&&/ראשונה/.test(homeText(B)),'(snapshot shown while waiting)');
  await sleep(DELAY+150);
  t.ok(!visible(B)&&!B.$('#gate').classList.contains('hidden')&&B.$('#g-em'),'sign-in failed: the sign-in screen replaces the data');
  t.ok(!B.w.localStorage.getItem(KEY)&&!/לא נשמר/.test(B.$('#g-err').textContent),'the snapshot is deleted; no warning when nothing was added');
  B=openApp(sh,{beforeParse:slow(snap,null)});await sleep(120);
  const before=keys(sh,P_BETA+'tx/').length;
  B.click(B.$('[data-a="fab"]'));B.type(B.$('#f-amount'),'12');B.click(B.$$('#f-cats .chip[data-a="f-cat"]')[0]);B.click(B.$('[data-a="tx-save"]'));
  await sleep(DELAY+150);
  t.ok(/לא נשמר/.test(B.$('#g-err').textContent),'something was added during the wait: the sign-in screen says it was not saved');
  t.ok(keys(sh,P_BETA+'tx/').length>=before,'(the fake store has no rules, so the write itself is not rejected here)');

  // ---- a different user signs in ----
  const sh2=makeShared();
  sh2.store.set('users/u2/beta/main/meta/profile',{seeded:true});
  sh2.store.set('users/u2/beta/main/categories/x',{name:'אחר',icon:'🍔',type:'expense',color:'#888888',ord:1});
  sh2.store.set('users/u2/beta/main/tx/z',{type:'expense',amount:9,categoryId:'x',catName:'אחר',date:D1,note:'של משתמש אחר',createdAt:1});
  const C=openApp(sh2,{beforeParse:slow(snap,{uid:'u2',email:'b@x.com',emailVerified:true})});
  await sleep(DELAY+DELAY+300);
  t.ok(visible(C)&&/של משתמש אחר/.test(homeText(C))&&!/ראשונה/.test(homeText(C)),'another user: their own data, nothing left from the snapshot');
  t.ok(!C.errors.length,'no script errors (other user)');
};
