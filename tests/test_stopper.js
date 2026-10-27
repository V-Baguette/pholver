const Phys = require('../engine.js'); require('../scene.js');
const DT = Phys.DT; let fails = 0;
const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '   ' + i : '')); if (!c) fails++; };
const ball = (w, x, y, m, o) => { const b = Phys.createBody('sphere', Object.assign({ x, y, m, r: 0.1, mus: 0, muk: 0, e: 0 }, o || {})); w.bodies.push(b); return b; };
const Z = { x: 0, y: 0 };
// 1. Spring from a wall point into empty space (both ends empty) is a stopper. Ball 1 kg at 3 m/s.
//    The ball first sticks to the light pad (perfectly inelastic with mass mp), then the pair compresses the spring:
//    v' = m v / (m + mp), x = v' sqrt((m + mp)/k) = m v / sqrt(k (m + mp)).
{
  const w = Phys.createWorld(); w.g = 0; w.ground = false;
  const j = Phys.createJoint(w, 'spring', null, null, { x: 0, y: 0 }, { x: 1, y: 0 }, { L: 1, k: 100, c: 0, name: 'S' });
  Phys.applyStopper(w, j);
  ok('empty-space spring gets a pad', !!j.pad && !!j.rail, j.pad ? 'pad at ' + j.pad.x.toFixed(2) : '');
  const b = ball(w, 3, 0, 1); b.vx = -3;
  let minX = 9, vOut = 0, seen = false;
  for (let i = 0; i < 240 * 4; i++) { Phys.step(w, DT); minX = Math.min(minX, b.x); if (b.vx > 0) { seen = true; vOut = b.vx; } }
  const mp = 0.05, x = 1 * 3 / Math.sqrt(100 * (1 + mp)), expect = 1 - x + 0.2;
  ok('ball is stopped by the spring', Math.abs(minX - expect) / 0.3 < 0.02, `closest ${minX.toFixed(4)} vs ${expect.toFixed(4)}`);
  ok('ball is pushed back', seen && Math.abs(vOut - 3 / (1 + mp)) / 3 < 0.02, `leaves at ${vOut.toFixed(3)} vs ${(3 / (1 + mp)).toFixed(3)}`);
  ok('pad stays on its axis', Math.abs(j.pad.y) < 1e-3, 'pad y ' + j.pad.y.toExponential(2));
}
// 2. Bumper on a cart: spring on a free block, tip in empty space. Block on a frictionless track hits a wall-mounted... a second ball.
{
  const w = Phys.createWorld(); w.g = 0; w.ground = false;
  const cart = Phys.createBody('rect', { x: 0, y: 0, W: 0.6, H: 0.4, m: 4, mus: 0, muk: 0 }); w.bodies.push(cart);
  const j = Phys.createJoint(w, 'spring', cart, null, { x: 0.3, y: 0 }, { x: 1.3, y: 0 }, { L: 1, k: 400, c: 0 }); j.mode = 'stopper'; Phys.applyStopper(w, j);
  ok('stopper mode frees the world end', j.b === j.pad && j.pad.owner === j.id && j.a === cart);
  const b = ball(w, 3, 0, 1); b.vx = -4;
  let vOut = 0; for (let i = 0; i < 240 * 3; i++) { Phys.step(w, DT); }
  const p0 = 4 * 0 + 1 * -4; // total momentum before
  const p = cart.m * cart.vx + b.m * b.vx + j.pad.m * j.pad.vx;
  ok('momentum conserved with the cart', Math.abs(p - p0) < 0.05, `p ${p.toFixed(3)} vs ${p0}`);
  ok('cart is pushed away', cart.vx < -0.3, 'cart vx ' + cart.vx.toFixed(3));
}
// 3. Rigid mode keeps the world pin: spring from the ceiling holds a hanging mass (period check)
{
  const w = Phys.createWorld(); w.ground = false;
  const m = ball(w, 0, 2, 1);
  const j = Phys.createJoint(w, 'spring', null, m, { x: 0, y: 4 }, Z, { L: 1, k: 100, c: 0 });
  Phys.applyStopper(w, j);
  ok('ceiling spring (one object end) is unchanged by default', !j.pad && j.a === w.anchor);
  let minY = 9, maxY = -9; for (let i = 0; i < 240 * 3; i++) { Phys.step(w, DT); minY = Math.min(minY, m.y); maxY = Math.max(maxY, m.y); }
  ok('ceiling spring still holds the mass', minY > 1.9 && maxY < 3.9, `y ${minY.toFixed(2)}..${maxY.toFixed(2)}`);
  j.mode = 'stopper'; Phys.applyStopper(w, j); ok('forcing stopper on a pinned spring creates a pad', !!j.pad);
  j.mode = 'rigid'; Phys.applyStopper(w, j); ok('rigid switches the pad off again', !j.pad && j.b === w.anchor);
  Phys.removeJoint(w, j); ok('no pad left behind', w.bodies.every(b => !b.owner));
}
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
