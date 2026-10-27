const Phys = require('../engine.js'); require('../scene.js');
const DT = Phys.DT, G = 9.81, Z = { x: 0, y: 0 };
let fails = 0;
const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '   ' + info : '')); if (!cond) fails++; };
const pct = (got, exp) => Math.abs(got - exp) / Math.abs(exp) * 100;
const world = (g) => { const w = Phys.createWorld(); w.g = g == null ? G : g; w.ground = false; return w; };
const ball = (w, x, y, m, o) => { const b = Phys.createBody('sphere', Object.assign({ x, y, m, r: 0.1, mus: 0, muk: 0 }, o || {})); w.bodies.push(b); return b; };
const rect = (w, x, y, W, H, m, o) => { const b = Phys.createBody('rect', Object.assign({ x, y, W, H, m, mus: 0, muk: 0 }, o || {})); w.bodies.push(b); return b; };
const run = (w, secs, cb) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { Phys.step(w, DT); if (cb) cb(i * DT + DT); } };
// period from successive same-direction zero crossings of a signal
function period(sig) {
  const t = []; for (let i = 1; i < sig.length; i++) { const a = sig[i - 1], b = sig[i]; if (a.v < 0 && b.v >= 0) t.push(a.t + (b.t - a.t) * (-a.v) / (b.v - a.v)); }
  return t.length < 2 ? NaN : (t[t.length - 1] - t[0]) / (t.length - 1);
}
function ellipticK(k) { let a = 1, b = Math.sqrt(1 - k * k); for (let i = 0; i < 30; i++) { const an = (a + b) / 2; b = Math.sqrt(a * b); a = an; } return Math.PI / (2 * a); }

// 1. spring-mass SHO period and energy
{
  const w = world(0), b = ball(w, 3, 0, 1); Phys.createJoint(w, 'spring', null, b, { x: 0, y: 0 }, Z, { L: 2, k: 100, c: 0 });
  const s = []; run(w, 4, t => s.push({ t, v: b.x - 2 }));
  const T = period(s), E = Phys.energy(w).total;
  ok('spring SHO period', pct(T, 2 * Math.PI / 10) < 0.5, `T ${T.toFixed(5)} vs ${(2 * Math.PI / 10).toFixed(5)} (${pct(T, 2 * Math.PI / 10).toFixed(3)}%)`);
  ok('spring energy conserved', pct(E, 50) < 0.5, `E ${E.toFixed(3)} vs 50 (${pct(E, 50).toFixed(3)}%)`);
}
// 2. damped oscillator against the closed form
{
  const w = world(0), b = ball(w, 3, 0, 1); Phys.createJoint(w, 'spring', null, b, { x: 0, y: 0 }, Z, { L: 2, k: 100, c: 2 });
  const zeta = 0.1, wn = 10, wd = wn * Math.sqrt(1 - zeta * zeta); let worst = 0;
  run(w, 2.5, t => { const x = Math.exp(-zeta * wn * t) * (Math.cos(wd * t) + zeta * wn / wd * Math.sin(wd * t)); worst = Math.max(worst, Math.abs((b.x - 2) - x)); });
  ok('damped spring vs analytic', worst < 0.01, `max error ${(worst * 100).toFixed(3)}% of amplitude`);
}
// 3. hanging mass equilibrium
{
  const w = world(), b = ball(w, 0, 4, 2); Phys.createJoint(w, 'spring', null, b, { x: 0, y: 5 }, Z, { L: 1, k: 200, c: 10 });
  run(w, 6); const ext = 5 - b.y - 1;
  ok('spring equilibrium extension mg/k', pct(ext, 2 * G / 200) < 0.5, `${ext.toFixed(5)} vs ${(2 * G / 200).toFixed(5)}`);
}
// 4. two free bodies, reduced mass
{
  const w = world(0), a = ball(w, 0, 0, 1), b = ball(w, 3, 0, 3); Phys.createJoint(w, 'spring', a, b, Z, Z, { L: 2, k: 50, c: 0 });
  const s = []; run(w, 5, t => s.push({ t, v: (b.x - a.x) - 2 }));
  const mu = 0.75, Te = 2 * Math.PI * Math.sqrt(mu / 50), T = period(s), com = (a.x * 1 + b.x * 3) / 4;
  ok('two-body spring period (reduced mass)', pct(T, Te) < 0.5, `T ${T.toFixed(5)} vs ${Te.toFixed(5)}`);
  ok('centre of mass stays put', Math.abs(com - 2.25) < 1e-6, `drift ${(com - 2.25).toExponential(2)}`);
}
// 5. very stiff spring (substepping keeps it stable and accurate)
{
  const w = world(0), b = ball(w, 1.1, 0, 10); Phys.createJoint(w, 'spring', null, b, { x: 0, y: 0 }, Z, { L: 1, k: 1e5, c: 0 });
  const s = []; run(w, 2, t => s.push({ t, v: b.x - 1 })); const Te = 2 * Math.PI * Math.sqrt(10 / 1e5), T = period(s);
  ok('stiff spring period (k = 1e5)', pct(T, Te) < 1, `T ${T.toFixed(6)} vs ${Te.toFixed(6)} (${pct(T, Te).toFixed(3)}%)`);
}
// 6. rod pendulum, large amplitude vs elliptic integral
for (const th0 of [0.3, 1.2]) {
  const w = world(), L = 1.5, b = ball(w, L * Math.sin(th0), -L * Math.cos(th0), 2); Phys.createJoint(w, 'rod', null, b, { x: 0, y: 0 }, Z, { L });
  const s = []; let drift = 0; const E0 = Phys.energy(w).total;
  run(w, 14, t => { s.push({ t, v: b.x }); drift = Math.max(drift, Math.abs(Math.hypot(b.x, b.y) - L)); });
  const Te = 4 * Math.sqrt(L / G) * ellipticK(Math.sin(th0 / 2)), T = period(s), E1 = Phys.energy(w).total;
  ok(`rod pendulum period, amplitude ${th0} rad`, pct(T, Te) < 0.5, `T ${T.toFixed(5)} vs ${Te.toFixed(5)} (${pct(T, Te).toFixed(3)}%), length drift ${(drift * 1000).toFixed(3)} mm, energy ${pct(E1, E0).toFixed(3)}%`);
}
// 7. inextensible rope: slack flight, then taut
{
  const w = world(), L = 1, b = ball(w, 0, -0.5, 1); Phys.createJoint(w, 'rope', null, b, { x: 0, y: 0 }, Z, { L, ext: false });
  b.vx = 2; b.vy = 3;
  let tt = 0; for (let t = 0; t < 2; t += 1e-4) { const x = 2 * t, y = -0.5 + 3 * t - 0.5 * G * t * t; if (Math.hypot(x, y) >= L) { tt = t; break; } }
  const probe = 0.9 * tt; let got = null; run(w, probe, () => { }); got = { x: b.x, y: b.y };
  const ex = 2 * probe, ey = -0.5 + 3 * probe - 0.5 * G * probe * probe;
  ok('slack rope: free flight matches projectile', Math.hypot(got.x - ex, got.y - ey) < 0.01, `error ${(Math.hypot(got.x - ex, got.y - ey) * 1000).toFixed(3)} mm, taut at ${tt.toFixed(4)} s`);
  let over = 0; run(w, 5, () => { over = Math.max(over, Math.hypot(b.x, b.y) - L); });
  ok('rope never stretches after going taut', over < 0.002, `max overshoot ${(over * 1000).toFixed(3)} mm`);
}
// 8. extensible rope: taut oscillation and bounce from slack
{
  const w = world(), m = 2, k = 500, b = ball(w, 0, 3, m); Phys.createJoint(w, 'rope', null, b, { x: 0, y: 5 }, Z, { L: 2, ext: true, k, c: 0 });
  const s = []; let peak = 0; run(w, 3, t => { s.push({ t, v: -(b.y - (3 - m * G / k)) }); peak = Math.max(peak, 5 - b.y - 2); });
  const Te = 2 * Math.PI * Math.sqrt(m / k), T = period(s), xe = m * G / k;
  ok('extensible rope oscillation period', pct(T, Te) < 0.5, `T ${T.toFixed(5)} vs ${Te.toFixed(5)}`);
  ok('extensible rope peak stretch = 2mg/k', pct(peak, 2 * xe) < 1, `${peak.toFixed(5)} vs ${(2 * xe).toFixed(5)}`);
}
{
  const w = world(), m = 2, k = 800, b = ball(w, 0, 4.5, m); Phys.createJoint(w, 'rope', null, b, { x: 0, y: 5 }, Z, { L: 2, ext: true, k, c: 0 });
  let peak = 0; run(w, 1.2, () => { peak = Math.max(peak, 5 - b.y - 2); });
  const mg = m * G, xm = (mg + Math.sqrt(mg * mg + 2 * k * mg * 1.5)) / k;
  ok('bounce after free fall through slack rope', pct(peak, xm) < 1, `peak stretch ${peak.toFixed(5)} vs ${xm.toFixed(5)}`);
}
// 9. physical pendulum on a pin
{
  const w = world(), W = 2, H = 0.2, m = 3, th0 = 0.1, a = -Math.PI / 2 + th0;
  const r = Phys.createBody('rect', { W, H, m, a, mus: 0, muk: 0 }); w.bodies.push(r);
  r.x = -(Math.cos(a) * -1); r.y = -(Math.sin(a) * -1);   // centre = pin - R(a) * (-1, 0)
  Phys.createJoint(w, 'pin', null, r, { x: 0, y: 0 }, { x: -1, y: 0 }, { ref: -Math.PI / 2 });
  const s = []; run(w, 14, t => s.push({ t, v: r.a + Math.PI / 2 }));
  const I = m * (W * W + H * H) / 12 + m, Te = 2 * Math.PI * Math.sqrt(I / (m * G * 1)) * (1 + th0 * th0 / 16), T = period(s);
  ok('physical pendulum on pin', pct(T, Te) < 0.5, `T ${T.toFixed(5)} vs ${Te.toFixed(5)} (${pct(T, Te).toFixed(3)}%)`);
}
// 10. double pendulum energy
{
  const w = world(), a = rect(w, 0.5, 0, 1, 0.1, 1), b = rect(w, 1.5, 0, 1, 0.1, 1);
  Phys.createJoint(w, 'pin', null, a, Z, { x: -0.5, y: 0 }); Phys.createJoint(w, 'pin', a, b, { x: 0.5, y: 0 }, { x: -0.5, y: 0 });
  const E0 = Phys.energy(w).total; let worst = 0, gap = 0, peak = 0;
  run(w, 6, () => { const E = Phys.energy(w); peak = Math.max(peak, E.ke); worst = Math.max(worst, Math.abs(E.total - E0)); const p = Phys.J.pt(a, { x: 0.5, y: 0 }), q = Phys.J.pt(b, { x: -0.5, y: 0 }); gap = Math.max(gap, Math.hypot(p.x - q.x, p.y - q.y)); });
  const range = Math.abs(E0) + 1;
  ok('double pendulum conserves energy', worst / peak * 100 < 1, `max error ${(worst / peak * 100).toFixed(3)}% of peak kinetic energy (${peak.toFixed(2)} J), joint gap ${(gap * 1000).toFixed(3)} mm`);
}
// 11. torsion spring period
{
  const w = world(0), I = 0.25, k = 10, b = ball(w, 0, 0, 2, { r: 0.5, a: 0.5 });
  Phys.createJoint(w, 'pin', null, b, Z, Z, { ks: k });
  const s = []; run(w, 5, t => s.push({ t, v: b.a })); const Te = 2 * Math.PI * Math.sqrt(I / k), T = period(s);
  ok('torsion spring period', pct(T, Te) < 0.5, `T ${T.toFixed(5)} vs ${Te.toFixed(5)}`);
}
// 12. pin motor: speed and torque limit
{
  const w = world(0), b = ball(w, 0, 0, 2, { r: 0.5 }); Phys.createJoint(w, 'pin', null, b, Z, Z, { motor: true, ms: 3, mt: 100 });
  run(w, 0.5); ok('motor reaches commanded speed', pct(b.w, 3) < 0.1, `w ${b.w.toFixed(5)} vs 3`);
  const w2 = world(0), c = ball(w2, 0, 0, 2, { r: 0.5 }); Phys.createJoint(w2, 'pin', null, c, Z, Z, { motor: true, ms: 50, mt: 0.5 });
  run(w2, 0.5); ok('motor torque limit (alpha = tau/I)', pct(c.w, 0.5 / 0.25 * 0.5) < 0.5, `w ${c.w.toFixed(5)} vs ${(0.5 / 0.25 * 0.5).toFixed(5)}`);
}
// 13. angle limit
{
  const w = world(), W = 2, H = 0.2, th0 = 0.5, a = -Math.PI / 2 + th0, r = Phys.createBody('rect', { W, H, m: 3, a, mus: 0, muk: 0 }); w.bodies.push(r);
  r.x = -(Math.cos(a) * -1); r.y = -(Math.sin(a) * -1);
  Phys.createJoint(w, 'pin', null, r, Z, { x: -1, y: 0 }, { ref: -Math.PI / 2, lim: true, lo: -0.3, hi: 0.8 });
  let mn = 9; run(w, 6, () => { mn = Math.min(mn, r.a + Math.PI / 2); });
  ok('pin angle limit holds at -0.3 rad', Math.abs(mn + 0.3) < 0.003, `min angle ${mn.toFixed(5)} rad (${Math.abs(mn + 0.3).toExponential(2)} off)`);
}
// 14. weld: composite physical pendulum
{
  const w = world(), A = rect(w, 0.75, 0, 1.5, 0.2, 2), B = rect(w, 1.75, 0, 0.5, 0.5, 4);
  const th0 = 0.1; const rot = (x, y) => ({ x: Math.cos(-Math.PI / 2 + th0) * x - Math.sin(-Math.PI / 2 + th0) * y, y: Math.sin(-Math.PI / 2 + th0) * x + Math.cos(-Math.PI / 2 + th0) * y });
  [[A, 0.75], [B, 1.75]].forEach(([b, d]) => { const p = rot(d, 0); b.x = p.x; b.y = p.y; b.a = -Math.PI / 2 + th0; });
  Phys.createJoint(w, 'pin', null, A, Z, { x: -0.75, y: 0 }, { ref: -Math.PI / 2 }); Phys.createJoint(w, 'weld', A, B, { x: 0.75, y: 0 }, { x: -0.25, y: 0 }, { ref: 0 });
  const s = []; let rel = 0; run(w, 14, t => { s.push({ t, v: A.a + Math.PI / 2 }); rel = Math.max(rel, Math.abs(B.a - A.a)); });
  const I = 2 * (1.5 * 1.5 + 0.04) / 12 + 2 * 0.75 * 0.75 + 4 * (0.5 * 0.5 + 0.25) / 12 + 4 * 1.75 * 1.75, M = 6, d = (2 * 0.75 + 4 * 1.75) / 6;
  const Te = 2 * Math.PI * Math.sqrt(I / (M * G * d)) * (1 + th0 * th0 / 16), T = period(s);
  ok('welded bodies swing as one rigid body', pct(T, Te) < 0.5 && rel < 1e-3, `T ${T.toFixed(5)} vs ${Te.toFixed(5)} (${pct(T, Te).toFixed(3)}%), relative angle drift ${rel.toExponential(2)}`);
}
// 15. slider: acceleration, limit, motor
{
  const w = world(), th = Math.PI / 6, b = rect(w, 0, 0, 0.6, 0.4, 2);
  Phys.createJoint(w, 'slider', null, b, Z, Z, { ax: -th, ref: 0 });
  run(w, 1); const s = b.x * Math.cos(th) - b.y * Math.sin(th), perp = b.x * Math.sin(th) + b.y * Math.cos(th), exp = 0.5 * G * Math.sin(th);
  ok('slider acceleration g sin(theta)', pct(s, exp) < 0.5, `s ${s.toFixed(5)} vs ${exp.toFixed(5)}, off-axis ${Math.abs(perp).toExponential(2)}, tilt ${Math.abs(b.a).toExponential(2)}`);
  const w2 = world(), c = rect(w2, 0, 0, 0.6, 0.4, 2); Phys.createJoint(w2, 'slider', null, c, Z, Z, { ax: -th, lim: true, lo: -1, hi: 1 });
  run(w2, 3); const s2 = c.x * Math.cos(th) - c.y * Math.sin(th);
  ok('slider limit', Math.abs(s2 - 1) < 0.005, `rests at ${s2.toFixed(5)} (limit 1)`);
  const w3 = world(0), d = rect(w3, 0, 0, 0.6, 0.4, 2); Phys.createJoint(w3, 'slider', null, d, Z, Z, { ax: 0, motor: true, ms: 2, mf: 1000 });
  run(w3, 0.5); ok('slider motor speed', pct(d.vx, 2) < 0.1, `v ${d.vx.toFixed(5)} vs 2`);
}
// 16. pulley (Atwood machine, and a 2:1 block and tackle)
{
  const w = world(), m1 = 3, m2 = 1, a = ball(w, -0.5, 3, m1), b = ball(w, 0.5, 3, m2);
  Phys.createJoint(w, 'pulley', a, b, Z, Z, { ga: { x: -0.5, y: 5 }, gb: { x: 0.5, y: 5 }, ratio: 1, L: 4 });
  run(w, 0.8); const acc = (m1 - m2) * G / (m1 + m2), exp = 0.5 * acc * 0.64;
  ok('Atwood machine displacement', pct(3 - a.y, exp) < 0.5 && pct(b.y - 3, exp) < 0.5, `${(3 - a.y).toFixed(5)} / ${(b.y - 3).toFixed(5)} vs ${exp.toFixed(5)}`);
  const w2 = world(), p = ball(w2, -0.5, 3, 3), q = ball(w2, 0.5, 3, 1);
  Phys.createJoint(w2, 'pulley', p, q, Z, Z, { ga: { x: -0.5, y: 5 }, gb: { x: 0.5, y: 5 }, ratio: 2, L: 6 });
  run(w2, 0.5); const Tn = 1.5 * G / (2 / 1 + 1 / (2 * 3)), a1 = G - Tn / 3, e1 = 0.5 * a1 * 0.25;
  ok('2:1 pulley displacement', pct(3 - p.y, e1) < 0.5 && pct(q.y - 3, e1 / 2) < 0.5, `${(3 - p.y).toFixed(5)} vs ${e1.toFixed(5)}; other ${(q.y - 3).toFixed(5)} vs ${(e1 / 2).toFixed(5)}`);
}
// 17. applied force and torque
{
  const w = world(0), b = ball(w, 0, 0, 2, { fx: 10, tq: 1, r: 0.5 }); run(w, 1);
  ok('constant force F = ma', pct(b.x, 2.5) < 0.1, `x ${b.x.toFixed(5)} vs 2.5`);
  ok('constant torque tau = I alpha', pct(b.w, 4) < 0.1, `w ${b.w.toFixed(5)} vs 4`);
}
// 18. chain hanging between two points vs the catenary
{
  const w = world(), L = 5, n = 40;
  const c = Phys.createChain(w, { b: null, l: { x: -2, y: 5 } }, { b: null, l: { x: 2, y: 5 } }, { L, n, mass: 8, r: 0.03, damp: 3 });
  c.nodes.forEach(b => { b.y = 5 - 0.5 * Math.sin(Math.PI * (b.x + 2) / 4) * 0.2; });   // start off the answer
  run(w, 10);
  const S = L, dx = 4, target = S / dx; let lo = 1e-9, hi = 600; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (Math.sinh(m) / m < target) lo = m; else hi = m; }
  const u = (lo + hi) / 2, a = dx / (2 * u), sag = a * (Math.cosh(u) - 1), mid = 5 - c.nodes[n / 2].y;
  let len = Phys.chainLength(c), worst = 0;
  c.nodes.forEach(b => { const exp = 5 - a * (Math.cosh((b.x) / a) - Math.cosh(u)); worst = Math.max(worst, Math.abs(b.y - (5 - sag) - (exp - (5 - sag)) + 0)); });
  let shape = 0; c.nodes.forEach(b => { const yth = 5 - sag + a * (Math.cosh(b.x / a) - 1); shape = Math.max(shape, Math.abs(b.y - yth)); });
  ok('chain sag vs catenary', pct(mid, sag) < 1, `sag ${mid.toFixed(5)} vs ${sag.toFixed(5)} (${pct(mid, sag).toFixed(3)}%)`);
  ok('chain shape vs catenary (max deviation / sag)', shape / sag * 100 < 1, `${(shape / sag * 100).toFixed(3)}% of sag`);
  ok('chain length preserved', pct(len, L) < 0.1, `${len.toFixed(5)} vs ${L}`);
}
// 19. mouse drag: free body and constrained body
{
  const w = world(0), b = ball(w, 0, 0, 1); Phys.startDrag(w, b, 0, 0); Phys.moveDrag(w, 3, 2); run(w, 3);
  ok('dragged free body reaches the cursor', Math.hypot(b.x - 3, b.y - 2) < 0.02, `at (${b.x.toFixed(4)}, ${b.y.toFixed(4)})`);
  const w2 = world(0), c = ball(w2, 2, 0, 1); Phys.createJoint(w2, 'rod', null, c, Z, Z, { L: 2 }); Phys.startDrag(w2, c, 2, 0); Phys.moveDrag(w2, 0, 5); run(w2, 4);
  ok('dragged rod bob stays on its circle, pointing at the cursor', Math.abs(Math.hypot(c.x, c.y) - 2) < 0.005 && Math.abs(c.x) < 0.02 && pct(c.y, 2) < 1, `at (${c.x.toFixed(4)}, ${c.y.toFixed(4)})`);
  const w3 = world(0), d = ball(w3, 2, 0, 1); Phys.createJoint(w3, 'rod', null, d, Z, Z, { L: 2 }); w3.pose = true; Phys.startDrag(w3, d, 2, 0, { hertz: 15, maxF: 1e7 }); Phys.moveDrag(w3, 0, 5); run(w3, 1);
  ok('pose mode (paused drag) positions a constrained body', Math.abs(d.x) < 0.02 && pct(d.y, 2) < 1 && Math.abs(d.vx) + Math.abs(d.vy) < 1e-9, `at (${d.x.toFixed(4)}, ${d.y.toFixed(4)})`);
}
{
  // collisions must still happen between bodies that share a rod, pulley, spring or rope
  for (const type of ['pulley', 'rod', 'spring', 'rope']) {
    const w = world(9.81); w.ground = false;
    const box = Phys.createBody('rect', { W: 4, H: 1, x: 0, y: 0, fixed: true }); w.bodies.push(box);
    const b = ball(w, 0, 1.2, 1); b.r = 0.5; Phys.rebuild(b);
    const opts = type === 'pulley' ? { ga: { x: -3, y: 6 }, gb: { x: 3, y: 6 }, L: 40 } : type === 'rod' ? { L: 1.2 } : type === 'spring' ? { L: 1.2, k: 1 } : { L: 5 };
    Phys.createJoint(w, type, box, b, { x: 0, y: 0 }, { x: 0, y: 0 }, opts);
    run(w, 3);
    ok(type + '-joined bodies still collide', b.y > 0.95 && b.y < 1.4, 'ball y = ' + b.y.toFixed(3));
  }
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
