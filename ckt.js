// Pholver circuit engine (global CKT). Modified nodal analysis with trapezoidal companion models.
// A scene is a schematic on an integer grid: two-terminal parts of length 3 cells, a one-terminal ground, and wire segments.
// Conventions: terminal 0 is "a", terminal 1 is "b". For every part Vab = v(a) - v(b) and I is the current from a to b through it.
// A battery has its + terminal at b, so Vab = -V and a battery that is delivering power has I > 0 (current flows a to b inside it).
(function () {
  'use strict';
  const EPS0 = 8.8541878128e-12, MU0 = 1.25663706212e-6, LEN = 3;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  let nextId = 1;
  const DEF = {
    vsrc: { V: 5 }, acsrc: { A: 5, f: 50, off: 0, ph: 0 }, isrc: { I: 0.01 },
    res: { R: 1000, len: 0.05, rad: 0.0005 }, lamp: { R: 100, P: 0.5 },
    cap: { C: 1e-6, v0: 0, gap: 1e-4, er: 100 }, ind: { L: 1e-2, i0: 0, N: 100, len: 0.02 },
    sw: { closed: false }, gnd: {},
    diode: { Is: 1e-14, n: 1 }, led: { col: 'red', Vf: 1.9, Imax: 0.02 }, zener: { Is: 1e-14, n: 1, Vz: 5.1 },
    npn: { bf: 100, br: 1, Is: 1e-14 }, pnp: { bf: 100, br: 1, Is: 1e-14 },
    nmos: { Vt: 2, k: 0.05, lam: 0.01 }, pmos: { Vt: 2, k: 0.05, lam: 0.01 },
    opamp: { A: 1e5, Vr: 12, Rout: 50 }
  };
  // Three-terminal parts: terminal positions in grid cells for rotation 0 (x along the part, y up); rotation turns them a quarter turn each.
  const LOC = {
    npn: [[0, 0], [3, 1], [3, -1]], pnp: [[0, 0], [3, 1], [3, -1]],       // base, collector, emitter
    nmos: [[0, 0], [3, 1], [3, -1]], pmos: [[0, 0], [3, 1], [3, -1]],     // gate, drain, source
    opamp: [[0, 1], [0, -1], [3, 0]]                                       // inverting input, non-inverting input, output
  };
  const NONLIN = { diode: 1, led: 1, zener: 1, npn: 1, pnp: 1, nmos: 1, pmos: 1, opamp: 1 };
  const LEDCOL = { red: 1.9, orange: 2.0, yellow: 2.1, green: 2.2, blue: 3.0, white: 3.1 };
  const VT = 0.025852;
  const NAMES = { vsrc: 'Battery', acsrc: 'AC source', isrc: 'Current source', res: 'Resistor', lamp: 'Lamp', diode: 'Diode', led: 'LED', zener: 'Zener diode', npn: 'NPN transistor', pnp: 'PNP transistor', nmos: 'N-MOSFET', pmos: 'P-MOSFET', opamp: 'Op-amp', cap: 'Capacitor', ind: 'Inductor', sw: 'Switch', gnd: 'Ground', wire: 'Wire' };
  const clone = o => JSON.parse(JSON.stringify(o));

  function create(type, o) {
    const it = Object.assign({ id: nextId++, type, x: 0, y: 0, rot: 0, name: NAMES[type] }, clone(DEF[type] || {}), o || {});
    if (o && o.id != null && o.id >= nextId) nextId = o.id + 1;
    return it;
  }
  function wire(x1, y1, x2, y2) { return { id: nextId++, type: 'wire', x1, y1, x2, y2 }; }
  function createScene() { return { items: [], t: 0, tscale: 1, err: '' }; }
  const terminals = it => {
    if (it.type === 'wire') return [{ x: it.x1, y: it.y1 }, { x: it.x2, y: it.y2 }];
    if (it.type === 'gnd') return [{ x: it.x, y: it.y }];
    if (LOC[it.type]) { const r = ((it.rot % 4) + 4) % 4; return LOC[it.type].map(q => { let lx = q[0], ly = q[1]; for (let k = 0; k < r; k++) { const t = lx; lx = -ly; ly = t; } return { x: it.x + lx, y: it.y + ly }; }); }
    const d = DIRS[((it.rot % 4) + 4) % 4]; return [{ x: it.x, y: it.y }, { x: it.x + d[0] * LEN, y: it.y + d[1] * LEN }];
  };
  const isPart = it => it.type !== 'wire';

  // ---- connectivity ----
  function compile(sc) {
    const key = (x, y) => x + ',' + y, idx = new Map(), parent = [];
    const node = (x, y) => { const k = key(x, y); let i = idx.get(k); if (i == null) { i = parent.length; idx.set(k, i); parent.push(i); } return i; };
    const find = i => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    const uni = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
    const pts = [];
    sc.items.forEach(it => terminals(it).forEach(p => { pts.push({ p, i: node(p.x, p.y) }); }));
    sc.items.forEach(it => {
      if (it.type !== 'wire') return;
      uni(node(it.x1, it.y1), node(it.x2, it.y2));
      if (it.x1 === it.x2 || it.y1 === it.y2) {   // T-junctions: any terminal or wire end lying inside this segment joins it
        const x0 = Math.min(it.x1, it.x2), x1 = Math.max(it.x1, it.x2), y0 = Math.min(it.y1, it.y2), y1 = Math.max(it.y1, it.y2);
        pts.forEach(q => { if (q.p.x >= x0 && q.p.x <= x1 && q.p.y >= y0 && q.p.y <= y1) uni(node(it.x1, it.y1), q.i); });
      }
    });
    // ground: a Ground part if present, otherwise the - side of the first source, otherwise the first node
    let g = -1; const gp = sc.items.find(it => it.type === 'gnd');
    if (gp) g = find(node(gp.x, gp.y));
    else { const s = sc.items.find(it => it.type === 'vsrc' || it.type === 'acsrc'); if (s) { const t = terminals(s)[0]; g = find(node(t.x, t.y)); } }
    const ids = new Map(); if (g >= 0) ids.set(g, 0); else if (parent.length) ids.set(find(0), 0);
    for (let i = 0; i < parent.length; i++) { const r = find(i); if (!ids.has(r)) ids.set(r, ids.size); }
    const nodeId = (x, y) => ids.get(find(node(x, y)));
    const net = { n: ids.size, parts: [], nb: 0, nodeId, auto: !gp };
    sc.items.forEach(it => {
      if (!isPart(it)) return;
      const t = terminals(it), p = { it, a: nodeId(t[0].x, t[0].y), b: t.length > 1 ? nodeId(t[1].x, t[1].y) : 0, br: -1 };
      p.n = t.map(q => nodeId(q.x, q.y)); if (NONLIN[it.type]) net.nl = true;
      if (it.type === 'vsrc' || it.type === 'acsrc') p.br = net.nb++;
      net.parts.push(p);
    });
    net.N = Math.max(0, net.n - 1) + net.nb;
    return net;
  }
  const sigOf = sc => sc.items.map(it => it.type + it.x + ',' + it.y + ',' + it.rot + ',' + (it.x1 != null ? it.x1 + ',' + it.y1 + ',' + it.x2 + ',' + it.y2 : '') + (it.type === 'sw' ? it.closed : it.type === 'res' || it.type === 'lamp' ? it.R : it.type === 'cap' ? it.C : it.type === 'ind' ? it.L : NONLIN[it.type] ? [it.Is, it.n, it.Vf, it.Vz, it.bf, it.br, it.Vt, it.k, it.lam, it.A, it.Vr, it.Rout].join('/') : '')).join(';');

  // ---- dense LU ----
  function lu(A, n) {
    const piv = new Int32Array(n);
    for (let k = 0; k < n; k++) {
      let p = k, m = Math.abs(A[k * n + k]);
      for (let i = k + 1; i < n; i++) { const v = Math.abs(A[i * n + k]); if (v > m) { m = v; p = i; } }
      if (m < 1e-18) return null;
      piv[k] = p;
      if (p !== k) for (let j = 0; j < n; j++) { const t = A[k * n + j]; A[k * n + j] = A[p * n + j]; A[p * n + j] = t; }
      const d = A[k * n + k];
      for (let i = k + 1; i < n; i++) { const f = A[i * n + k] / d; A[i * n + k] = f; if (f !== 0) for (let j = k + 1; j < n; j++) A[i * n + j] -= f * A[k * n + j]; }
    }
    return piv;
  }
  function luSolve(A, piv, n, b) {
    // lu() swaps whole rows (multipliers included), so apply every swap to b first, then eliminate
    for (let k = 0; k < n; k++) { const p = piv[k]; if (p !== k) { const t = b[k]; b[k] = b[p]; b[p] = t; } }
    for (let k = 0; k < n; k++) for (let i = k + 1; i < n; i++) b[i] -= A[i * n + k] * b[k];
    for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s -= A[i * n + j] * b[j]; b[i] = s / A[i * n + i]; }
    return b;
  }

  const GMIN = 1e-12, GON = 1e3, GOFF = 1e-12;
  const val = (it, t) => it.type === 'vsrc' ? it.V : it.type === 'acsrc' ? it.off + it.A * Math.sin(2 * Math.PI * it.f * t + it.ph * Math.PI / 180) : 0;
  // Integration: trapezoidal ('tr') for linear circuits; backward Euler ('be') for the first step after any change; and for circuits with
  // nonlinear parts TR-BDF2 (a trapezoidal stage to t + g h, then a BDF2 stage), which is second order like the trapezoid but L-stable, so a diode
  // or transistor switching hard cannot make the capacitor and inductor currents ring.
  const GAM = 2 - Math.SQRT2, C1 = 1 / (GAM * (2 - GAM)), C2 = (1 - GAM) * (1 - GAM) / (GAM * (2 - GAM));
  const kM = (mode, h) => mode === 'be' ? 1 / h : mode === 'tr' ? 2 / h : (2 - GAM) / ((1 - GAM) * h);   // d/dt of the state ~ kM * (new - history)
  const cG = (it, h, mode) => kM(mode, h) * Math.max(it.C, 1e-15), lG = (it, h, mode) => 1 / (kM(mode, h) * Math.max(it.L, 1e-12));

  // Put every reactive part at its starting state and forget the cache.
  function init(sc) {
    sc.t = 0; sc.err = ''; sc._be = true; sc._sig = null;
    sc.items.forEach(it => {
      it._v = 0; it._i = 0; it._p = 0;
      if (it.type === 'cap') { it._v = it.v0 || 0; it._i = 0; } else if (it.type === 'ind') { it._i = it.i0 || 0; it._v = 0; }
    });
  }

  // ---- nonlinear devices ----
  // Each device is linearised about the present estimate of its terminal voltages. lin() returns the currents into its terminals,
  // the slopes of those currents against a few control voltages, and how the control voltages are built from the terminal voltages
  // (control j = sum C[j][m] * v[m] + off[j]). Junction voltages are limited the way SPICE does, so the exponential cannot throw Newton's method out.
  const expc = x => x > 80 ? Math.exp(80) * (1 + x - 80) : Math.exp(x), dexpc = x => x > 80 ? Math.exp(80) : Math.exp(x);
  function pnjlim(vnew, vold, vt, vcrit) {
    if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
      if (vold > 0) { const arg = 1 + (vnew - vold) / vt; vnew = arg > 0 ? vold + vt * Math.log(arg) : vcrit; }
      else vnew = vt * Math.log(vnew / vt);
    }
    return vnew;
  }
  const vcrit = (vt, Is) => vt * Math.log(vt / (Math.SQRT2 * Is));
  const clampd = (v, o, d) => o + Math.max(-d, Math.min(d, v - o));
  // limited junction voltage: remembers the previous iterate in p.lj[k]
  function junc(p, k, v, vt, Is, free) {
    const lj = p.lj || (p.lj = {}); const old = lj[k] == null ? 0 : lj[k];
    const vl = free ? v : pnjlim(v, old, vt, vcrit(vt, Is)); if (!free) { if (Math.abs(vl - v) > 1e-9) p.lim = true; lj[k] = vl; } return vl;
  }
  const diodeIs = it => it.type === 'led' ? 0.01 / Math.exp((it.Vf || 1.9) / (2 * VT)) : Math.max(it.Is || 1e-14, 1e-30);
  function lin(p, v, free) {
    const it = p.it, T = it.type;
    if (T === 'diode' || T === 'led' || T === 'zener') {
      const Is = diodeIs(it), nVt = (T === 'led' ? 2 : (it.n || 1)) * VT, V = junc(p, 'd', v[0] - v[1], nVt, Is, free);
      let I = Is * (expc(V / nVt) - 1) + GMIN * V, g = Is / nVt * dexpc(V / nVt) + GMIN;
      const J = [[g], [-g]], C = [[1, -1]], off = [0], Vc = [V];
      if (T === 'zener') {   // reverse breakdown: 5 mA flows at -Vz, rising by a factor e every 2 kT/q beyond
        const Ik = 5e-3, bVt = 2 * VT, Vr0 = -(v[0] - v[1]) - it.Vz, Vr = junc(p, 'z', Vr0, bVt, Ik, free);
        const ib = Ik * expc(Vr / bVt), gb = Ik / bVt * dexpc(Vr / bVt);
        I -= ib; J[0].push(-gb); J[1].push(gb); C.push([-1, 1]); off.push(-it.Vz); Vc.push(Vr);
      }
      return { I: [I, -I], J, C, off, Vc, V: V, Id: I };
    }
    if (T === 'npn' || T === 'pnp') {
      const s = T === 'npn' ? 1 : -1, Is = Math.max(it.Is || 1e-14, 1e-30), bf = Math.max(it.bf || 100, 1), br = Math.max(it.br || 1, 0.01);
      const vbe = junc(p, 'be', s * (v[0] - v[2]), VT, Is, free), vbc = junc(p, 'bc', s * (v[0] - v[1]), VT, Is, free);
      const ibe = Is * (expc(vbe / VT) - 1) + GMIN * vbe, ibc = Is * (expc(vbc / VT) - 1) + GMIN * vbc, gbe = Is / VT * dexpc(vbe / VT) + GMIN, gbc = Is / VT * dexpc(vbc / VT) + GMIN;
      const Ic = ibe - ibc - ibc / br, Ib = ibe / bf + ibc / br;
      const Jb = [gbe / bf, gbc / br], Jc = [gbe, -gbc * (1 + 1 / br)];
      return { I: [s * Ib, s * Ic, -s * (Ib + Ic)], J: [Jb, Jc, [-(Jb[0] + Jc[0]), -(Jb[1] + Jc[1])]].map((r, i) => r.map(x => s * x)),
        C: [[s, 0, -s], [s, -s, 0]], off: [0, 0], Vc: [vbe, vbc], Ib: s * Ib, Ic: s * Ic, vbe: s * vbe, vce: s * (v[1] - v[2]) * s };
    }
    if (T === 'nmos' || T === 'pmos') {
      const s = T === 'nmos' ? 1 : -1, Vt = it.Vt != null ? it.Vt : 2, k = Math.max(it.k || 0.05, 1e-9), lam = it.lam || 0;
      let vgs = s * (v[0] - v[2]), vds = s * (v[1] - v[2]);
      if (!free) { const lj = p.lj || (p.lj = {}), og = lj.g == null ? 0 : lj.g, od = lj.d == null ? 0 : lj.d, g2 = clampd(vgs, og, 2), d2 = clampd(vds, od, 4); if (g2 !== vgs || d2 !== vds) p.lim = true; vgs = g2; vds = d2; lj.g = vgs; lj.d = vds; }
      const f = (vg, vd) => {   // forward (vd >= 0) square-law drain current and its slopes
        const vov = vg - Vt; if (vov <= 0) return [0, 0, 0]; const m = 1 + lam * vd;
        if (vd < vov) return [k * (vov * vd - vd * vd / 2) * m, k * vd * m, k * (vov - vd) * m + k * (vov * vd - vd * vd / 2) * lam];
        return [k / 2 * vov * vov * m, k * vov * m, k / 2 * vov * vov * lam];
      };
      let Id, gm, gds;
      if (vds >= 0) { const r = f(vgs, vds); Id = r[0]; gm = r[1]; gds = r[2]; }
      else { const r = f(vgs - vds, -vds); Id = -r[0]; gm = -r[1]; gds = r[1] + r[2]; }
      Id += GMIN * vds; gds += GMIN;
      return { I: [0, s * Id, -s * Id], J: [[0, 0], [s * gm, s * gds], [-s * gm, -s * gds]], C: [[s, 0, -s], [0, s, -s]], off: [0, 0], Vc: [vgs, vds], Id: s * Id, vgs: s * vgs, vds: s * vds };
    }
    if (T === 'opamp') {
      const A = Math.max(it.A || 1e5, 1), Vr = Math.max(it.Vr || 12, 0.1), Ro = Math.max(it.Rout || 50, 1e-3), vd = v[1] - v[0], vo = v[2];
      const u = Math.max(-40, Math.min(40, A * vd / Vr)), th = Math.tanh(u), I = (vo - Vr * th) / Ro, gd = -A * (1 - th * th) / Ro;
      return { I: [0, 0, I], J: [[0, 0], [0, 0], [gd, 1 / Ro]], C: [[-1, 1, 0], [0, 0, 1]], off: [0, 0], Vc: [vd, vo], Io: I, vd };
    }
    return null;
  }
  const regime = p => { const it = p.it; return it.type === 'diode' || it.type === 'led' || it.type === 'zener' ? Math.abs(it._i) > 1e-9 : it.type === 'npn' || it.type === 'pnp' ? Math.abs(it._ic || 0) > 1e-9 : it.type === 'nmos' || it.type === 'pmos' ? Math.abs(it._i) > 1e-9 : Math.abs(it._v) > 12 / Math.max(it.A || 1e5, 1) ? 1 : 0; };

  // One implicit step of size h. Returns false (and sets sc.err) when the circuit cannot be solved.
  function stage(sc, h, mode, tn) {
    const net = sc._net, n = net.n - 1, N = net.N, nl = !!net.nl, key = mode + '|' + h, mc = sc._mc || (sc._mc = {});
    let ent = mc[key];
    if (!ent) {
      const A = new Float64Array(N * N), gs = (a, b, g) => { if (a > 0) A[(a - 1) * N + a - 1] += g; if (b > 0) A[(b - 1) * N + b - 1] += g; if (a > 0 && b > 0) { A[(a - 1) * N + b - 1] -= g; A[(b - 1) * N + a - 1] -= g; } };
      for (let i = 0; i < n; i++) A[i * N + i] += GMIN;
      net.parts.forEach(p => {
        const it = p.it;
        switch (it.type) {
          case 'res': case 'lamp': gs(p.a, p.b, 1 / Math.max(it.R, 1e-6)); break;
          case 'sw': gs(p.a, p.b, it.closed ? GON : GOFF); break;
          case 'cap': gs(p.a, p.b, cG(it, h, mode)); break;
          case 'ind': gs(p.a, p.b, lG(it, h, mode)); break;
          case 'vsrc': case 'acsrc': { const r = n + p.br; if (p.a > 0) { A[(p.a - 1) * N + r] += 1; A[r * N + p.a - 1] -= 1; } if (p.b > 0) { A[(p.b - 1) * N + r] -= 1; A[r * N + p.b - 1] += 1; } break; }
        }
      });
      ent = { A0: A };
      if (!nl) { const L = Float64Array.from(A), piv = lu(L, N); if (!piv) { sc.err = singMsg(sc); return false; } ent.lu = L; ent.piv = piv; }
      if (Object.keys(mc).length > 8) sc._mc = {}; (sc._mc)[key] = ent;
    }
    sc._A0 = ent.A0; sc._lu = ent.lu; sc._piv = ent.piv;
    const rhs = new Float64Array(N), inj = (a, b, J) => { if (a > 0) rhs[a - 1] -= J; if (b > 0) rhs[b - 1] += J; };
    net.parts.forEach(p => {
      const it = p.it;
      if (it.type === 'cap') { const G = cG(it, h, mode); inj(p.a, p.b, mode === 'bdf2' ? -G * (C1 * it._vg - C2 * it._vn) : -(G * it._v + (mode === 'be' ? 0 : it._i))); }
      else if (it.type === 'ind') { const G = lG(it, h, mode); inj(p.a, p.b, mode === 'bdf2' ? C1 * it._ig - C2 * it._in : it._i + (mode === 'be' ? 0 : G * it._v)); }
      else if (it.type === 'isrc') inj(p.a, p.b, it.I);
      else if (p.br >= 0) rhs[n + p.br] = val(it, tn);
    });
    let sol = rhs;
    if (!nl) luSolve(sc._lu, sc._piv, N, rhs);
    else {
      const nlp = net.parts.filter(p => NONLIN[p.it.type]); let x = sc._x && sc._x.length === N ? Float64Array.from(sc._x) : new Float64Array(N), conv = false, it = 0;
      const vAt = (xx, k) => k > 0 ? xx[k - 1] : 0;
      for (; it < 150 && !conv; it++) {
        const A = Float64Array.from(sc._A0), r = Float64Array.from(rhs); let lim = false;
        for (const p of nlp) {
          p.lim = false; const v = p.n.map(k => vAt(x, k)), L = lin(p, v, false); lim = lim || p.lim;
          const K = p.n.length;
          for (let i = 0; i < K; i++) {
            const ni = p.n[i]; let ieq = L.I[i]; for (let j = 0; j < L.Vc.length; j++) ieq -= L.J[i][j] * (L.Vc[j] - L.off[j]);
            if (ni > 0) { r[ni - 1] -= ieq; for (let j = 0; j < L.Vc.length; j++) for (let m = 0; m < K; m++) { const nm = p.n[m]; if (nm > 0 && L.C[j][m] !== 0) A[(ni - 1) * N + nm - 1] += L.J[i][j] * L.C[j][m]; } }
          }
        }
        const piv = lu(A, N); if (!piv) { sc.err = singMsg(sc); return false; }
        luSolve(A, piv, N, r);
        let dm = 0; for (let i = 0; i < N; i++) { const d = Math.abs(r[i] - x[i]), tol = (i < n ? 1e-7 : 1e-10) + 1e-4 * Math.abs(r[i]); if (d > tol) dm = Math.max(dm, d / tol); }
        const damp = it > 40 ? 0.5 : 1; for (let i = 0; i < N; i++) x[i] += damp * (r[i] - x[i]);
        conv = dm === 0 && !lim && it > 0;
      }
      sc._iters = it; sc._x = x; sol = x;
      if (!conv) { sc.warn = 'The solver did not fully settle on this step.'; } else sc.warn = '';
    }
    const vn = k => k > 0 ? sol[k - 1] : 0;
    net.parts.forEach(p => {
      const it = p.it, V = vn(p.a) - vn(p.b);
      if (NONLIN[it.type]) {
        const L = lin(p, p.n.map(vn), true); it._ti = L.I.slice();
        if (it.type === 'npn' || it.type === 'pnp') { it._v = L.vce; it._i = L.Ic; it._ib = L.Ib; it._ic = L.Ic; it._vbe = L.vbe; it._p = L.vce * L.Ic + L.vbe * L.Ib; }
        else if (it.type === 'nmos' || it.type === 'pmos') { it._v = L.vds; it._i = L.Id; it._vgs = L.vgs; it._p = L.vds * L.Id; }
        else if (it.type === 'opamp') { it._v = L.vd; it._i = L.Io; it._p = L.Io * vn(p.n[2]); }
        else { it._v = V; it._i = L.Id; it._p = V * L.Id; }
        const rg = regime(p); if (p.rg != null && p.rg !== rg) sc._flip = true; p.rg = rg; return;
      }
      switch (it.type) {
        case 'res': case 'lamp': it._i = V / Math.max(it.R, 1e-6); break;
        case 'sw': it._i = V * (it.closed ? GON : GOFF); break;
        case 'cap': { const G = cG(it, h, mode); it._i = mode === 'bdf2' ? G * (V - C1 * it._vg + C2 * it._vn) : G * (V - it._v) - (mode === 'be' ? 0 : it._i); break; }
        case 'ind': { const G = lG(it, h, mode); it._i = mode === 'bdf2' ? G * V + C1 * it._ig - C2 * it._in : G * V + it._i + (mode === 'be' ? 0 : G * it._v); break; }
        case 'isrc': it._i = it.I; break;
        default: if (p.br >= 0) it._i = sol[n + p.br];
      }
      it._v = V; it._p = V * it._i;
    });
    sc._vn = Array.from({ length: net.n }, (_, k) => vn(k)); sc.err = ''; return true;
  }
  // One step of size h: backward Euler right after anything changed, trapezoidal for linear circuits, TR-BDF2 when parts are nonlinear.
  function step(sc, h) {
    const sig = sigOf(sc); if (sc._sig !== sig) { sc._sig = sig; sc._net = compile(sc); sc._mc = {}; sc._be = true; sc._x = null; }
    const net = sc._net; if (!net.parts.length) { sc.t += h; return true; }
    if (sc._be) { if (!stage(sc, h, 'be', sc.t + h)) return false; sc._be = false; sc.t += h; return true; }
    if (!net.nl) { if (!stage(sc, h, 'tr', sc.t + h)) return false; sc.t += h; return true; }
    sc.items.forEach(it => { it._vn = it._v; it._in = it._i; });
    sc._flip = false;
    if (!stage(sc, GAM * h, 'tr', sc.t + GAM * h)) return false;
    sc.items.forEach(it => { it._vg = it._v; it._ig = it._i; });
    if (!stage(sc, h, 'bdf2', sc.t + h)) return false;
    // a device that switched on or off inside the step makes the second-order result unreliable (the capacitor would be carried past where the
    // device cut it off), so that step is redone with backward Euler, which can only move monotonically toward the answer
    if (sc._flip) { sc.items.forEach(it => { it._v = it._vn; it._i = it._in; }); if (!stage(sc, h, 'be', sc.t + h)) return false; }
    sc.t += h; return true;
  }

  // Characteristic times of the circuit: used for the step size and the default playback speed.
  function times(sc) {
    const R = [], C = [], L = [], ac = [];
    sc.items.forEach(it => {
      if (it.type === 'res' || it.type === 'lamp') R.push(it.R); else if (it.type === 'cap') C.push(it.C); else if (it.type === 'ind') L.push(it.L);
      else if (it.type === 'acsrc' && it.f > 0) ac.push(1 / it.f);
    });
    const T = [], rs = R.reduce((a, b) => a + b, 0), rm = R.length ? Math.min.apply(null, R) : 0;
    if (R.length) { if (!L.length) C.forEach(c => T.push(c * rs)); L.forEach(l => T.push(l / Math.max(rs, 1e-9))); }   // an RC time constant only matters when no inductor makes it a ring
    C.forEach(c => L.forEach(l => T.push(3 * Math.sqrt(c * l))));   // 3 / omega0: oscillations run slower than decays so a period lasts a few seconds
    ac.forEach(p => T.push(3 * p / (2 * Math.PI)));
    const fast = [];
    if (R.length) { C.forEach(c => fast.push(c * rm)); L.forEach(l => fast.push(l / Math.max(R.reduce((a, b) => Math.max(a, b), 0), 1e-9))); }
    C.forEach(c => L.forEach(l => fast.push(Math.sqrt(c * l))));
    ac.forEach(p => fast.push(p / 6));
    const tc = T.length ? Math.min.apply(null, T) : 1, tf = fast.length ? Math.min.apply(null, fast) : tc;
    return { tchar: tc, tfast: Math.min(tf, tc), reactive: T.length > 0 };
  }
  function autoScale(sc) {   // a decay (no inductor) is played so that one time constant lasts about 0.7 s, an oscillation a little slower
    const t = times(sc), ring = sc.items.some(it => it.type === 'ind'); sc.tscale = t.reactive ? t.tchar / (ring ? 1.2 : 0.7) : 1; return sc.tscale; }
  // Advance by dt of simulated time with steps no longer than about tfast/30.
  function advance(sc, dt) {
    const tm = times(sc); let h = Math.max(tm.tfast / 30, 1e-12), n = Math.ceil(dt / h); if (n > 800) { n = 800; }
    h = dt / n; for (let i = 0; i < n; i++) if (!step(sc, h)) return false; return true;
  }
  // The part (if any) that a wire from (x1,y1) to (x2,y2) would pass straight across: two of its terminals lie on the wire.
  function singMsg(sc) {
    const sh = sc.items.find(it => it.type === 'wire' && across(sc, it.x1, it.y1, it.x2, it.y2));
    if (sh) { const p = across(sc, sh.x1, sh.y1, sh.x2, sh.y2); return 'A wire runs across ' + p.name + ' and shorts it. Delete that wire and connect to each end of the part separately.'; }
    return 'This circuit has no unique solution (for example a battery shorted by a wire).';
  }
  function across(sc, x1, y1, x2, y2) {
    if (x1 !== x2 && y1 !== y2) return null;
    const on = q => q.x >= Math.min(x1, x2) && q.x <= Math.max(x1, x2) && q.y >= Math.min(y1, y2) && q.y <= Math.max(y1, y2);
    return sc.items.find(it => isPart(it) && it.type !== 'gnd' && terminals(it).filter(on).length >= 2) || null;
  }
  function toggle(it, sc) { it.closed = !it.closed; if (sc) sc._be = true; }

  // ---- characteristic curves and operating regions, for the field panel ----
  // Each returns the curve(s) the device follows, in the units of the plot, with the present operating point on it.
  function regionOf(it) {
    const T = it.type;
    if (T === 'npn' || T === 'pnp') { const vbe = it._vbe || 0, vbc = (it._vbe || 0) - (it._v || 0); return vbe < 0.4 ? 'cut-off' : vbc > 0.4 ? 'saturation' : 'forward active'; }
    if (T === 'nmos' || T === 'pmos') { const vov = (it._vgs || 0) - (it.Vt != null ? it.Vt : 2) * (T === 'nmos' ? 1 : -1), s = T === 'nmos' ? 1 : -1; return s * (it._vgs || 0) <= (it.Vt != null ? it.Vt : 2) ? 'cut-off' : Math.abs(it._v || 0) < s * vov ? 'triode' : 'saturation'; }
    if (T === 'opamp') return Math.abs(it._v) * (it.A || 1e5) > 0.9 * (it.Vr || 12) ? 'saturated (output at the rail)' : 'linear';
    if (T === 'zener') return it._v < -(it.Vz || 5) + 0.05 ? 'breakdown' : it._v > 0.3 ? 'forward' : 'blocking';
    return it._v > 0.3 ? 'forward' : 'blocking';
  }
  function charac(it) {
    const T = it.type, pts = [], fam = [];
    const eval1 = (v) => { const p = { it, n: [1, 2, 3].slice(0, LOC[T] ? 3 : 2) }; return lin(p, v, true); };
    if (T === 'diode' || T === 'led' || T === 'zener') {
      const vf = T === 'led' ? (it.Vf || 1.9) : 0.75, lo = T === 'zener' ? -(it.Vz || 5) - 1 : -1, hi = vf + 0.35, Iop = Math.abs(it._i || 0);
      const cap = Math.max(Iop * 2.2, T === 'led' ? 0.03 : 0.02);
      for (let k = 0; k <= 160; k++) { const V = lo + (hi - lo) * k / 160, I = eval1([V, 0, 0]).Id; pts.push([V, I]); }
      return { xl: 'V across (V)', yl: 'I (A)', curves: [{ pts, col: 0 }], op: [it._v || 0, it._i || 0], xr: [lo, hi], yr: [-cap * 0.15, cap] };
    }
    if (T === 'npn' || T === 'pnp') {
      const s = T === 'npn' ? 1 : -1, Ibo = Math.max(Math.abs(it._ib || 0), 1e-6), Vmax = Math.max(Math.abs(it._v || 0) * 1.4, 2);
      let Imax = 0;
      [0.25, 0.5, 1, 1.5, 2].forEach(m => {
        const Ib = Ibo * m, line = [];
        for (let k = 0; k <= 80; k++) {
          const vce = Vmax * k / 80; let lo = 0, hi = 1.2;   // find the base-emitter voltage that carries this base current at this vce
          for (let q = 0; q < 50; q++) { const mid = (lo + hi) / 2, L = eval1([s * mid, s * vce, 0]); if (s * L.I[0] > Ib) hi = mid; else lo = mid; }
          const L = eval1([s * (lo + hi) / 2, s * vce, 0]), Ic = s * L.I[1]; line.push([vce, Ic]); Imax = Math.max(Imax, Ic);
        }
        fam.push({ pts: line, col: m === 1 ? 1 : 0 });
      });
      return { xl: 'Vce (V)', yl: 'Ic (A)', curves: fam, op: [Math.abs(it._v || 0), Math.abs(it._ic || 0)], xr: [0, Vmax], yr: [0, Math.max(Imax, Math.abs(it._ic || 0) * 1.3)], note: 'curves for Ib at 0.25, 0.5, 1, 1.5 and 2 times the present base current' };
    }
    if (T === 'nmos' || T === 'pmos') {
      const s = T === 'nmos' ? 1 : -1, Vt = it.Vt != null ? it.Vt : 2, Vmax = Math.max(Math.abs(it._v || 0) * 1.4, 3), vg = Math.abs(it._vgs || 0); let Imax = 0;
      [0.6, 0.8, 1, 1.2, 1.4].forEach(m => {
        const Vgs = Vt + Math.max(vg - Vt, 0.5) * m, line = [];
        for (let k = 0; k <= 80; k++) { const vds = Vmax * k / 80, L = eval1([s * Vgs, s * vds, 0]), Id = s * L.I[1]; line.push([vds, Id]); Imax = Math.max(Imax, Id); }
        fam.push({ pts: line, col: m === 1 ? 1 : 0 });
      });
      return { xl: 'Vds (V)', yl: 'Id (A)', curves: fam, op: [Math.abs(it._v || 0), Math.abs(it._i || 0)], xr: [0, Vmax], yr: [0, Math.max(Imax, Math.abs(it._i || 0) * 1.3)], note: 'curves for Vgs above the threshold, 0.6 to 1.4 times the present overdrive' };
    }
    if (T === 'opamp') {
      const A = it.A || 1e5, Vr = it.Vr || 12, w = Math.max(Math.abs(it._v || 0) * 2, 4 * Vr / A);
      for (let k = 0; k <= 160; k++) { const vd = -w + 2 * w * k / 160; pts.push([vd, Vr * Math.tanh(A * vd / Vr)]); }
      return { xl: 'V+ − V− (V)', yl: 'output (V)', curves: [{ pts, col: 0 }], op: [it._v || 0, Vr * Math.tanh(A * (it._v || 0) / Vr)], xr: [-w, w], yr: [-Vr * 1.1, Vr * 1.1] };
    }
    return null;
  }

  // ---- fields of the physical part (for the field panel) ----
  // Parts with no polarity (resistor, lamp, switch) are read left to right, or bottom to top when vertical, so turning one round never changes its readings.
  const flip = it => (it.type === 'res' || it.type === 'lamp' || it.type === 'sw') && (it.rot === 2 || it.rot === 3) ? -1 : 1;
  function fieldsOf(it) {
    const fl = flip(it), V = (it._v || 0) * fl, I = (it._i || 0) * fl, o = { V, I, P: V * I };
    if (it.type === 'res' || it.type === 'lamp') {
      const l = it.len || 0.05, a = it.rad || 0.0005, A = Math.PI * a * a;
      Object.assign(o, { len: l, rad: a, E: V / l, J: I / A, B: MU0 * I / (2 * Math.PI * a), S: Math.abs(V * I) / (2 * Math.PI * a * l), rho: it.R * A / l });
    } else if (it.type === 'cap') {
      const d = it.gap || 1e-4, er = it.er || 1, C = Math.max(it.C, 1e-15), A = C * d / (EPS0 * er), Rp = Math.sqrt(A / Math.PI);
      Object.assign(o, { gap: d, er, area: A, Rp, E: V / d, D: EPS0 * er * V / d, dEdt: I / (EPS0 * er * A), uE: 0.5 * EPS0 * er * (V / d) * (V / d), U: 0.5 * C * V * V, Q: C * V, B: MU0 * I / (2 * Math.PI * Rp), S: Math.abs(V * I) / (2 * Math.PI * Rp * d) });
    } else if (it.type === 'ind') {
      const N = Math.max(1, it.N || 1), l = it.len || 0.02, L = Math.max(it.L, 1e-12), A = L * l / (MU0 * N * N), Rc = Math.sqrt(A / Math.PI);
      Object.assign(o, { N, len: l, area: A, Rc, B: MU0 * N * I / l, dBdt: V / (N * A), Eind: V / (N * 2 * Math.PI * Rc), flux: L * I / N, U: 0.5 * L * I * I, dIdt: V / L, S: Math.abs(V * I) / (2 * Math.PI * Rc * l) });
    }
    return o;
  }

  // ---- save / load ----
  const serialize = sc => ({ v: 1, tscale: sc.tscale, items: sc.items.map(it => { const o = {}; for (const k in it) if (k[0] !== '_') o[k] = it[k]; return o; }) });
  function deserialize(d) {
    const sc = createScene(); sc.tscale = d.tscale || 1;
    (d.items || []).forEach(o => { const it = o.type === 'wire' ? Object.assign(wire(0, 0, 0, 0), o) : create(o.type, o); if (o.id != null && o.id >= nextId) nextId = o.id + 1; sc.items.push(it); });
    init(sc); return sc;
  }
  const snapshot = sc => JSON.stringify(serialize(sc)), restore = s => deserialize(JSON.parse(s));
  function bounds(sc) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    sc.items.forEach(it => terminals(it).forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }));
    return x0 > x1 ? [-6, -4, 6, 4] : [x0, y0, x1, y1];
  }
  // distance from point to item (grid units) for picking
  function dist(it, x, y) {
    const seg = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0; return Math.hypot(x - ax - t * dx, y - ay - t * dy); };
    if (it.type === 'wire') return seg(it.x1, it.y1, it.x2, it.y2);
    if (it.type === 'gnd') return Math.hypot(it.x - x, it.y - y) - 0.2;
    const t = terminals(it);
    if (t.length > 2) { const cx = t.reduce((a, q) => a + q.x, 0) / t.length, cy = t.reduce((a, q) => a + q.y, 0) / t.length; let m = 1e9; t.forEach(q => { m = Math.min(m, seg(cx, cy, q.x, q.y)); }); return m - 0.3; }
    return seg(t[0].x, t[0].y, t[1].x, t[1].y);
  }

  // ---- examples ----
  function rect(sc, x0, y0, x1, y1, parts) {   // parts: {side:'left'|'top'|'right'|'bottom', at, type, props}, wires fill the rest of the loop
    // walk the loop corner to corner and place parts on their edges
    const P = [{ x: x0, y: y0 }, { x: x0, y: y1 }, { x: x1, y: y1 }, { x: x1, y: y0 }, { x: x0, y: y0 }];
    for (let e = 0; e < 4; e++) {
      const a = P[e], b = P[e + 1], dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y), rot = dx > 0 ? 0 : dy > 0 ? 1 : dx < 0 ? 2 : 3;
      const here = parts.filter(q => q.edge === e).sort((u, v) => u.at - v.at); let cx = a.x, cy = a.y;
      here.forEach(q => {
        const sx = a.x + dx * q.at, sy = a.y + dy * q.at;
        if (sx !== cx || sy !== cy) sc.items.push(wire(cx, cy, sx, sy));
        sc.items.push(create(q.type, Object.assign({ x: sx, y: sy, rot }, q.props || {}))); cx = sx + dx * LEN; cy = sy + dy * LEN;
      });
      if (cx !== b.x || cy !== b.y) sc.items.push(wire(cx, cy, b.x, b.y));
    }
  }
  const PRESETS = [
    {
      name: 'RC charging', note: 'Close the switch: the capacitor charges through the resistor. Select it to see E build up between its plates and B swirl round them.', sel: 'cap',
      build(sc) { rect(sc, 0, 0, 14, 7, [{ edge: 0, at: 0, type: 'vsrc', props: { V: 5, name: 'Battery' } }, { edge: 1, at: 2, type: 'sw', props: { closed: false } }, { edge: 1, at: 8, type: 'res', props: { R: 1000, name: 'R' } }, { edge: 2, at: 2, type: 'cap', props: { C: 1e-6, name: 'C' } }]); sc.items.push(create('gnd', { x: 0, y: 0, rot: 3 })); }
    },
    {
      name: 'RL current ramp', note: 'The inductor opposes the change in current, so it ramps up. The changing B inside it drives a circulating E.', sel: 'ind',
      build(sc) { rect(sc, 0, 0, 14, 7, [{ edge: 0, at: 0, type: 'vsrc', props: { V: 10 } }, { edge: 1, at: 2, type: 'sw', props: { closed: false } }, { edge: 1, at: 8, type: 'res', props: { R: 100, name: 'R' } }, { edge: 2, at: 2, type: 'ind', props: { L: 0.1, name: 'L' } }]); sc.items.push(create('gnd', { x: 0, y: 0, rot: 3 })); }
    },
    {
      name: 'LC oscillator', note: 'Energy sloshes between the capacitor\'s E field and the inductor\'s B field. Watch the two fields trade places.', sel: 'cap',
      build(sc) { rect(sc, 0, 0, 10, 6, [{ edge: 1, at: 3, type: 'ind', props: { L: 1e-2, name: 'L' } }, { edge: 3, at: 3, type: 'cap', props: { C: 1e-6, v0: 5, name: 'C' } }]); sc.items.push(create('gnd', { x: 0, y: 0, rot: 3 })); }
    },
    {
      name: 'Series RLC, AC drive', note: 'An AC source drives a series RLC. The current peaks near the resonance 1/(2π√LC).', sel: 'res',
      build(sc) { rect(sc, 0, 0, 14, 7, [{ edge: 0, at: 0, type: 'acsrc', props: { A: 5, f: 1590, name: 'AC' } }, { edge: 1, at: 1, type: 'res', props: { R: 20, name: 'R' } }, { edge: 1, at: 7, type: 'ind', props: { L: 0.01, name: 'L' } }, { edge: 2, at: 2, type: 'cap', props: { C: 1e-6, name: 'C' } }]); sc.items.push(create('gnd', { x: 0, y: 0, rot: 3 })); }
    },
    {
      name: 'Voltage divider and lamp', note: 'Two resistors divide the battery voltage. The lamp is another resistor and glows with the power it takes.', sel: 'lamp',
      build(sc) { rect(sc, 0, 0, 12, 7, [{ edge: 0, at: 0, type: 'vsrc', props: { V: 12 } }, { edge: 1, at: 1, type: 'sw', props: { closed: true } }, { edge: 1, at: 6, type: 'res', props: { R: 100, name: 'R1' } }, { edge: 2, at: 2, type: 'lamp', props: { R: 50, P: 3, name: 'Lamp' } }]); sc.items.push(create('gnd', { x: 0, y: 0, rot: 3 })); }
    },
    {
      name: 'RC low-pass filter', note: 'A 1 kHz source into R and C. Above the corner frequency the capacitor voltage shrinks and lags.', sel: 'cap',
      build(sc) { rect(sc, 0, 0, 14, 7, [{ edge: 0, at: 0, type: 'acsrc', props: { A: 5, f: 1000, name: 'AC' } }, { edge: 1, at: 4, type: 'res', props: { R: 1000, name: 'R' } }, { edge: 2, at: 2, type: 'cap', props: { C: 3.3e-7, name: 'C' } }]); sc.items.push(create('gnd', { x: 0, y: 0, rot: 3 })); }
    }
  ];
  function demoScene(sc) { PRESETS[0].build(sc); init(sc); autoScale(sc); }

  window.CKT = { across, regionOf, charac, _lin: lin, NONLIN, LEDCOL, LOC, EPS0, MU0, LEN, DIRS, NAMES, DEF, create, wire, createScene, terminals, compile, init, step, advance, times, autoScale, toggle, fieldsOf, serialize, deserialize, snapshot, restore, bounds, dist, flip, PRESETS, demoScene, isPart, nextId: () => nextId++ };
})();
