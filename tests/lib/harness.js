// Loads the REAL app (beta/index.html by default) into jsdom, with Firebase swapped for the in-memory fake in ./fakefs.js.
// Only D.init() is replaced; everything else (data layer, screens, events) is the production code.
const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs'),path=require('path');
const {makeShared,makeFake}=require('./fakefs');
const ROOT=path.resolve(__dirname,'..','..');
const USER={uid:'u1',email:'me@x.com',emailVerified:true};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function targetFile(){return path.resolve(ROOT,process.env.TARGET||'beta/index.html');}
function loadHtml(){
  const p=targetFile();
  let html=fs.readFileSync(p,'utf8').replace('<script type="module">','<script>');
  const re=/  async init\(\)\{[\s\S]*?\n  \},\n  onAuth/;
  if(!re.test(html))throw new Error('harness: D.init() not found in '+p+' (keep the "  async init(){ ... }," block followed by "  onAuth")');
  return html.replace(re,"  async init(){this.A=window.__FAKE.auth;this.F=window.__FAKE.fs;this.db={};this.auth={};},\n  onAuth");
}
function appVersion(){
  const m=fs.readFileSync(targetFile(),'utf8').match(/const APP_VERSION='([^']+)'(?:,APP_BUILD='([^']+)')?/);
  return m?(m[2]?m[1]+' · '+m[2]:m[1]):null;
}
let HTML=null;
function openApp(shared,{path:p='/FinanceTrack/beta/',user=USER,beforeParse}={}){
  HTML=HTML||loadHtml();
  const errors=[];const vc=new VirtualConsole();
  vc.on('jsdomError',e=>errors.push(e.message));
  const fake=makeFake(shared,user);
  const dom=new JSDOM(HTML,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://idot10.github.io'+p,virtualConsole:vc,
    beforeParse(w){w.scrollTo=()=>{};w.__FAKE=fake;w.__inClick=false;if(beforeParse)beforeParse(w);}});
  const w=dom.window,d=w.document;
  const app={w,d,fake,errors,
    $:s=>d.querySelector(s),$$:s=>[...d.querySelectorAll(s)],
    click(el){if(!el)throw new Error('click: element not found');w.__inClick=true;el.dispatchEvent(new w.MouseEvent('click',{bubbles:true}));w.__inClick=false;},
    type(el,v){el.value=v;el.dispatchEvent(new w.Event('input',{bubbles:true}));},
    tab(v){app.click(d.querySelector('.tab[data-v="'+v+'"]'));},
    async confirm(){await sleep(10);app.click(d.querySelector('#dialog [data-r="1"]'));await sleep(150);},
    async importText(text,name='backup.json'){
      const inp=d.querySelector('#file');
      Object.defineProperty(inp,'files',{value:[new w.File([text],name,{type:'application/json'})],configurable:true});
      inp.dispatchEvent(new w.Event('change',{bubbles:true}));await sleep(600);
    },
    async addExpense(amount){
      app.click(d.querySelector('[data-a="fab"]'));app.type(d.querySelector('#f-amount'),String(amount));
      app.click(d.querySelectorAll('#f-cats .chip[data-a="f-cat"]')[0]);app.click(d.querySelector('[data-a="tx-save"]'));await sleep(60);
    },
    toast:()=>d.querySelector('#toast').textContent,
    sheetOpen:()=>d.querySelector('#sheet').classList.contains('open'),
  };
  return app;
}
const keys=(shared,prefix)=>[...shared.store.keys()].filter(k=>k.startsWith(prefix));
const maxBatch=shared=>Math.max(0,...shared.log.filter(x=>x[0]==='batch').map(x=>x[1]));
module.exports={openApp,makeShared,sleep,keys,maxBatch,appVersion,ROOT,P_BETA:'users/u1/beta/main/',P_PROD:'users/u1/'};
