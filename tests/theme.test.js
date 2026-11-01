// Appearance: auto / light / dark, saved per device (localStorage "fin-theme"), applied before first paint.
const {openApp,makeShared,sleep}=require('./lib/harness');
const metas=A=>A.$$('meta[name="theme-color"]').map(m=>m.getAttribute('content')).join(',');
module.exports=async t=>{
  let A=openApp(makeShared(),{beforeParse(w){w.localStorage.setItem('fin-theme','dark');}});
  t.ok(A.d.documentElement.getAttribute('data-theme')==='dark'&&metas(A)==='#0D1316,#0D1316','saved "dark" applied at load, status bar dark');
  await sleep(150);A.tab('settings');
  t.ok(A.$$('[data-a="theme"]')[2].classList.contains('on'),'"כהה" selected');
  A.click(A.$$('[data-a="theme"]')[1]);
  t.ok(A.d.documentElement.getAttribute('data-theme')==='light'&&A.w.localStorage.getItem('fin-theme')==='light'&&metas(A)==='#F2F4F1,#F2F4F1','switch to light');
  A.click(A.$$('[data-a="theme"]')[0]);
  t.ok(!A.d.documentElement.hasAttribute('data-theme')&&A.w.localStorage.getItem('fin-theme')===null&&metas(A)==='#F2F4F1,#0D1316','back to automatic');
  const css=A.d.querySelector('style').textContent;
  t.ok(/:root\[data-theme="dark"\]\{[^}]*--paper:#0D1316/.test(css)&&/:root:not\(\[data-theme="light"\]\)/.test(css),'CSS: forced theme overrides system setting');
  t.ok(!/@media \(prefers-color-scheme:dark\)\{\.[a-z]/.test(css),'no dark rule ignores the user choice');
};
