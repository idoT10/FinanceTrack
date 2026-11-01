// Production and beta run the same file; beta must never touch production data.
const {openApp,makeShared,sleep,keys,appVersion,P_BETA}=require('./lib/harness');
module.exports=async t=>{
  const sh=makeShared();
  const prodOnly=()=>JSON.stringify([...sh.store.entries()].filter(([k])=>!k.includes('/beta/')).sort());
  const P=openApp(sh,{path:'/FinanceTrack/'});await sleep(150);
  t.ok(keys(sh,'users/u1/categories/').length===8&&sh.store.has('users/u1/meta/profile'),'prod: new account seeded with 8 default categories');
  t.ok(!P.$('.beta-bar'),'prod: no beta bar');
  await P.addExpense(45);await P.addExpense(60);
  t.ok(keys(sh,'users/u1/tx/').length===2,'prod: transactions stored under users/<uid>/tx');
  const before=prodOnly();
  const B=openApp(sh);await sleep(150);
  t.ok(!!B.$('.beta-bar')&&B.d.body.classList.contains('beta'),'beta: orange bar');
  t.ok(keys(sh,P_BETA+'categories/').length===8,'beta: seeded its own categories');
  await B.addExpense(99);
  t.ok(keys(sh,P_BETA+'tx/').length===1&&prodOnly()===before,'beta: writes only under users/<uid>/beta/main');
  P.tab('settings');B.tab('settings');
  t.ok(!P.$('[data-a="beta-copy"]')&&!!B.$('[data-a="beta-copy"]'),'beta tools exist only in beta');
  const v=appVersion();
  t.ok(P.$('#view').textContent.includes('גרסה '+v)&&B.$('.beta-bar').textContent.includes(v),'version label "'+v+'" shown in settings and beta bar');
  t.ok(!P.errors.length&&!B.errors.length,'no script errors');
};
