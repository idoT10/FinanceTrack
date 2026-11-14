// R4 (1.0.7): monthly budget per expense category. The budget is stored with the month it starts from
// (categories/{id}.budgets = {'YYYY-MM': amount}), so changing it does not rewrite earlier months.
const {openApp,makeShared,sleep,keys,P_BETA}=require('./lib/harness');
const pad=n=>String(n).padStart(2,'0');
const now=new Date(),MK=now.getFullYear()+'-'+pad(now.getMonth()+1),D1=MK+'-01';
const pd=new Date(now.getFullYear(),now.getMonth()-1,1),PREV=pd.getFullYear()+'-'+pad(pd.getMonth()+1);
const cat=(sh,id)=>sh.store.get(P_BETA+'categories/'+id);
function seed(sh,withBudgets=true){
  sh.store.set(P_BETA+'meta/profile',{seeded:true});
  const b=x=>withBudgets?{budgets:x}:{};
  sh.store.set(P_BETA+'categories/food',Object.assign({name:'אוכל',icon:'🍔',type:'expense',color:'#888888',ord:1},b({[MK]:800})));
  sh.store.set(P_BETA+'categories/home',Object.assign({name:'דיור',icon:'🏠',type:'expense',color:'#888888',ord:2},b({[PREV]:500,[MK]:1000})));
  sh.store.set(P_BETA+'categories/fun',{name:'פנאי',icon:'🎬',type:'expense',color:'#888888',ord:3});
  sh.store.set(P_BETA+'categories/sal',{name:'משכורת',icon:'💼',type:'income',color:'#888888',ord:4});
  sh.store.set(P_BETA+'assets/c1',{name:'עו"ש',category:'checking',value:5000,updatedAt:1});
  sh.store.set(P_BETA+'liabilities/cc',{name:'ויזה',category:'credit',value:1234.5,updatedAt:1});
  const tx=(id,c,amount,date)=>sh.store.set(P_BETA+'tx/'+id,{type:'expense',amount,categoryId:c,catName:'',date,note:'',createdAt:1});
  tx('t1','food',640,D1);tx('t2','fun',100,D1);tx('t3','home',300,D1);tx('t4','home',450,PREV+'-15');
}
module.exports=async t=>{
  const sh=makeShared();seed(sh);
  const A=openApp(sh);await sleep(250);
  const $=A.$,$$=A.$$,click=A.click;
  const row=id=>$('#budget-card .bg-row[data-cat="'+id+'"]');
  const undo=async()=>{click($('#toast .toast-undo'));await sleep(40);};

  // ---- home: the budget card replaces "לאן הלך הכסף החודש" ----
  t.ok($('#budget-card')&&!/לאן הלך הכסף/.test($('#view').textContent),'home shows the budget card instead of the top categories');
  t.ok(/₪640/.test(row('food').textContent)&&/מתוך ₪800/.test(row('food').textContent)&&/נשארו ₪160/.test(row('food').textContent),'a row per budgeted category: used, budget, what is left');
  t.ok(row('food').querySelector('.bg-track i.wn')&&row('home').querySelector('.bg-track i.ok'),'80% used is orange, 30% is green');
  t.ok(/₪940/.test($('.bg-sum').textContent)&&/מתוך ₪1,800/.test($('.bg-sum').textContent),'the total is the sum of the category budgets');
  t.ok(/בלי תקציב: ₪100 בקטגוריה אחת/.test($('#budget-card').textContent)&&!row('fun'),'spending without a budget is one line');

  // ---- add sheet: what is left, and a message when this expense crosses the budget ----
  click($('[data-a="fab"]'));await sleep(10);
  click($('#f-cats [data-id="food"]'));
  t.ok(/נשארו ₪160 מתוך ₪800 החודש/.test($('#f-budget-hint').textContent),'add sheet shows what is left in the chosen category');
  A.type($('#f-amount'),'200');
  t.ok(/חריגה של ₪40/.test($('#f-budget-hint').textContent)&&$('#f-budget-hint').classList.contains('t-ov'),'…including the amount being typed');
  click($('#f-cats [data-id="fun"]'));
  t.ok($('#f-budget-hint').hidden,'no hint for a category without a budget');
  click($('#f-cats [data-id="food"]'));click($('[data-a="tx-save"]'));await sleep(60);
  t.ok(/חרגתם מהתקציב של אוכל ב־₪40/.test(A.toast()),'saving says by how much the budget was exceeded');
  t.ok(row('food').querySelector('.bg-track i.ov')&&/חריגה של ₪40/.test(row('food').textContent),'over budget is red');
  await undo();
  t.ok(/נשארו ₪160/.test(row('food').textContent),'undo brings the budget back');

  // ---- transactions screen: the budget of the filtered category, per displayed month ----
  click(row('home'));await sleep(40);
  t.ok(/תקציב ₪1,000 · נשארו ₪700/.test($('#tx-budget').textContent),'filtering by a category shows its budget');
  click($$('[data-a="month"]')[0]);await sleep(120);
  t.ok(/תקציב ₪500 · נשארו ₪50/.test($('#tx-budget').textContent),'an earlier month is shown against the budget it had then');
  click($$('[data-a="month"]').find(b=>b.dataset.v==='0'));await sleep(60);
  click($('[data-a="tx-cat"][data-id=""]'));await sleep(20);
  click($('[data-a="brk-toggle"]'));await sleep(10);
  t.ok($$('#tx-results .bg-row').length===2&&$$('#tx-results .bar-row').length===1,'open breakdown: budget rows for budgeted categories');

  // ---- changing a budget: from this month on; earlier months stay ----
  A.tab('settings');A.set('cats');await sleep(20);
  click($('[data-a="cat-edit"][data-id="home"]'));await sleep(40);
  t.ok($('#c-budget').value==='1000'&&!$('#c-budget-sec').hidden,'category sheet shows the current budget');
  A.type($('#c-budget'),'1200');click($('[data-a="cat-save"]'));await sleep(60);
  t.ok(cat(sh,'home').budgets[MK]===1200&&cat(sh,'home').budgets[PREV]===500,'a new budget is stored from this month; the earlier one is kept');
  await undo();
  t.ok(cat(sh,'home').budgets[MK]===1000,'undo restores the previous budget');
  click($('[data-a="cat-edit"][data-id="home"]'));await sleep(40);
  A.type($('#c-budget'),'');click($('[data-a="cat-save"]'));await sleep(60);
  t.ok(cat(sh,'home').budgets[MK]===0&&cat(sh,'home').budgets[PREV]===500,'clearing the field removes the budget from this month only');
  click($('[data-a="cat-edit"][data-id="fun"]'));await sleep(40);
  A.type($('#c-budget'),'abc');click($('[data-a="cat-save"]'));await sleep(30);
  t.ok(A.sheetOpen()&&/תקציב/.test(A.toast()),'an invalid budget is refused');
  A.type($('#c-budget'),'300');click($('[data-a="cat-save"]'));await sleep(60);
  t.ok(cat(sh,'fun').budgets[MK]===300,'a first budget starts this month');
  click($('[data-a="cat-tab"][data-v="income"]'));await sleep(20);
  click($('[data-a="cat-edit"][data-id="sal"]'));await sleep(40);
  t.ok($('#c-budget-sec').hidden,'no budget field for an income category');
  click($('[data-a="cat-save"]'));await sleep(40);
  t.ok(!cat(sh,'sal').budgets,'…and nothing is stored for it');
  A.tab('home');await sleep(30);
  t.ok(!row('home')&&row('fun')&&row('food'),'home follows the changes');
  click($('[data-a="go-cats"]'));await sleep(30);
  t.ok($('#top-title').textContent==='קטגוריות'&&$('[data-a="cat-edit"][data-id="food"]'),'"עריכה" on the card opens the categories');

  // ---- paying a credit card: "the whole debt" in the transfer sheet ----
  click($('[data-a="fab"]'));await sleep(10);click($('#f-type [data-v="transfer"]'));
  click($('#f-from [data-id="c1"]'));
  t.ok($('#f-debt').hidden,'no debt button before choosing a card');
  click($('#f-to [data-id="cc"]'));
  t.ok(!$('#f-debt').hidden&&/מלוא החוב: ₪1,234\.50/.test($('#f-debt').textContent),'transfer to a credit card offers the whole debt');
  click($('[data-a="f-debt"]'));
  t.ok($('#f-amount').value==='1234.5','…and fills the amount');
  click($('[data-a="tx-save"]'));await sleep(60);
  t.ok(sh.store.get(P_BETA+'liabilities/cc').value===0&&sh.store.get(P_BETA+'assets/c1').value===3765.5,'the payment clears the card and leaves the current account');
  t.ok(!A.errors.length,'no script errors'+(A.errors.length?': '+A.errors[0]:''));

  // ---- expected this month (recurring not yet due) counts against the budget ----
  const last=new Date(now.getFullYear(),now.getMonth()+1,0).getDate();
  if(now.getDate()<last){
    const sh2=makeShared();seed(sh2);
    sh2.store.set(P_BETA+'recurring/r1',{type:'expense',amount:100,categoryId:'food',catName:'אוכל',note:'מנוי',day:now.getDate()+1,startMonth:MK,lastMonth:null,paused:false,createdAt:1});
    const B=openApp(sh2);await sleep(250);
    const r=B.$('#budget-card .bg-row[data-cat="food"]');
    t.ok(r.querySelector('.bg-track i.soft')&&/נשארו ₪60, אחרי ₪100 שצפויים/.test(r.textContent),'a recurring expense not yet due is a light part of the bar and reduces what is left');
    t.ok(/₪640/.test(r.textContent)&&keys(sh2,P_BETA+'tx/').length===4,'…without being counted as spent or created early');
  }else t.ok(true,'(last day of the month: nothing can be "expected", skipped)');

  // ---- no budgets at all: home stays as before ----
  const sh3=makeShared();seed(sh3,false);
  const C=openApp(sh3);await sleep(250);
  t.ok(!C.$('#budget-card')&&/לאן הלך הכסף החודש/.test(C.$('#view').textContent),'without budgets the home screen is unchanged');

  // ---- backup: budgets are imported ----
  const sh4=makeShared(),E=openApp(sh4);await sleep(200);
  E.tab('settings');
  await E.importText(JSON.stringify({app:'personal-finance-dashboard',version:2,tx:{categories:[{id:'bx',name:'חדשה',icon:'🍔',type:'expense',color:'#888888',ord:9,budgets:{[MK]:450,bad:'x'}}],transactions:[]},nw:{assets:[],liabilities:[],history:[]}}));
  const got=cat(sh4,'bx');
  t.ok(got&&got.budgets&&got.budgets[MK]===450&&Object.keys(got.budgets).length===1,'import keeps the budgets (and drops invalid entries)');
  // restoring into a new account: the default categories already exist (same names), and they get the budgets from the backup
  const sh5=makeShared(),G=openApp(sh5);await sleep(200);
  G.tab('settings');
  await G.importText(JSON.stringify({app:'personal-finance-dashboard',version:2,tx:{categories:[{id:'old-super',name:'סופר',icon:'🛒',type:'expense',color:'#4E9A5F',ord:1,budgets:{[MK]:2400}}],transactions:[]},nw:{assets:[],liabilities:[],history:[]}}));
  const sup=keys(sh5,P_BETA+'categories/').map(k=>sh5.store.get(k)).find(c=>c.name==='סופר');
  t.ok(keys(sh5,P_BETA+'categories/').length===8&&sup.budgets&&sup.budgets[MK]===2400,'an existing category without a budget gets the one from the backup');
  await G.importText(JSON.stringify({app:'personal-finance-dashboard',version:2,tx:{categories:[{id:'old-super',name:'סופר',icon:'🛒',type:'expense',color:'#4E9A5F',ord:1,budgets:{[MK]:9999}}],transactions:[]},nw:{assets:[],liabilities:[],history:[]}}));
  const sup2=keys(sh5,P_BETA+'categories/').map(k=>sh5.store.get(k)).find(c=>c.name==='סופר');
  t.ok(sup2.budgets[MK]===2400,'…but an existing budget is never overwritten by an import');
};
