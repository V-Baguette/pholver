const Phys=require('./engine.js'); require('./scene.js');
const DT=Phys.DT; let fails=0;
const ok=(n,c,i)=>{console.log((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++;};
const w=Phys.createWorld(); w.g=0; w.ground=false;
// rod hinged to world at its end, torsion spring ks, rest at placement pose; inertia of rect about pivot
const b=Phys.createBody('rect',{x:1,y:0,W:2,H:0.1,m:1,mus:0,muk:0}); w.bodies.push(b);
const j=Phys.createJoint(w,'pin',null,b,{x:0,y:0},{x:-1,y:0},{ref:b.a-0,ks:5,cs:0});
b.x=1;b.a=0.2; // twist 0.2 rad
const I=b.I+b.m*1; const T=2*Math.PI/Math.sqrt(5/I);
const s=[];let t=0;for(let i=0;i<Math.round(4*T/DT);i++){Phys.step(w,DT);t+=DT;s.push({t,v:b.a});}
let ts=[];for(let i=1;i<s.length;i++)if(s[i-1].v>0&&s[i].v<=0)ts.push(s[i].t);
const Tm=(ts[ts.length-1]-ts[0])/(ts.length-1);
ok('torsion period',Math.abs(Tm-T)/T<0.01,`T ${Tm.toFixed(4)} vs ${T.toFixed(4)}`);
// rest angle ka
j.ka=0.5;j.cs=2;b.a=0;b.w=0;b.x=Math.cos(0);for(let i=0;i<Math.round(8/DT);i++)Phys.step(w,DT);
ok('rest angle',Math.abs(b.a-0.5)<0.01,`a ${b.a.toFixed(3)}`);
// nog
const w2=Phys.createWorld(); w2.ground=false; const c=Phys.createBody('sphere',{x:0,y:5,m:1,r:.1}); c.nog=true; w2.bodies.push(c);
for(let i=0;i<200;i++)Phys.step(w2,DT); ok('ignore gravity',Math.abs(c.y-5)<1e-6);
process.exit(fails?1:0);
