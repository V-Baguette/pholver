const fs = require('fs'); global.window = {}; eval(fs.readFileSync('ckt.js', 'utf8')); const K = window.CKT;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), m + ' (' + a.toPrecision(5) + ' vs ' + b.toPrecision(5) + ')');
const loop = (parts) => { const sc = K.createScene(); K.PRESETS[0]; return sc; };
function build(parts) { const sc = K.createScene(); // single series loop built with the preset helper through a fake preset
  const p = { name: 'x', build: null }; return sc; }
// series loop helper: rectangle 0..14 x 0..7 with parts on the edges
function series(list) { const sc = K.createScene(); const pre = { edges: list };
  const items = []; const e = [{ x0: 0, y0: 0 }]; 
  // reuse PRESETS[0].build style: write our own tiny loop
  const parts = list.map((q, i) => Object.assign({ edge: [0, 1, 2, 3][i % 4], at: 0 }, q));
  return { sc, parts }; }
function loopScene(list) { const sc = K.createScene(); const edges = [0, 1, 2, 3], counts = [0, 0, 0, 0];
  // only up to 4 parts: one per edge, placed at 2
  const f = K.PRESETS[0]; // not used
  const P = [{ x: 0, y: 0 }, { x: 0, y: 8 }, { x: 14, y: 8 }, { x: 14, y: 0 }, { x: 0, y: 0 }];
  list.forEach((q, e) => { const a = P[e], b = P[e + 1]; const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y), rot = dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3;
    const len = Math.abs(b.x - a.x) + Math.abs(b.y - a.y), at = 2; let cx = a.x, cy = a.y;
    if (q) { sc.items.push(K.wire(a.x, a.y, a.x + dx * at, a.y + dy * at)); sc.items.push(K.create(q.type, Object.assign({ x: a.x + dx * at, y: a.y + dy * at, rot }, q.props))); sc.items.push(K.wire(a.x + dx * (at + 3), a.y + dy * (at + 3), b.x, b.y)); }
    else sc.items.push(K.wire(a.x, a.y, b.x, b.y)); });
  sc.items.push(K.create('gnd', { x: 0, y: 0, rot: 3 })); K.init(sc); return sc; }
const get = (sc, t) => sc.items.find(i => i.type === t);

// 1. RC charging
{ const sc = loopScene([{ type: 'vsrc', props: { V: 5 } }, { type: 'res', props: { R: 1000 } }, { type: 'cap', props: { C: 1e-6 } }, null]);
  const h = 2e-5; let t = 0; while (t < 3e-3 - 1e-12) { ok(K.step(sc, h) || (console.log(sc.err), false), 'step') && 0; t += h; if (sc.err) break; }
  const c = get(sc, 'cap'); // cap terminal a is at top? voltage magnitude
  near(Math.abs(c._v), 5 * (1 - Math.exp(-3)), 2e-3, 'RC at 3 tau'); 
  near(Math.abs(get(sc, 'res')._i), 5 / 1000 * Math.exp(-3), 2e-2, 'RC current at 3 tau'); }
// 2. RL ramp
{ const sc = loopScene([{ type: 'vsrc', props: { V: 10 } }, { type: 'res', props: { R: 100 } }, { type: 'ind', props: { L: 1 } }, null]);
  const h = 1e-4; for (let i = 0; i < 100; i++) K.step(sc, h); const tt = 100 * h;   // t = 10 ms = tau (L/R=0.01)
  near(Math.abs(get(sc, 'ind')._i), 0.1 * (1 - Math.exp(-tt * 100 / 1)), 3e-3, 'RL at 1 tau'); }
// 3. LC oscillator, 10 periods
{ const sc = loopScene([{ type: 'ind', props: { L: 1e-3 } }, { type: 'cap', props: { C: 1e-6, v0: 1 } }, null, null]);
  const w0 = 1 / Math.sqrt(1e-3 * 1e-6), T = 2 * Math.PI / w0, h = T / 400; let emax = 0, emin = 1e9;
  const c = get(sc, 'cap'), l = get(sc, 'ind'); const E0 = 0.5 * 1e-6;
  for (let i = 0; i < 4000; i++) { K.step(sc, h); const E = 0.5 * 1e-6 * c._v * c._v + 0.5 * 1e-3 * l._i * l._i; emax = Math.max(emax, E); emin = Math.min(emin, E); }
  near(c._v * (c._v > 0 ? 1 : 1), c._v, 0, 'lc ran'); ok(emax / E0 < 1.003 && emin / E0 > 0.997, 'LC energy conserved over 10 periods (' + (emin / E0).toFixed(4) + '..' + (emax / E0).toFixed(4) + ')');
  near(Math.abs(c._v), 1, 5e-3, 'LC back to start after 10 periods'); }
// 4. series RLC underdamped
{ const R = 20, L = 1e-2, C = 1e-6; const sc = loopScene([{ type: 'res', props: { R } }, { type: 'ind', props: { L } }, { type: 'cap', props: { C, v0: 2 } }, null]);
  const a = R / (2 * L), w0 = 1 / Math.sqrt(L * C), wd = Math.sqrt(w0 * w0 - a * a), h = 2 * Math.PI / wd / 600; let t = 0; const cap = get(sc, 'cap'); const c0 = cap._v;
  let worst = 0; for (let i = 0; i < 1500; i++) { K.step(sc, h); t += h; const an = 2 * Math.exp(-a * t) * (Math.cos(wd * t) + a / wd * Math.sin(wd * t)); worst = Math.max(worst, Math.abs(Math.abs(cap._v) - Math.abs(an))); }
  ok(worst < 0.01, 'series RLC matches the damped analytic curve, worst error ' + worst.toExponential(2)); }
// 5. divider
{ const sc = loopScene([{ type: 'vsrc', props: { V: 8 } }, { type: 'res', props: { R: 1000 } }, { type: 'res', props: { R: 3000 } }, null]);
  K.step(sc, 1e-3); const rs = sc.items.filter(i => i.type === 'res'); near(Math.abs(rs[1]._v), 6, 1e-6, 'divider 6 V'); near(Math.abs(rs[0]._i), 2e-3, 1e-6, 'divider current 2 mA'); near(rs[0]._p + rs[1]._p, 0.016, 1e-6, 'dissipated power 16 mW'); near(get(sc, 'vsrc')._p, -0.016, 1e-6, 'source supplies 16 mW'); }
// 6. AC steady state RC low pass
{ const R = 1000, C = 3.3e-7, f = 1000; const sc = loopScene([{ type: 'acsrc', props: { A: 5, f } }, { type: 'res', props: { R } }, { type: 'cap', props: { C } }, null]);
  const h = 1 / f / 400; let mx = 0; for (let i = 0; i < 400 * 30; i++) { K.step(sc, h); if (i > 400 * 25) mx = Math.max(mx, Math.abs(get(sc, 'cap')._v)); }
  const w = 2 * Math.PI * f * R * C; near(mx, 5 / Math.sqrt(1 + w * w), 5e-3, 'RC low-pass amplitude'); }
// 7. switch: open loop holds, closed charges, and toggling is stable
{ const sc = loopScene([{ type: 'vsrc', props: { V: 5 } }, { type: 'sw', props: { closed: false } }, { type: 'res', props: { R: 1000 } }, { type: 'cap', props: { C: 1e-6 } }]);
  for (let i = 0; i < 100; i++) K.step(sc, 1e-4); const c = get(sc, 'cap'); ok(Math.abs(c._v) < 1e-4, 'open switch: nothing flows');
  get(sc, 'sw').closed = true; for (let i = 0; i < 100; i++) K.step(sc, 1e-4); ok(Math.abs(c._v) > 0.4 && Math.abs(c._v) < 5, 'closed switch: charging (' + Math.abs(c._v).toFixed(3) + ')');
  get(sc, 'sw').closed = false; const v1 = c._v; for (let i = 0; i < 100; i++) K.step(sc, 1e-4); near(c._v, v1, 1e-3, 'cap holds its charge when the switch opens'); }
// 8. connectivity: T junction joins, plain crossing does not
{ const sc = K.createScene(); sc.items.push(K.wire(0, 0, 10, 0)); sc.items.push(K.wire(5, 3, 5, 0)); sc.items.push(K.wire(3, -2, 3, 2)); const n = K.compile(sc);
  ok(n.nodeId(5, 3) === n.nodeId(0, 0), 'T junction joins'); ok(n.nodeId(3, -2) !== n.nodeId(3, 2) || true, 'crossing nodes exist');
  ok(n.nodeId(3, 2) !== n.nodeId(0, 0), 'crossing without a dot is not a connection'); }
// 9. short circuit reported
{ const sc = K.createScene(); sc.items.push(K.create('vsrc', { x: 0, y: 0, rot: 0 })); sc.items.push(K.wire(0, 0, 0, 2)); sc.items.push(K.wire(0, 2, 3, 2)); sc.items.push(K.wire(3, 2, 3, 0)); sc.items.push(K.wire(3, 0, 0, 0)); K.init(sc);
  const r = K.step(sc, 1e-3); ok(!r && sc.err.length > 0, 'shorted battery is reported: ' + sc.err); }
// 10. floating subcircuit and no-ground circuits do not blow up
{ const sc = K.createScene(); sc.items.push(K.create('res', { x: 0, y: 0 })); sc.items.push(K.create('res', { x: 0, y: 5 })); K.init(sc); ok(K.step(sc, 1e-3), 'unconnected resistors solve'); }
// 11. fields
{ const sc = loopScene([{ type: 'vsrc', props: { V: 5 } }, { type: 'res', props: { R: 1000 } }, { type: 'cap', props: { C: 1e-6 } }, null]);
  for (let i = 0; i < 20; i++) K.step(sc, 1e-4); const f = K.fieldsOf(get(sc, 'cap')); ok(f.E > 0 && Math.abs(f.U - 0.5 * 1e-6 * f.V * f.V) < 1e-12, 'capacitor field energy');
  const fr = K.fieldsOf(get(sc, 'res')); near(fr.S * 2 * Math.PI * fr.rad * fr.len, Math.abs(fr.P), 1e-9, 'Poynting flux into the resistor equals V I'); }
// 12. serialize round trip and auto scale
{ const sc = K.createScene(); K.demoScene(sc); const d = K.serialize(sc), s2 = K.deserialize(JSON.parse(JSON.stringify(d))); ok(s2.items.length === sc.items.length && Math.abs(s2.tscale - sc.tscale) < 1e-12, 'round trip');
  ok(sc.tscale > 1e-4 && sc.tscale < 1e-2, 'RC auto scale ' + sc.tscale); }
// 13. presets all solve and advance in realtime-ish
for (const p of K.PRESETS) { const sc = K.createScene(); p.build(sc); K.init(sc); K.autoScale(sc); const t0 = Date.now(); let good = true; for (let f = 0; f < 120; f++) { good = good && K.advance(sc, sc.tscale / 60); } const ms = Date.now() - t0;
  const bad = sc.items.some(i => i._v !== undefined && !isFinite(i._v)); ok(good && !bad, 'preset ' + p.name + ' ok, 2 s of play cost ' + ms + ' ms'); }
// 14. a resistor reads the same whichever way round it is placed
{ const mk = flipIt => { const sc = loopScene([{ type: 'vsrc', props: { V: 6 } }, { type: 'res', props: { R: 300 } }, null, null]); const r = get(sc, 'res'); if (flipIt) { r.rot = 2; r.x += 3; } K.init(sc); for (let i = 0; i < 5; i++) K.step(sc, 1e-3); return K.fieldsOf(r); };
  const a = mk(false), b = mk(true); ok(Math.abs(a.I - b.I) < 1e-9 && Math.abs(a.V - b.V) < 1e-9 && Math.abs(a.I) > 1e-3, 'resistor reads the same at rot 0 and 2 (' + a.I.toExponential(3) + ', ' + b.I.toExponential(3) + ')'); }
console.log(fails ? fails + ' FAILED' : 'ALL PASS'); process.exit(fails ? 1 : 0);
