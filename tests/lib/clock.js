// A test clock that does not cross midnight.
// The tests compute "today" / "this month" once when a file loads, and the app reads the real time while it runs.
// A run that started at 23:59 used to end after midnight with the two disagreeing (failures that passed on a rerun).
// Here every clock (Node and each jsdom window) starts at 12:00 of the real date and then advances in real time,
// so a run has 12 hours before the date changes. Only Date changes; setTimeout and friends keep real time.
//
// TEST_NOW=2026-12-31            → run as if today were that date (12:00)
// TEST_NOW=2026-11-30T23:59:30   → exact start time (for example to check behavior around midnight)
const RealDate=Date;
const realStart=RealDate.now();
function startTime(){
  const v=process.env.TEST_NOW;
  if(v){
    const m=v.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if(!m)throw new Error('TEST_NOW: use YYYY-MM-DD or YYYY-MM-DDTHH:MM[:SS] (local time), got '+v);
    return new RealDate(+m[1],+m[2]-1,+m[3],m[4]==null?12:+m[4],m[5]==null?0:+m[5],m[6]==null?0:+m[6]).getTime();
  }
  const d=new RealDate(realStart);
  return new RealDate(d.getFullYear(),d.getMonth(),d.getDate(),12).getTime();
}
const OFFSET=startTime()-realStart;

// Source code, so the same shift can be installed inside a jsdom window (its own Date) and in Node.
const SHIFT_SRC=`(function(G,off){
  var R=G.Date;
  function D(){
    if(!(this instanceof D))return new R(R.now()+off).toString();
    var a=arguments;
    return a.length===0?new R(R.now()+off):new (Function.prototype.bind.apply(R,[null].concat([].slice.call(a))))();
  }
  D.prototype=R.prototype;
  D.now=function(){return R.now()+off;};
  D.parse=R.parse;D.UTC=R.UTC;
  G.Date=D;
})`;

function install(G,evalIn){
  if(G.Date&&G.Date.__testClock)return;
  (evalIn||eval)(SHIFT_SRC)(G,OFFSET);
  G.Date.__testClock=true;
}
install(globalThis);
module.exports={installIn:w=>install(w,src=>w.eval(src)),OFFSET,startedAt:()=>new Date(realStart+OFFSET)};
