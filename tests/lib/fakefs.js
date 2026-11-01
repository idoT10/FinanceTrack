// In-memory Firestore that enforces the security-rules limit: a batch may use at most 20 access calls,
// and every write in our rules costs one exists() call on the allowlist.
const clone=v=>JSON.parse(JSON.stringify(v));
function makeShared(){return{store:new Map(),listeners:new Set(),log:[]};}
function makeFake(sh,user){
  const {store,listeners,log}=sh;
  const parentOf=k=>k.slice(0,k.lastIndexOf('/'));
  const run=q=>{let d=[...store.entries()].filter(([k])=>parentOf(k)===q.path).map(([k,v])=>({id:k.slice(k.lastIndexOf('/')+1),data:v}));
    for(const c of q.cons||[])if(c.t==='where')d=d.filter(x=>{const v=x.data[c.f];return c.op==='>='?v>=c.v:c.op==='<'?v<c.v:c.op==='=='?v===c.v:true;});
    const o=(q.cons||[]).find(c=>c.t==='order');if(o)d.sort((a,b)=>(a.data[o.f]<b.data[o.f]?-1:1)*(o.dir==='desc'?-1:1));
    const l=(q.cons||[]).find(c=>c.t==='limit');if(l)d=d.slice(0,l.n);return d;};
  const meta={fromCache:false};
  const qs=d=>({docs:d.map(x=>({id:x.id,data:()=>clone(x.data)})),metadata:meta});
  const ds=r=>({id:r.id,exists:()=>store.has(r.path),data:()=>clone(store.get(r.path)),metadata:meta});
  const emit=l=>l.cb(l.t.kind==='doc'?ds(l.t):qs(run(l.t)));
  const notify=()=>{for(const l of listeners)setTimeout(()=>l.on&&emit(l),0);};
  const denied=()=>Object.assign(new Error('Missing or insufficient permissions.'),{code:'permission-denied'});
  const fs={
    collection:(db,...p)=>({kind:'col',path:p.join('/')}),doc:(db,...p)=>({kind:'doc',path:p.join('/'),id:p[p.length-1]}),
    query:(c,...cons)=>({path:c.path,cons}),where:(f,op,v)=>({t:'where',f,op,v}),orderBy:(f,dir)=>({t:'order',f,dir}),limit:n=>({t:'limit',n}),
    onSnapshot(t,a,b,c){let cb=a;if(a&&typeof a==='object')cb=b;const l={t,cb,on:true};listeners.add(l);setTimeout(()=>l.on&&emit(l),0);return()=>{l.on=false;listeners.delete(l);};},
    async setDoc(r,d){store.set(r.path,clone(d));notify();},async deleteDoc(r){store.delete(r.path);notify();},
    writeBatch(){const ops=[];return{set:(r,d)=>ops.push(['set',r,d]),update:(r,d)=>ops.push(['update',r,d]),delete:r=>ops.push(['del',r]),
      async commit(){log.push(['batch',ops.length]);if(ops.length>20)throw denied();
        for(const [t,r,d] of ops){if(t==='set')store.set(r.path,clone(d));else if(t==='update')store.set(r.path,Object.assign(store.get(r.path)||{},clone(d)));else store.delete(r.path);}notify();}};},
    async getDocsFromServer(q){return qs(run(q));},async getCountFromServer(q){return{data:()=>({count:run(q).length})};},
    async waitForPendingWrites(){},
    async disableNetwork(){log.push(['disableNetwork']);},async enableNetwork(){log.push(['enableNetwork']);}
  };
  const auth={onAuthStateChanged:(a,cb)=>{setTimeout(()=>cb(user),0);return()=>{};},signOut:async()=>{}};
  return{fs,auth};
}
module.exports={makeShared,makeFake};
