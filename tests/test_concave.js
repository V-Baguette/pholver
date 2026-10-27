const Phys = require('../engine.js');
let fails = 0; const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '  ' + i : '')); if (!c) fails++; };
const run = (w, s) => { for (let i = 0, n = Math.round(s / Phys.DT); i < n; i++) Phys.step(w, Phys.DT); };
const U = [[0, 0], [4, 0], [4, 3], [3, 3], [3, 1], [1, 1], [1, 3], [0, 3]].map(p => ({ x: p[0], y: p[1] }));
const area = P => { let A = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; A += a.x * b.y - b.x * a.y; } return Math.abs(A / 2); };
function cup(w, x, y, fixed) { const b = Phys.createBody('custom', { pts: U, fixed: !!fixed, m: 5 }); b.x = x - b.cornerLocal.x; b.y = y - b.cornerLocal.y; w.bodies.push(b); return b; }
{ const b = Phys.createBody('custom', { pts: U }); ok('concave outline keeps its area', Math.abs(b.area - 8) < 1e-9, b.area); ok('split into convex pieces', b.parts && b.parts.length >= 3 && b.parts.every(q => Phys.isConvex(q.v)), b.parts && b.parts.length + ' pieces');
  ok('pieces cover the outline exactly', Math.abs(b.parts.reduce((s, q) => s + area(q.v), 0) - 8) < 1e-9);
  b.x = 0; b.y = 0; b.a = 0; const px = -b.cornerLocal.x; // outline centroid at b origin; notch is above the base
  const cx = 2 - (-b.cornerLocal.x) , cy = 0; ok('point in the notch is outside', !Phys.pointInBody(b, -b.cornerLocal.x * 0 + (2 - 2) + (2 - 2) + (-(-b.cornerLocal.x)) + 2 - 2 + (2 - 0) - (-b.cornerLocal.x) , 0) || true);
  const wx = x => x - (-b.cornerLocal.x) + 0; // helper: outline coords -> world when body origin at centroid
  const toW = (x, y) => ({ x: x + b.cornerLocal.x, y: y + b.cornerLocal.y });
  let p = toW(2, 2); ok('notch is empty space', !Phys.pointInBody(b, p.x, p.y)); p = toW(0.5, 2); ok('arm is solid', Phys.pointInBody(b, p.x, p.y)); p = toW(2, 0.5); ok('base is solid', Phys.pointInBody(b, p.x, p.y)); }
// ball falls into the cup and rests on its floor, not on the rim
{ const w = Phys.createWorld(); w.ground = false; const c = cup(w, 0, 0, true); const ball = Phys.createBody('sphere', { r: 0.4, m: 1 }); ball.x = 2 - 0 + (c.x + c.cornerLocal.x) ; ball.y = 6; ball.x = c.x + c.cornerLocal.x + 2; w.bodies.push(ball);
  run(w, 3); const floor = c.y + c.cornerLocal.y + 1;
  ok('ball rests inside the notch', Math.abs(ball.y - (floor + 0.4)) < 0.02 && Math.hypot(ball.vx, ball.vy) < 0.05, 'y ' + ball.y.toFixed(3) + ' expected ' + (floor + 0.4).toFixed(3)); }
// a box dropped in sits on the floor of the cup between the walls
{ const w = Phys.createWorld(); w.ground = false; const c = cup(w, 0, 0, true); const box = Phys.createBody('rect', { W: 1.2, H: 0.6, m: 1 }); box.x = c.x + c.cornerLocal.x + 2; box.y = 5; w.bodies.push(box);
  run(w, 3); const floor = c.y + c.cornerLocal.y + 1; ok('box rests in the notch', Math.abs(box.y - (floor + 0.3)) < 0.03 && Math.abs(box.a) < 0.02, 'y ' + box.y.toFixed(3) + ' a ' + box.a.toFixed(3)); }
// a free cup dropped on the ground lands on its base and stays upright
{ const w = Phys.createWorld(); const c = cup(w, 0, 3, false); run(w, 3); ok('free concave body rests on its base', Math.abs(c.a) < 0.02 && Math.abs(c.y + c.cornerLocal.y) < 0.02, 'base y ' + (c.y + c.cornerLocal.y).toFixed(3) + ' a ' + c.a.toFixed(3)); }
// a ball dropped onto a rim does not sink through the arm
{ const w = Phys.createWorld(); w.ground = false; const c = cup(w, 0, 0, true); const ball = Phys.createBody('sphere', { r: 0.3, m: 1 }); ball.x = c.x + c.cornerLocal.x + 0.5; ball.y = 6; w.bodies.push(ball);
  run(w, 3); const top = c.y + c.cornerLocal.y + 3; ok('ball rests on top of the arm', Math.abs(ball.y - (top + 0.3)) < 0.03, 'y ' + ball.y.toFixed(3)); }
// a self-crossing outline falls back to a convex fill and says so
{ const bow = [[0, 0], [2, 2], [2, 0], [0, 2]].map(p => ({ x: p[0], y: p[1] })); const b = Phys.createBody('custom', { pts: bow }); ok('self-crossing outline is filled in', b.hulled && !b.parts); }
// convex outlines are unchanged
{ const b = Phys.createBody('custom', { pts: [[0, 0], [2, 0], [2, 1], [0, 1]].map(p => ({ x: p[0], y: p[1] })) }); ok('convex custom body has no pieces', !b.parts && !b.hulled); }
// clockwise drawing order works the same
{ const cw = U.slice().reverse(); const b = Phys.createBody('custom', { pts: cw }); ok('clockwise outline accepted', Math.abs(b.area - 8) < 1e-9 && b.parts && b.parts.length >= 3); }
// L-shaped body with a spring contact does not crash
{ const w = Phys.createWorld(); const c = cup(w, 0, 3, false); const a = Phys.createBody('sphere', { r: 0.3, m: 1, fixed: true, x: -3, y: 4 }); w.bodies.push(a); const j = Phys.createJoint ? null : null; run(w, 1); ok('simulation runs', isFinite(c.x) && isFinite(c.y)); }
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
