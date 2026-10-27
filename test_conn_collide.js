// Every connector type must stop a body that runs into it.
const Phys = require('./engine.js'); require('./scene.js');
const DT = Phys.DT, G = 9.81, Z = { x: 0, y: 0 };
let fails = 0;
const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '   ' + i : '')); if (!c) fails++; };
const world = g => { const w = Phys.createWorld(); w.g = g == null ? G : g; w.ground = false; return w; };
const ball = (w, x, y, m, o) => { const b = Phys.createBody('sphere', Object.assign({ x, y, m, r: 0.1, mus: 0, muk: 0, e: 0 }, o || {})); w.bodies.push(b); return b; };
const box = (w, x, y, W, H, m, o) => { const b = Phys.createBody('rect', Object.assign({ x, y, W, H, m, mus: 0, muk: 0, e: 0 }, o || {})); w.bodies.push(b); return b; };
const run = (w, s, cb) => { const n = Math.round(s / DT); for (let i = 0; i < n; i++) { Phys.step(w, DT); if (cb) cb(); } };
const att = (b, x, y) => ({ b, l: Phys.localOf(b, x, y) });
const anchors = w => [ball(w, -1, 2, 1, { fixed: true, r: 0.02 }), ball(w, 1, 2, 1, { fixed: true, r: 0.02 })];

for (const kind of ['spring', 'rod', 'rope (extensible)', 'rope (inextensible)']) {
  for (const shape of ['ball', 'box']) {
    const w = world(), [A, B] = anchors(w);
    const pa = { b: A, l: Z }, pb = { b: B, l: Z };
    if (kind === 'spring') Phys.createJoint(w, 'spring', A, B, Z, Z, { L: 2, k: 100 });
    else if (kind === 'rod') Phys.createJoint(w, 'rod', A, B, Z, Z, { L: 2 });
    else if (kind === 'rope (extensible)') Phys.createJoint(w, 'rope', A, B, Z, Z, { L: 2, ext: true, k: 2000, c: 20 });
    else Phys.createWrap(w, pa, pb, []);
    const m = shape === 'ball' ? ball(w, 0, 3, 1) : box(w, 0, 3, 0.3, 0.3, 1);
    let minY = 9; run(w, 1.5, () => { minY = Math.min(minY, m.y); });
    const half = shape === 'ball' ? 0.1 : 0.15;
    ok(`${shape} dropped on a ${kind} is stopped`, minY > 2 + half - 0.03 && m.y > 2, `lowest centre ${minY.toFixed(3)} (rests at ~${(2 + half).toFixed(3)})`);
  }
}
// slack rope (chain of linked bodies)
{
  const w = world(), [A, B] = anchors(w);
  const c = Phys.createChain(w, { b: A, l: Z }, { b: B, l: Z }, { name: 'c' });
  const m = ball(w, 0, 3, 1); let minY = 9; run(w, 1.5, () => { minY = Math.min(minY, m.y); });
  const mid = c.nodes[Math.floor(c.nodes.length / 2)];
  ok('ball dropped on a slack rope is stopped', m.y > mid.y && m.y > 1.5, `ball y ${m.y.toFixed(3)}, chain mid y ${mid.y.toFixed(3)}`);
}
// momentum: free rod between two equal masses, ball hits the middle in zero gravity. Total momentum is conserved.
for (const kind of ['rod', 'spring']) {
  const w = world(0), a = ball(w, -1, 0, 1), b = ball(w, 1, 0, 1), h = ball(w, 0, 1, 1); h.vy = -3;
  Phys.createJoint(w, kind, a, b, Z, Z, { L: 2, k: 50 });
  run(w, 0.4);
  const py = a.m * a.vy + b.m * b.vy + h.m * h.vy;
  ok(`${kind}: hit in the middle, momentum conserved`, Math.abs(py + 3) < 0.03 && Math.abs(a.vy - b.vy) < 0.05 && h.vy > -3, `p ${py.toFixed(3)} vs -3, ends ${a.vy.toFixed(3)} / ${b.vy.toFixed(3)}, ball ${h.vy.toFixed(3)}`);
}
// a connector can opt out
{
  const w = world(), [A, B] = anchors(w); const j = Phys.createJoint(w, 'rod', A, B, Z, Z, { L: 2 }); j.oc = false;
  const m = ball(w, 0, 3, 1); run(w, 1, null);
  ok('"Collide with objects" off lets a ball through', m.y < 1.5, 'y ' + m.y.toFixed(3));
}
// a spring pinned to a wall does not fight the wall
{
  const w = world(), wall = box(w, 0, 1, 1, 2, 1, { fixed: true }), b = box(w, 1.5, 0.3, 0.4, 0.4, 1);
  Phys.createJoint(w, 'spring', wall, b, { x: 0.5, y: -0.7 }, Z, { L: 1, k: 50 });
  const g = box(w, 0, -0.1, 6, 0.2, 1, { fixed: true });
  run(w, 2, null); ok('spring rooted in a wall stays stable', isFinite(b.x) && Math.abs(b.y - 0.3) < 0.2, `block ${b.x.toFixed(3)}, ${b.y.toFixed(3)}`);
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
