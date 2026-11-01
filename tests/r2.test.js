// R2: accounts and transfers. Balances of current accounts follow the transactions (increment),
// transfers are neutral for cash flow and savings, every manual value change is stored as an "adjust" record.
const {openApp,makeShared,sleep,keys,P_BETA}=require('./lib/harness');
const pad=n=>String(n).padStart(2,'0');
const now=new Date(),MK=now.getFullYear()+'-'+pad(now.getMonth()+1),D1=MK+'-01';
const prevMonthT=new Date(now.getFullYear(),now.getMonth()-1,15).getTime();

function seed(sh){
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  sh.store.set(P_BETA+'categories/food',{name:'אוכל',icon:'🍔',type:'expense',color:'#888888',ord:1});
  sh.store.set(P_BETA+'categories/sal',{name:'משכורת',icon:'💼',type:'income',color:'#888888',ord:2});
  sh.store.set(P_BETA+'assets/c1',{name:'עו"ש לאומי',category:'checking',value:1000,updatedAt:1});
  sh.store.set(P_BETA+'assets/g1',{name:'גמל להשקעה',category:'gemel',value:5000,updatedAt:1});
  sh.store.set(P_BETA+'liabilities/cc',{name:'ויזה',category:'credit',value:0,updatedAt:1});
  sh.store.set(P_BETA+'history/'+prevMonthT,{t:prevMonthT,a:6000,l:0,n:6000,note:''});
}
const val=(sh,p)=>sh.store.get(P_BETA+p).value;
const txDocs=sh=>keys(sh,P_BETA+'tx/').map(k=>Object.assign({id:k.split('/').pop()},sh.store.get(k)));

module.exports=async t=>{
  const sh=makeShared();seed(sh);
  const A=openApp(sh);await sleep(200);
  const $=A.$,click=A.click;
  const undo=async()=>{click($('#toast .toast-undo'));await sleep(40);};
  const add=async({type='expense',amount,acct,from,to,cat})=>{
    click($('[data-a="fab"]'));await sleep(10);
    if(type!=='expense')click($('#f-type [data-v="'+type+'"]'));
    A.type($('#f-amount'),String(amount));
    if(type==='transfer'){click($('#f-from [data-id="'+from+'"]'));click($('#f-to [data-id="'+to+'"]'));}
    else{
      click(cat?$('#f-cats [data-id="'+cat+'"]'):$$('#f-cats .chip[data-a="f-cat"]')[0]);
      if(acct!==undefined)click($('#f-accts [data-id="'+acct+'"]'));
    }
    click($('[data-a="tx-save"]'));await sleep(50);
  };
  const $$=A.$$;

  // ---- monthly point: last point is from last month and the value changed → one point added on open ----
  const hist0=keys(sh,P_BETA+'history/').length;
  t.ok(hist0===1,'monthly point: none added when net worth did not change since last month');

  // ---- expense from an account ----
  await add({amount:100,acct:'c1'});
  const e1=txDocs(sh).find(x=>x.amount===100);
  t.ok(e1&&e1.accountId==='c1'&&val(sh,'assets/c1')===900,'expense from עו"ש: balance 1000 → 900, accountId saved');
  click($('[data-a="fab"]'));await sleep(10);
  t.ok($('#f-accts .chip.on')&&$('#f-accts .chip.on').dataset.id==='c1','add sheet remembers the last account');
  click($('[data-a="sheet-close"]'));await sleep(10);
  await add({type:'income',amount:500,acct:'c1',cat:'sal'});
  t.ok(val(sh,'assets/c1')===1400,'income to עו"ש: 900 → 1400');
  await add({amount:30,acct:''});
  t.ok(val(sh,'assets/c1')===1400&&!txDocs(sh).find(x=>x.amount===30).accountId,'"בלי חשבון": no balance change');

  // ---- credit card ----
  await add({amount:200,acct:'cc'});
  t.ok(val(sh,'liabilities/cc')===200,'expense on the credit card: card debt 0 → 200');
  await add({type:'transfer',amount:200,from:'c1',to:'cc'});
  t.ok(val(sh,'assets/c1')===1200&&val(sh,'liabilities/cc')===0,'card payment (transfer עו"ש → card): עו"ש 1400 → 1200, debt 200 → 0');

  // ---- transfer to savings ----
  await add({type:'transfer',amount:1000,from:'c1',to:'g1'});
  t.ok(val(sh,'assets/c1')===200&&val(sh,'assets/g1')===6000,'transfer עו"ש → גמל: 1200 → 200, 5000 → 6000');
  A.tab('home');await sleep(20);
  const flow=$('.flow').textContent;
  t.ok(/500/.test(flow)&&/330/.test(flow)&&!/1,530|1,330/.test(flow),'home: transfers not counted in income/expenses (income 500, expenses 330)');
  t.ok(/הושקע החודש:\s*₪?1,000|הושקע החודש:.*1,000/.test(flow),'home: "הושקע החודש" = 1,000');

  // ---- edit, undo, delete, undo ----
  A.tab('tx');await sleep(20);
  click($('.tx-row[data-id="'+e1.id+'"]'));A.type($('#f-amount'),'150');click($('[data-a="tx-save"]'));await sleep(40);
  t.ok(val(sh,'assets/c1')===150,'edit expense 100 → 150: balance adjusted by the difference (200 → 150)');
  await undo();
  t.ok(val(sh,'assets/c1')===200&&sh.store.get(P_BETA+'tx/'+e1.id).amount===100,'undo edit: amount and balance back');
  click($('.tx-row[data-id="'+e1.id+'"]'));click($('#f-accts [data-id=""]'));click($('[data-a="tx-save"]'));await sleep(40);
  t.ok(val(sh,'assets/c1')===300&&!sh.store.get(P_BETA+'tx/'+e1.id).accountId,'edit: remove the account → amount returns to the account');
  await undo();
  const tr=txDocs(sh).find(x=>x.type==='transfer'&&x.amount===1000);
  click($('.tx-row[data-id="'+tr.id+'"]'));click($('[data-a="tx-del"]'));await sleep(40);
  t.ok(val(sh,'assets/c1')===1200&&val(sh,'assets/g1')===5000,'delete transfer: both balances restored');
  await undo();
  t.ok(val(sh,'assets/c1')===200&&val(sh,'assets/g1')===6000&&sh.store.has(P_BETA+'tx/'+tr.id),'undo delete: transfer and balances back');
  await add({amount:50,acct:'c1'});
  t.ok(val(sh,'assets/c1')===150,'add 50 → 150');
  await undo();
  t.ok(val(sh,'assets/c1')===200,'undo add: balance back to 200');

  // ---- list ----
  const tr2=txDocs(sh).find(x=>x.type==='transfer'&&x.amount===1000);
  const row=$('.tx-row[data-id="'+tr2.id+'"]');
  t.ok(row&&/עו"ש לאומי ← גמל להשקעה/.test(row.textContent),'transfer row shows "from ← to"');
  t.ok(!$$('#view [data-a="tx-cat"]').some(b=>/ללא קטגוריה/.test(b.textContent)),'transfers do not create a "ללא קטגוריה" chip');
  click($('[data-a="tx-type"][data-v="transfer"]'));await sleep(10);
  t.ok($$('#tx-results .tx-row').length===2,'"העברות" tab shows only the 2 transfers');
  click($('[data-a="tx-type"][data-v="all"]'));await sleep(10);
  A.type($('#tx-search'),'גמל');
  t.ok($$('#tx-results .tx-row').length===1,'search by account name finds the transfer');
  click($('[data-a="tx-q-clear"]'));await sleep(10);
  click($('[data-a="fab"]'));await sleep(10);
  click($('#f-type [data-v="transfer"]'));click($('#f-from [data-id="c1"]'));
  t.ok(!$('#f-to [data-id="c1"]'),'transfer: the "from" account is not offered as "to"');
  click($('#f-to [data-id="g1"]'));A.type($('#f-amount'),'5');click($('#f-from [data-id="g1"]'));click($('[data-a="tx-save"]'));await sleep(20);
  t.ok(A.sheetOpen()&&/שני חשבונות|מאיזה חשבון/.test(A.toast()),'transfer needs two different accounts');
  click($('[data-a="sheet-close"]'));await sleep(10);

  // ---- reconciliation of a current account ----
  A.tab('nw');await sleep(20);
  t.ok(/כסף שוטף/.test($('#view').textContent)&&/חיסכון והשקעות/.test($('#view').textContent)&&/חובות/.test($('#view').textContent),'net worth screen: three groups');
  const hBefore=keys(sh,P_BETA+'history/').length;
  click($('[data-a="asset-edit"][data-id="c1"]'));await sleep(10);
  t.ok(/יתרה נוכחית/.test($('#n-value-label').textContent)&&/התאמת יתרה/.test($('#n-hint').textContent),'current account sheet explains reconciliation');
  A.type($('#n-value'),'250');click($('[data-a="nw-save"]'));await sleep(40);
  const adj=txDocs(sh).find(x=>x.type==='adjust'&&x.accountId==='c1');
  t.ok(val(sh,'assets/c1')===250&&adj&&adj.delta===50&&adj.value===250&&adj.note==='התאמת יתרה','reconciliation: balance 250, record with delta +50');
  t.ok(keys(sh,P_BETA+'history/').length===hBefore+1,'reconciliation adds a graph point');
  A.tab('tx');await sleep(20);
  const adjRow=$('.tx-row[data-id="'+adj.id+'"]');
  t.ok(adjRow&&/התאמת יתרה/.test(adjRow.textContent),'reconciliation shows in the transactions list');
  t.ok(/תזרים/.test($('.tri').textContent)&&/170/.test($('.tri').textContent),'reconciliation not counted in cash flow (500 − 330 = 170)');
  click(adjRow);await sleep(10);click($('[data-a="tx-del"]'));await sleep(40);
  t.ok(val(sh,'assets/c1')===200,'deleting the reconciliation returns the balance (250 → 200)');
  await undo();
  t.ok(val(sh,'assets/c1')===250,'undo: reconciliation back (250)');

  // ---- investment update: record stored, not shown in the list ----
  A.tab('nw');await sleep(20);
  click($('[data-a="asset-edit"][data-id="g1"]'));A.type($('#n-value'),'6500');click($('[data-a="nw-save"]'));await sleep(40);
  const inv=txDocs(sh).find(x=>x.type==='adjust'&&x.accountId==='g1');
  t.ok(inv&&inv.delta===500&&inv.note==='עדכון שווי','investment update stored as a record (+500)');
  A.tab('tx');await sleep(20);
  t.ok(!$('.tx-row[data-id="'+inv.id+'"]'),'investment updates are not in the transactions list');
  A.tab('nw');await sleep(20);
  click($('[data-a="asset-edit"][data-id="g1"]'));A.type($('#n-value'),'7000');click($('[data-a="nw-save"]'));await sleep(40);
  const inv2=txDocs(sh).find(x=>x.type==='adjust'&&x.accountId==='g1'&&x.value===7000);
  await undo();
  t.ok(!sh.store.has(P_BETA+'tx/'+inv2.id)&&val(sh,'assets/g1')===6500,'undo update removes its record');
  click($('[data-a="nw-bulk"]'));await sleep(10);
  const ins=$$('.bulk-in');ins.forEach(i=>{i.value='';});
  const gi=ins.find(i=>i.dataset.id==='g1');gi.value='6600';click($('[data-a="bulk-save"]'));await sleep(60);
  const bulkRec=txDocs(sh).find(x=>x.type==='adjust'&&x.accountId==='g1'&&x.value===6600);
  t.ok(bulkRec&&bulkRec.delta===100,'full update stores a record per changed account');
  await undo();await sleep(30);
  t.ok(!sh.store.has(P_BETA+'tx/'+bulkRec.id),'undo full update removes the records');

  // ---- new current account with negative opening balance ----
  click($('[data-a="asset-add"][data-v="checking"]'));await sleep(10);
  A.type($('#n-value'),'-300');A.type($('#n-name'),'עו"ש משותף');click($('[data-a="nw-save"]'));await sleep(40);
  const nk=keys(sh,P_BETA+'assets/').find(k=>sh.store.get(k).name==='עו"ש משותף');
  const open=txDocs(sh).find(x=>x.type==='adjust'&&x.note==='יתרת פתיחה');
  t.ok(nk&&sh.store.get(nk).value===-300&&sh.store.get(nk).category==='checking','new עו"ש with negative opening balance (מינוס)');
  t.ok(open&&open.delta===-300,'opening balance stored as a record');

  // ---- graph "now" point: the change line is measured up to the current value ----
  const tot=keys(sh,P_BETA+'assets/').reduce((x,k)=>x+sh.store.get(k).value,0)-keys(sh,P_BETA+'liabilities/').reduce((x,k)=>x+sh.store.get(k).value,0);
  A.tab('home');await sleep(20);
  const dl=$('.delta').textContent.replace(/[^\d,.+\-−]/g,'');
  const want=(tot-6000).toLocaleString('en-US');
  t.ok(dl.includes(want),'graph ends at the current net worth (change '+want+' since the first point; shown: '+$('.delta').textContent+')');

  // ---- deleted account ----
  A.tab('nw');await sleep(20);
  click($('[data-a="liab-edit"][data-id="cc"]'));await sleep(10);click($('[data-a="nw-del"]'));await sleep(40);
  A.tab('tx');await sleep(20);
  t.ok(/חשבון שנמחק/.test($('#tx-results').textContent),'transactions of a deleted account show "חשבון שנמחק"');

  // ---- import keeps the new fields ----
  const shI=makeShared();shI.store.set(P_BETA+'meta/profile',{seeded:true});
  const I=openApp(shI);await sleep(200);
  await I.importText(JSON.stringify({app:'personal-finance-dashboard',version:2,tx:{categories:[],transactions:[
    {id:'x',type:'transfer',amount:5,date:D1,note:'',fromId:'a',toId:'b',createdAt:1},
    {id:'y',type:'adjust',amount:5,date:D1,note:'',accountId:'a',delta:-5,value:10,createdAt:2},
    {id:'z',type:'expense',amount:5,date:D1,note:'',accountId:'a',categoryId:null,createdAt:3}]},
    nw:{assets:[{id:'a',name:'עו"ש',category:'checking',value:10,updatedAt:1},{id:'b',name:'גמל',category:'gemel',value:5,updatedAt:1}],liabilities:[],history:[]}}));
  if(I.sheetOpen()){I.click(I.$('[data-a="import-go"]'));await sleep(200);}
  const gx=k=>shI.store.get(P_BETA+'tx/'+k)||{};
  t.ok(gx('x').type==='transfer'&&gx('x').fromId==='a'&&gx('y').delta===-5&&gx('y').value===10&&gx('z').accountId==='a','import keeps transfers, records and accounts');
  t.ok(shI.store.get(P_BETA+'assets/a').value===10,'import does not apply the transactions to balances again');

  t.ok(A.errors.length===0,'no script errors'+(A.errors.length?': '+A.errors[0]:''));

  // ---- monthly point when the value changed since last month ----
  const sh2=makeShared();seed(sh2);sh2.store.set(P_BETA+'assets/g1',{name:'גמל',category:'gemel',value:5600,updatedAt:1});
  const B=openApp(sh2);await sleep(200);
  const hk=keys(sh2,P_BETA+'history/');
  t.ok(hk.length===2&&sh2.store.get(hk.find(k=>!k.endsWith(String(prevMonthT)))).note==='נקודה חודשית','first open in a new month adds one monthly point');
  const C=openApp(sh2);await sleep(200);
  t.ok(keys(sh2,P_BETA+'history/').length===2,'opening again in the same month adds nothing');
  void B;void C;
};
