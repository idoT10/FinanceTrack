// Imports tests/fixtures/finance-backup-demo.json (6 months of realistic data) and checks the main screens.
const fs=require('fs'),path=require('path');
const {openApp,makeShared,sleep,keys,maxBatch,P_BETA:P}=require('./lib/harness');
module.exports=async t=>{
  const text=fs.readFileSync(path.join(__dirname,'fixtures','finance-backup-demo.json'),'utf8'),B=JSON.parse(text);
  const sh=makeShared(),A=openApp(sh);await sleep(150);
  A.tab('settings');await A.importText(text);await sleep(300);
  t.ok(keys(sh,P+'tx/').length===B.tx.transactions.length,'all '+B.tx.transactions.length+' transactions imported');
  t.ok(keys(sh,P+'history/').length===B.nw.history.length&&keys(sh,P+'assets/').length===B.nw.assets.length,'assets and history imported');
  t.ok(maxBatch(sh)<=10,'batches ≤10');
  A.tab('tx');for(let i=0;i<3;i++)A.click(A.$$('[data-a="month"]')[0]);await sleep(150);
  t.ok(A.$$('.tx-row').length>20,'an older month loads on demand ('+A.$('.mname').textContent.trim()+': '+A.$$('.tx-row').length+' rows)');
  A.tab('nw');await sleep(50);
  t.ok(/לא עודכן מעל חודש/.test(A.$('#view').textContent),'stale items are marked');
  t.ok(!A.errors.length,'no script errors');
};
