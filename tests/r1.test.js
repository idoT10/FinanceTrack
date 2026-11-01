// R1: undo (delete/add/edit), search in the shown month, savings rate, share without extra text file,
// beta error codes.
const {openApp,makeShared,sleep,keys,P_BETA}=require('./lib/harness');
const pad=n=>String(n).padStart(2,'0');
const now=new Date(),MK=now.getFullYear()+'-'+pad(now.getMonth()+1),D1=MK+'-01';

function seedData(sh){
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  sh.store.set(P_BETA+'categories/food',{name:'אוכל',icon:'🍔',type:'expense',color:'#888888',ord:1});
  sh.store.set(P_BETA+'categories/sal',{name:'משכורת',icon:'💼',type:'income',color:'#888888',ord:2});
  sh.store.set(P_BETA+'tx/t1',{type:'expense',amount:120.5,categoryId:'food',catName:'אוכל',date:D1,note:'חשמלאי',createdAt:1});
  sh.store.set(P_BETA+'tx/t2',{type:'expense',amount:1205,categoryId:'food',catName:'אוכל',date:D1,note:'',createdAt:2});
  sh.store.set(P_BETA+'tx/t3',{type:'income',amount:10000,categoryId:'sal',catName:'משכורת',date:D1,note:'',createdAt:3});
  sh.store.set(P_BETA+'assets/a1',{name:'עו"ש',category:'cash',value:5000,updatedAt:1});
  sh.store.set(P_BETA+'history/100',{t:100,a:5000,l:0,n:5000,note:''});
}
const undoBtn=A=>A.$('#toast .toast-undo');

module.exports=async t=>{
  const sh=makeShared();seedData(sh);
  const A=openApp(sh);await sleep(200);

  // ---- savings rate ----
  t.ok(/חסכת\s*87%/.test(A.$('.save-rate')?A.$('.save-rate').textContent:''),'home: savings rate 87% ((10000-1325.5)/10000)');
  A.tab('tx');await sleep(30);
  t.ok(/שיעור חיסכון\s*87%/.test(A.$('.tx-save-rate').textContent),'transactions: savings rate for the shown month');

  // ---- search ----
  const search=v=>{A.type(A.$('#tx-search'),v);};
  const rows=()=>A.$$('#tx-results .tx-row').map(r=>r.dataset.id).sort().join(',');
  const inp=A.$('#tx-search');
  search('חשמל');
  t.ok(rows()==='t1','search by note');
  t.ok(A.$('#tx-search')===inp,'typing does not redraw the search box (keyboard stays open)');
  search('120');
  t.ok(rows()==='t1','search "120" finds 120.50 but not 1205');
  search('משכורת');
  t.ok(rows()==='t3','search by category name');
  t.ok(/תנועה אחת מתאימות לחיפוש|תנועה אחת/.test(A.$('#tx-results .filter-sum').textContent),'summary line while searching');
  A.click(A.$('[data-a="tx-type"][data-v="expense"]'));await sleep(10);
  t.ok(A.$('#tx-search').value==='משכורת'&&rows()==='','search combines with the type filter');
  t.ok(/לא נמצאו תנועות/.test(A.$('#tx-results').textContent),'empty search result message');
  A.click(A.$('[data-a="tx-clear"]'));await sleep(10);
  t.ok(A.$('#tx-search').value===''&&rows()==='t1,t2,t3','"clear" resets search and filters');

  // ---- undo: delete transaction (no confirm dialog) ----
  A.click(A.$('.tx-row[data-id="t1"]'));A.click(A.$('[data-a="tx-del"]'));await sleep(40);
  t.ok(!A.$('#dialog').classList.contains('open'),'delete: no confirm dialog');
  t.ok(!sh.store.has(P_BETA+'tx/t1')&&undoBtn(A),'delete: done immediately, toast with "בטל"');
  const before=JSON.stringify({type:'expense',amount:120.5,categoryId:'food',catName:'אוכל',date:D1,note:'חשמלאי',createdAt:1});
  A.click(undoBtn(A));await sleep(40);
  t.ok(JSON.stringify(sh.store.get(P_BETA+'tx/t1'))===before,'undo: same transaction back, same id and fields');
  t.ok(A.$('.tx-row[data-id="t1"]')&&/הוחזרה/.test(A.toast()),'undo: back on screen');

  // ---- undo: add ----
  const n0=keys(sh,P_BETA+'tx/').length;
  await A.addExpense(42);
  t.ok(keys(sh,P_BETA+'tx/').length===n0+1&&undoBtn(A),'add: saved, toast with "בטל"');
  A.click(undoBtn(A));await sleep(40);
  t.ok(keys(sh,P_BETA+'tx/').length===n0&&/ההוספה בוטלה/.test(A.toast()),'undo add: transaction removed');

  // ---- undo: edit ----
  A.click(A.$('.tx-row[data-id="t2"]'));A.type(A.$('#f-amount'),'99');A.click(A.$('[data-a="tx-save"]'));await sleep(40);
  t.ok(sh.store.get(P_BETA+'tx/t2').amount===99,'edit saved');
  A.click(undoBtn(A));await sleep(40);
  t.ok(sh.store.get(P_BETA+'tx/t2').amount===1205&&/השינויים בוטלו/.test(A.toast()),'undo edit: previous version back');

  // ---- undo expires ----
  A.click(A.$('.tx-row[data-id="t2"]'));A.click(A.$('[data-a="tx-del"]'));await sleep(5200);
  t.ok(!A.$('#toast').classList.contains('show')&&!sh.store.has(P_BETA+'tx/t2'),'after 5 seconds the undo is gone, delete stays');

  // ---- undo: asset delete removes the graph point it added ----
  A.tab('nw');await sleep(30);
  A.click(A.$('[data-a="asset-edit"][data-id="a1"]'));A.click(A.$('[data-a="nw-del"]'));await sleep(40);
  const hAfterDel=keys(sh,P_BETA+'history/').length;
  t.ok(!sh.store.has(P_BETA+'assets/a1')&&hAfterDel===2,'asset delete: item gone, graph point added');
  A.click(undoBtn(A));await sleep(40);
  t.ok(sh.store.get(P_BETA+'assets/a1').value===5000&&keys(sh,P_BETA+'history/').length===1,'undo asset delete: item back, extra graph point removed');

  // ---- undo: asset edit / add / full update ----
  A.click(A.$('[data-a="asset-edit"][data-id="a1"]'));A.type(A.$('#n-value'),'7000');A.click(A.$('[data-a="nw-save"]'));await sleep(40);
  t.ok(sh.store.get(P_BETA+'assets/a1').value===7000&&keys(sh,P_BETA+'history/').length===2&&undoBtn(A),'asset edit: saved, graph point added, "בטל" shown');
  A.click(undoBtn(A));await sleep(40);
  t.ok(sh.store.get(P_BETA+'assets/a1').value===5000&&keys(sh,P_BETA+'history/').length===1&&/העדכון בוטל/.test(A.toast()),'undo asset edit: old value back, graph point removed');
  const nA=keys(sh,P_BETA+'assets/').length;
  A.click(A.$('[data-a="asset-add"]'));A.type(A.$('#n-value'),'300');A.click(A.$('[data-a="nw-save"]'));await sleep(40);
  t.ok(keys(sh,P_BETA+'assets/').length===nA+1,'asset added');
  A.click(undoBtn(A));await sleep(40);
  t.ok(keys(sh,P_BETA+'assets/').length===nA&&keys(sh,P_BETA+'history/').length===1,'undo asset add: asset and its graph point removed');
  A.click(A.$('[data-a="nw-bulk"]'));A.$$('.bulk-in')[0].value='9000';A.click(A.$('[data-a="bulk-save"]'));await sleep(60);
  t.ok(sh.store.get(P_BETA+'assets/a1').value===9000&&undoBtn(A),'full update saved with "בטל"');
  A.click(undoBtn(A));await sleep(60);
  t.ok(sh.store.get(P_BETA+'assets/a1').value===5000&&keys(sh,P_BETA+'history/').length===1,'undo full update: values back, graph point removed');

  // ---- undo: graph point delete ----
  A.click(A.$('[data-a="hist-del"][data-id="100"]'));await sleep(40);
  t.ok(!sh.store.has(P_BETA+'history/100'),'graph point deleted without dialog');
  A.click(undoBtn(A));await sleep(40);
  t.ok(sh.store.get(P_BETA+'history/100').n===5000,'undo: graph point back');

  // ---- undo: category delete ----
  A.tab('settings');await sleep(30);
  A.click(A.$('[data-a="cat-edit"][data-id="food"]'));await sleep(60);A.click(A.$('[data-a="cat-del"]'));await sleep(40);
  t.ok(!sh.store.has(P_BETA+'categories/food'),'category deleted');
  A.click(undoBtn(A));await sleep(40);
  t.ok(sh.store.get(P_BETA+'categories/food').name==='אוכל','undo: category back with the same id (transactions linked again)');

  // ---- heavy actions still ask ----
  A.click(A.$('[data-a="reset"]'));await sleep(20);
  t.ok(A.$('#dialog').classList.contains('open'),'"delete all data" still asks for confirmation');
  A.click(A.$('#dialog [data-r="0"]'));await sleep(20);

  t.ok(A.errors.length===0,'no script errors'+(A.errors.length?': '+A.errors[0]:''));

  // ---- expenses above income: plain text, no duplicated amount ----
  const shX=makeShared();seedData(shX);shX.store.set(P_BETA+'tx/big',{type:'expense',amount:20000,categoryId:'food',catName:'אוכל',date:D1,note:'',createdAt:9});
  const X=openApp(shX);await sleep(200);
  const homeTxt=X.$('.flow').textContent;
  t.ok(/ההוצאות עולות על ההכנסות/.test(homeTxt)&&!/[<>]/.test(homeTxt),'home: expenses > income, no HTML code in the text');
  X.tab('tx');await sleep(30);
  t.ok(/ההוצאות עולות על ההכנסות/.test(X.$('.tx-save-rate').textContent)&&!/[<>]/.test(X.$('.tx-save-rate').textContent),'transactions: expenses > income, no HTML code');
  t.ok(!/\(₪|\(.*8,675/.test(A.$('.flow')?A.$('.flow').textContent:''),'home: savings line does not repeat the cash-flow amount');

  // ---- share: only the file (no title → no extra text file on iPhone) ----
  const shares=[];
  const sh2=makeShared();seedData(sh2);
  const B=openApp(sh2,{beforeParse(w){w.navigator.canShare=()=>true;w.navigator.share=d=>{shares.push(d);return Promise.resolve();};}});
  await sleep(150);B.tab('settings');B.click(B.$$('[data-a="bk"]')[0]);await sleep(150);B.click(B.$('[data-a="bk-save"]'));await sleep(20);
  t.ok(shares.length===1&&Object.keys(shares[0]).join()==='files','share gets only the file, no title/text');

  // ---- export: busy message stays; offline → immediate message ----
  let rel;B.fake.fs.getDocsFromServer=()=>new Promise(r=>{rel=r;});
  B.click(B.$$('[data-a="bk"]')[0]);await sleep(2600);
  t.ok(/מכין גיבוי/.test(B.toast())&&B.$('#toast').classList.contains('show'),'export: "מכין גיבוי…" stays visible while waiting');
  rel({docs:[],metadata:{fromCache:false}});await sleep(60);
  t.ok(B.sheetOpen()&&!B.$('#toast').classList.contains('show'),'export ready: sheet opens, busy message gone');
  B.click(B.$('[data-a="sheet-close"]')||B.$('#overlay'));await sleep(20);
  Object.defineProperty(B.w.navigator,'onLine',{value:false,configurable:true});
  B.click(B.$$('[data-a="bk"]')[0]);await sleep(20);
  t.ok(/דורש חיבור לאינטרנט/.test(B.toast()),'export offline: message right away');
  Object.defineProperty(B.w.navigator,'onLine',{value:true,configurable:true});

  // ---- beta error code in the message ----
  B.fake.fs.getDocsFromServer=async()=>{throw Object.assign(new Error('x'),{code:'unavailable'});};
  B.click(B.$('[data-a="beta-wipe"]'));await B.confirm();await sleep(50);
  t.ok(/הניקוי נכשל.*\(unavailable\)/.test(B.toast()),'beta: failure message shows the error code ('+B.toast()+')');

};
