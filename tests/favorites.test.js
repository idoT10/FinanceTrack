// 1.0.8: favorites (מועדפים). A cloud collection favorites/{id}; tapping one in the add sheet fills the fields and waits for "שמירה".
// Created from the add sheet ("☆ גם כמועדף") or from Settings → מועדפים (add, edit, reorder, delete, with undo). Expense/income only.
const fs=require('fs'),path=require('path');
const {openApp,makeShared,sleep,keys,P_BETA,ROOT}=require('./lib/harness');
const FAV=P_BETA+'favorites/';
module.exports=async t=>{
  const sh=makeShared();
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  const cat=(id,name,type,ord,icon)=>sh.store.set(P_BETA+'categories/'+id,{name,icon:icon||'🏷️',type,color:'#888888',ord});
  cat('food','אוכל','expense',1,'☕');cat('fuel','רכב','expense',2);cat('sal','משכורת','income',3);
  sh.store.set(P_BETA+'assets/c1',{name:'עו"ש',category:'checking',value:1000,updatedAt:1});
  sh.store.set(P_BETA+'liabilities/cc',{name:'ויזה',category:'credit',value:0,updatedAt:1});
  const fav=(id,o)=>sh.store.set(FAV+id,Object.assign({type:'expense',note:'',categoryId:null,catName:'',amount:0,createdAt:1},o));
  fav('f1',{note:'קפה',categoryId:'food',catName:'אוכל',amount:14,accountId:'cc',ord:2});
  fav('f2',{note:'דלק',categoryId:'fuel',catName:'רכב',amount:0,accountId:'c1',ord:1});
  fav('f3',{note:'ספר',categoryId:'gone',catName:'ספרים',amount:40,accountId:'deleted-acct',ord:3});
  fav('f4',{type:'income',note:'פרילנס',categoryId:'sal',catName:'משכורת',amount:0,ord:4});
  const A=openApp(sh);await sleep(250);
  const {$,$$,click}=A;
  const open=async()=>{click($('[data-a="fab"]'));await sleep(10);};
  const chips=()=>$$('#f-favs .chip').map(b=>b.dataset.id);
  const catOn=()=>($('#f-cats .chip.on')||{dataset:{}}).dataset.id;
  const acctOn=()=>($('#f-accts .chip.on')||{dataset:{}}).dataset.id;
  const undo=async()=>{click($('#toast .toast-undo'));await sleep(40);};
  const txCount=()=>keys(sh,P_BETA+'tx/').length;

  // ---- add sheet: a row of favorites under the type selector, in the manual order ----
  await open();
  t.ok(!$('#f-favs').hidden&&chips().join()==='f2,f1,f3','expense favorites, by their order');
  t.ok($('#f-favs').compareDocumentPosition($('#f-amount'))&4,'the row is above the amount');
  t.ok(/☕ קפה/.test($('#f-favs [data-id="f1"]').textContent)&&/₪14/.test($('#f-favs [data-id="f1"]').textContent),'icon from the category, description and amount');
  click($('[data-a="f-type"][data-v="income"]'));
  t.ok(chips().join()==='f4','income shows income favorites');
  click($('[data-a="f-type"][data-v="transfer"]'));
  t.ok($('#f-favs').hidden&&$('#f-fav-sec').hidden,'no favorites for transfers');
  click($('[data-a="f-type"][data-v="expense"]'));

  // ---- tapping fills description, category, account and amount; the date stays; nothing is saved ----
  A.type($('#f-date'),'2025-03-04');$('#f-date').dispatchEvent(new A.w.Event('change',{bubbles:true}));
  const before=txCount();
  click($('#f-favs [data-id="f1"]'));await sleep(10);
  t.ok($('#f-note').value==='קפה'&&catOn()==='food'&&acctOn()==='cc'&&$('#f-amount').value==='14','fills description, category, account and amount');
  t.ok($('#f-date').value==='2025-03-04','the date does not change');
  t.ok(A.sheetOpen()&&txCount()===before,'waits for "שמירה": nothing saved yet');
  t.ok($('#f-favs [data-id="f1"]').classList.contains('on'),'the chosen favorite is marked');
  A.type($('#f-amount'),'');
  click($('#f-favs [data-id="f2"]'));await sleep(10);
  t.ok($('#f-note').value==='דלק'&&catOn()==='fuel'&&acctOn()==='c1'&&$('#f-amount').value==='','a favorite without an amount leaves the amount as it was');
  A.type($('#f-amount'),'230');
  click($('#f-favs [data-id="f3"]'));await sleep(10);
  t.ok($('#f-note').value==='ספר'&&!catOn()&&!acctOn()&&$('#f-amount').value==='40','deleted category or account: that field stays empty');
  click($('#f-cats [data-id="food"]'));
  t.ok(catOn()==='food','fields stay editable');
  click($('#f-favs [data-id="f1"]'));await sleep(10);
  click($('[data-a="tx-save"]'));await sleep(60);
  const saved=[...sh.store.entries()].filter(([k])=>k.startsWith(P_BETA+'tx/')).map(([,v])=>v).find(v=>v.note==='קפה');
  t.ok(saved&&saved.amount===14&&saved.categoryId==='food'&&saved.accountId==='cc'&&saved.date==='2025-03-04','"שמירה" saves the filled transaction');
  t.ok(keys(sh,FAV).length===4,'using a favorite does not add one');

  // ---- "☆ גם כמועדף": saved with the transaction; same type+description+category updates instead of duplicating ----
  await open();
  t.ok(!$('#f-fav-sec').hidden&&/☆ גם כמועדף/.test($('#f-fav-tg').textContent),'add sheet offers "☆ גם כמועדף"');
  A.type($('#f-amount'),'89.9');A.type($('#f-note'),'אוכל לכלב');click($('#f-cats [data-id="food"]'));click($('#f-accts [data-id="cc"]'));
  click($('#f-fav-tg'));
  t.ok($('#f-fav-tg').classList.contains('on')&&/יופיע בראש החלון/.test($('#f-fav-hint').textContent),'toggled on, with what it does');
  click($('[data-a="tx-save"]'));await sleep(60);
  const nf=[...sh.store.entries()].filter(([k])=>k.startsWith(FAV)).map(([,v])=>v).find(v=>v.note==='אוכל לכלב');
  t.ok(nf&&nf.amount===89.9&&nf.categoryId==='food'&&nf.catName==='אוכל'&&nf.accountId==='cc'&&nf.type==='expense'&&nf.ord===5,'new favorite stored with type, note, category, account, amount, last in order');
  t.ok(/ההוצאה נשמרה · נוסף למועדפים/.test(A.toast()),'the message says it was added');
  const n0=txCount();
  await undo();
  t.ok(keys(sh,FAV).length===4&&txCount()===n0-1,'"בטל" removes both the transaction and the new favorite');
  await open();
  A.type($('#f-amount'),'16');A.type($('#f-note'),'קפה');click($('#f-cats [data-id="food"]'));click($('#f-accts [data-id="c1"]'));
  click($('#f-fav-tg'));
  t.ok(/יתעדכן/.test($('#f-fav-hint').textContent),'existing match: says it will be updated');
  click($('[data-a="tx-save"]'));await sleep(60);
  t.ok(keys(sh,FAV).length===4&&sh.store.get(FAV+'f1').amount===16&&sh.store.get(FAV+'f1').accountId==='c1'&&sh.store.get(FAV+'f1').ord===2,'same type+description+category updates the existing favorite (order kept)');
  t.ok(/המועדף עודכן/.test(A.toast()),'…and says so');
  await undo();
  t.ok(sh.store.get(FAV+'f1').amount===14&&sh.store.get(FAV+'f1').accountId==='cc','"בטל" restores the favorite');
  await open();
  A.type($('#f-amount'),'300');A.type($('#f-note'),'מנוי');click($('#f-cats [data-id="fuel"]'));
  click($('[data-a="f-rep"][data-v="monthly"]'));click($('#f-fav-tg'));click($('[data-a="tx-save"]'));await sleep(60);
  t.ok(keys(sh,FAV).length===5&&/נשמרה כתנועה חוזרת.*נוסף למועדפים/.test(A.toast()),'works with a recurring transaction too');
  await undo();
  t.ok(keys(sh,FAV).length===4&&keys(sh,P_BETA+'recurring/').length===0,'…and "בטל" removes both');

  // ---- editing a transaction: no favorites row and no toggle ----
  A.tab('home');await sleep(20);
  click($('[data-a="tx-edit"]'));await sleep(20);
  t.ok(!$('#f-favs')&&!$('#f-fav-sec'),'editing a transaction: no favorites');
  click($('#sheet [data-a="sheet-close"]'));await sleep(10);

  // ---- Settings → מועדפים: list, add, edit, reorder, delete ----
  A.tab('settings');
  t.ok(/מועדפים/.test($('[data-a="set"][data-v="favs"]').textContent)&&/4 מועדפים/.test($('[data-a="set"][data-v="favs"]').textContent),'settings row with the count');
  A.set('favs');await sleep(20);
  const rows=()=>$$('[data-a="fav-edit"]').map(b=>b.dataset.id);
  t.ok($('#top-title').textContent==='מועדפים'&&rows().join()==='f2,f1,f3','page lists expense favorites by order');
  t.ok(/ספרים \(נמחקה\)/.test($('[data-a="fav-edit"][data-id="f3"]').textContent)&&/חשבון שנמחק/.test($('[data-a="fav-edit"][data-id="f3"]').textContent),'a deleted category/account is shown as such');
  t.ok($('[data-a="fav-mv"][data-v="-1"][data-id="f2"]').disabled&&$('[data-a="fav-mv"][data-v="1"][data-id="f3"]').disabled,'first cannot move up, last cannot move down');
  click($('[data-a="fav-mv"][data-v="1"][data-id="f2"]'));await sleep(40);
  t.ok(rows().join()==='f1,f2,f3'&&sh.store.get(FAV+'f1').ord===1&&sh.store.get(FAV+'f2').ord===2,'moving down swaps the order (stored)');
  click($('[data-a="fav-mv"][data-v="-1"][data-id="f3"]'));await sleep(40);
  t.ok(rows().join()==='f1,f3,f2','moving up');
  A.tab('home');await open();
  t.ok(chips().join()==='f1,f3,f2','the add sheet follows the new order');
  click($('#sheet [data-a="sheet-close"]'));await sleep(10);
  A.tab('settings');A.set('favs');await sleep(10);
  click($('[data-a="fav-tab"][data-v="income"]'));await sleep(10);
  t.ok(rows().join()==='f4','income tab');
  click($('[data-a="fav-tab"][data-v="expense"]'));await sleep(10);

  click($('[data-a="fav-add"]'));await sleep(20);
  t.ok(A.sheetOpen()&&/מועדף חדש/.test($('#sheet').textContent),'"＋ מועדף חדש" opens a sheet');
  A.type($('#fv-note'),'סופר');click($('[data-a="fav-save"]'));await sleep(20);
  t.ok(A.sheetOpen()&&/קטגוריה/.test(A.toast()),'a category is required');
  click($('#f-cats [data-id="food"]'));A.type($('#fv-amount'),'abc');click($('[data-a="fav-save"]'));await sleep(20);
  t.ok(A.sheetOpen()&&/הסכום לא תקין/.test(A.toast()),'an invalid amount is refused');
  A.type($('#fv-amount'),'');click($('#f-accts [data-id="c1"]'));click($('[data-a="fav-save"]'));await sleep(60);
  const sup=[...sh.store.entries()].filter(([k])=>k.startsWith(FAV)).find(([,v])=>v.note==='סופר');
  t.ok(sup&&sup[1].amount===0&&sup[1].categoryId==='food'&&sup[1].accountId==='c1'&&rows().slice(-1)[0]===sup[0].slice(FAV.length),'empty amount = no amount; added at the end');
  await undo();
  t.ok(keys(sh,FAV).length===4,'"בטל" removes the new favorite');
  click($('[data-a="fav-edit"][data-id="f1"]'));await sleep(20);
  t.ok($('#fv-note').value==='קפה'&&$('#fv-amount').value==='14'&&catOn()==='food'&&acctOn()==='cc','edit sheet shows the favorite');
  A.type($('#fv-note'),'דלק');click($('#f-cats [data-id="fuel"]'));click($('[data-a="fav-save"]'));await sleep(20);
  t.ok(A.sheetOpen()&&/כבר יש מועדף/.test(A.toast()),'a duplicate of another favorite is refused');
  A.type($('#fv-note'),'קפה הפוך');A.type($('#fv-amount'),'15.5');click($('[data-a="fav-save"]'));await sleep(60);
  t.ok(sh.store.get(FAV+'f1').note==='קפה הפוך'&&sh.store.get(FAV+'f1').amount===15.5&&sh.store.get(FAV+'f1').categoryId==='fuel'&&sh.store.get(FAV+'f1').ord===1,'edit is saved, order kept');
  await undo();
  t.ok(sh.store.get(FAV+'f1').note==='קפה'&&sh.store.get(FAV+'f1').amount===14,'"בטל" restores it');
  click($('[data-a="fav-edit"][data-id="f2"]'));await sleep(20);
  click($('[data-a="fav-del"]'));await sleep(40);
  t.ok(!sh.store.get(FAV+'f2')&&!rows().includes('f2')&&/המועדף נמחק/.test(A.toast()),'delete');
  await undo();
  t.ok(sh.store.get(FAV+'f2')&&rows().includes('f2'),'"בטל" brings it back');

  // ---- export, snapshot, import (existing wins), delete-all ----
  await sleep(900);
  const snap=JSON.parse(A.w.localStorage.getItem('fin-snap-beta')||'{}');
  t.ok(Array.isArray(snap.fav)&&snap.fav.length===4,'the saved snapshot includes favorites');
  let file=null;
  A.w.navigator.canShare=()=>true;A.w.navigator.share=d=>{file=d.files[0];return Promise.resolve();};
  A.tab('settings');await sleep(10);
  A.set('bk');click($$('[data-a="bk"]')[0]);await sleep(200);click($('[data-a="bk-save"]'));await sleep(30);
  const bk=JSON.parse(await file.text());
  t.ok(Array.isArray(bk.fav)&&bk.fav.length===4&&bk.fav.some(x=>x.note==='קפה'&&x.amount===14),'export includes favorites');

  const B=JSON.parse(fs.readFileSync(path.join(ROOT,'tests/fixtures/finance-backup-demo.json'),'utf8'));
  B.fav.push({id:'other-id',type:'expense',note:'קפה',categoryId:'demo-cat-eat',catName:'אוכל',amount:99,ord:9,createdAt:1});   // same as the existing "קפה/אוכל"
  const sh2=makeShared();sh2.store.set(P_BETA+'meta/profile',{seeded:true});
  sh2.store.set(P_BETA+'categories/food',{name:'אוכל',icon:'☕',type:'expense',color:'#888888',ord:1});
  sh2.store.set(FAV+'mine',{type:'expense',note:'קפה',categoryId:'food',catName:'אוכל',amount:12,ord:1,createdAt:1});
  const C=openApp(sh2);await sleep(250);
  C.tab('settings');C.set('bk');C.click(C.$$('[data-a="bk"]')[1]);await C.importText(JSON.stringify(B));
  t.ok(/מועדפים/.test(C.$('#sheet').textContent),'import summary lists favorites');
  C.click(C.$('[data-a="import-go"]'));await sleep(400);
  const imp=[...sh2.store.entries()].filter(([k])=>k.startsWith(FAV)).map(([,v])=>v);
  t.ok(imp.length===1+B.fav.length-1&&sh2.store.get(FAV+'mine').amount===12,'import adds missing favorites; an existing one (same type+description+category) wins');
  const dog=imp.find(x=>x.note==='אוכל לכלב');
  t.ok(dog&&dog.ord>1&&dog.categoryId==='demo-cat-pet','imported favorites keep their category, after the existing ones');
  C.tab('settings');C.click(C.$('[data-a="reset"]'));await C.confirm();await sleep(300);
  t.ok(keys(sh2,FAV).length===0,'"מחיקת כל הנתונים" deletes favorites');
  t.ok(!A.errors.length&&!C.errors.length,'no script errors'+(A.errors.concat(C.errors).length?': '+A.errors.concat(C.errors)[0]:''));
};
