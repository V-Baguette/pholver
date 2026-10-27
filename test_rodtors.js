const Phys=require('./engine.js'); require('./scene.js');
const DT=Phys.DT; let fails=0; const ok=(n,c,i)=>{console.log((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++;};
const w=Phys.createWorld();w.g=0;w.ground=false;
const B=Phys.createBody('sphere',{x:1,y:0,m:1,r:.05,mus:0,muk:0});w.bodies.push(B);
const j=Phys.createJoint(w,'rod',null,B,{x:0,y:0},{x:0,y:0},{L:1});
Phys.J.setRodEnd(j,'a',true); j.ksA=10; j.csA=0;
const th0=0.3;B.x=Math.cos(th0);B.y=Math.sin(th0);
const T=2*Math.PI/Math.sqrt(10), s=[];let t=0;const E0=Phys.energy(w).total;let emax=0;
for(let i=0;i<Math.round(4*T/DT);i++){Phys.step(w,DT);t+=DT;s.push({t,v:Math.atan2(B.y,B.x)});}
const ts=[];for(let i=1;i<s.length;i++)if(s[i-1].v>0&&s[i].v<=0)ts.push(s[i].t);
const Tm=(ts[ts.length-1]-ts[0])/(ts.length-1);
ok('rod end torsion period',Math.abs(Tm-T)/T<0.02,`T ${Tm.toFixed(4)} vs ${T.toFixed(4)}`);
// damping reaches rest
j.csA=2;B.x=Math.cos(.3);B.y=Math.sin(.3);B.vx=B.vy=0;for(let i=0;i<Math.round(10/DT);i++)Phys.step(w,DT);
ok('rod damping settles',Math.abs(Math.atan2(B.y,B.x))<0.01&&Math.abs(Math.hypot(B.x,B.y)-1)<1e-3,`ang ${Math.atan2(B.y,B.x).toFixed(4)}`);
process.exit(fails?1:0);
