const Phys=require('./engine.js'); require('./scene.js'); const DT=Phys.DT; let fails=0;
// A massless (default) pulley disc welded to two heavy bars with end balls and opposing springs: a torsional oscillator that must hold together
function run(opts){
const w=Phys.createWorld(); w.ground=false;
const D=Phys.createWheel(w,0,0,{r:.42,m:opts.dm||1.5,massless:opts.dml!==false});
const L=Phys.createBody('rect',{x:-.92,y:0,W:1,H:.13,m:opts.bm||4}), R=Phys.createBody('rect',{x:.92,y:0,W:1,H:.13,m:opts.bm||4});
const bl=Phys.createBody('sphere',{x:-1.42,y:0,r:.12,m:opts.em||2}), br=Phys.createBody('sphere',{x:1.42,y:0,r:.12,m:opts.em||2}); w.bodies.push(L,R,bl,br);
const J=(a,b,p)=>Phys.createJoint(w,'weld',a,b,Phys.localOf(a,p[0],p[1]),Phys.localOf(b,p[0],p[1]),{ref:b.a-a.a});
J(D,L,[-.42,0]);J(D,R,[.42,0]);J(L,bl,[-1.42,0]);J(R,br,[1.42,0]);
Phys.createJoint(w,'spring',w.anchor,bl,{x:-1.42,y:.9},{x:0,y:0},{L:opts.sl||.8,k:opts.k||100,c:opts.c||0});
Phys.createJoint(w,'spring',w.anchor,br,{x:1.42,y:-.9},{x:0,y:0},{L:opts.sl||.8,k:opts.k||100,c:opts.c||0});
Phys.reconcile(w);
let worst=0;
for(let i=0;i<Math.round(20/DT);i++){Phys.step(w,DT); if(i%24==0){for(const j of w.joints.filter(q=>q.type==='weld')){const a=Phys.J.pt(j.a,j.la),b=Phys.J.pt(j.b,j.lb);worst=Math.max(worst,Math.hypot(a.x-b.x,a.y-b.y),Math.abs((j.b.a-j.a.a)-j.ref));}}}
return worst;}
for(const k of [100,1000,5000]) for(const bm of [1,4,20]) for(const c of [0,5]){ const e=run({k,bm,c}); const ok=isFinite(e)&&e<0.02; console.log((ok?'PASS ':'FAIL ')+`massless disc, k ${k} bars ${bm} kg c ${c}: worst weld error ${e.toFixed(4)}`); if(!ok)fails++; }
process.exit(fails?1:0);
