// iOS opens the share sheet only from a direct tap: prepare first, then "שמירת הקובץ" must call share() synchronously.
const {openApp,makeShared,sleep}=require('./lib/harness');
module.exports=async t=>{
  const shares=[];
  const sh=makeShared();
  sh.store.set('users/u1/beta/main/tx/a',{type:'expense',amount:5,categoryId:null,catName:'',date:'2026-10-01',note:'',createdAt:1});
  const A=openApp(sh,{beforeParse(w){w.navigator.canShare=()=>true;
    w.navigator.share=d=>{shares.push({sync:w.__inClick,name:d.files[0].name});return w.__inClick?Promise.resolve():Promise.reject(Object.assign(new Error('NotAllowed'),{name:'NotAllowedError'}));};}});
  await sleep(150);A.tab('settings');
  A.click(A.$$('[data-a="bk"]')[0]);
  t.ok(shares.length===0,'share is not called after waiting for the server');
  await sleep(200);
  t.ok(A.sheetOpen()&&/הגיבוי מוכן/.test(A.$('#sheet').textContent),'sheet "הגיבוי מוכן"');
  A.click(A.$('[data-a="bk-save"]'));
  t.ok(shares.length===1&&shares[0].sync,'share called inside the tap');
  t.ok(/^finance-backup-\d{4}-\d{2}-\d{2}\.json$/.test(shares[0].name),'file name '+shares[0].name);
  await sleep(30);
  t.ok(!A.sheetOpen()&&/הגיבוי נשמר/.test(A.toast()),'toast "הגיבוי נשמר"');
  A.fake.fs.getDocsFromServer=async()=>{throw new Error('offline');};
  A.click(A.$$('[data-a="bk"]')[0]);await sleep(100);
  t.ok(/אין חיבור לאינטרנט/.test(A.toast())&&!A.sheetOpen(),'offline: clear message, no sheet');
};
