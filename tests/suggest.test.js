// 1.0.7 · b2: category (and account) suggestion by description, and description completion, in the add sheet.
// Memory is per device (localStorage, per environment and user); the first time it learns from all transactions (one read).
const {openApp,makeShared,sleep,P_BETA}=require('./lib/harness');
const waitFor=async(fn,ms=3000)=>{const t0=Date.now();while(Date.now()-t0<ms){if(fn())return true;await sleep(20);}return false;};
module.exports=async t=>{
  const sh=makeShared();
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  const cat=(id,name,type,ord)=>sh.store.set(P_BETA+'categories/'+id,{name,icon:'🏷️',type,color:'#888888',ord});
  cat('food','אוכל','expense',1);cat('fuel','רכב','expense',2);cat('fun','פנאי','expense',3);cat('sal','משכורת','income',4);
  sh.store.set(P_BETA+'assets/c1',{name:'עו"ש',category:'checking',value:1000,updatedAt:1});
  sh.store.set(P_BETA+'liabilities/cc',{name:'ויזה',category:'credit',value:0,updatedAt:1});
  const tx=(id,c,note,createdAt,extra)=>sh.store.set(P_BETA+'tx/'+id,Object.assign({type:'expense',amount:50,categoryId:c,catName:'',date:'2025-01-0'+createdAt,note,createdAt},extra||{}));
  tx('t1','fuel','דלק פז',1,{accountId:'cc'});
  tx('t2','food','סופר שופרסל',2,{accountId:'c1'});
  tx('t3','food','קפה',3);
  tx('t4','fun','קפה',4);           // later choice for the same description wins
  tx('t5','sal','משכורת',5,{type:'income'});
  let reads=0;
  const A=openApp(sh,{beforeParse(w){const fs=w.__FAKE.fs,real=fs.getDocsFromServer.bind(fs);fs.getDocsFromServer=(...a)=>{reads++;return real(...a);};}});
  await sleep(250);
  const {$,$$,click}=A;
  const open=async()=>{click($('[data-a="fab"]'));await sleep(10);};
  const close=async()=>{click($('#sheet [data-a="sheet-close"]'));await sleep(10);};
  const note=async v=>{A.type($('#f-note'),v);await sleep(5);};
  const catOn=()=>($('#f-cats .chip.on')||{dataset:{}}).dataset.id;
  const acctOn=()=>($('#f-accts .chip.on')||{dataset:{}}).dataset.id;
  const mem=()=>{try{return JSON.parse(A.w.localStorage.getItem('fin-sugg-beta'));}catch(e){return null;}};

  await open();
  t.ok(await waitFor(()=>mem()&&mem().learned),'first open of the add sheet learns from all transactions');
  t.ok(reads===1,'…with one read');

  await note('דלק פז');
  t.ok(catOn()==='fuel'&&!$('#f-cat-sugg').hidden&&/הוצעה לפי הוצאות קודמות/.test($('#f-cat-sugg').textContent),'same description: category selected, with "הוצעה לפי הוצאות קודמות"');
  t.ok(acctOn()==='cc'&&!$('#f-acct-sugg').hidden,'same description: its account is suggested too');
  await note('דל');
  t.ok(catOn()==='fuel'&&acctOn()!=='cc'&&$('#f-acct-sugg').hidden,'start of a known description: category only, account back to the default');
  await note('ד');
  t.ok(!catOn()&&$('#f-cat-sugg').hidden,'one letter: no suggestion, the suggested category is cleared');
  await note('תדלוק פז');
  t.ok(catOn()==='fuel','a shared word suggests too');
  await note('משהו אחר לגמרי');
  t.ok(!catOn(),'no match: nothing selected');
  await note('קפה');
  t.ok(catOn()==='fun','the latest choice for a description wins (a correction is remembered)');

  // manual choice wins and stops suggestions in this sheet
  click($('#f-cats [data-id="food"]'));await note('דלק פז');
  t.ok(catOn()==='food'&&$('#f-cat-sugg').hidden,'a manual category choice is not overridden');
  t.ok(acctOn()==='cc','…but the account is still suggested');
  click($('#f-accts [data-id="c1"]'));await note('קפה');await note('דלק פז');
  t.ok(acctOn()==='c1'&&$('#f-acct-sugg').hidden,'a manual account choice is not overridden');

  // income is separate
  click($('#f-type [data-v="income"]'));await sleep(5);
  await note('דלק פז');
  t.ok(!catOn(),'income does not use expense descriptions');
  await note('משכורת');
  t.ok(catOn()==='sal'&&/הכנסות קודמות/.test($('#f-cat-sugg').textContent),'income descriptions suggest income categories');
  await close();

  // description completion
  await open();
  await note('סו');
  const chips=$$('#f-desc-sugg .chip');
  t.ok(!$('#f-desc-sugg').hidden&&chips.length===1&&/סופר שופרסל/.test(chips[0].textContent),'typing shows matching earlier descriptions');
  // b3: typing again with the same result does not replace the chip under the finger, and pressing it keeps the keyboard
  await note('סו');
  t.ok($$('#f-desc-sugg .chip')[0]===chips[0],'the same suggestions are not re-rendered (the chip being tapped stays)');
  const md=new A.w.MouseEvent('mousedown',{bubbles:true,cancelable:true});chips[0].dispatchEvent(md);
  t.ok(md.defaultPrevented,'pressing a suggested description does not take focus from the field');
  click(chips[0]);await sleep(5);
  t.ok($('#f-note').value==='סופר שופרסל'&&catOn()==='food'&&acctOn()==='c1'&&$('#f-desc-sugg').hidden,'tapping fills the description, category and account');
  t.ok($('#f-amount').value==='','…not the amount');
  t.ok(A.d.activeElement!==$('#f-note')&&$('#f-note').classList.contains('flash')&&$('#f-cats .chip.on').classList.contains('flash'),'b4: after the tap the keyboard closes, and the field and category flash');
  // b4: the iPhone keyboard finishing its word writes the typed text back ("סו") right after the tap
  await sleep(1100);   // after the 1-second guard of the previous pick
  await note('סו');click($$('#f-desc-sugg .chip')[0]);A.type($('#f-note'),'סו');await sleep(200);
  t.ok($('#f-note').value==='סופר שופרסל'&&$('#f-desc-sugg').hidden,'b4: the picked description survives the keyboard writing back the typed letters');
  // b5: a late write-back (after the rechecks) inside the first second is undone on the spot
  await sleep(1100);
  await note('סו');click($$('#f-desc-sugg .chip')[0]);await sleep(500);A.type($('#f-note'),'סו');await sleep(5);
  t.ok($('#f-note').value==='סופר שופרסל','b5: a late write-back by the keyboard is undone');
  // b5: the tap is handled on touchend, without waiting for a click
  await sleep(600);await note('סו');
  const chip=$$('#f-desc-sugg .chip')[0],T=(type,x)=>{const ev=new A.w.Event(type,{bubbles:true,cancelable:true});ev.touches=type==='touchend'?[]:[{clientX:x,clientY:5}];ev.changedTouches=[{clientX:x,clientY:5}];chip.dispatchEvent(ev);return ev;};
  T('touchstart',10);const te=T('touchend',12);
  t.ok($('#f-note').value==='סופר שופרסל'&&te.defaultPrevented,'b5: lifting the finger on a suggestion picks it (no click needed)');
  await sleep(1100);await note('סו');const chip2=$$('#f-desc-sugg .chip')[0];
  const T2=(type,x)=>{const ev=new A.w.Event(type,{bubbles:true,cancelable:true});ev.touches=[{clientX:x,clientY:5}];ev.changedTouches=[{clientX:x,clientY:5}];chip2.dispatchEvent(ev);};
  T2('touchstart',10);T2('touchend',60);
  t.ok($('#f-note').value==='סו','b5: a horizontal scroll over the suggestions does not pick');
  t.ok(!$('#f-dbg').hidden&&/touchend/.test($('#f-dbg').textContent),'b5: the beta shows a small log of what happened');
  await close();

  // saving teaches
  await open();
  A.type($('#f-amount'),'80');await note('מספרה');
  t.ok(!catOn(),'unknown description: nothing yet');
  click($('#f-cats [data-id="fun"]'));click($('[data-a="tx-save"]'));await sleep(60);
  await open();await note('מספרה');
  t.ok(catOn()==='fun','a saved description is suggested next time');
  t.ok(reads===1,'no more reads after the first time');
  await close();

  // editing has no suggestions
  const key=[...sh.store.keys()].find(k=>k.startsWith(P_BETA+'tx/')&&sh.store.get(k).note==='מספרה');
  const id=key&&key.split('/').pop();
  A.tab('tx');await sleep(20);
  const row=id&&$('[data-a="tx-edit"][data-id="'+id+'"]');
  if(row){
    click(row);await sleep(10);
    t.ok(!$('#f-desc-sugg'),'edit sheet: no description completion');
    await note('דלק פז');
    t.ok(catOn()==='fun','edit sheet: typing does not change the category');
    await close();
  }else t.ok(false,'edit sheet: row found');

  // no errors on the page
  t.ok(A.errors.length===0,'no page errors'+(A.errors.length?': '+A.errors[0]:''));
};
