const Phys = require('./engine.js'); require('./scene.js');
const DT = Phys.DT, G = 9.81, Z = { x: 0, y: 0 };
let fails = 0;
const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '   ' + info : '')); if (!cond) fails++; };
const pct = (got, exp) => Math.abs(got - exp) / Math.abs(exp) * 100;
const world = (g) => { const w = Phys.createWorld(); w.g = g == null ? G : g; w.ground = false; return w; };
const ball = (w, x, y, m, o) => { const b = Phys.createBody('sphere', Object.assign({ x, y, m, r: 0.1, mus: 0, muk: 0 }, o || {})); w.bodies.push(b); return b; };
const rect = (w, x, y, W, H, m, o) => { const b = Phys.createBody('rect', Object.assign({ x, y, W, H, m, mus: 0, muk: 0 }, o || {})); w.bodies.push(b); return b; };
const run = (w, secs, cb) => { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { Phys.step(w, DT); if (cb) cb(i * DT + DT); } };
function period(sig) { const t = []; for (let i = 1; i < sig.length; i++) { const a = sig[i - 1], b = sig[i]; if (a.v < 0 && b.v >= 0) t.push(a.t + (b.t - a.t) * (-a.v) / (b.v - a.v)); } return t.length < 2 ? NaN : (t[t.length - 1] - t[0]) / (t.length - 1); }
const wheel = (w, x, y, R, o) => { const b = Phys.createWheel(w, x, y, Object.assign({ r: R }, o || {})); return b; };
const att = (b, x, y) => ({ b, l: Phys.localOf(b, x, y) });
const WORLD = (x, y) => ({ b: null, l: { x, y } });

// 1. Atwood machine, ideal (massless) fixed wheel. a = (m1-m2)g/(m1+m2), T = 2 m1 m2 g/(m1+m2)
{
  const w = world(), W = wheel(w, 0, 5, 0.5), m1 = ball(w, -0.5, 3, 3), m2 = ball(w, 0.5, 3, 1);
  const j = Phys.createWrap(w, att(m1, -0.5, 3), att(m2, 0.5, 3), [W]); const L0 = j.L;
  const t = 0.6; run(w, t);
  const a = (3 - 1) * G / 4, y1 = 3 - 0.5 * a * t * t, v1 = -a * t, Tn = 2 * 3 * 1 * G / 4;
  ok('Atwood (ideal wheel): displacement', pct(3 - m1.y, 0.5 * a * t * t) < 1, `drop ${(3 - m1.y).toFixed(4)} vs ${(0.5 * a * t * t).toFixed(4)} (${pct(3 - m1.y, 0.5 * a * t * t).toFixed(3)}%)`);
  ok('Atwood (ideal wheel): speed', pct(-m1.vy, a * t) < 1, `v ${(-m1.vy).toFixed(4)} vs ${(a * t).toFixed(4)}`);
  const r = Phys.J.read(j); ok('Atwood (ideal wheel): tension', pct(r.tension, Tn) < 1, `T ${r.tension.toFixed(4)} vs ${Tn.toFixed(4)}`);
  ok('Atwood: rope length conserved', pct(Phys.J.wrapLength(j), L0) < 0.05, `len ${Phys.J.wrapLength(j).toFixed(5)} vs ${L0.toFixed(5)}`);
  ok('Atwood: massless wheel turns with the rope', Math.abs(Math.abs(W.w) * 0.5 - Math.abs(m1.vy)) < 0.01, `wheel rim ${(Math.abs(W.w) * 0.5).toFixed(4)} vs ${Math.abs(m1.vy).toFixed(4)}`);
}
// 2. Atwood with a massive disc wheel: a = (m1-m2) g / (m1 + m2 + I/R^2), I = M R^2 / 2
{
  const w = world(), M = 2, R = 0.5, W = wheel(w, 0, 5, R, { massless: false, m: M }), m1 = ball(w, -0.5, 3, 3), m2 = ball(w, 0.5, 3, 1);
  const j = Phys.createWrap(w, att(m1, -0.5, 3), att(m2, 0.5, 3), [W]);
  const t = 0.6; run(w, t);
  const a = (3 - 1) * G / (3 + 1 + M / 2), T1 = 3 * (G - a), T2 = 1 * (G + a);
  ok('Atwood (massive wheel): displacement', pct(3 - m1.y, 0.5 * a * t * t) < 1, `drop ${(3 - m1.y).toFixed(4)} vs ${(0.5 * a * t * t).toFixed(4)} (${pct(3 - m1.y, 0.5 * a * t * t).toFixed(3)}%)`);
  const r = Phys.J.read(j);
  ok('Atwood (massive wheel): tensions differ correctly', pct(r.tensions[0], T1) < 1 && pct(r.tensions[1], T2) < 1, `T1 ${r.tensions[0].toFixed(3)} vs ${T1.toFixed(3)}, T2 ${r.tensions[1].toFixed(3)} vs ${T2.toFixed(3)}`);
  ok('Atwood (massive wheel): wheel spin matches rope', pct(Math.abs(W.w) * R, -m1.vy) < 1, `rim ${(Math.abs(W.w) * R).toFixed(4)} vs ${(-m1.vy).toFixed(4)}`);
}
// 3. Equal masses at rest stay at rest, rope over wheel off to the side (wheel not between masses)
{
  const w = world(), W = wheel(w, 0, 5, 0.4), m1 = ball(w, -0.4, 3, 2), m2 = ball(w, 0.4, 3, 2);
  Phys.createWrap(w, att(m1, -0.4, 3), att(m2, 0.4, 3), [W]); run(w, 2);
  ok('balanced Atwood stays put', Math.abs(m1.y - 3) < 0.002 && Math.abs(m2.y - 3) < 0.002, `y ${m1.y.toFixed(4)}, ${m2.y.toFixed(4)}`);
}
// 4. Movable ideal pulley (2:1). Mass M hangs on the movable pulley, the rope's one end is tied to the ceiling,
//    goes down under the movable pulley, up over a fixed wheel and down to mass m: a_M = (M - 2m) g / (M + 4m)
{
  const w = world(), M = 3, m = 1, R = 0.3;
  const fixedW = wheel(w, 2 * R, 6, R);
  const mov = wheel(w, 0, 4, R, { axle: false }); Phys.setAxle(w, mov, false);
  const body = ball(w, 0, 4, M); Phys.createJoint(w, 'pin', mov, body, Z, Z, { owner: 0 });
  const hang = ball(w, 3 * R, 3, m);
  // rope: ceiling (-R, 6) -> down to movable pulley -> up to fixed wheel -> down to hang
  const j = Phys.createWrap(w, WORLD(-R, 6), att(hang, 3 * R, 3), [mov, fixedW]);
  const t = 1.0; run(w, t);
  const aM = (M - 2 * m) * G / (M + 4 * m), drop = 4 - body.y, exp = 0.5 * aM * t * t;
  ok('movable pulley (2:1) displacement', pct(drop, exp) < 1, `drop ${drop.toFixed(4)} vs ${exp.toFixed(4)} (${pct(drop, exp).toFixed(3)}%); hang rises ${(hang.y - 3).toFixed(4)} vs ${(2 * exp).toFixed(4)}`);
  const r = Phys.J.read(j), Tn = m * (G + 2 * aM); ok('movable pulley tension', pct(r.tension, Tn) < 1.5, `T ${r.tension.toFixed(4)} vs ${Tn.toFixed(4)}`);
}
// 5. Equilibrium of that system: M = 2m stays put
{
  const w = world(), M = 2, m = 1, R = 0.3, fixedW = wheel(w, 2 * R, 6, R), mov = wheel(w, 0, 4, R); Phys.setAxle(w, mov, false);
  const body = ball(w, 0, 4, M); Phys.createJoint(w, 'pin', mov, body, Z, Z, { owner: 0 });
  const hang = ball(w, 3 * R, 3, m); Phys.createWrap(w, WORLD(-R, 6), att(hang, 3 * R, 3), [mov, fixedW]); run(w, 3);
  ok('movable pulley holds at M = 2m', Math.abs(body.y - 4) < 0.01 && Math.abs(hang.y - 3) < 0.02, `M y ${body.y.toFixed(4)}, m y ${hang.y.toFixed(4)}`);
}
// 6. Slack rope: the hanging mass free-falls until the rope goes taut
{
  const w = world(), W = wheel(w, 0, 5, 0.3), m1 = ball(w, -0.3, 3, 1), m2 = ball(w, 0.3, 4.4, 1);
  const j = Phys.createWrap(w, att(m1, -0.3, 3), att(m2, 0.3, 4.4), [W]); j.L += 0.5;  // 0.5 m of slack
  run(w, 0.2);
  ok('slack rope: both masses fall freely', pct(3 - m1.y, 0.5 * G * 0.04) < 1 && pct(4.4 - m2.y, 0.5 * G * 0.04) < 1, `drops ${(3 - m1.y).toFixed(4)}, ${(4.4 - m2.y).toFixed(4)} vs ${(0.5 * G * 0.04).toFixed(4)}`);
}
// 7. A rope over a wheel with a block on a frictionless table: m2 on the table pulled by hanging m1: a = m1 g/(m1+m2)
{
  const w = world(), W = wheel(w, 2, 1.8, 0.2), table = rect(w, 0, 1.4, 3.6, 0.8, 5, { fixed: true, mus: 0, muk: 0 });
  const blk = rect(w, 0, 2.0, 0.4, 0.4, 2, { mus: 0, muk: 0 }), hang = ball(w, 2.2, 1, 1);
  const j = Phys.createWrap(w, att(blk, 0.2, 2.0), att(hang, 2.2, 1), [W]);
  run(w, 0.8);
  const a = 1 * G / 3, d = 0.5 * a * 0.64;
  ok('block on table pulled over a wheel', pct(blk.x, d) < 1.5, `x ${blk.x.toFixed(4)} vs ${d.toFixed(4)}`);
}
// 8. Massless body flag: a massless bar with a bob keeps the pendulum period of the bob alone
{
  const w = world(), L = 1.5, th = 0.3;
  const bar = rect(w, 0, 0, L, 0.04, 1, { massless: true }); Phys.rebuild(bar);
  const bob = ball(w, 0, 0, 2, { r: 0.05 });
  Phys.createJoint(w, 'pin', w.anchor, bar, { x: 0, y: 3 }, { x: -L / 2, y: 0 }, {});
  Phys.createJoint(w, 'pin', bar, bob, { x: L / 2, y: 0 }, Z, {});
  bar.a = -(Math.PI / 2 - th); bar.x = (L / 2) * Math.sin(th); bar.y = 3 - (L / 2) * Math.cos(th); bob.x = L * Math.sin(th); bob.y = 3 - L * Math.cos(th);
  const s = []; run(w, 9, t => s.push({ t, v: Math.atan2(bob.x, 3 - bob.y) }));
  const T = period(s.map(q => ({ t: q.t, v: -q.v }))), Texp = 2 * Math.PI * Math.sqrt(L / G) * (1 + th * th / 16);
  ok('massless bar + bob pendulum period', pct(T, Texp) < 1, `T ${T.toFixed(4)} vs ${Texp.toFixed(4)} (${pct(T, Texp).toFixed(3)}%)`);
}

// 9. Rope bends over the corner of a fixed shelf by itself (no pulley placed): block on a frictionless shelf, mass hanging past the edge.
//    a = m2 g / (m1 + m2), T = m1 m2 g / (m1 + m2)
{
  const w = world(), shelf = rect(w, 0, 0, 4, 0.1, 1, { fixed: true }), m1 = 2, m2 = 1;
  const blk = rect(w, 1.2, 0.25, 1, 0.4, m1), hang = ball(w, 2.0, -0.45, m2);
  const j = Phys.createWrap(w, att(blk, 1.7, 0.05), att(hang, 2.0, -0.45), []);
  ok('shelf corner: rope picked up the corner', Phys.J.wrapPoly(j).length === 3, 'path points ' + Phys.J.wrapPoly(j).length);
  const t = 0.35; run(w, t);
  const a = m2 * G / (m1 + m2), r = Phys.J.read(j);
  ok('shelf corner: block displacement', pct(blk.x - 1.2, 0.5 * a * t * t) < 1, `dx ${(blk.x - 1.2).toFixed(4)} vs ${(0.5 * a * t * t).toFixed(4)} (${pct(blk.x - 1.2, 0.5 * a * t * t).toFixed(3)}%)`);
  ok('shelf corner: hanging mass drop matches', pct(-0.45 - hang.y, 0.5 * a * t * t) < 1, `dy ${(-0.45 - hang.y).toFixed(4)}`);
  ok('shelf corner: tension', pct(r.tension, m1 * m2 * G / (m1 + m2)) < 1, `T ${r.tension.toFixed(4)} vs ${(m1 * m2 * G / (m1 + m2)).toFixed(4)}`);
  ok('shelf corner: block stays level', Math.abs(blk.a) < 0.01, 'angle ' + blk.a.toFixed(5));
}
// 10. Pendulum with a peg: the rope wraps the peg, so the bob swings on a shorter radius afterwards and energy is conserved.
function peg(oc) {
  const w = world(), L = 2, th = Math.PI / 4, px = 0, py = 5;
  const pegb = ball(w, 0, 4, 1, { r: 0.01, fixed: true }), bob = ball(w, -L * Math.sin(th), py - L * Math.cos(th), 1);
  const j = Phys.createWrap(w, WORLD(px, py), att(bob, bob.x, bob.y), []); if (oc === false) { j.oc = false; }
  const E0 = G * bob.y; let xmax = -9, ymaxR = -9, emax = 0;
  run(w, 2.2, () => { const E = G * bob.y + 0.5 * (bob.vx * bob.vx + bob.vy * bob.vy); emax = Math.max(emax, Math.abs(E - E0)); if (bob.x > 0) { xmax = Math.max(xmax, bob.x); ymaxR = Math.max(ymaxR, bob.y); } });
  return { xmax, ymaxR, emax, y0: bob.y, E0, drop: G * (2 - 2 * Math.cos(th)) };
}
{
  const r = peg(true), free = peg(false);
  const th2 = Math.acos(1 - (1 - Math.cos(Math.PI / 4)) * 2 / 1), xth = Math.sin(th2);
  ok('peg: swings on the shorter radius', Math.abs(r.xmax - xth) < 0.04, `x max ${r.xmax.toFixed(3)} vs ${xth.toFixed(3)}; without the peg ${free.xmax.toFixed(3)}`);
  ok('peg: energy conserved', r.emax / r.drop < 0.01, `max dE/drop ${(r.emax / r.drop * 100).toFixed(3)}%`);
  ok('peg: rope can be told to ignore objects', free.xmax > 1.3, 'free x max ' + free.xmax.toFixed(3));
}
// 11. A free box in the way of a taut rope is pushed along, not passed through (no gravity: bob swings on a circle through the box).
{
  const w = world(0), bob = ball(w, -2, 5, 1), box = rect(w, 0, 4.2, 0.5, 0.5, 0.2);
  bob.vy = -3;
  const j = Phys.createWrap(w, WORLD(0, 5), att(bob, bob.x, bob.y), []);
  let through = 0, maxPts = 0;
  run(w, 1.3, () => {
    const P = Phys.J.wrapPoly(j); maxPts = Math.max(maxPts, P.length);
    for (let i = 1; i < P.length; i++) for (let q = 0; q <= 20; q++) {
      const x = P[i - 1].x + (P[i].x - P[i - 1].x) * q / 20, y = P[i - 1].y + (P[i].y - P[i - 1].y) * q / 20;
      const c = Math.cos(box.a), s = Math.sin(box.a), lx = c * (x - box.x) + s * (y - box.y), ly = -s * (x - box.x) + c * (y - box.y);
      if (Math.abs(lx) < 0.25 - 0.04 && Math.abs(ly) < 0.25 - 0.04) through++;
    }
  });
  ok('box in the way: rope does not cut through it', through === 0 && maxPts > 2 && Math.abs(box.x) > 0.02, `samples inside ${through}, path points ${maxPts}, box moved to ${box.x.toFixed(3)}, ${box.y.toFixed(3)}`);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
