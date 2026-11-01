// Copy/wipe in beta, batch size limit (security rules allow ≤20 access calls per batch), bulk update, reconnect.
const {openApp,makeShared,sleep,keys,maxBatch,P_BETA}=require('./lib/harness');
module.exports=async t=>{
  const sh=makeShared();
  sh.store.set('users/u1/meta/profile',{seeded:true});
  for(let i=0;i<9;i++)sh.store.set('users/u1/categories/c'+i,{name:'cat'+i,icon:'🏷️',type:'expense',color:'#888888',ord:i});
  for(let i=0;i<12;i++)sh.store.set('users/u1/tx/t'+i,{type:'expense',amount:10+i,categoryId:'c0',catName:'cat0',date:'2026-10-0'+(1+i%7),note:'',createdAt:i});
  for(let i=0;i<3;i++){sh.store.set('users/u1/assets/a'+i,{name:'a'+i,category:'cash',value:1000,updatedAt:1});sh.store.set('users/u1/history/'+(100+i),{t:100+i,a:3000,l:0,n:3000,note:''});}
  const prodTx=keys(sh,'users/u1/tx/').length;
  const B=openApp(sh);await sleep(150);
  B.tab('settings');B.click(B.$('[data-a="beta-copy"]'));await B.confirm();await sleep(200);
  t.ok(/הועתקו 28/.test(B.toast()),'copy: all 28 production documents copied ('+B.toast()+')');
  t.ok(keys(sh,P_BETA+'tx/').length===12&&keys(sh,P_BETA+'assets/').length===3,'copy: transactions and assets present in beta');
  t.ok(maxBatch(sh)<=10,'every batch ≤10 writes (largest: '+maxBatch(sh)+')');
  t.ok(B.$('#gate').classList.contains('hidden'),'no false "no access" screen');
  B.tab('nw');B.click(B.$('[data-a="nw-bulk"]'));B.$$('.bulk-in')[0].value='2000';B.click(B.$('[data-a="bulk-save"]'));await sleep(100);
  t.ok(keys(sh,P_BETA+'assets/').map(k=>sh.store.get(k).value).includes(2000),'bulk update saved');
  B.tab('settings');B.click(B.$('[data-a="reset"]'));await B.confirm();await sleep(200);
  t.ok(keys(sh,P_BETA+'tx/').length===0&&keys(sh,'users/u1/tx/').length===prodTx,'reset in beta clears beta only');
  B.click(B.$('[data-a="beta-wipe"]'));await B.confirm();await sleep(200);
  t.ok(keys(sh,P_BETA+'assets/').length===0&&keys(sh,P_BETA+'categories/').length===8,'wipe clears beta and re-seeds default categories');
  // a write that never gets acknowledged
  let release;B.fake.fs.setDoc=()=>new Promise(r=>{release=r;});
  B.tab('home');await B.addExpense(32);await sleep(5300);
  t.ok(B.$('#sync').textContent==='ממתין לסנכרון','stuck write → chip "ממתין לסנכרון"');
  B.click(B.$('#sync'));await sleep(30);
  t.ok(sh.log.some(x=>x[0]==='disableNetwork')&&sh.log.some(x=>x[0]==='enableNetwork'),'tap on chip reconnects');
  release();await sleep(80);
  t.ok(B.$('#sync').textContent==='הכול מסונכרן','acknowledged → "הכול מסונכרן"');
};
