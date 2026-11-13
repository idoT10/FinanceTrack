// 1.0.6: full update with a negative balance, manual edits that do not overwrite a concurrent change (increment),
// category order remembered per device, amounts with 0 or 2 decimals, shorter breakdown and net-worth rows.
const {openApp,makeShared,sleep,P_BETA}=require('./lib/harness');
const pad=n=>String(n).padStart(2,'0');
const now=new Date(),MK=now.getFullYear()+'-'+pad(now.getMonth()+1),D1=MK+'-01';
const CATS=['a','b','c','d','e'];
function seed(sh){
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  CATS.forEach((k,i)=>sh.store.set(P_BETA+'categories/'+k,{name:'קט '+k,icon:'🍔',type:'expense',color:'#888888',ord:i+1}));
  sh.store.set(P_BETA+'assets/c1',{name:'עו"ש',category:'checking',value:-500,updatedAt:1});
  sh.store.set(P_BETA+'assets/g1',{name:'גמל להשקעה',category:'gemel',value:5000,updatedAt:1});
  sh.store.set(P_BETA+'assets/p1',{name:'פנסיה א',category:'pension',value:100,updatedAt:1});
  sh.store.set(P_BETA+'assets/p2',{name:'פנסיה ב',category:'pension',value:200,updatedAt:1});
  CATS.forEach((k,i)=>sh.store.set(P_BETA+'tx/t'+k,{type:'expense',amount:i?10*i:364.7,categoryId:k,catName:'',date:D1,note:'',createdAt:i}));
}
const val=(sh,p)=>sh.store.get(P_BETA+p).value;
module.exports=async t=>{
  const sh=makeShared();seed(sh);
  const A=openApp(sh,{beforeParse(w){w.localStorage.setItem('fin-cat-use-beta',JSON.stringify({e:40}));}});await sleep(200);
  const $=A.$,$$=A.$$,click=A.click;
  const bulkIn=id=>$$('.bulk-in').find(i=>i.dataset.id===id);
  const other=(p,d)=>A.fake.fs.updateDoc({path:P_BETA+p},{value:A.fake.fs.increment(d)});   // a change from another device

  // ---- amounts: no decimals, or exactly two ----
  A.tab('tx');await sleep(30);
  const amt=$('.tx-row[data-id="ta"] .tx-amt').textContent;
  t.ok(/364\.70$/.test(amt),'364.7 is shown as 364.70 ('+amt+')');
  t.ok(/₪10$/.test($('.tx-row[data-id="tb"] .tx-amt').textContent),'a whole amount has no decimals');

  // ---- breakdown: top 3, the rest on demand ----
  t.ok(!$$('#tx-results .bar-row').length&&$$('.brk-mini .stack i').length===5&&/ועוד 2/.test($('.brk-mini').textContent),'breakdown is collapsed: one colour bar, top 3 names');
  click($('.brk-mini'));
  t.ok($$('#tx-results .bar-row').length===5,'tapping it opens the full breakdown');
  click($('[data-a="brk-toggle"]'));
  t.ok(!$$('#tx-results .bar-row').length,'…and "הסתרה" closes it');

  // ---- net worth rows ----
  A.tab('nw');await sleep(30);
  const heads=$$('.grp-h').map(e=>e.textContent);
  t.ok(heads.some(h=>/פנסיה/.test(h))&&!heads.some(h=>/קופת גמל/.test(h)),'a type with one item has no header of its own');
  t.ok(/עודכן .+ · קופת גמל/.test($('[data-a="asset-edit"][data-id="g1"] .tx-sub').textContent),'…and its row shows the type');
  t.ok($('[data-a="asset-edit"][data-id="g1"] .tx-sub.stale')&&!/לא עודכן מעל חודש/.test($('#view').textContent),'stale item: short text in the warning colour');
  t.ok($('[data-a="asset-edit"][data-id="c1"] .tx-sub').textContent==='עו"ש','current account row shows only its type');

  // ---- full update with an account in minus ----
  click($('[data-a="nw-bulk"]'));await sleep(10);
  t.ok(bulkIn('c1').value==='-500'&&/4,800/.test($('#b-total').textContent),'full update shows the negative balance and counts it');
  A.type(bulkIn('g1'),'5100');click($('[data-a="bulk-save"]'));await sleep(80);
  t.ok(!A.sheetOpen()&&val(sh,'assets/g1')===5100&&val(sh,'assets/c1')===-500,'full update saves with a negative current account');
  click($('[data-a="nw-bulk"]'));await sleep(10);
  A.type(bulkIn('c1'),'-300');click($('[data-a="bulk-save"]'));await sleep(80);
  t.ok(val(sh,'assets/c1')===-300,'a negative balance can be typed in the full update');
  click($('[data-a="nw-bulk"]'));await sleep(10);
  A.type(bulkIn('g1'),'-5');click($('[data-a="bulk-save"]'));await sleep(40);
  t.ok(A.sheetOpen()&&/לא תקין/.test(A.toast()),'minus is still refused for a savings account');
  click($('[data-a="sheet-close"]'));
  // the iPhone number pad has no minus key: a button toggles the sign
  click($('[data-a="nw-bulk"]'));await sleep(10);
  t.ok($('[data-a="b-neg"][data-id="c1"]')&&!$('[data-a="b-neg"][data-id="g1"]'),'± button only next to current accounts');
  click($('[data-a="b-neg"][data-id="c1"]'));
  t.ok(bulkIn('c1').value==='300','± toggles the sign in the full update');
  click($('[data-a="b-neg"][data-id="c1"]'));click($('[data-a="sheet-close"]'));
  click($('[data-a="asset-edit"][data-id="c1"]'));await sleep(10);
  t.ok(!$('#n-neg-wrap').hidden&&$('#n-neg').classList.contains('on'),'account sheet: "במינוס" button, on for a negative balance');
  click($('#n-neg'));t.ok($('#n-value').value==='300','…and it toggles the sign');
  click($('[data-a="sheet-close"]'));
  click($('[data-a="asset-edit"][data-id="g1"]'));await sleep(10);
  t.ok($('#n-neg-wrap').hidden,'no minus button for a savings account');
  click($('[data-a="sheet-close"]'));

  // ---- an untouched field does not overwrite a change made elsewhere meanwhile ----
  click($('[data-a="nw-bulk"]'));await sleep(10);
  await other('assets/c1',-50);await sleep(30);
  A.type(bulkIn('g1'),'5200');click($('[data-a="bulk-save"]'));await sleep(80);
  t.ok(val(sh,'assets/c1')===-350&&val(sh,'assets/g1')===5200,'full update keeps a balance that changed while the sheet was open');
  click($('#toast .toast-undo'));await sleep(60);
  t.ok(val(sh,'assets/c1')===-350&&val(sh,'assets/g1')===5100,'undo of the full update reverts only what it changed');

  click($('[data-a="asset-edit"][data-id="c1"]'));await sleep(10);
  await other('assets/c1',-20);await sleep(30);
  A.type($('#n-name'),'עו"ש חדש');click($('[data-a="nw-save"]'));await sleep(60);
  t.ok(val(sh,'assets/c1')===-370&&sh.store.get(P_BETA+'assets/c1').name==='עו"ש חדש','renaming an account keeps a balance that changed meanwhile');
  click($('[data-a="asset-edit"][data-id="c1"]'));await sleep(10);
  A.type($('#n-value'),'-100');click($('[data-a="nw-save"]'));await sleep(60);
  t.ok(val(sh,'assets/c1')===-100,'balance adjustment sets the typed value');
  click($('#toast .toast-undo'));await sleep(60);
  t.ok(val(sh,'assets/c1')===-370,'undo of the adjustment restores the balance');

  // ---- category order is remembered on this device ----
  click($('[data-a="fab"]'));await sleep(10);
  const order=()=>$$('#f-cats .chip[data-a="f-cat"]').map(c=>c.dataset.id);
  t.ok(order()[0]==='e','the most used category (remembered on the device) comes first');
  A.type($('#f-amount'),'5');click($('#f-cats [data-id="b"]'));click($('[data-a="tx-save"]'));await sleep(60);
  t.ok(JSON.parse(A.w.localStorage.getItem('fin-cat-use-beta')).b===1,'saving a transaction counts its category');
  // ---- settings menu ----
  click($('[data-a="sheet-close"]'));A.tab('settings');await sleep(20);
  t.ok($$('#view [data-a="set"]').length===7&&!$('#view [data-a="cat-edit"]'),'settings is a menu of rows');
  A.set('cats');await sleep(20);
  t.ok($('#view [data-a="cat-edit"]')&&$('[data-a="set-back"]'),'categories open as a page with a way back');
  click($('[data-a="set-back"]'));await sleep(20);
  A.set('acct');await sleep(20);
  t.ok(A.sheetOpen()&&$('#sheet [data-a="signout"]'),'account opens as a sheet');
  click($('[data-a="sheet-close"]'));
  t.ok(!/גרסה חדשה/.test($('#view').textContent),'no "new version" notice by default');
  t.ok(!A.errors.length,'no script errors'+(A.errors.length?': '+A.errors[0]:''));
};
