const fs = require('fs'); global.window = {}; eval(fs.readFileSync(__dirname + '/../ckt.js', 'utf8')); const K = window.CKT;
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); } else console.log('ok  ', m); };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, m + ' (' + a.toPrecision(5) + ' vs ' + b.toPrecision(5) + ', tol ' + tol + ')');
// Builder: parts are placed far apart; every terminal is joined to a named node by a diagonal wire, so nothing joins by accident.
function build(spec) {
  const sc = K.createScene(), bus = {}, bi = n => bus[n] || (bus[n] = { x: 2000 + 7 * Object.keys(bus).length, y: 3000 + 13 * Object.keys(bus).length });
  let px = 0; const it = {};
  spec.forEach(([type, nodes, props, name]) => {
    const p = K.create(type, Object.assign({ x: px, y: 5, rot: 0 }, props || {})); px += 20; if (name) { p.name = name; it[name] = p; } sc.items.push(p);
    K.terminals(p).forEach((t, k) => { const b = bi(nodes[k]); sc.items.push(K.wire(t.x, t.y, b.x, b.y)); });
  });
  sc.items.push(K.create('gnd', { x: 0, y: -20 })); const g = K.terminals(sc.items[sc.items.length - 1])[0], b0 = bi('0'); sc.items.push(K.wire(g.x, g.y, b0.x, b0.y));
  K.init(sc); return { sc, it, V: n => { const net = sc._net, b = bus[n]; return sc._vn[net.nodeId(b.x, b.y)]; } };
}
const run = (c, T, h) => { const n = Math.round(T / h); for (let i = 0; i < n; i++) if (!K.step(c.sc, h)) throw new Error(c.sc.err); };
// vsrc terminal order: a is the - side, b the + side (see ckt.js header): nodes ['0','vin'] means + at vin
const bis = (f, lo, hi) => { for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (f(m) > 0) hi = m; else lo = m; } return (lo + hi) / 2; };

// 1 diode + resistor: compare with a root-finder
{ const c = build([['vsrc', ['0', 'in'], { V: 5 }], ['res', ['in', 'd'], { R: 1000 }, 'R'], ['diode', ['d', '0'], {}, 'D']]); run(c, 1e-3, 1e-4);
  const Is = 1e-14, Vd = bis(v => Is * (Math.exp(v / 0.025852) - 1) - (5 - v) / 1000, 0, 1);
  near(c.V('d'), Vd, 2e-3, 'diode forward drop (' + c.V('d').toFixed(3) + ' V)'); near(c.it.D._i, (5 - Vd) / 1000, 2e-5, 'diode current'); ok(!c.sc.warn, 'converged'); }
// 2 reverse-biased diode blocks
{ const c = build([['vsrc', ['in', '0'], { V: 5 }], ['res', ['in', 'd'], { R: 1000 }, 'R'], ['diode', ['d', '0'], {}, 'D']]); run(c, 1e-3, 1e-4); near(c.it.D._i, 0, 1e-9, 'reverse diode carries nothing'); near(c.V('d'), -5, 1e-3, 'node sits at the source voltage'); }
// 3 LED
{ const c = build([['vsrc', ['0', 'in'], { V: 5 }], ['res', ['in', 'd'], { R: 330 }, 'R'], ['led', ['d', '0'], { Vf: 1.9 }, 'L']]); run(c, 1e-3, 1e-4);
  near(c.V('d'), 1.9, 0.12, 'LED drop near its Vf'); const I = c.it.L._i; ok(I > 8e-3 && I < 11e-3, 'LED current ' + (I * 1e3).toFixed(2) + ' mA'); }
// 4 Zener regulator
{ const c = build([['vsrc', ['0', 'in'], { V: 12 }], ['res', ['in', 'o'], { R: 1000 }, 'R'], ['zener', ['0', 'o'], { Vz: 5.1 }, 'Z']]); run(c, 1e-3, 1e-4);
  near(c.V('o'), 5.1, 0.25, 'Zener regulates (' + c.V('o').toFixed(3) + ' V)'); near(c.it.R._i, 6.9e-3, 0.6e-3, 'Zener shunt current');
  const c2 = build([['vsrc', ['0', 'in'], { V: 20 }], ['res', ['in', 'o'], { R: 1000 }, 'R'], ['zener', ['0', 'o'], { Vz: 5.1 }, 'Z']]); run(c2, 1e-3, 1e-4); near(c2.V('o'), 5.1, 0.35, 'still regulated at 20 V'); }
// 5 half-wave rectifier with a smoothing capacitor
{ const c = build([['acsrc', ['0', 'in'], { A: 10, f: 1000 }], ['diode', ['in', 'o'], {}, 'D'], ['cap', ['o', '0'], { C: 10e-6 }, 'C'], ['res', ['o', '0'], { R: 2000 }, 'R']]);
  run(c, 5e-3, 1e-6); let mx = 0, mn = 1e9; for (let i = 0; i < 1000; i++) { K.step(c.sc, 1e-6); mx = Math.max(mx, c.V('o')); mn = Math.min(mn, c.V('o')); }
  near(mx, 10 - 0.72, 0.2, 'rectifier peak is the source peak minus a diode drop (' + mx.toFixed(2) + ' V)'); ok(mn > 7.4 && mn < mx, 'ripple is small and positive (' + mn.toFixed(2) + ' to ' + mx.toFixed(2) + ')'); ok(!c.sc.warn, 'no solver warning'); }
// 6 bridge rectifier
{ const c = build([['acsrc', ['a', 'b'], { A: 10, f: 1000 }], ['diode', ['a', 'p'], {}, 'D1'], ['diode', ['b', 'p'], {}, 'D2'], ['diode', ['n', 'a'], {}, 'D3'], ['diode', ['n', 'b'], {}, 'D4'], ['res', ['p', 'n'], { R: 1000 }, 'R'], ['res', ['n', '0'], { R: 1 }, 'Rg']]);
  let mn = 1e9, mx = -1e9; run(c, 2e-3, 1e-6); for (let i = 0; i < 2000; i++) { K.step(c.sc, 1e-6); const v = c.V('p') - c.V('n'); mn = Math.min(mn, v); mx = Math.max(mx, v); }
  ok(mn > -0.05, 'bridge output never goes negative (' + mn.toFixed(3) + ')'); near(mx, 10 - 1.4, 0.35, 'bridge peak = source peak minus two drops (' + mx.toFixed(2) + ')'); }
// 7 NPN in the active region: Ic = beta Ib
{ const c = build([['vsrc', ['0', 'vcc'], { V: 10 }], ['res', ['vcc', 'c'], { R: 1000 }, 'Rc'], ['res', ['vcc', 'b'], { R: 1e6 }, 'Rb'], ['npn', ['b', 'c', '0'], { bf: 100 }, 'Q']]); run(c, 1e-3, 1e-4);
  near(c.it.Q._ic / c.it.Q._ib, 100, 2, 'NPN current gain'); near(c.V('b'), 0.65, 0.08, 'base-emitter drop (' + c.V('b').toFixed(3) + ')'); near(c.V('c'), 10 - 1000 * c.it.Q._ic, 0.01, 'collector voltage follows Ic Rc'); }
// 8 NPN saturates and cuts off
{ const mk = vb => { const c = build([['vsrc', ['0', 'vcc'], { V: 5 }], ['vsrc', ['0', 'vb'], { V: vb }], ['res', ['vcc', 'c'], { R: 1000 }], ['res', ['vb', 'b'], { R: 10000 }], ['npn', ['b', 'c', '0'], {}, 'Q']]); run(c, 1e-3, 1e-4); return c; };
  const on = mk(5), off = mk(0); ok(on.V('c') < 0.3, 'saturated switch pulls the collector low (' + on.V('c').toFixed(3) + ')'); near(off.V('c'), 5, 0.01, 'cut-off switch leaves it high'); }
// 9 PNP mirror of the NPN
{ const c = build([['vsrc', ['0', 'vcc'], { V: 10 }], ['res', ['c', '0'], { R: 1000 }, 'Rc'], ['res', ['b', '0'], { R: 1e6 }, 'Rb'], ['pnp', ['b', 'c', 'vcc'], { bf: 100 }, 'Q']]); run(c, 1e-3, 1e-4);
  near(c.V('c'), 1000 * 100 * (10 - 0.7) / 1e6, 0.1, 'PNP collector load voltage (' + c.V('c').toFixed(2) + ' V)'); near(c.it.Q._ic / c.it.Q._ib, 100, 3, 'PNP current gain'); }
// 10 NMOS saturation current
{ const c = build([['vsrc', ['0', 'vdd'], { V: 10 }], ['vsrc', ['0', 'g'], { V: 4 }], ['res', ['vdd', 'd'], { R: 200 }], ['nmos', ['g', 'd', '0'], { Vt: 2, k: 0.005, lam: 0 }, 'M']]); run(c, 1e-3, 1e-4);
  near(c.it.M._i, 0.005 / 2 * 4, 2e-5, 'NMOS saturation current (' + (c.it.M._i * 1e3).toFixed(3) + ' mA)'); near(c.V('d'), 10 - 2, 0.05, 'drain voltage'); }
// 11 NMOS in triode with a small drain supply
{ const c = build([['vsrc', ['0', 'vdd'], { V: 0.5 }], ['vsrc', ['0', 'g'], { V: 5 }], ['nmos', ['g', 'vdd', '0'], { Vt: 2, k: 0.005, lam: 0 }, 'M']]); run(c, 1e-3, 1e-4);
  near(c.it.M._i, 0.005 * (3 * 0.5 - 0.125), 1e-5, 'NMOS triode current'); }
// 12 CMOS inverter both ways
{ const mk = vin => { const c = build([['vsrc', ['0', 'vdd'], { V: 5 }], ['vsrc', ['0', 'in'], { V: vin }], ['pmos', ['in', 'o', 'vdd'], { Vt: 1, k: 0.005 }], ['nmos', ['in', 'o', '0'], { Vt: 1, k: 0.005 }], ['res', ['o', '0'], { R: 1e7 }]]); run(c, 1e-3, 1e-4); return c.V('o'); };
  near(mk(0), 5, 0.05, 'CMOS inverter high output'); near(mk(5), 0, 0.05, 'CMOS inverter low output'); const mid = mk(2.5); ok(mid > 1 && mid < 4, 'switching region is in the middle (' + mid.toFixed(2) + ')'); }
// 13 op-amp inverting amplifier, gain -10
{ const c = build([['vsrc', ['0', 'vi'], { V: 0.5 }], ['res', ['vi', 'm'], { R: 1000 }], ['res', ['m', 'o'], { R: 10000 }], ['opamp', ['m', '0', 'o'], {}, 'U']]); run(c, 1e-3, 1e-4);
  near(c.V('o'), -5, 0.01, 'inverting amplifier output'); near(c.V('m'), 0, 1e-3, 'virtual ground'); }
// 14 op-amp saturates at its rails and acts as a comparator
{ const c = build([['vsrc', ['0', 'vi'], { V: 2 }], ['vsrc', ['0', 'vr'], { V: 1 }], ['opamp', ['vr', 'vi', 'o'], { Vr: 9 }], ['res', ['o', '0'], { R: 10000 }]]); run(c, 1e-3, 1e-4); near(c.V('o'), 9, 0.1, 'comparator goes to +rail');
  const d = build([['vsrc', ['0', 'vi'], { V: 0.5 }], ['vsrc', ['0', 'vr'], { V: 1 }], ['opamp', ['vr', 'vi', 'o'], { Vr: 9 }], ['res', ['o', '0'], { R: 10000 }]]); run(d, 1e-3, 1e-4); near(d.V('o'), -9, 0.1, 'comparator goes to -rail'); }
// 15 op-amp follower and non-inverting gain
{ const c = build([['vsrc', ['0', 'vi'], { V: 3 }], ['opamp', ['o', 'vi', 'o'], {}], ['res', ['o', '0'], { R: 1000 }]]); run(c, 1e-3, 1e-4); near(c.V('o'), 3, 1e-3, 'voltage follower');
  const d = build([['vsrc', ['0', 'vi'], { V: 1 }], ['res', ['m', '0'], { R: 1000 }], ['res', ['o', 'm'], { R: 2000 }], ['opamp', ['m', 'vi', 'o'], {}]]); run(d, 1e-3, 1e-4); near(d.V('o'), 3, 1e-3, 'non-inverting gain of 3'); }
// 16 op-amp integrator: ramp of -Vin t / RC
{ const c = build([['vsrc', ['0', 'vi'], { V: 1 }], ['res', ['vi', 'm'], { R: 1000 }], ['cap', ['m', 'o'], { C: 1e-6 }], ['opamp', ['m', '0', 'o'], { Vr: 12 }], ['res', ['m', 'o'], { R: 1e9 }]]); run(c, 5e-3, 1e-5);
  near(c.V('o'), -5, 0.15, 'integrator ramps at -Vin/RC (' + c.V('o').toFixed(2) + ' V after 5 ms)'); }
// 17 RC through a diode: capacitor charges to the source minus a drop and does not discharge back
{ const c = build([['vsrc', ['0', 'in'], { V: 5 }], ['diode', ['in', 'o'], {}], ['cap', ['o', '0'], { C: 1e-6 }], ['res', ['o', '0'], { R: 1e8 }]]); run(c, 5e-3, 1e-5); const v = c.V('o'); near(v, 5 - 0.5, 0.35, 'cap charges through diode (' + v.toFixed(2) + ')'); }
// 18 stability: a hard-switched LC with a diode must stay finite and not ring up
{ const c = build([['acsrc', ['0', 'in'], { A: 20, f: 5000 }], ['diode', ['in', 'a'], {}], ['ind', ['a', 'b'], { L: 1e-3 }], ['diode', ['0', 'b'], {}], ['cap', ['b', '0'], { C: 1e-6 }], ['res', ['b', '0'], { R: 100 }]]);
  let mx = 0; for (let i = 0; i < 20000; i++) { if (!K.step(c.sc, 1e-6)) break; mx = Math.max(mx, Math.abs(c.V('b'))); } ok(Number.isFinite(mx) && mx < 100, 'diode-switched LC stays bounded (' + mx.toFixed(2) + ' V)'); }
// 19 random resistor networks: Kirchhoff's current law must hold at every node (guards the linear solver against pivoting mistakes)
{ let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; let worst = 0;
  for (let t = 0; t < 40; t++) { const nn = 4 + Math.floor(rnd() * 6), spec = [['vsrc', ['0', 'n0'], { V: 5 }]], rs = [];
    for (let k = 0; k < nn * 2; k++) { const a = Math.floor(rnd() * nn), b = Math.floor(rnd() * (nn + 1)); if (a === b - 0 && b === 0) continue; const R = Math.pow(10, 1 + rnd() * 5), nb = b === nn ? '0' : 'n' + b; if ('n' + a === nb) continue; spec.push(['res', ['n' + a, nb], { R }, 'R' + k]); rs.push(['n' + a, nb, 'R' + k]); }
    for (let a = 0; a < nn; a++) spec.push(['res', ['n' + a, '0'], { R: 1e5 }, 'G' + a]), rs.push(['n' + a, '0', 'G' + a]);
    const c = build(spec); run(c, 3e-4, 1e-4);
    for (let a = 0; a < nn; a++) { let sum = 0; rs.forEach(([x, y, name]) => { const i = c.it[name]._i; if (x === 'n' + a) sum += i; if (y === 'n' + a) sum -= i; }); if (a === 0) sum -= c.it.__src || 0; worst = Math.max(worst, a === 0 ? 0 : Math.abs(sum)); } }
  ok(worst < 1e-9, 'KCL holds on random networks (worst imbalance ' + worst.toExponential(1) + ' A)'); }
process.exit(fails ? 1 : 0);
