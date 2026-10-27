const Phys=require('../engine.js'); require('../scene.js');
const DT=Phys.DT; let fails=0; const ok=(n,c,i)=>{console.log((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++;};
function scene(fix){const w=Phys.createWorld();w.g=0;w.ground=false;
 const A=Phys.createBody('rect',{x:0,y:0,W:1,H:1,m:5,mus:0,muk:0,fixed:true});
 const B=Phys.createBody('rect',{x:2.5,y:0,W:1,H:1,m:1,mus:0,muk:0});w.bodies.push(A,B);
 const j=Phys.createJoint(w,'spring',A,B,{x:.5,y:0},{x:-.5,y:0},{L:1,k:100,c:0});
 if(fix)Phys.J.setFixedAxis(j,true);
 B.w=0; // kick: torque pulse by pushing a corner
 B.vy=0; return {w,A,B,j};}
// hinged: a block with an off-axis kick spins freely about the attachment (angle grows)
for(const fix of [false,true]){
  const s=scene(fix); s.B.w=3; let amax=0; // initial spin 3 rad/s
  for(let i=0;i<Math.round(3/DT);i++){Phys.step(s.w,DT);amax=Math.max(amax,Math.abs(s.B.a));}
  console.log(fix?'clamped':'hinged','max |angle|',amax.toFixed(3));
  if(fix) ok('clamped end resists pivoting',amax<0.25,amax.toFixed(3)); else ok('hinged end spins',amax>1.5,amax.toFixed(3));
}
// energy conservation clamped (no damping): drop angle
const s=scene(true); s.j.c=0; s.B.a=0.2; s.B.x=2.5; const E0=Phys.energy(s.w).total; let emax=0;
for(let i=0;i<Math.round(2/DT);i++){Phys.step(s.w,DT);}
const E1=Phys.energy(s.w).total; ok('energy never grows (bending damping on)',E1<=E0*1.01,`E0 ${E0.toFixed(3)} E1 ${E1.toFixed(3)}`);
// settles with damping to aligned
const s2=scene(true); s2.B.a=0.3; for(let i=0;i<Math.round(12/DT);i++)Phys.step(s2.w,DT);
ok('rotation returns',Math.abs(s2.B.a)<0.02,s2.B.a.toFixed(4));
// serialize round trip
const sd=Phys.serialize(s.w);const w2=Phys.deserialize(JSON.parse(JSON.stringify(sd)));const jj=w2.joints.find(j=>j.type=='spring');ok('serialized fix',jj.fix===true&&jj.rA!=null,`rA ${jj.rA}`);
process.exit(fails?1:0);
