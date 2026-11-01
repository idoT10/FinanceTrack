// Swipe down on a sheet closes it; a short swipe or a sideways swipe does not.
const {openApp,makeShared,sleep,P_BETA}=require('./lib/harness');
module.exports=async t=>{
  const sh=makeShared();sh.store.set(P_BETA+'meta/profile',{seeded:true});
  const A=openApp(sh);await sleep(200);
  const el=A.$('#sheet');
  const touch=(type,x,y)=>{const e=new A.w.Event(type,{bubbles:true,cancelable:true});e.touches=type==='touchend'?[]:[{clientX:x,clientY:y}];e.changedTouches=[{clientX:x,clientY:y}];el.dispatchEvent(e);};
  const swipe=async(dx,dy,ms=0)=>{touch('touchstart',100,100);for(let i=1;i<=5;i++){if(ms)await sleep(ms/5);touch('touchmove',100+dx*i/5,100+dy*i/5);}touch('touchend',100+dx,100+dy);await sleep(20);};
  A.click(A.$('[data-a="fab"]'));await sleep(20);
  await swipe(0,60,400);
  t.ok(A.sheetOpen()&&el.style.transform==='','short slow swipe: sheet stays and snaps back');
  await swipe(200,40);
  t.ok(A.sheetOpen(),'sideways swipe (scrolling a chip row): sheet stays');
  await swipe(0,200);
  t.ok(!A.sheetOpen(),'swipe down: sheet closes');
  A.click(A.$('[data-a="fab"]'));await sleep(20);el.scrollTop=50;
  await swipe(0,200);
  t.ok(A.sheetOpen(),'sheet scrolled down: swiping scrolls, does not close');
};
