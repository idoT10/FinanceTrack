// npm test  → runs every tests/*.test.js against beta/index.html
// TARGET=index.html npm test → runs them against the production file
const fs=require('fs'),path=require('path');
const files=fs.readdirSync(__dirname).filter(f=>f.endsWith('.test.js')).sort();
const only=process.argv[2];
(async()=>{
  let pass=0,fail=0;
  console.log('target: '+(process.env.TARGET||'beta/index.html')+'\n');
  for(const f of files){
    if(only&&!f.includes(only))continue;
    console.log('■ '+f);
    const t={ok(cond,msg){if(cond){pass++;console.log('   ok   '+msg);}else{fail++;console.log('   FAIL '+msg);}}};
    try{await require(path.join(__dirname,f))(t);}
    catch(e){fail++;console.log('   CRASH '+(e.stack||e));}
  }
  console.log('\n'+pass+' passed, '+fail+' failed');
  process.exit(fail?1:0);
})();
