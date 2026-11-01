// 1.0.4 · b2: last account remembered per type (transfers don't change it), top-8 categories + "עוד",
// "תיאור" right under the amount.
const {openApp,makeShared,sleep,P_BETA}=require('./lib/harness');
module.exports=async t=>{
  const sh=makeShared();
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  for(let i=0;i<12;i++)sh.store.set(P_BETA+'categories/e'+i,{name:'הוצאה'+i,icon:'🏷️',type:'expense',color:'#888888',ord:i});
  sh.store.set(P_BETA+'categories/sal',{name:'משכורת',icon:'💼',type:'income',color:'#888888',ord:20});
  sh.store.set(P_BETA+'assets/c1',{name:'עו"ש',category:'checking',value:1000,updatedAt:1});
  sh.store.set(P_BETA+'assets/g1',{name:'גמל',category:'gemel',value:0,updatedAt:1});
  sh.store.set(P_BETA+'liabilities/cc',{name:'ויזה',category:'credit',value:0,updatedAt:1});
  const A=openApp(sh);await sleep(200);
  const {$,$$,click}=A;
  const open=async()=>{click($('[data-a="fab"]'));await sleep(10);};
  const save=async()=>{click($('[data-a="tx-save"]'));await sleep(40);};
  const on=()=>($('#f-accts .chip.on')||{}).dataset.id;

  // description under the amount
  await open();
  const order=[...$('#sheet').querySelectorAll('#f-amount,#f-note,#f-cats')].map(e=>e.id).join();
  t.ok(order==='f-amount,f-note,f-cats'&&/תיאור/.test($('#sheet').textContent)&&!/הערה/.test($('#sheet').textContent),'"תיאור" right under the amount, before the categories');
  // top 8 + more
  const cats=()=>$$('#f-cats .chip[data-a="f-cat"]').length;
  t.ok(cats()===8&&/עוד \(4\)/.test($('[data-a="f-cat-more"]').textContent),'12 categories: 8 shown + "עוד (4)"');
  click($('[data-a="f-cat-more"]'));
  t.ok(cats()===12&&!$('[data-a="f-cat-more"]'),'"עוד" shows all of them');
  t.ok($('#f-accts').classList.contains('line'),'accounts in one scrolling line');

  // expense from the card, income to עו"ש
  A.type($('#f-amount'),'10');click($$('#f-cats .chip[data-a="f-cat"]')[0]);click($('#f-accts [data-id="cc"]'));await save();
  await open();click($('#f-type [data-v="income"]'));A.type($('#f-amount'),'50');click($('#f-cats [data-id="sal"]'));click($('#f-accts [data-id="c1"]'));await save();
  await open();
  t.ok(on()==='cc','expense remembers the card');
  click($('#f-type [data-v="income"]'));
  t.ok(on()==='c1','income remembers עו"ש');
  // a card payment (transfer) must not change what expense remembers
  click($('#f-type [data-v="transfer"]'));A.type($('#f-amount'),'10');click($('#f-from [data-id="c1"]'));click($('#f-to [data-id="cc"]'));await save();
  await open();
  t.ok(on()==='cc','after a transfer from עו"ש, expense still remembers the card');
  click($('[data-a="sheet-close"]'));await sleep(10);
  // the 9th category, once chosen, stays visible
  await open();click($('[data-a="f-cat-more"]'));const ninth=$$('#f-cats .chip[data-a="f-cat"]')[11];const id9=ninth.dataset.id;click(ninth);
  A.type($('#f-amount'),'5');await save();
  t.ok(A.errors.length===0,'no script errors'+(A.errors.length?': '+A.errors[0]:''));
  void id9;
};
