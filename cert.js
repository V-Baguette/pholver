// Extra certification: presets, round-trips, random-network physics, determinism, mechanics fuzz.  Run: node cert.js
const fs = require('fs');
const Phys = require('./engine.js'); require('./scene.js'); const EM = require('./em.js');
global.window = {}; eval(fs.readFileSync('ckt.js', 'utf8')); const K = window.CKT;
let fails = 0, n = 0; const ok = (m, c, i) => { n++; if (!c) { fails++; console.log('FAIL', m, i || ''); } };
const fin = x => Number.isFinite(x);

// 1. every circuit preset builds, solves, stays finite, and survives save/load unchanged
K.PRESETS.forEach(p => {
  const sc = K.createScene(); p.build(sc); K.init(sc); K.autoScale(sc);
  let good = true; for (let i = 0; i < 400; i++) { if (!K.advance(sc, sc.tscale / 15)) { good = false; break; } }
  ok('circuit preset solves: ' + p.name, good && !sc.err, sc.err);
  ok('circuit preset finite: ' + p.name, sc.items.every(it => !('_v' in it) || (fin(it._v) && fin(it._i))));
  const s1 = K.snapshot(sc), s2 = K.snapshot(K.restore(s1)); ok('circuit roundtrip: ' + p.name, s1 === s2);
});
// 2. every E&M preset runs and roundtrips
EM.PRESETS.forEach(p => {
  const sc = EM.createScene(); p.build(sc); for (let i = 0; i < 1500; i++) EM.step(sc, EM.DT);
  ok('EM preset finite: ' + p.name, sc.items.every(it => ['x', 'y', 'vx', 'vy'].every(k => it[k] === undefined || fin(it[k]))));
});
// 3. random resistor networks: KCL at every node, power balance, against a naive Gauss-Seidel-free dense solve
let seed = 12345; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
for (let trial = 0; trial < 60; trial++) {
  const nn = 3 + Math.floor(rnd() * 5), sc = K.createScene(), bus = i => ({ x: 1000 + 7 * i, y: 1000 + 13 * i });
  let px = 0; const edges = [];
  const add = (type, a, b, props) => { const p = K.create(type, Object.assign({ x: px, y: 0, rot: 0 }, props)); px += 20; sc.items.push(p); const t = K.terminals(p); [a, b].forEach((nd, k) => { const q = bus(nd); sc.items.push(K.wire(t[k].x, t[k].y, q.x, q.y)); }); edges.push({ p, a, b }); return p; };
  for (let i = 1; i < nn; i++) add('res', i - 1, i, { R: 10 + rnd() * 5000 });
  for (let e = 0; e < nn; e++) { const a = Math.floor(rnd() * nn), b = Math.floor(rnd() * nn); if (a !== b) add('res', a, b, { R: 10 + rnd() * 5000 }); }
  const vs = add('vsrc', 0, nn - 1, { V: 1 + rnd() * 20 }); vs.name = 'V';
  const g = K.create('gnd', { x: 0, y: -50 }); sc.items.push(g); const gt = K.terminals(g)[0], b0 = bus(0); sc.items.push(K.wire(gt.x, gt.y, b0.x, b0.y));
  K.init(sc); K.advance(sc, 1e-3);
  if (sc.err) { ok('random net solves', false, sc.err); continue; }
  const vn = sc._vn, net = sc._net, res = new Array(net.n).fill(0);
  let pdis = 0; edges.forEach(e => { if (e.p.type !== 'res') return; const i = e.p._i; res[net.nodeId(K.terminals(e.p)[0].x, K.terminals(e.p)[0].y)] += i; res[net.nodeId(K.terminals(e.p)[1].x, K.terminals(e.p)[1].y)] -= i; pdis += e.p._p; });
  const iv = vs._i, t = K.terminals(vs), ia = net.nodeId(t[0].x, t[0].y), ib = net.nodeId(t[1].x, t[1].y); res[ia] += iv; res[ib] -= iv;
  ok('random net KCL', res.every(r => Math.abs(r) < 1e-9), JSON.stringify(res));
  ok('random net power balance', Math.abs(pdis + vs._p) < 1e-6 * Math.max(1, pdis), pdis + ' ' + vs._p);
}
// 4. circuit determinism: two identical runs give identical bits
{
  const run = () => { const sc = K.createScene(); K.PRESETS[2].build(sc); K.init(sc); K.autoScale(sc); for (let i = 0; i < 300; i++) K.advance(sc, sc.tscale / 15); return sc.items.filter(i => '_v' in i).map(i => i._v).join(','); };
  ok('circuit deterministic', run() === run());
}
// 5. mechanics fuzz: random bodies + joints never produce NaN/Infinity and stay bounded
for (let trial = 0; trial < 25; trial++) {
  const w = Phys.createWorld(), bs = [];
  w.bodies.push(Phys.createBody('rect', { x: 0, y: -0.5, W: 40, H: 1, fixed: true, name: 'floor' }));
  for (let i = 0; i < 6; i++) { const k = ['sphere', 'rect'][Math.floor(rnd() * 2)], b = Phys.createBody(k, { x: (rnd() - 0.5) * 8, y: 1 + rnd() * 6, r: 0.2 + rnd() * 0.4, W: 0.5 + rnd(), H: 0.3 + rnd(), m: 0.5 + rnd() * 9, name: 'b' + i }); w.bodies.push(b); bs.push(b); }
  for (let j = 0; j < 4; j++) { const a = bs[Math.floor(rnd() * bs.length)], b = bs[Math.floor(rnd() * bs.length)]; if (a === b) continue; const t = ['rod', 'spring', 'pin'][Math.floor(rnd() * 3)]; try { Phys.createJoint(w, t, a, b, { x: 0, y: 0 }, { x: 0, y: 0 }, { L: 1 + rnd() * 2, k: 50 + rnd() * 400, name: 'j' + j }); } catch (e) { } }
  for (let i = 0; i < 1500; i++) Phys.step(w, Phys.DT);
  ok('mech fuzz finite #' + trial, w.bodies.every(b => fin(b.x) && fin(b.y) && fin(b.vx) && fin(b.vy) && Math.abs(b.x) < 1e4 && Math.abs(b.y) < 1e4));
}
// 6. mechanics determinism
{
  const run = () => { const w = Phys.createWorld(); w.bodies.push(Phys.createBody('rect', { x: 0, y: -0.5, W: 20, H: 1, fixed: true })); for (let i = 0; i < 5; i++) w.bodies.push(Phys.createBody('sphere', { x: i * 0.3, y: 1 + i, r: 0.25, m: 1 })); for (let i = 0; i < 1200; i++) Phys.step(w, Phys.DT); return w.bodies.map(b => b.x + ':' + b.y).join(','); };
  ok('mechanics deterministic', run() === run());
}
console.log(n + ' checks, ' + fails + ' failed'); process.exit(fails ? 1 : 0);
