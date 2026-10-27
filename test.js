const Phys = require('./engine.js');
let fails = 0;
const ok = (name, cond, info) => { console.log((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); if (!cond) fails++; };
const run = (w, secs) => { const n = Math.round(secs / Phys.DT); for (let i = 0; i < n; i++) Phys.step(w, Phys.DT); };
const sinT = 3 / Math.hypot(10, 3), cosT = 10 / Math.hypot(10, 3), g = 9.81;

// 1. disc rolling without slipping: a = (2/3) g sin(theta)
{
  const w = Phys.createWorld(); const { ball } = Phys.demoScene(w);
  const x0 = ball.x, y0 = ball.y; run(w, 2);
  const d = Math.hypot(ball.x - x0, ball.y - y0), exp = 0.5 * (2 / 3) * g * sinT * 4;
  ok('rolling distance', Math.abs(d - exp) / exp < 0.03, `got ${d.toFixed(3)} expected ${exp.toFixed(3)}`);
  const v = Math.hypot(ball.vx, ball.vy);
  ok('no slip (v = w r)', Math.abs(v - Math.abs(ball.w) * ball.r) < 0.03 * v, `v ${v.toFixed(3)} wr ${(Math.abs(ball.w) * ball.r).toFixed(3)}`);
}
// 2. frictionless sphere slides: a = g sin(theta)
{
  const w = Phys.createWorld(); const { inc, ball } = Phys.demoScene(w);
  ball.mus = ball.muk = 0; inc.mus = inc.muk = 0;
  const x0 = ball.x, y0 = ball.y; run(w, 1.5);
  const d = Math.hypot(ball.x - x0, ball.y - y0), exp = 0.5 * g * sinT * 2.25;
  ok('frictionless slide', Math.abs(d - exp) / exp < 0.03, `got ${d.toFixed(3)} expected ${exp.toFixed(3)}`);
  ok('no spin', Math.abs(ball.w) < 0.05, `w ${ball.w.toFixed(4)}`);
}
// 3. box on slope: stays with high mu_s, slides with a = g(sin - mu_k cos) otherwise
function boxOnSlope(mus, muk) {
  const w = Phys.createWorld(); const { inc } = Phys.demoScene(w); w.bodies.pop();
  const hyp = Math.hypot(10, 3), nx = 3 / hyp, ny = 10 / hyp, tx = ny, ty = -nx; // down-slope dir
  const H = 0.4, W = 0.8;
  inc.mus = mus; inc.muk = muk; // friction is the geometric mean of both surfaces
  const box = Phys.createBody('rect', { W, H, m: 3, mus, muk });
  const t = 0.15, ang = Math.atan2(-3, 10);
  const px = -5 + t * 10, py = 3 * (1 - t);
  box.a = ang; box.x = px + nx * (H / 2 + 0.001); box.y = py + ny * (H / 2 + 0.001);
  w.bodies.push(box);
  return { w, box, tx, ty };
}
{
  const { w, box } = boxOnSlope(0.6, 0.5); const x0 = box.x, y0 = box.y; run(w, 3);
  ok('box sticks (mu_s > tan)', Math.hypot(box.x - x0, box.y - y0) < 0.05, `moved ${Math.hypot(box.x - x0, box.y - y0).toFixed(4)} m`);
}
{
  const { w, box } = boxOnSlope(0.1, 0.1); const x0 = box.x, y0 = box.y; run(w, 2);
  const d = Math.hypot(box.x - x0, box.y - y0), exp = 0.5 * g * (sinT - 0.1 * cosT) * 4;
  ok('box slides with friction', Math.abs(d - exp) / exp < 0.06, `got ${d.toFixed(3)} expected ${exp.toFixed(3)}`);
}
// 4. box resting on ground stays put, no jitter
{
  const w = Phys.createWorld(); const box = Phys.createBody('rect', { x: 0, y: 0.3 + 0.001 }); box.W = 1; box.H = 0.6; Phys.rebuild(box);
  w.bodies.push(box); run(w, 5);
  ok('resting box stable', Math.abs(box.vx) < 0.01 && Math.abs(box.vy) < 0.05 && Math.abs(box.y - 0.3) < 0.01 && Math.abs(box.a) < 0.01, `y ${box.y.toFixed(4)} vy ${box.vy.toFixed(4)} a ${box.a.toFixed(4)}`);
}
// 5. dropped sphere bounces with restitution and stays above ground
{
  const w = Phys.createWorld(); const s = Phys.createBody('sphere', { x: 0, y: 3, e: 0.5 }); w.bodies.push(s);
  let minY = 9, maxAfter = 0, hit = false;
  for (let i = 0; i < 240 * 3; i++) { Phys.step(w, Phys.DT); minY = Math.min(minY, s.y); if (s.y < 0.52) hit = true; if (hit && s.vy > 0) maxAfter = Math.max(maxAfter, s.y); }
  ok('bounce height ~ e^2 h', minY > 0.45 && maxAfter > 0.5 + 0.25 * 2.5 * 0.7 && maxAfter < 0.5 + 0.25 * 2.5 * 1.3, `min ${minY.toFixed(3)} peak ${maxAfter.toFixed(3)}`);
}
// 6. energy: frictionless sliding conserves total energy
{
  const w = Phys.createWorld(); const { inc, ball } = Phys.demoScene(w); ball.mus = ball.muk = 0; inc.mus = inc.muk = 0;
  const e0 = Phys.energy(w).total; run(w, 1.5); const e1 = Phys.energy(w).total;
  ok('energy conserved (no friction)', Math.abs(e1 - e0) / Math.abs(e0) < 0.01, `${e0.toFixed(3)} -> ${e1.toFixed(3)}`);
}
// 7. hull and point test
{
  const h = Phys.hull([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 0.5, y: 0.5 }]);
  const b = Phys.createBody('rect', { W: 2, H: 2 });
  ok('hull drops interior point', h.length === 4);
  ok('point in body', Phys.pointInBody(b, 0.9, 0.9) && !Phys.pointInBody(b, 1.1, 0));
}
// 8. a 100 kg block at 30 m/s hits the ramp wall: a free ramp must be shoved, a fixed one must not move
function shoot(fixedRamp) {
  const w = Phys.createWorld(); const { inc } = Phys.demoScene(w); w.bodies.pop(); inc.fixed = fixedRamp; Phys.rebuild(inc);
  const blk = Phys.createBody('rect', { W: 1.2, H: 0.6, m: 100, x: -8, y: 0.9, vx: 30, e: 0.1 }); w.bodies.push(blk);
  const x0 = inc.x; run(w, 0.15); const v15 = inc.vx; const p = blk.m * blk.vx + inc.m * inc.vx; run(w, 0.85);
  return { v15, moved: inc.x - x0, p, blkVx: blk.vx };
}
{
  const f = shoot(false);
  ok('free ramp is pushed', f.v15 > 5 && f.moved > 0.5, `vx ${f.v15.toFixed(2)} m/s, moved ${f.moved.toFixed(2)} m, momentum ${f.p.toFixed(0)} (was 3000)`);
  ok('momentum roughly conserved at impact', Math.abs(f.p - 3000) < 250);
  const g = shoot(true);
  ok('fixed ramp stays put', Math.abs(g.moved) < 1e-9 && g.blkVx < 5, `moved ${g.moved}`);
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
