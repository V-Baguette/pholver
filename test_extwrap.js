const Phys=require('./engine.js'); require('./scene.js'); const DT=Phys.DT; let fails=0; const ok=(n,c,i)=>{console.log((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++;};
const run=(w,t)=>{for(let i=0;i<Math.round(t/DT);i++)Phys.step(w,DT);};
function atwood(ext,wm){ const w=Phys.createWorld(); w.ground=false;
  const W=Phys.createWheel(w,0,8,{r:.4,m:1,massless:wm});
  const A=Phys.createBody('rect',{x:-.4,y:3.5,W:.2,H:.4,m:2}),B=Phys.createBody('rect',{x:.4,y:3.5,W:.2,H:.4,m:1});w.bodies.push(A,B);
  const j=Phys.createWrap(w,{b:A,l:{x:0,y:.2}},{b:B,l:{x:0,y:.2}},[W],{}); Phys.reconcile(w);
  if(ext){Phys.setRopeType(w,j,true); j.k=4000; j.c=40;}
  return {w,A,B,W,j}; }
// 1 switching keeps the pulley and goes both ways
{ const s=atwood(false,true); const n0=s.j.wh.length; Phys.setRopeType(s.w,s.j,true); ok('ext keeps pulleys',s.j.type==='wrap'&&s.j.ext&&s.j.wh.length===n0);
  Phys.setRopeType(s.w,s.j,false); ok('back to rigid keeps pulleys',s.j.type==='wrap'&&!s.j.ext&&s.j.wh.length===n0);
  const sd=Phys.deserialize(JSON.parse(JSON.stringify(Phys.serialize((()=>{Phys.setRopeType(s.w,s.j,true);return s.w;})())))); const jj=sd.joints.find(q=>q.type==='wrap'); ok('ext wrap saves',jj&&jj.ext===true&&jj.wh.length===1&&jj.k>0); }
// 2 extensible Atwood accelerates like the rigid one (stiff rope)
for(const wm of [true,false]){ const r=atwood(false,wm), e=atwood(true,wm); run(r.w,1); run(e.w,1);
  ok('Atwood ext vs rigid, wheel '+(wm?'massless':'massive'),Math.abs(e.B.vy-r.B.vy)<0.25&&Math.abs(e.A.vy+e.B.vy)<0.3,`rigid ${r.B.vy.toFixed(2)} ext ${e.B.vy.toFixed(2)} A ${e.A.vy.toFixed(2)}`); }
// 3 massive wheel turns with an extensible rope (no slip)
{ const e=atwood(true,false); run(e.w,1); ok('wheel turns under ext rope',Math.abs(e.W.w*.4-e.B.vy)<0.3,`w*r ${(e.W.w*.4).toFixed(2)} v ${e.B.vy.toFixed(2)}`); }
// 4 hanging weight on an extensible rope over a pulley stretches by m g / k and rests
{ const w=Phys.createWorld(); w.ground=false; const W=Phys.createWheel(w,0,8,{r:.4,m:1});
  const A=Phys.createBody('rect',{x:-.4,y:3.5,W:.2,H:.4,m:2}); const B=Phys.createBody('rect',{x:.4,y:3.5,W:.2,H:.4,m:2,fixed:true}); w.bodies.push(A,B);
  const j=Phys.createWrap(w,{b:A,l:{x:0,y:.2}},{b:B,l:{x:0,y:.2}},[W],{}); Phys.reconcile(w); Phys.setRopeType(w,j,true); j.k=1000;j.c=30; run(w,6);
  const r=Phys.J.read(j); ok('static stretch = m g / k',Math.abs(r.ext-2*9.81/1000)<0.004&&Math.abs(r.tension-19.62)<0.6,`ext ${r.ext.toFixed(4)} T ${r.tension.toFixed(2)}`); }
// 5 rope looped back to the same object over a movable pulley (both ends on the world)
for(const ext of [false,true]){ const w=Phys.createWorld(); w.ground=false;
  const W=Phys.createWheel(w,0,4,{r:.4,m:2,massless:false}); W.axle=false; Phys.rebuild(W);
  const j=Phys.createWrap(w,{b:null,l:{x:-.4,y:5}},{b:null,l:{x:.4,y:5}},[W],{}); Phys.reconcile(w); if(ext){Phys.setRopeType(w,j,true);j.k=2000;j.c=40;}
  run(w,4); ok('movable pulley on a sling, '+(ext?'extensible':'rigid'),Math.abs(W.y-4)<(ext?0.05:0.02)&&Math.abs(W.x)<0.02,`y ${W.y.toFixed(3)} x ${W.x.toFixed(3)}`); }
// 6 rope from an object over a pulley and back to a different point on the same object
{ const w=Phys.createWorld(); w.ground=false; const W=Phys.createWheel(w,0,6,{r:.4,m:1});
  const B=Phys.createBody('rect',{x:0,y:3,W:2,H:.4,m:3}); w.bodies.push(B);
  const j=Phys.createWrap(w,{b:B,l:{x:-.4,y:.2}},{b:B,l:{x:.4,y:.2}},[W],{}); Phys.reconcile(w); run(w,3);
  ok('same-object loop holds the object',B.y>2.5&&Math.abs(B.a)<0.05&&Math.abs(B.x)<0.05,`y ${B.y.toFixed(2)} a ${B.a.toFixed(3)}`); }
process.exit(fails?1:0);
