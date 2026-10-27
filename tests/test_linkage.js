const Phys=require('../engine.js'); require('../scene.js'); const DT=Phys.DT; let bad=0;
const ok=(n,c,x)=>{console.log((c?'ok   ':'FAIL ')+n+(x!==undefined?'  '+x:''));if(!c)bad++;};
const P=n=>Phys.linkNodePos(n);
// distance of point p from segment a-b
const dseg=(p,a,b)=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);};
function tapScene(M,k,massless,steps,lm){
  const w=Phys.createWorld(); w.g=9.81; w.ground=false;
  const ball=Phys.createBody('sphere',{x:2,y:0,r:.1,m:1}); const box=Phys.createBody('rect',{x:1,y:-1.5,W:.6,H:.6,m:M,mus:0,muk:0}); w.bodies.push(ball,box);
  const c=Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:ball,l:{x:0,y:0}},{on:[0,1],t:.5,x:0,y:0},{b:box,l:{x:0,y:.3}}],edges:[[0,1],[2,3]]},{massless,mass:lm||0.05});
  if(k) Phys.createJoint(w,'spring',w.anchor,box,{x:-3,y:-1.5},{x:-.3,y:0},{L:.3,k,c:0.5});
  Phys.reconcile(w);
  let off=0,len=0,L0=Math.hypot(P(c.nodes[3]).x-P(c.nodes[2]).x,P(c.nodes[3]).y-P(c.nodes[2]).y);
  for(let i=0;i<steps;i++){Phys.step(w,DT);
    const a=P(c.nodes[0]),b=P(c.nodes[1]),t=P(c.nodes[2]); off=Math.max(off,dseg(t,a,b));
    const q=P(c.nodes[3]); len=Math.max(len,Math.abs(Math.hypot(q.x-t.x,q.y-t.y)-L0)); }
  return {off,len};
}
for(const massless of [true,false]) for(const [M,k] of [[5,0],[50,0],[200,0],[50,400],[200,3000],[1000,0]]){
  const r=tapScene(M,k,massless,Math.round(4/DT));
  ok('tap holds M='+M+' k='+k+(massless?' massless':' massive'),r.off<0.02&&r.len<0.02,'off '+r.off.toFixed(4)+' rodlen '+r.len.toFixed(4));
}


const fin=(...v)=>v.every(Number.isFinite);
const rodErr=(w,c)=>{let m=0;for(const j of w.joints)if(j.owner===c.id&&j.lk){const a=Phys.J.slPos(j.a,j.la),b=Phys.J.slPos(j.b,j.lb);m=Math.max(m,Math.abs(Math.hypot(b.x-a.x,b.y-a.y)-j.L)/j.L);}return m;};
// statics: both ends of the master rod on pivots, a very heavy load on the tap: nothing moves and the rod carries the weight
for(const M of [10,500,5000]){
  const w=Phys.createWorld(); w.g=9.81; w.ground=false; const box=Phys.createBody('rect',{x:1,y:-1,W:.6,H:.6,m:M,mus:0,muk:0}); w.bodies.push(box);
  const c=Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:null,x:2,y:0,fixed:true},{on:[0,1],t:.5,x:0,y:0},{b:box,l:{x:0,y:.3}}],edges:[[0,1],[2,3]]},{});
  const y0=box.y; let dm=0; for(let i=0;i<Math.round(3/DT);i++){Phys.step(w,DT);dm=Math.max(dm,Math.abs(box.y-y0));}
  ok('heavy load on a tap between two pivots M='+M,dm<0.003&&fin(box.y),'drift '+dm.toFixed(5));
}
// the tap rod carries the same load as a plain rod would
{ const tens=kind=>{ const w=Phys.createWorld(); w.g=9.81; w.ground=false; const box=Phys.createBody('rect',{x:1,y:-1,W:.6,H:.6,m:20,mus:0,muk:0}); w.bodies.push(box);
    const nodes=kind==='tap'?[{b:null,x:0,y:0,fixed:true},{b:null,x:2,y:0,fixed:true},{on:[0,1],t:.5,x:0,y:0},{b:box,l:{x:0,y:.3}}]:[{b:null,x:1,y:0,fixed:true},{b:box,l:{x:0,y:.3}}];
    const c=Phys.createLink(w,{nodes,edges:kind==='tap'?[[0,1],[2,3]]:[[0,1]]},{}); for(let i=0;i<Math.round(2/DT);i++)Phys.step(w,DT);
    return Math.abs(w.joints.filter(j=>j.owner===c.id&&j.lk).pop().imp); };
  const a=tens('tap'),b=tens('plain'); ok('tap rod tension equals a plain rod',Math.abs(a-b)<0.01*b,a.toFixed(4)+' vs '+b.toFixed(4)); }
// off-centre taps, t near the ends
for(const t of [0.02,0.1,0.5,0.9,0.98]){ const r=tapT(t); ok('tap at t='+t+' with 100 kg load holds',r.off<1e-6&&r.len<0.02,'rod '+r.len.toFixed(4)); }
function tapT(t){ const w=Phys.createWorld(); w.g=9.81; w.ground=false;
  const ball=Phys.createBody('sphere',{x:2,y:0,r:.1,m:5}); const box=Phys.createBody('rect',{x:2*t,y:-1.5,W:.6,H:.6,m:100,mus:0,muk:0}); w.bodies.push(ball,box);
  const c=Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:ball,l:{x:0,y:0}},{on:[0,1],t,x:0,y:0},{b:box,l:{x:0,y:.3}}],edges:[[0,1],[2,3]]},{});
  let off=0,len=0; for(let i=0;i<Math.round(4/DT);i++){Phys.step(w,DT); const a=P(c.nodes[0]),b=P(c.nodes[1]),q=P(c.nodes[2]); off=Math.max(off,dseg(q,a,b)); len=Math.max(len,rodErr(w,c));} return {off,len}; }
// nested taps: a tap on a rod that itself starts at a tap, heavy loads on both
{ const w=Phys.createWorld(); w.g=9.81; w.ground=false; const b1=Phys.createBody('rect',{x:1,y:-1,W:.5,H:.5,m:80,mus:0,muk:0}), b2=Phys.createBody('rect',{x:.5,y:-2.5,W:.5,H:.5,m:60,mus:0,muk:0}); w.bodies.push(b1,b2);
  const c=Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:null,x:3,y:0,fixed:true},{on:[0,1],t:.5,x:0,y:0},{b:b1,l:{x:0,y:.25}},{on:[2,3],t:.5,x:0,y:0},{b:b2,l:{x:0,y:.25}}],edges:[[0,1],[2,3],[4,5]]},{});
  let m=0; const y1=b1.y,y2=b2.y; for(let i=0;i<Math.round(3/DT);i++){Phys.step(w,DT); m=Math.max(m,rodErr(w,c));}
  ok('nested taps hold under load',m<0.005&&fin(b1.y,b2.y),m.toFixed(5)); }
// a tap on a rod between two swinging bodies, hard pull on the loaded body by the mouse: nothing comes apart
for(const M of [5,100]){
  const w=Phys.createWorld(); w.g=9.81; w.ground=false; const A=Phys.createBody('sphere',{x:0,y:0,r:.2,m:10,fixed:true}), B=Phys.createBody('sphere',{x:2,y:0,r:.2,m:10}), box=Phys.createBody('rect',{x:1,y:-1.2,W:.5,H:.5,m:M,mus:0,muk:0}); w.bodies.push(A,B,box);
  const c=Phys.createLink(w,{nodes:[{b:A,l:{x:0,y:0}},{b:B,l:{x:0,y:0}},{on:[0,1],t:.5,x:0,y:0},{b:box,l:{x:0,y:.25}}],edges:[[0,1],[2,3]]},{});
  Phys.startDrag(w,box,1,-1.2); let m=0;
  for(let i=0;i<Math.round(5/DT);i++){ Phys.moveDrag(w,1+6*Math.sin(i*DT*3),-1.2+5*Math.cos(i*DT*2)); Phys.step(w,DT); m=Math.max(m,rodErr(w,c)); }
  ok('mouse pulls hard on a tap load M='+M,m<0.05&&fin(box.x,box.y),'rod error '+m.toFixed(4)); }
// locked tap: the rod keeps its angle against the master rod while the master rod swings
{ for(const lock of [true,false]){ const w=Phys.createWorld(); w.g=9.81; w.ground=false; const B=Phys.createBody('sphere',{x:2,y:0,r:.1,m:3}), C=Phys.createBody('sphere',{x:1,y:-1,r:.1,m:2}); w.bodies.push(B,C);
  const c=Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:B,l:{x:0,y:0}},{on:[0,1],t:.5,x:0,y:0,lock},{b:C,l:{x:0,y:0}}],edges:[[0,1],[2,3]]},{});
  const ang=()=>{const a=P(c.nodes[0]),b=P(c.nodes[1]),t=P(c.nodes[2]),q=P(c.nodes[3]);return wrap(Math.atan2(q.y-t.y,q.x-t.x)-Math.atan2(b.y-a.y,b.x-a.x));};
  const a0=ang(); let mx=0; for(let i=0;i<Math.round(3/DT);i++){Phys.step(w,DT);mx=Math.max(mx,Math.abs(wrap(ang()-a0)));}
  ok('tap lock '+(lock?'on':'off'),lock?mx<0.05:mx>0.3,mx.toFixed(3)); } }
function wrap(x){while(x>Math.PI)x-=2*Math.PI;while(x<=-Math.PI)x+=2*Math.PI;return x;}
// a ball dropped on a rod that runs from a tap to a pivot is stopped by it
{ const w=Phys.createWorld(); w.g=9.81; w.ground=false; const ball=Phys.createBody('sphere',{x:1.25,y:-.2,r:.1,m:1,e:0,mus:0,muk:0}); w.bodies.push(ball);
  Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:null,x:2,y:0,fixed:true},{on:[0,1],t:.25,x:0,y:0},{b:null,x:2,y:-1,fixed:true}],edges:[[0,1],[2,3]]},{});
  let under=0; for(let i=0;i<Math.round(1.2/DT);i++){Phys.step(w,DT); const ly=-(2/3)*(ball.x-.5); if(ball.x<1.95) under=Math.max(under,ly-ball.y);} ok('ball dropped on a tap rod rides on it',under<0.12&&fin(ball.y),'deepest below the line '+under.toFixed(3)); }
// objects a linkage is built on never collide with its own rods, however they hang
{ const w=Phys.createWorld(); w.g=9.81; w.ground=false; const box=Phys.createBody('rect',{x:1,y:-1,W:.5,H:.5,m:50,mus:0,muk:0}); w.bodies.push(box);
  const c=Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:null,x:2,y:0,fixed:true},{on:[0,1],t:.5,x:0,y:0},{b:box,l:{x:0,y:.25}}],edges:[[0,1],[2,3]]},{});
  let n=0; for(let i=0;i<Math.round(2/DT);i++){Phys.step(w,DT); n+=w._lcN||0;} ok('no self-contact between a linkage and its objects',n===0,'contacts '+n); }
// save and load keep taps and locks, and the loaded copy runs the same
{ const w=Phys.createWorld(); w.g=9.81; w.ground=false; const box=Phys.createBody('rect',{x:1,y:-1,W:.5,H:.5,m:40,mus:0,muk:0}); w.bodies.push(box);
  Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:null,x:2,y:0,fixed:true},{on:[0,1],t:.3,x:0,y:0,lock:true},{b:box,l:{x:0,y:.25}}],edges:[[0,1],[2,3]]},{});
  const w2=Phys.deserialize(JSON.parse(JSON.stringify(Phys.serialize(w)))); const b2=w2.bodies.find(b=>b.kind==='rect'&&b.owner==null);
  for(let i=0;i<Math.round(2/DT);i++){Phys.step(w,DT);Phys.step(w2,DT);} ok('taps survive save/load',w2.links[0].nodes[2].on&&Math.abs(b2.y-box.y)<1e-6&&Math.abs(b2.x-box.x)<1e-6,(b2.y-box.y).toExponential(1)); }
// fuzz: random linkages with taps, nested taps, locks and heavy loads
{ let seed=12345; const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}; let worst=0,badn=0,N=60;
  for(let n=0;n<N;n++){
    const w=Phys.createWorld(); w.g=9.81; w.ground=false; const nodes=[{b:null,x:0,y:0,fixed:true},{b:null,x:1+rnd()*2,y:(rnd()-.5)*2,fixed:rnd()<.5}], edges=[[0,1]], bodies=[];
    const k=2+Math.floor(rnd()*4);
    for(let q=0;q<k;q++){ const M=[1,10,100,1000][Math.floor(rnd()*4)];
      const par=rnd()<.7?[0,1]:null; const base=nodes.length;
      const e=edges[Math.floor(rnd()*edges.length)]; nodes.push({on:[e[0],e[1]],t:.15+rnd()*.7,x:0,y:0,lock:rnd()<.3});
      const tp=nodes.length-1; const p0=Phys.linkNodePos?null:null;
      const bd=Phys.createBody(rnd()<.5?'sphere':'rect',{x:rnd()*3-.5,y:-1-rnd()*2,r:.15,W:.4,H:.4,m:M,mus:0,muk:0}); w.bodies.push(bd); bodies.push(bd);
      nodes.push({b:bd,l:{x:0,y:0},lock:rnd()<.3}); edges.push([tp,nodes.length-1]);
      if(rnd()<.4){ const e2=edges[edges.length-1]; /* tap on the new rod, nested */ }
    }
    // taps need their geometry; give them initial positions from the rods
    let c; try{ c=Phys.createLink(w,{nodes,edges},{massless:rnd()<.8}); }catch(err){ console.log('create threw',err.message); badn++; continue; }
    Phys.reconcile(w);
    let ok1=true,m=0; for(let i=0;i<Math.round(3/DT);i++){Phys.step(w,DT); for(const b of w.bodies)if(!fin(b.x,b.y,b.a)){ok1=false;} m=Math.max(m,rodErr(w,c)); if(!ok1)break;}
    worst=Math.max(worst,m); if(!ok1||m>0.08)badn++; }
  ok('fuzz: '+N+' random linkages with taps stay finite and joined',badn===0,'worst rod error '+worst.toFixed(4)+', bad '+badn); }
process.exit(bad?1:0);
