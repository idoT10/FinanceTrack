// R3: recurring transactions and installments. Generated on their day (with catch-up), deterministic ids,
// one transaction per month per template (atomic, so two devices can't double-create), balances follow.
const {openApp,makeShared,sleep,keys,P_BETA}=require('./lib/harness');
const pad=n=>String(n).padStart(2,'0');
const now=new Date(),Y=now.getFullYear(),M=now.getMonth()+1,MK=Y+'-'+pad(M),TODAY=MK+'-'+pad(now.getDate());
const mkShift=k=>{const d=new Date(Y,M-1+k,1);return d.getFullYear()+'-'+pad(d.getMonth()+1);};
const lastDay=mk=>new Date(+mk.slice(0,4),+mk.slice(5,7),0).getDate();

function seed(sh){
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  sh.store.set(P_BETA+'categories/rent',{name:'דיור',icon:'🏠',type:'expense',color:'#888888',ord:1});
  sh.store.set(P_BETA+'categories/shop',{name:'קניות',icon:'🛍️',type:'expense',color:'#888888',ord:2});
  sh.store.set(P_BETA+'categories/sal',{name:'משכורת',icon:'💼',type:'income',color:'#888888',ord:3});
  sh.store.set(P_BETA+'assets/c1',{name:'עו"ש',category:'checking',value:10000,updatedAt:1});
  sh.store.set(P_BETA+'assets/g1',{name:'גמל',category:'gemel',value:0,updatedAt:1});
  sh.store.set(P_BETA+'liabilities/cc',{name:'ויזה',category:'credit',value:0,updatedAt:1});
}
const val=(sh,p)=>sh.store.get(P_BETA+p).value;
const tx=(sh,id)=>sh.store.get(P_BETA+'tx/'+id);
// מחכים לתנאי (עד 3 שניות) במקום זמן קבוע: הפעלה ראשונה של jsdom איטית
const waitFor=async(fn,ms=3000)=>{const end=Date.now()+ms;while(Date.now()<end){try{if(fn())return true;}catch(e){}await sleep(20);}return false;};
const r2s=v=>Math.round(v*100)/100;
const recs=sh=>keys(sh,P_BETA+'recurring/').map(k=>Object.assign({id:k.split('/').pop()},sh.store.get(k)));

module.exports=async t=>{
  // ---- catch-up: template from 3 months ago on day 1 → 4 transactions (3 past months + this month) ----
  const sh=makeShared();seed(sh);
  sh.store.set(P_BETA+'recurring/rent',{type:'expense',amount:4000,categoryId:'rent',catName:'דיור',note:'שכירות',accountId:'c1',day:1,startMonth:mkShift(-3),lastMonth:null,paused:false,createdAt:1});
  // a template whose day this month has not come yet (day = tomorrow if possible) → expected, not created
  const tomorrow=now.getDate()<lastDay(MK)?now.getDate()+1:null;
  if(tomorrow)sh.store.set(P_BETA+'recurring/sal',{type:'income',amount:12000,categoryId:'sal',catName:'משכורת',note:'',accountId:'c1',day:tomorrow,startMonth:MK,lastMonth:null,paused:false,createdAt:1});
  // paused template → nothing
  sh.store.set(P_BETA+'recurring/gym',{type:'expense',amount:200,categoryId:'shop',catName:'קניות',note:'חדר כושר',day:1,startMonth:mkShift(-1),lastMonth:null,paused:true,createdAt:1});
  const A=openApp(sh);
  await waitFor(()=>sh.store.get(P_BETA+'recurring/rent').lastMonth===MK&&/נוספו/.test(A.toast()));
  const {$,$$,click}=A;
  const rentIds=[-3,-2,-1,0].map(k=>'r-rent-'+mkShift(k));
  t.ok(rentIds.every(id=>tx(sh,id)),'catch-up: one transaction per month, deterministic ids (r-<template>-<month>)');
  t.ok(tx(sh,rentIds[0]).date===mkShift(-3)+'-01'&&tx(sh,rentIds[0]).recId==='rent','generated transaction has the right date and recId');
  t.ok(val(sh,'assets/c1')===10000-16000,'balance: 4 × 4,000 taken from עו"ש');
  t.ok(sh.store.get(P_BETA+'recurring/rent').lastMonth===MK,'template remembers the last generated month');
  t.ok(!keys(sh,P_BETA+'tx/').some(k=>k.includes('r-gym-')),'paused template: nothing created');
  t.ok(/נוספו 4 תנועות חוזרות/.test(A.toast()),'toast: "נוספו 4 תנועות חוזרות"');
  if(tomorrow){
    t.ok(!tx(sh,'r-sal-'+MK),'not created before its day');
    t.ok(/צפוי עוד החודש/.test($('.flow').textContent)&&/12,000/.test($('.flow').textContent),'home: "צפוי עוד החודש" shows the coming income');
  }
  // ---- second device opening: no duplicates ----
  const before=keys(sh,P_BETA+'tx/').length,bal=val(sh,'assets/c1');
  const B=openApp(sh);await waitFor(()=>B.$('#view')&&B.$('#view').children.length>0);await sleep(200);
  t.ok(keys(sh,P_BETA+'tx/').length===before&&val(sh,'assets/c1')===bal,'second device: no duplicates, balance unchanged');
  // two devices racing on a stale template: the transaction re-reads it, only one wins
  await A.fake.fs.setDoc({path:P_BETA+'recurring/race'},{type:'expense',amount:10,categoryId:'shop',catName:'קניות',note:'',accountId:'c1',day:1,startMonth:MK,lastMonth:null,paused:false,createdAt:1});
  await sleep(50);   // both apps now know the template; both try to create this month's transaction at the same moment
  A.w.document.dispatchEvent(new A.w.Event('visibilitychange'));B.w.document.dispatchEvent(new B.w.Event('visibilitychange'));
  await waitFor(()=>tx(sh,'r-race-'+MK));await sleep(200);
  t.ok(tx(sh,'r-race-'+MK)&&val(sh,'assets/c1')===bal-10,'two devices at once: created once, balance −10 once');

  // ---- generated transaction: edit/delete only that one, not re-created ----
  A.tab('tx');await sleep(30);
  click($('.tx-row[data-id="r-rent-'+MK+'"]'));await sleep(10);click($('[data-a="tx-del"]'));await sleep(40);
  A.w.document.dispatchEvent(new A.w.Event('visibilitychange'));await sleep(200);
  t.ok(!tx(sh,'r-rent-'+MK),'deleted generated transaction is not re-created ("skip this month")');

  // ---- new monthly from the add sheet ----
  const sh2=makeShared();seed(sh2);
  const C=openApp(sh2);await sleep(200);
  C.click(C.$('[data-a="fab"]'));await sleep(10);
  C.type(C.$('#f-amount'),'50');C.type(C.$('#f-note'),'ספוטיפיי');C.click(C.$('#f-cats [data-id="shop"]'));C.click(C.$('#f-accts [data-id="c1"]'));
  C.click(C.$('#f-rep [data-v="monthly"]'));
  t.ok(/כל חודש ב/.test(C.$('#f-rep-hint').textContent),'monthly hint shows the day');
  C.click(C.$('[data-a="tx-save"]'));await sleep(60);
  const r1=recs(sh2).find(r=>r.note==='ספוטיפיי');
  t.ok(r1&&r1.day===now.getDate()&&r1.startMonth===MK&&r1.lastMonth===MK,'template saved (day from the date, this month done)');
  t.ok(tx(sh2,'r-'+r1.id+'-'+MK)&&val(sh2,'assets/c1')===9950,'first transaction created now, balance −50');
  C.click(C.$('#toast .toast-undo'));await sleep(60);
  t.ok(!recs(sh2).length&&!tx(sh2,'r-'+r1.id+'-'+MK)&&val(sh2,'assets/c1')===10000,'undo: template, transaction and balance all reverted');

  // ---- installments ----
  C.click(C.$('[data-a="fab"]'));await sleep(10);
  C.type(C.$('#f-amount'),'1000');C.click(C.$('#f-cats [data-id="shop"]'));C.click(C.$('#f-accts [data-id="cc"]'));
  C.click(C.$('#f-rep [data-v="inst"]'));C.type(C.$('#f-inst'),'3');
  t.ok(/3 × ₪333\.33/.test(C.$('#f-rep-hint').textContent)&&/הראשון ₪333\.34/.test(C.$('#f-rep-hint').textContent),'hint: 3 × 333.33, first 333.34');
  C.click(C.$('[data-a="tx-save"]'));await sleep(60);
  const ri=recs(sh2).find(r=>r.count===3);
  const first=tx(sh2,'r-'+ri.id+'-'+MK);
  t.ok(ri&&ri.total===1000&&first.amount===333.34&&first.inst.i===1&&first.inst.n===3,'installments: template + payment 1 of 3 (333.34)');
  t.ok(val(sh2,'liabilities/cc')===333.34,'card debt grows by the first payment only');
  C.tab('nw');await sleep(30);
  t.ok(/מחויב לחודשים הבאים מתשלומים:\s*₪?666\.66|666\.66/.test(C.$('#view').textContent)||/667/.test(C.$('#view').textContent),'net worth screen: committed future payments (666.66), not counted');
  C.tab('tx');await sleep(30);
  t.ok(/תשלום 1 מתוך 3/.test(C.$('.tx-row[data-id="r-'+ri.id+'-'+MK+'"]').textContent),'row shows "תשלום 1 מתוך 3"');
  C.tab('settings');C.set('rec');await sleep(30);
  t.ok(/נשארו ₪?666\.66|נשארו ₪?667/.test(C.$('#view').textContent)&&!/<\/?span|&lt;/.test(C.$('#view').textContent),'settings: "נשארו" amount shown as text, no raw HTML');

  // installments with a start date 2 months ago, from the add sheet: all due payments created at once, message says where
  if(now.getDate()<=28){
    const shP=makeShared();seed(shP);
    const P=openApp(shP);await sleep(200);
    const start=mkShift(-2)+'-'+pad(now.getDate());
    P.click(P.$('[data-a="fab"]'));await sleep(10);
    P.type(P.$('#f-amount'),'900');P.click(P.$('#f-cats [data-id="shop"]'));P.click(P.$('#f-accts [data-id="cc"]'));
    P.$('#f-date').value=start;P.$('#f-date').dispatchEvent(new P.w.Event('change',{bubbles:true}));
    P.click(P.$('#f-rep [data-v="inst"]'));P.type(P.$('#f-inst'),'3');
    P.click(P.$('[data-a="tx-save"]'));await sleep(80);
    const rp=recs(shP)[0];
    const pids=[-2,-1,0].map(k=>'r-'+rp.id+'-'+mkShift(k));
    t.ok(pids.every(id=>tx(shP,id))&&tx(shP,pids[0]).date===start&&rp.lastMonth===MK,'past start: all 3 due payments created at once (also works offline)');
    t.ok(/הראשון ב/.test(P.toast())&&/נוצרו 3/.test(P.toast()),'message says where the first payment is ('+P.toast()+')');
    t.ok(val(shP,'liabilities/cc')===900,'card debt = 3 × 300');
    P.tab('tx');await sleep(30);
    P.click(P.$('.tx-row[data-id="'+pids[2]+'"]'));await sleep(10);
    t.ok(/היתרה תתחלק מחדש על התשלומים הבאים/.test(P.$('#sheet').textContent),'editing a payment: hint that the rest is redistributed');
    P.click(P.$('[data-a="sheet-close"]'));await sleep(10);
    P.click(P.$('[data-a="fab"]'));await sleep(10);P.click(P.$('[data-a="sheet-close"]'));await sleep(10);
    // undo removes all of them
    P.click(P.$('[data-a="fab"]'));await sleep(10);
    P.type(P.$('#f-amount'),'600');P.click(P.$('#f-cats [data-id="shop"]'));P.click(P.$('#f-accts [data-id="cc"]'));
    P.$('#f-date').value=start;P.$('#f-date').dispatchEvent(new P.w.Event('change',{bubbles:true}));
    P.click(P.$('#f-rep [data-v="inst"]'));P.type(P.$('#f-inst'),'2');P.click(P.$('[data-a="tx-save"]'));await sleep(80);
    const rp2=recs(shP).find(r=>r.total===600);
    P.click(P.$('#toast .toast-undo'));await sleep(80);
    t.ok(!recs(shP).some(r=>r.total===600)&&!keys(shP,P_BETA+'tx/').some(k=>k.includes('r-'+rp2.id))&&val(shP,'liabilities/cc')===900,'undo: template, all created payments and the debt reverted');
  }

  // Ido's case (b3): 2,400 in 7 from the 1st of last month → 2 payments; payment 2 edited to 500 → the rest is redistributed
  {
    const shK=makeShared();seed(shK);
    const K=openApp(shK);await sleep(200);
    K.click(K.$('[data-a="fab"]'));await sleep(10);
    K.type(K.$('#f-amount'),'2400');K.click(K.$('#f-cats [data-id="shop"]'));K.click(K.$('#f-accts [data-id="cc"]'));
    K.$('#f-date').value=mkShift(-1)+'-01';K.$('#f-date').dispatchEvent(new K.w.Event('change',{bubbles:true}));
    K.click(K.$('#f-rep [data-v="inst"]'));K.type(K.$('#f-inst'),'7');K.click(K.$('[data-a="tx-save"]'));await sleep(80);
    const rk=recs(shK)[0],p2='r-'+rk.id+'-'+MK;
    t.ok(tx(shK,'r-'+rk.id+'-'+mkShift(-1))&&tx(shK,p2)&&rk.paid===r2s(tx(shK,'r-'+rk.id+'-'+mkShift(-1)).amount+tx(shK,p2).amount),'2 of 7 created; template remembers what was paid ('+rk.paid+')');
    K.tab('tx');await sleep(30);
    K.click(K.$('.tx-row[data-id="'+p2+'"]'));await sleep(10);K.type(K.$('#f-amount'),'500');K.click(K.$('[data-a="tx-save"]'));await sleep(60);
    const paid=shK.store.get(P_BETA+'recurring/'+rk.id).paid,first=tx(shK,'r-'+rk.id+'-'+mkShift(-1)).amount;
    t.ok(Math.abs(paid-(first+500))<0.005,'edit payment 2 to 500: paid = '+first+' + 500');
    t.ok(tx(shK,p2).recId===rk.id&&tx(shK,p2).inst.i===2,'edited payment keeps its link to the template (recId, "תשלום 2 מתוך 7")');
    K.tab('settings');K.set('rec');await sleep(30);
    const left=(2400-first-500).toFixed(2);
    t.ok(K.$('#view').textContent.includes(Number(left).toLocaleString('en-US',{minimumFractionDigits:2}))||K.$('#view').textContent.includes(Math.round(+left).toLocaleString('en-US')),'settings: "נשארו" = '+left+' (2,400 − what was paid)');
    // the next payment = remaining / 5; the last one closes the cents
    const rr=Object.assign({},shK.store.get(P_BETA+'recurring/'+rk.id));
    const per=Math.floor((2400-rr.paid)/5*100)/100;
    t.ok(Math.abs(per-Math.floor((2400-first-500)/5*100)/100)<0.005&&per<342,'next payments are redistributed: '+per+' each (was ~342.85)');
    // delete payment 2 → its amount goes back to "left"
    K.tab('tx');await sleep(30);K.click(K.$('.tx-row[data-id="'+p2+'"]'));await sleep(10);K.click(K.$('[data-a="tx-del"]'));await sleep(60);
    t.ok(Math.abs(shK.store.get(P_BETA+'recurring/'+rk.id).paid-first)<0.005,'delete a payment: paid goes down, the rest is spread on the next payments');
    K.click(K.$('#toast .toast-undo'));await sleep(60);
    t.ok(Math.abs(shK.store.get(P_BETA+'recurring/'+rk.id).paid-(first+500))<0.005,'undo delete: paid back');
  }
  // generation uses the redistributed amount; last payment closes the cents; old templates get "paid" from their payments
  {
    const shL=makeShared();seed(shL);
    // old template (no paid), started 6 months ago, 7 payments of 2,400; one payment already created with 500
    shL.store.set(P_BETA+'recurring/old',{type:'expense',amount:342.85,total:2400,count:7,categoryId:'shop',catName:'קניות',note:'',accountId:'cc',day:1,startMonth:mkShift(-6),lastMonth:mkShift(-6),paused:false,createdAt:1});
    shL.store.set(P_BETA+'tx/r-old-'+mkShift(-6),{type:'expense',amount:500,categoryId:'shop',catName:'קניות',date:mkShift(-6)+'-01',note:'',createdAt:1,recId:'old',inst:{i:1,n:7},accountId:'cc'});
    openApp(shL);
    await waitFor(()=>shL.store.get(P_BETA+'recurring/old').lastMonth===MK);
    const amts=[-5,-4,-3,-2,-1,0].map(k=>tx(shL,'r-old-'+mkShift(k)).amount);
    const sum=r2s(500+amts.reduce((a,b)=>a+b,0));
    t.ok(amts[0]===Math.floor(1900/6*100)/100,'old template: "paid" taken from its payments (500), next = 1,900 / 6 = '+amts[0]);
    t.ok(sum===2400&&shL.store.get(P_BETA+'recurring/old').paid===2400,'all 7 payments add up to exactly 2,400 (the last closes the cents)');
  }

  // installments started 4 months ago with 3 payments → stops after the 3rd
  const sh3=makeShared();seed(sh3);
  sh3.store.set(P_BETA+'recurring/tv',{type:'expense',amount:333.33,total:1000,count:3,categoryId:'shop',catName:'קניות',note:'טלוויזיה',accountId:'cc',day:1,startMonth:mkShift(-4),lastMonth:null,paused:false,createdAt:1});
  const E=openApp(sh3);await waitFor(()=>keys(sh3,P_BETA+'tx/').filter(k=>k.includes('r-tv-')).length>=3);await sleep(100);
  const tv=keys(sh3,P_BETA+'tx/').filter(k=>k.includes('r-tv-'));
  t.ok(tv.length===3&&!tx(sh3,'r-tv-'+mkShift(-1)),'installments stop after the last payment (3 of 3)');
  t.ok(Math.round(val(sh3,'liabilities/cc')*100)===100000,'card debt = full 1,000 after 3 payments');
  E.tab('settings');E.set('rec');await sleep(30);
  t.ok(/הסתיים/.test(E.$('#view').textContent),'settings: finished installments marked "הסתיים"');
  t.ok(!/<\/?span|&lt;/.test(E.$('#view').textContent),'settings: no raw HTML in the status lines');

  // ---- day 31 in a short month ----
  const sh4=makeShared();seed(sh4);
  sh4.store.set(P_BETA+'recurring/eom',{type:'expense',amount:1,categoryId:'shop',catName:'קניות',note:'',day:31,startMonth:mkShift(-3),lastMonth:null,paused:false,createdAt:1});
  openApp(sh4);await waitFor(()=>keys(sh4,P_BETA+'tx/').filter(k=>k.includes('r-eom-')).length>=3);
  const eom=keys(sh4,P_BETA+'tx/').filter(k=>k.includes('r-eom-')).map(k=>sh4.store.get(k).date);
  t.ok(eom.length>=3&&eom.every(d=>+d.slice(8)===Math.min(31,lastDay(d.slice(0,7)))),'day 31 → last day of short months ('+eom.join(', ')+')');

  // ---- settings: edit / pause / delete ----
  A.tab('settings');A.set('rec');await sleep(30);
  t.ok(A.$('#top-title').textContent==='תנועות חוזרות'&&A.$('[data-a="rec-edit"][data-id="rent"]'),'settings lists the templates');
  t.ok(!/<\/?span|&lt;/.test(A.$('#view').textContent),'settings: status lines are plain text (no raw HTML)');
  click($('[data-a="rec-edit"][data-id="rent"]'));await sleep(10);
  A.type($('#r-amount'),'4200');A.type($('#r-day'),'5');click($('[data-a="rec-save"]'));await sleep(40);
  const rr=sh.store.get(P_BETA+'recurring/rent');
  t.ok(rr.amount===4200&&rr.day===5&&tx(sh,'r-rent-'+mkShift(-1)).amount===4000,'edit template: future only, past transactions unchanged');
  click($('#toast .toast-undo'));await sleep(40);
  t.ok(sh.store.get(P_BETA+'recurring/rent').amount===4000,'undo template edit');
  click($('[data-a="rec-edit"][data-id="rent"]'));await sleep(10);click($('[data-a="rec-pause"]'));await sleep(40);
  t.ok(sh.store.get(P_BETA+'recurring/rent').paused===true,'pause');
  click($('[data-a="rec-edit"][data-id="rent"]'));await sleep(10);click($('[data-a="rec-del"]'));await sleep(40);
  t.ok(!sh.store.has(P_BETA+'recurring/rent')&&tx(sh,'r-rent-'+mkShift(-1)),'delete template: generated transactions stay');
  click($('#toast .toast-undo'));await sleep(40);
  t.ok(sh.store.has(P_BETA+'recurring/rent'),'undo delete');

  // ---- export/import, delete-all include templates ----
  const shI=makeShared();shI.store.set(P_BETA+'meta/profile',{seeded:true});
  const I=openApp(shI);await sleep(200);
  await I.importText(JSON.stringify({app:'personal-finance-dashboard',version:2,tx:{categories:[],transactions:[]},nw:{assets:[],liabilities:[],history:[]},
    rec:[{id:'imp',type:'expense',amount:99,categoryId:null,catName:'',note:'מנוי',day:2,startMonth:MK,lastMonth:MK,paused:false,createdAt:1}]}));
  if(I.sheetOpen()){I.click(I.$('[data-a="import-go"]'));await sleep(200);}
  t.ok(shI.store.get(P_BETA+'recurring/imp')&&shI.store.get(P_BETA+'recurring/imp').note==='מנוי','import adds templates');
  I.tab('settings');await sleep(20);I.click(I.$('[data-a="reset"]'));await I.confirm();await sleep(200);
  t.ok(!keys(shI,P_BETA+'recurring/').length,'"delete all data" removes templates');

  t.ok(A.errors.length===0&&C.errors.length===0,'no script errors'+(A.errors[0]?': '+A.errors[0]:C.errors[0]?': '+C.errors[0]:''));
};
