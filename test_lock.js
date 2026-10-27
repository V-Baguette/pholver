const Phys=require('./engine.js'); require('./scene.js');
const DT=Phys.DT; let fails=0; const ok=(n,c,i)=>{console.log((c?'PASS ':'FAIL ')+n+(i?'  '+i:''));if(!c)fails++;};
const run=(w,t)=>{for(let i=0;i<Math.round(t/DT);i++)Phys.step(w,DT);};
const wrap=Phys.J.wrapAngle;
// 1 rod from the world to a block, locked at the block: the block cannot spin relative to the rod
{ for(const lock of [false,true]){
  const w=Phys.createWorld(); w.g=0; w.ground=false;
  const B=Phys.createBody('rect',{x:2,y:0,W:.6,H:.4,m:1,mus:0,muk:0}); w.bodies.push(B);
  const j=Phys.createJoint(w,'rod',w.anchor,B,{x:0,y:0},{x:-.3,y:0},{L:1.7}); if(lock)Phys.J.setLock(j,'b',true);
  B.w=3; let mx=0; for(let i=0;i<Math.round(3/DT);i++){Phys.step(w,DT); const phi=Math.atan2(B.y,B.x+0); mx=Math.max(mx,Math.abs(wrap(B.a-phi)));}
  ok('rod end '+(lock?'locked':'free'),lock?mx<0.05:mx>1,mx.toFixed(3)); } }
// 2 rod locked to the world: a cantilever, the block hangs without swinging
{ const w=Phys.createWorld(); w.g=9.81; w.ground=false;
  const B=Phys.createBody('sphere',{x:1,y:0,r:.1,m:2}); w.bodies.push(B);
  const j=Phys.createJoint(w,'rod',w.anchor,B,{x:0,y:0},{x:0,y:0},{L:1}); Phys.J.setLock(j,'a',true);
  run(w,3); ok('rod locked to world stays put',Math.hypot(B.x-1,B.y)<0.03,`${B.x.toFixed(3)},${B.y.toFixed(3)}`); }
// 3 spring ends locked
{ const w=Phys.createWorld(); w.g=0; w.ground=false;
  const A=Phys.createBody('rect',{x:0,y:0,W:1,H:1,m:5,mus:0,muk:0,fixed:true}), B=Phys.createBody('rect',{x:2.5,y:0,W:1,H:1,m:1,mus:0,muk:0}); w.bodies.push(A,B);
  const j=Phys.createJoint(w,'spring',A,B,{x:.5,y:0},{x:-.5,y:0},{L:1,k:100,c:0}); Phys.J.setLock(j,'a',true); Phys.J.setLock(j,'b',true); B.w=3; let mx=0;
  for(let i=0;i<Math.round(3/DT);i++){Phys.step(w,DT);mx=Math.max(mx,Math.abs(B.a));} ok('spring ends locked',mx<0.05,mx.toFixed(3)); }
// 4 pin lock
{ for(const lock of [false,true]){ const w=Phys.createWorld(); w.g=0; w.ground=false;
  const A=Phys.createBody('rect',{x:0,y:0,W:1,H:.4,m:1,mus:0,muk:0}), B=Phys.createBody('rect',{x:1,y:0,W:1,H:.4,m:1,mus:0,muk:0}); w.bodies.push(A,B);
  const j=Phys.createJoint(w,'pin',A,B,{x:.5,y:0},{x:-.5,y:0},{ref:0}); j.lock=lock; B.w=4; let mx=0;
  for(let i=0;i<Math.round(2/DT);i++){Phys.step(w,DT);mx=Math.max(mx,Math.abs(B.a-A.a));}
  ok('pin '+(lock?'locked':'free'),lock?mx<0.03:mx>1,mx.toFixed(3)); } }
// 5 linkage: a locked free joint keeps the angle between its rods; an unlocked one folds
{ for(const lock of [false,true]){
  const w=Phys.createWorld(); w.g=9.81; w.ground=false; const ball=Phys.createBody('sphere',{x:1,y:-1,r:.1,m:2}); w.bodies.push(ball);
  const c=Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:null,x:1,y:0,lock},{b:ball,l:{x:0,y:0}}],edges:[[0,1],[1,2]]},{});
  const ang=()=>{const p=c.nodes.map(n=>Phys.linkNodePos(n));return wrap(Math.atan2(p[2].y-p[1].y,p[2].x-p[1].x)-Math.atan2(p[1].y-p[0].y,p[1].x-p[0].x));};
  const a0=ang(); let mx=0; for(let i=0;i<Math.round(3/DT);i++){Phys.step(w,DT);mx=Math.max(mx,Math.abs(wrap(ang()-a0)));}
  ok('linkage joint '+(lock?'locked':'free'),lock?mx<0.05:mx>0.5,mx.toFixed(3));
  if(lock){const w3=Phys.deserialize(JSON.parse(JSON.stringify(Phys.serialize(w))));ok('lock survives save/load',w3.links[0].nodes[1].lock===true&&w3.joints.some(j=>j.type==='alock'));} } }
// 5b joint on an object, locked: rods keep their angle to it
{ const w=Phys.createWorld(); w.g=0; w.ground=false; const B=Phys.createBody('rect',{x:1,y:0,W:.6,H:.3,m:1,mus:0,muk:0}); w.bodies.push(B);
  const c=Phys.createLink(w,{nodes:[{b:null,x:0,y:0,fixed:true},{b:B,l:{x:-.3,y:0},lock:true}],edges:[[0,1]]},{}); B.w=3; let mx=0;
  for(let i=0;i<Math.round(3/DT);i++){Phys.step(w,DT);mx=Math.max(mx,Math.abs(wrap(B.a-Math.atan2(B.y,B.x))));} ok('linkage joint locked to an object',mx<0.06,mx.toFixed(3)); }
// 6 serialize rod lock
{ const w=Phys.createWorld(); const B=Phys.createBody('sphere',{x:1,y:0,r:.1,m:1}); w.bodies.push(B); const j=Phys.createJoint(w,'rod',w.anchor,B,{x:0,y:0},{x:0,y:0},{L:1}); Phys.J.setLock(j,'a',true);
  const w2=Phys.deserialize(JSON.parse(JSON.stringify(Phys.serialize(w)))); const r=w2.joints.find(q=>q.type==='rod'); ok('rod lock serialized',r&&r.lkA===true); }
// 7 arbitrary angles: rotated bodies, rod at a slant, lock at either end, nothing may jump at the start
for(const lock of ['a','b','both']){ for(const rot of [0.4,-1.1,2.5]){
  const w=Phys.createWorld(); w.g=9.81;
  const T=Phys.createBody('rect',{x:0,y:3,base:2,height:.5,fixed:true,a:rot}),B=Phys.createBody('rect',{x:.6,y:2.1,base:1.4,height:.4,m:2,a:rot*0.5});w.bodies.push(T,B);
  const j=Phys.createJoint(w,'rod',T,B,{x:.3,y:-.25},{x:-.2,y:.2},{L:1});
  Phys.createJoint(w,'spring',w.anchor,B,{x:-2,y:2},{x:-.6,y:0},{L:.8,k:40,c:1});
  Phys.reconcile(w); if(lock!=='b')Phys.J.setLock(j,'a',true); if(lock!=='a')Phys.J.setLock(j,'b',true);
  const a0=B.a, p0=[B.x,B.y]; let mx=0,mp=0; for(let i=0;i<Math.round(1/DT);i++){Phys.step(w,DT); if(lock==='both'){mx=Math.max(mx,Math.abs(wrap(B.a-a0)));mp=Math.max(mp,Math.hypot(B.x-p0[0],B.y-p0[1]));} else {mp=Math.max(mp,Math.hypot(B.x-p0[0],B.y-p0[1]));}}
  const rel=(()=>{common=Phys.J._h.common;common(j);const dx=B.x+j.rbx-T.x-j.rax,dy=B.y+j.rby-T.y-j.ray;const phi=Math.atan2(dy,dx);return [wrap(phi-T.a-j.lA),wrap(phi+Math.PI-B.a-j.lB)];})();
  const e=lock==='a'?Math.abs(rel[0]):lock==='b'?Math.abs(rel[1]):Math.max(Math.abs(rel[0]),Math.abs(rel[1]));
  ok('slanted '+lock+' rot '+rot+': locked angle held, no jump',e<0.05&&mp<0.9,`err ${e.toFixed(3)} moved ${mp.toFixed(2)}`); } }
process.exit(fails?1:0);
