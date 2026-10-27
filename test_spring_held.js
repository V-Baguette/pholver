const Phys=require('./engine.js'); require('./scene.js'); const DT=Phys.DT; let bad=0;
const box=(w,x,y,W,H,m)=>{const b=Phys.createBody('rect',{x,y,W,H,m,mus:0,muk:0,e:0});w.bodies.push(b);return b;};
function run(link){const w=Phys.createWorld(); w.g=0; w.ground=false;
  const wall=Phys.createBody('sphere',{x:-3,y:0,r:.02,m:1,fixed:true}); w.bodies.push(wall);
  const A=box(w,0,0,1,1,2); Phys.createJoint(w,'spring',wall,A,{x:0,y:0},{x:-.5,y:0},{L:1.5,k:20,c:0});
  const C=box(w,-.55,0,.1,.6,.2);
  if(link==='weld')Phys.createJoint(w,'weld',A,C,Phys.localOf(A,-.5,0),Phys.localOf(C,-.5,0),{ref:C.a-A.a});
  if(link==='pin')Phys.createJoint(w,'pin',A,C,Phys.localOf(A,-.5,.25),Phys.localOf(C,-.5,.25),{ref:C.a-A.a});
  if(link==='rod')Phys.createJoint(w,'rod',A,C,{x:-.5,y:.4},{x:0,y:.2},{L:Math.hypot(.05,.2)});
  Phys.reconcile(w); let m=0; for(let i=0;i<Math.round(4/DT);i++){Phys.step(w,DT); m=Math.max(m,w._lcN||0);} return m;}
// unrelated body must still hit the spring
{const w=Phys.createWorld(); w.g=0; w.ground=false;
 const wall=Phys.createBody('sphere',{x:-3,y:0,r:.02,m:1,fixed:true}); w.bodies.push(wall);
 const A=box(w,0,0,1,1,2); Phys.createJoint(w,'spring',wall,A,{x:0,y:0},{x:-.5,y:0},{L:1.5,k:20,c:0});
 const C=box(w,-1.5,.8,.4,.4,.2); C.vy=-1; Phys.reconcile(w); for(let i=0;i<Math.round(2/DT);i++)Phys.step(w,DT);
 if(C.y>0.6){console.log('FAIL free body did not collide with spring, y=',C.y);bad++;} else console.log('ok free body collides y=',C.y.toFixed(2));}
for(const l of ['weld','pin','rod']){const n=run(l); if(n){console.log('FAIL',l,'held body touches spring line',n);bad++;} else console.log('ok',l,'no spring contact');}
process.exit(bad?1:0);
