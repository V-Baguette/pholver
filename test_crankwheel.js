// a box tied by a rod to the rim of a massless pulley on an axle must not gain energy or make the wheel spin up
const Phys=require('./engine.js'); require('./scene.js'); const DT=Phys.DT;
const w=Phys.deserialize(JSON.parse(require('fs').readFileSync(__dirname+'/test_crankwheel.json','utf8')).data);
const B=w.bodies.find(b=>b.name==='Rectangle 4'), W=w.bodies.find(b=>b.name==='Pulley 2'); let top=-1e9,wm=0;
for(let i=0;i<Math.round(10/DT);i++){Phys.step(w,DT); top=Math.max(top,B.y); wm=Math.max(wm,Math.abs(W.w));}
const ok=top<3.85&&wm<30&&Number.isFinite(B.y); console.log((ok?'ok   ':'FAIL ')+'massless wheel crank is stable  highest '+top.toFixed(3)+' max spin '+wm.toFixed(1)); process.exit(ok?0:1);
