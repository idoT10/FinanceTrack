// Smart import: adds only what's missing, existing data always wins, confirmation only if the account has real data.
const {openApp,makeShared,sleep,keys,maxBatch,P_BETA:P}=require('./lib/harness');
const backup=JSON.stringify({app:'personal-finance-dashboard',version:2,tx:{
  categories:[{id:'B_super',name:'סופר',icon:'🛒',type:'expense',color:'#4E9A5F'},{id:'B_salary',name:'משכורת',icon:'💼',type:'income',color:'#2A98A8'},{id:'B_gym',name:'חדר כושר',icon:'🏋️',type:'expense',color:'#3F6FB5'}],
  transactions:[
    {id:'bt1',type:'expense',amount:14,categoryId:'B_super',catName:'סופר',date:'2026-10-02',note:'קפה',createdAt:1},
    {id:'bt2',type:'expense',amount:14,categoryId:'B_super',catName:'סופר',date:'2026-10-02',note:'קפה',createdAt:2},
    {id:'bt3',type:'expense',amount:200,categoryId:'B_gym',catName:'חדר כושר',date:'2026-10-03',note:'',createdAt:3},
    {id:'bt4',type:'income',amount:9000,categoryId:'B_salary',catName:'משכורת',date:'2026-10-01',note:'',createdAt:4}]},
  nw:{assets:[{id:'ba1',name:'עו"ש',category:'cash',value:5000,updatedAt:1},{id:'ba2',name:'גמל',category:'gemel',value:20000,updatedAt:1}],liabilities:[],
      history:[{t:1759300000000,a:25000,l:0,n:25000,note:''}]}});
module.exports=async t=>{
  let sh=makeShared(),A=openApp(sh);await sleep(150);A.tab('settings');
  await A.importText(backup);
  t.ok(!A.sheetOpen()&&keys(sh,P+'tx/').length===4,'fresh account: imported immediately (4 transactions)');
  const cats=keys(sh,P+'categories/').map(k=>sh.store.get(k));
  t.ok(cats.length===9&&cats.filter(c=>c.name==='סופר').length===1,'default categories linked, no duplicate "סופר"');
  t.ok(maxBatch(sh)<=10,'batches ≤10');
  await A.importText(backup);
  t.ok(/כבר קיים/.test(A.toast())&&keys(sh,P+'tx/').length===4,'same file again: nothing added');

  sh=makeShared();
  sh.store.set(P+'meta/profile',{seeded:true});
  [['c_super','סופר','expense'],['c_sal','משכורת','income']].forEach(([id,name,type],i)=>sh.store.set(P+'categories/'+id,{name,icon:'🏷️',type,color:'#888888',ord:i}));
  sh.store.set(P+'tx/bt4',{type:'income',amount:9500,categoryId:'c_sal',catName:'משכורת',date:'2026-10-01',note:'',createdAt:4});
  sh.store.set(P+'tx/mine1',{type:'expense',amount:14,categoryId:'c_super',catName:'סופר',date:'2026-10-02',note:'  קפה ',createdAt:9});
  sh.store.set(P+'assets/x1',{name:'עו"ש',category:'cash',value:7777,updatedAt:5});
  A=openApp(sh);await sleep(150);A.tab('settings');
  await A.importText(backup);
  const txt=A.$('#sheet').textContent.replace(/\s+/g,' ');
  t.ok(A.sheetOpen()&&/בחשבון כבר יש נתונים/.test(txt),'account with data: warning + confirmation');
  t.ok(/תנועות ?2 חדשים · 2 קיימים/.test(txt)&&/קטגוריות ?1 חדשים · 2 קיימים/.test(txt),'summary counts are right');
  t.ok(keys(sh,P+'tx/').length===2,'nothing written before confirming');
  A.click(A.$('[data-a="import-go"]'));await sleep(250);
  t.ok(keys(sh,P+'tx/').length===4,'after confirm: one coffee + gym added');
  t.ok(sh.store.get(P+'tx/bt4').amount===9500&&sh.store.get(P+'assets/x1').value===7777,'existing values kept (existing wins)');

  sh=makeShared();sh.store.set(P+'meta/profile',{seeded:true});
  sh.store.set(P+'tx/m',{type:'expense',amount:1,categoryId:null,catName:'',date:'2026-10-05',note:'',createdAt:1});
  A=openApp(sh);await sleep(150);A.tab('settings');await A.importText(backup);
  const n=sh.store.size;A.click(A.$('#sheet [data-a="sheet-close"]'));await sleep(80);
  t.ok(sh.store.size===n,'cancel writes nothing');
};
