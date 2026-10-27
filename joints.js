const Joints = (function () {
  'use strict';
  const J = {};
  const MAXC = 0.2;
  const KEYS = ['imp', 'ix', 'iy', 'jm', 'jl', 'ju', 'lk0', 'lk1'];
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const cross = (ax, ay, bx, by) => ax * by - ay * bx;
  function pt(b, l) { const c = Math.cos(b.a), s = Math.sin(b.a); return { x: b.x + c * l.x - s * l.y, y: b.y + s * l.x + c * l.y }; }
  J.pt = pt;

  // Clamped spring ends: the spring is a straight line that is built into each object, so an object cannot pivot about its
  // end. Each end resists any change of its angle against the spring line, measured from the pose captured here.
  // Circular objects (spheres, wheels) have no orientation to clamp, so their ends stay free to turn.
  const turns = b => b.kind === 'sphere' || b.kind === 'wheel' || b.kind === 'anchor';
  J.clampsEnd = (j, e) => !turns(e ? j.b : j.a);
  J.setFixedAxis = function (j, on) {
    j.fix = !!on; if (!on) return;
    const a = j.a, b = j.b;
    common(j); const pa = pt(a, j.la), pb = pt(b, j.lb), dir = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    j.rA = dir - a.a; j.rB = dir + Math.PI - b.a;
  };
  J.bendStiff = j => j.kb > 0 ? j.kb : Math.max(j.k, 1) * Math.max(j.L, 0.05) * Math.max(j.L, 0.05);
  // Rod end torsion spring: the rod's direction is the angle, measured against the attached body (end 'a' or 'b').
  J.rodAngle = function (j) { common(j); const dx = j.b.x + j.rbx - j.a.x - j.rax, dy = j.b.y + j.rby - j.a.y - j.ray; return Math.atan2(dy, dx); };
  J.setRodEnd = function (j, end, on) {
    const A = end === 'a', body = A ? j.a : j.b, phi = J.rodAngle(j) + (A ? 0 : Math.PI);
    if (!on) { j[A ? 'ksA' : 'ksB'] = 0; return; }
    if (!(j[A ? 'ksA' : 'ksB'] > 0)) { j[A ? 'ksA' : 'ksB'] = 20; if (!(j[A ? 'csA' : 'csB'] > 0)) j[A ? 'csA' : 'csB'] = 0.3; }
    j[A ? 'rA' : 'rB'] = phi - body.a;
  };
  // Hard angle lock at one end of a rod or spring: the line keeps the angle it had against the object at that end.
  const wrapL = x => { while (x > Math.PI) x -= 2 * Math.PI; while (x <= -Math.PI) x += 2 * Math.PI; return x; };
  J.wrapAngle = wrapL;
  J.captureLocks = function (j) {
    if (!(j.lkA || j.lkB)) return;
    const pa = J.slPos(j.a, j.la), pb = J.slPos(j.b, j.lb), phi = Math.atan2(pb.y - pa.y, pb.x - pa.x);
    if (j.lkA) j.lA = wrapL(phi - J.slAng(j.a)); if (j.lkB) j.lB = wrapL(phi + Math.PI - J.slAng(j.b));
  };
  J.setLock = function (j, end, on) { j[end === 'a' ? 'lkA' : 'lkB'] = !!on; if (!on) { j[end === 'a' ? 'lk0' : 'lk1'] = 0; return; } J.captureLocks(j); };
  J.defaults = function (type) {
    switch (type) {
      case 'spring': return { L: 1, k: 100, c: 0, oc: true, mode: 'auto', pad: null, rail: null, fix: false, kb: 0, rA: null, rB: null, lkA: false, lkB: false, lA: 0, lB: 0 };
      case 'rod': return { L: 1, cc: true, oc: true, ksA: 0, csA: 0, rA: 0, ksB: 0, csB: 0, rB: 0, lkA: false, lkB: false, lA: 0, lB: 0 };
      case 'rope': return { L: 1, ext: false, k: 2000, c: 20, oc: true };
      case 'pin': return { lock: false, motor: false, ms: 2, mt: 50, lim: false, lo: -0.7853981634, hi: 0.7853981634, ref: 0, ks: 0, cs: 0, ka: 0 };
      case 'weld': return { ref: 0 };
      case 'slider': return { ax: 0, ref: 0, lim: false, lo: -1, hi: 1, motor: false, ms: 1, mf: 100 };
      case 'pulley': return { ga: { x: 0, y: 0 }, gb: { x: 0, y: 0 }, ratio: 1, L: 2, cc: true };
    }
    return {};
  };
  const NOCOL = { rod: 1, pin: 1, weld: 1, slider: 1, pulley: 1 };
  // Joints whose bodies overlap at the joint (pin, weld, slider) switch collision off between the pair by default;
  // rods and pulleys keep it on. Either can be changed per connector with j.cc.
  J.noCollide = j => j.owner != null || (!!NOCOL[j.type] && !j.cc);
  J.hasForce = j => j.type === 'spring' || (j.type === 'rod' && (j.ksA > 0 || j.ksB > 0 || j.csA > 0 || j.csB > 0)) || (j.type === 'rope' && j.ext) || (j.type === 'wrap' && j.ext) || (j.type === 'pin' && (j.ks > 0 || j.cs > 0));

  function common(j) {
    const a = j.a, b = j.b;
    const ca = Math.cos(a.a), sa = Math.sin(a.a), cb = Math.cos(b.a), sb = Math.sin(b.a);
    j.rax = ca * j.la.x - sa * j.la.y; j.ray = sa * j.la.x + ca * j.la.y;
    j.rbx = cb * j.lb.x - sb * j.lb.y; j.rby = sb * j.lb.x + cb * j.lb.y;
  }
  function applyImp(j, px, py) {
    const a = j.a, b = j.b;
    a.vx -= a.im * px; a.vy -= a.im * py; a.w -= a.iI * (j.rax * py - j.ray * px);
    b.vx += b.im * px; b.vy += b.im * py; b.w += b.iI * (j.rbx * py - j.rby * px);
  }
  function mv(b, dx, dy, dth, dt) {
    if (b.im === 0 && b.iI === 0) return;
    b.x += dx; b.y += dy; b.a += dth;
    if (dt) { b.vx += dx / dt; b.vy += dy / dt; b.w += dth / dt; }
  }
  function angImp(j, l) { j.a.w -= j.a.iI * l; j.b.w += j.b.iI * l; }
  function geom(j) {
    const a = j.a, b = j.b;
    const dx = b.x + j.rbx - a.x - j.rax, dy = b.y + j.rby - a.y - j.ray, len = Math.hypot(dx, dy);
    j.len = len;
    if (len > 1e-9) { j.nx = dx / len; j.ny = dy / len; } else { j.nx = 1; j.ny = 0; }
    const ra = cross(j.rax, j.ray, j.nx, j.ny), rb = cross(j.rbx, j.rby, j.nx, j.ny);
    j.kk = a.im + b.im + a.iI * ra * ra + b.iI * rb * rb;
  }
  const relV = j => {
    const a = j.a, b = j.b;
    return { x: b.vx - b.w * j.rby - a.vx + a.w * j.ray, y: b.vy + b.w * j.rbx - a.vy - a.w * j.rax };
  };

  // ---- distance based: rod and (inextensible) rope ----
  function distP(j, rope, dt) {
    const a = j.a, b = j.b, pa = pt(a, j.la), pb = pt(b, j.lb);
    let C = Math.hypot(pb.x - pa.x, pb.y - pa.y) - j.L; if (rope && C <= 0) return 0;
    C = clamp(C, -MAXC, MAXC);
    const lam = -C * j.mass, px = lam * j.nx, py = lam * j.ny;
    mv(a, -a.im * px, -a.im * py, -a.iI * cross(j.rax, j.ray, px, py), dt);
    mv(b, b.im * px, b.im * py, b.iI * cross(j.rbx, j.rby, px, py), dt);
    j.pimp += lam; return Math.abs(C);
  }
  function distV(j, dt, rope) {
    const v = relV(j), cdot = j.nx * v.x + j.ny * v.y;
    let lam;
    if (rope) { const C = j.len - j.L; lam = -j.mass * (cdot + (C < 0 ? C / dt : 0)); const o = j.imp, n = Math.min(0, o + lam); lam = n - o; j.imp = n; }
    else { lam = -j.mass * cdot; j.imp += lam; }
    applyImp(j, lam * j.nx, lam * j.ny);
  }
  const T = {};

  // ---- taps: a point on a linkage rod ----
  // A tap bar b (b.sl = {a, la, b, lb, L}) is not a body that carries mass. It is the straight line between two points, a point at fraction
  // t of the way along it being (1 - t) of one end plus t of the other. A rod that ends on the bar therefore pulls on the two ends of the
  // bar's rod directly: forces are shared out exactly, however heavy the load, and the tap can never come away from its rod.
  // The end points may themselves be taps; everything is expanded down to real bodies.
  const slW = (b, l) => clamp(l.x / b.sl.L + 0.5, 0, 1);
  function slPos(b, l) {
    if (!b.sl) return pt(b, l);
    const s = b.sl, pa = slPos(s.a, s.la), pb = slPos(s.b, s.lb), t = slW(b, l);
    return { x: pa.x + (pb.x - pa.x) * t, y: pa.y + (pb.y - pa.y) * t };
  }
  function slAng(b) { if (!b.sl) return b.a; const s = b.sl, pa = slPos(s.a, s.la), pb = slPos(s.b, s.lb); return Math.atan2(pb.y - pa.y, pb.x - pa.x); }
  J.slPos = slPos; J.slAng = slAng;
  J.syncSlaves = function (w) {
    for (const b of w.bodies) if (b.sl) {
      const s = b.sl, pa = slPos(s.a, s.la), pb = slPos(s.b, s.lb), x = (pa.x + pb.x) / 2, y = (pa.y + pb.y) / 2, a = Math.atan2(pb.y - pa.y, pb.x - pa.x);
      b.x = x; b.y = y; b.a = a;
    }
  };
  const term = (m, b) => { let q = m.get(b); if (!q) m.set(b, q = { b, x: 0, y: 0, w: 0 }); return q; };
  // add: coefficient (gx, gy) on the velocity of the point l of body b
  function addPt(m, b, l, gx, gy) {
    if (b.sl) { const s = b.sl, t = slW(b, l); addPt(m, s.a, s.la, gx * (1 - t), gy * (1 - t)); addPt(m, s.b, s.lb, gx * t, gy * t); return; }
    const c = Math.cos(b.a), sn = Math.sin(b.a), rx = c * l.x - sn * l.y, ry = sn * l.x + c * l.y, q = term(m, b);
    q.x += gx; q.y += gy; q.w += rx * gy - ry * gx;
  }
  // add: coefficient c on the angular velocity of body b (for a tap bar, the turning of the line between its two points)
  function addAng(m, b, c) {
    if (b.sl) {
      const s = b.sl, pa = slPos(s.a, s.la), pb = slPos(s.b, s.lb), dx = pb.x - pa.x, dy = pb.y - pa.y, d2 = dx * dx + dy * dy; if (d2 < 1e-12) return;
      const px = -dy / d2 * c, py = dx / d2 * c; addPt(m, s.b, s.lb, px, py); addPt(m, s.a, s.la, -px, -py); return;
    }
    term(m, b).w += c;
  }
  J._sl = { slPos, slAng, term, addPt, addAng };
  const isV = j => !!(j.a.sl || j.b.sl);
  J.isVirtual = isV; J._vrRows = j => vrRows(j);
  function vrRows(j) {
    const pa = slPos(j.a, j.la), pb = slPos(j.b, j.lb), dx = pb.x - pa.x, dy = pb.y - pa.y, L = Math.hypot(dx, dy); if (L < 1e-6) return null;
    const nx = dx / L, ny = dy / L, tx = -ny, ty = nx, rows = [];
    let m = new Map(); addPt(m, j.a, j.la, -nx, -ny); addPt(m, j.b, j.lb, nx, ny); rows.push({ k: 'imp', m, C: L - j.L });
    const phi = Math.atan2(dy, dx);
    for (let e = 0; e < 2; e++) {
      if (!(e ? j.lkB : j.lkA)) continue;
      m = new Map(); addPt(m, j.a, j.la, -tx / L, -ty / L); addPt(m, j.b, j.lb, tx / L, ty / L); addAng(m, e ? j.b : j.a, -1);
      rows.push({ k: 'lk' + e, m, C: wrapL(phi + (e ? Math.PI - slAng(j.b) - j.lB : -slAng(j.a) - j.lA)) });
    }
    for (const r of rows) { r.t = [...r.m.values()]; let K = 0; for (const q of r.t) K += q.b.im * (q.x * q.x + q.y * q.y) + q.b.iI * q.w * q.w; r.mass = K > 1e-12 ? 1 / K : 0; }
    return rows;
  }
  function rowApply(r, l) { for (const q of r.t) { q.b.vx += q.b.im * q.x * l; q.b.vy += q.b.im * q.y * l; q.b.w += q.b.iI * q.w * l; } }
  const rodV = {
    init(j, dt) {
      j.pimp = 0; geom(j); j.dt = dt; j.vr = vrRows(j) || [];
      if (!j.lkA) j.lk0 = 0; if (!j.lkB) j.lk1 = 0;
      for (const r of j.vr) rowApply(r, j[r.k] || 0);
    },
    solveV(j) {
      for (const r of j.vr) {
        let cd = 0; for (const q of r.t) cd += q.x * q.b.vx + q.y * q.b.vy + q.w * q.b.w;
        const l = -r.mass * cd; j[r.k] = (j[r.k] || 0) + l; rowApply(r, l);
      }
    },
    solveP(j, dt) {
      const rows = vrRows(j); if (!rows) return 0; let err = 0;
      for (const r of rows) {
        const C = clamp(r.C, -MAXC, MAXC), l = -C * r.mass;
        for (const q of r.t) mv(q.b, q.b.im * q.x * l, q.b.im * q.y * l, q.b.iI * q.w * l, dt);
        if (r.k === 'imp') j.pimp += l; err = Math.max(err, Math.abs(C));
      }
      return err;
    }
  };
  T.rod = {
    init(j, dt) { if (isV(j)) return rodV.init(j, dt); j.pimp = 0; geom(j); j.dt = dt; j.mass = j.kk > 0 ? 1 / j.kk : 0; applyImp(j, j.nx * j.imp, j.ny * j.imp); },
    solveV(j, dt) { if (isV(j)) return rodV.solveV(j, dt); distV(j, dt, false); },
    solveP(j, dt) { return isV(j) ? rodV.solveP(j, dt) : distP(j, false, dt); }
  };
  T.rope = {
    init(j, dt) {
      j.pimp = 0; if (j.ext) { j.imp = 0; return; }
      geom(j); j.dt = dt; j.mass = j.kk > 0 ? 1 / j.kk : 0;
      if (j.len < j.L - 1e-7) j.imp = 0;
      applyImp(j, j.nx * j.imp, j.ny * j.imp);
    },
    solveV(j, dt) { if (!j.ext) distV(j, dt, true); },
    solveP(j, dt) { return j.ext ? 0 : distP(j, true, dt); }
  };
  T.spring = {};

  // ---- pulley: lenA + ratio * lenB <= L (rope over two fixed ground points) ----
  function pulGeom(j) {
    const a = j.a, b = j.b; common(j);
    const sax = a.x + j.rax - j.ga.x, say = a.y + j.ray - j.ga.y, lA = Math.hypot(sax, say);
    const sbx = b.x + j.rbx - j.gb.x, sby = b.y + j.rby - j.gb.y, lB = Math.hypot(sbx, sby);
    j.lenA = lA; j.lenB = lB;
    j.uax = lA > 1e-6 ? sax / lA : 0; j.uay = lA > 1e-6 ? say / lA : 0;
    j.ubx = lB > 1e-6 ? sbx / lB : 0; j.uby = lB > 1e-6 ? sby / lB : 0;
    const ca = cross(j.rax, j.ray, j.uax, j.uay), cb = cross(j.rbx, j.rby, j.ubx, j.uby);
    j.kk = a.im + a.iI * ca * ca + j.ratio * j.ratio * (b.im + b.iI * cb * cb);
  }
  function pulApply(j, Tn) {
    const a = j.a, b = j.b, r = j.ratio;
    const pax = -Tn * j.uax, pay = -Tn * j.uay, pbx = -r * Tn * j.ubx, pby = -r * Tn * j.uby;
    a.vx += a.im * pax; a.vy += a.im * pay; a.w += a.iI * cross(j.rax, j.ray, pax, pay);
    b.vx += b.im * pbx; b.vy += b.im * pby; b.w += b.iI * cross(j.rbx, j.rby, pbx, pby);
  }
  T.pulley = {
    init(j, dt) { j.pimp = 0; pulGeom(j); j.dt = dt; j.mass = j.kk > 0 ? 1 / j.kk : 0; pulApply(j, j.imp); },
    solveV(j, dt) {
      const a = j.a, b = j.b;
      const cd = j.uax * (a.vx - a.w * j.ray) + j.uay * (a.vy + a.w * j.rax) + j.ratio * (j.ubx * (b.vx - b.w * j.rby) + j.uby * (b.vy + b.w * j.rbx));
      const C = j.lenA + j.ratio * j.lenB - j.L;
      let Tn = j.mass * (cd + (C < 0 ? C / dt : 0)); const o = j.imp, n = Math.max(0, o + Tn); Tn = n - o; j.imp = n;
      pulApply(j, Tn);
    },
    solveP(j, dt) {
      const a = j.a, b = j.b, pa = pt(a, j.la), pb = pt(b, j.lb);
      const C = Math.hypot(pa.x - j.ga.x, pa.y - j.ga.y) + j.ratio * Math.hypot(pb.x - j.gb.x, pb.y - j.gb.y) - j.L;
      if (C <= 0 || j.kk <= 0) return 0;
      const Tn = clamp(C, 0, MAXC) / j.kk, r = j.ratio;
      const pax = -Tn * j.uax, pay = -Tn * j.uay, pbx = -r * Tn * j.ubx, pby = -r * Tn * j.uby;
      mv(a, a.im * pax, a.im * pay, a.iI * cross(j.rax, j.ray, pax, pay), dt);
      mv(b, b.im * pbx, b.im * pby, b.iI * cross(j.rbx, j.rby, pbx, pby), dt);
      j.pimp += Tn; return C;
    }
  };

  J._T = T; J._h = { clamp, cross, common, applyImp, angImp, geom, relV, mv, MAXC, KEYS };
  J._pt = pt;
  return J;
})();
// ---- rope routed over pulley wheels ('wrap') ----
// The rope runs from an end point on body a, over wheels j.wh (each wrapped in sense j.sg = +1 counter-clockwise,
// -1 clockwise), to an end point on body b. Straight sections are common tangents of consecutive circles, so only
// the wheel centres and radii matter. The rope is inextensible, never pushes, and does not slip on a wheel:
//   speed of rope leaving node k along its section  =  speed of rope arriving at node k+1.
// A wheel's own spin enters those equations, so a wheel with inertia makes the tensions on its two sides differ
// (T2 - T1) R = I alpha. A wheel flagged massless merges its two sections into one, which forces equal tension.
(function (J) {
  'use strict';
  const H = J._h, T = J._T, pt = J._pt, cross = H.cross, clamp = H.clamp, MAXC = H.MAXC, TWO = 2 * Math.PI;

  // The path is an ordered list j.seq. Entries {i} are the pulley wheels the rope was routed over by hand (j.wh[i]). Other entries
  // are obstacles the rope has met on its own: a circle (any sphere or unused wheel) or a single corner of a polygon.
  // An obstacle is frictionless: the rope slides over it, tension is equal either side, and the obstacle feels the rope's force.
  function ensureSeq(j) { if (!j.seq || j.seqN !== j.wh.length) { j.seq = j.wh.map((_, i) => ({ i })); j.seqN = j.wh.length; } }
  let this_j = null;
  const getPhi = e => e.i != null ? this_j.phi[e.i] : e.phi;
  function corner(b, vi) {
    const v = b.verts[vi], c = Math.cos(b.a), s = Math.sin(b.a), rx = c * v.x - s * v.y, ry = s * v.x + c * v.y;
    return { rx, ry, x: b.x + rx, y: b.y + ry };
  }
  // Build the rope path from the nodes that are currently engaged. Wrap angle at node i is unwrapped against its previous value.
  function build(j) {
    ensureSeq(j); this_j = j;
    const pa = pt(j.a, j.la), pb = pt(j.b, j.lb), N = [{ x: pa.x, y: pa.y, r: 0, R: 0, rx: 0, ry: 0 }];
    for (const e of j.seq) {
      if (e.i != null) {
        if (!j.act[e.i]) continue;
        const w = j.wh[e.i], s = j.sg[e.i]; N.push({ x: w.x, y: w.y, r: s * w.r, R: w.r, s, b: w, e, rx: 0, ry: 0, i: e.i });
      } else if (e.vi >= 0) {
        const c = corner(e.b, e.vi); N.push({ x: c.x, y: c.y, r: 0, R: 0, s: e.s, b: e.b, e, rx: c.rx, ry: c.ry, auto: true });
      } else N.push({ x: e.b.x, y: e.b.y, r: e.s * e.b.r, R: e.b.r, s: e.s, b: e.b, e, rx: 0, ry: 0, auto: true });
    }
    N.push({ x: pb.x, y: pb.y, r: 0, R: 0, rx: 0, ry: 0 });
    const n = N.length - 2, seg = [], arc = []; let tot = 0;
    for (let k = 0; k <= n; k++) {
      const A = N[k], B = N[k + 1], dx = B.x - A.x, dy = B.y - A.y, dist = Math.max(Math.hypot(dx, dy), 1e-9);
      const dr = clamp(B.r - A.r, -0.999 * dist, 0.999 * dist), th = Math.atan2(dy, dx) - Math.asin(dr / dist), len = Math.sqrt(dist * dist - dr * dr);
      const ux = Math.cos(th), uy = Math.sin(th);
      seg.push({ th, len, dx: ux, dy: uy, x0: A.x + A.r * uy, y0: A.y - A.r * ux, x1: B.x + B.r * uy, y1: B.y - B.r * ux }); tot += len;
    }
    for (let i = 1; i <= n; i++) {
      const Nn = N[i]; let x = Nn.s * (seg[i].th - seg[i - 1].th), prev = getPhi(Nn.e);
      if (isFinite(prev)) x -= TWO * Math.round((x - prev) / TWO); else x -= TWO * Math.floor((x + 0.5) / TWO);
      arc[i] = x; tot += Nn.R * x;
    }
    return { N, seg, arc, n, tot };
  }
  const setPhi = (j, e, v) => { if (e.i != null) j.phi[e.i] = v; else e.phi = v; };

  // ---- finding obstacles in the way of a straight section ----
  const TOL = 5e-4;
  function hullOf(b) {
    if (b._hv !== b.verts) { b._hv = b.verts; const idx = b.verts.map((v, i) => ({ x: v.x, y: v.y, i })); b._hi = Phys_hull(idx); }
    return b._hi;
  }
  function Phys_hull(p) {  // convex hull keeping vertex indices, CCW
    p = p.slice().sort((a, b) => a.x - b.x || a.y - b.y); if (p.length < 3) return p;
    const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x), lo = [], up = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop(); return lo.concat(up);
  }
  // Depth to which segment A-B runs inside the convex CCW polygon P (0 if it only grazes it).
  function depthIn(P, ax, ay, bx, by) {
    let t0 = 0, t1 = 1; const dx = bx - ax, dy = by - ay;
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length], ex = q.x - p.x, ey = q.y - p.y;
      const f0 = ex * (ay - p.y) - ey * (ax - p.x), df = ex * dy - ey * dx;
      if (Math.abs(df) < 1e-12) { if (f0 < 0) return 0; continue; }
      const t = -f0 / df; if (df > 0) t0 = Math.max(t0, t); else t1 = Math.min(t1, t);
      if (t0 >= t1) return 0;
    }
    const mx = ax + dx * (t0 + t1) / 2, my = ay + dy * (t0 + t1) / 2; let m = Infinity;
    for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], ex = q.x - p.x, ey = q.y - p.y; m = Math.min(m, (ex * (my - p.y) - ey * (mx - p.x)) / Math.hypot(ex, ey)); }
    return m;
  }
  function insertAfterActive(j, k, entry) {
    let cnt = 0, at = 0;
    if (k > 0) for (let q = 0; q < j.seq.length; q++) { const e = j.seq[q], on = e.i != null ? j.act[e.i] : true; if (on && ++cnt === k) { at = q + 1; break; } }
    j.seq.splice(at, 0, entry);
  }
  // Look for one obstacle the rope runs through; add it to the path. Returns true if the path changed.
  function engageOne(j, G) {
    const w = J._w; if (!w) return false;
    for (let k = 0; k <= G.n; k++) {
      const sg = G.seg[k], ax = sg.x0, ay = sg.y0, bx = sg.x1, by = sg.y1, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy); if (L < 1e-6) continue;
      const ux = dx / L, uy = dy / L, nA = G.N[k], nB = G.N[k + 1];
      for (const b of w.bodies) {
        if (b === j.a || b === j.b || b.owner != null || j.wh.includes(b)) continue;
        if (b.kind === 'sphere' || b.kind === 'wheel') {
          const l2 = L * L, t = clamp(((b.x - ax) * dx + (b.y - ay) * dy) / l2, 0, 1), d = Math.hypot(b.x - (ax + t * dx), b.y - (ay + t * dy));
          if (d >= b.r - TOL) continue;
          if ((k === 0 || k === G.n) && Math.hypot((k === 0 ? ax : bx) - b.x, (k === 0 ? ay : by) - b.y) < b.r - 0.01) continue;
          insertAfterActive(j, k, { b, s: dx * (b.y - ay) - dy * (b.x - ax) >= 0 ? 1 : -1, vi: -1, phi: NaN, auto: true }); return true;
        }
        if (!b.verts) continue;
        if (Math.hypot(b.x - (ax + bx) / 2, b.y - (ay + by) / 2) > b.br + L / 2 + 0.01) continue;
        const hv = hullOf(b), P = hv.map(v => { const c = corner(b, v.i); return { x: c.x, y: c.y, i: v.i }; });
        if (depthIn(P, ax, ay, bx, by) <= TOL) continue;
        // an end of the rope buried in the obstacle is not "wrapping" it
        const ins = (x, y) => depthIn(P, x, y, x + 1e-7, y) > 0.01 || (() => { let m = Infinity; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length], ex = q.x - p.x, ey = q.y - p.y; m = Math.min(m, (ex * (y - p.y) - ey * (x - p.x)) / Math.hypot(ex, ey)); } return m > 0.01; })();
        if ((k === 0 && ins(ax, ay)) || (k === G.n && ins(bx, by))) continue;
        // which way round: keep the side the rope already uses on this body, otherwise take the shorter way round
        let forced = 0;
        for (const nd of [nA, nB]) if (nd.auto && nd.b === b && nd.e.vi >= 0) forced = -nd.s;
        const dd = P.map(p => (p.x - ax) * -uy + (p.y - ay) * ux);
        let side = 0, best = -1, bl = Infinity;
        for (const sd of forced ? [forced] : [1, -1]) {
          let bi = -1, bd = 0;
          P.forEach((p, i) => { const t = ((p.x - ax) * ux + (p.y - ay) * uy) / L, v = sd * dd[i]; if (t > 1e-6 && t < 1 - 1e-6 && v > bd) { bd = v; bi = i; } });
          if (bi < 0) continue;
          const len = Math.hypot(P[bi].x - ax, P[bi].y - ay) + Math.hypot(bx - P[bi].x, by - P[bi].y);
          if (len < bl) { bl = len; best = bi; side = sd; }
        }
        if (best < 0) continue;
        insertAfterActive(j, k, { b, s: -side, vi: P[best].i, phi: NaN, auto: true }); return true;
      }
    }
    return false;
  }
  // A wheel is engaged while the rope presses on it (positive wrap angle). When the rope straightens it lifts off and the node
  // drops out of the path; a free wheel the straight rope would pass through is engaged again, on whichever side it lies.
  // Other bodies in the scene are met the same way (engageOne) unless the rope has "collide with objects" switched off.
  function geom(j, fresh) {
    const nW = j.wh.length;
    if (!j.act || j.act.length !== nW) { j.act = new Array(nW).fill(true); j.phi = new Array(nW).fill(NaN); j.seq = null; }
    ensureSeq(j);
    if (fresh) {
      const w = J._w;
      j.seq = j.seq.filter(e => e.i != null || (j.oc !== false && w && w.bodies.includes(e.b)));
    }
    let G = build(j);
    if (fresh) {
      for (let pass = 0; pass < 40; pass++) {
        let changed = false;
        for (let k = 1; k <= G.n && !changed; k++) if (G.arc[k] <= 1e-9) {
          const e = G.N[k].e; changed = true;
          if (e.i != null) { j.act[e.i] = false; j.phi[e.i] = NaN; } else j.seq.splice(j.seq.indexOf(e), 1);
        }
        for (let i = 0; i < nW && !changed; i++) {
          if (j.act[i]) continue;
          let before = 0; for (const e of j.seq) { if (e.i === i) break; if (e.i != null ? j.act[e.i] : true) before++; }
          const sg = G.seg[before], w = j.wh[i], dx = sg.x1 - sg.x0, dy = sg.y1 - sg.y0, l2 = dx * dx + dy * dy;
          const t = l2 > 0 ? clamp(((w.x - sg.x0) * dx + (w.y - sg.y0) * dy) / l2, 0, 1) : 0, d = Math.hypot(w.x - (sg.x0 + t * dx), w.y - (sg.y0 + t * dy));
          if (d < w.r - 1e-6) { j.act[i] = true; j.sg[i] = dx * (w.y - sg.y0) - dy * (w.x - sg.x0) >= 0 ? 1 : -1; j.phi[i] = NaN; changed = true; }
        }
        if (!changed && j.oc !== false) changed = engageOne(j, G);
        if (!changed) break;
        G = build(j);
      }
      for (let k = 1; k <= G.n; k++) setPhi(j, G.N[k].e, G.arc[k]);
    }
    return G;
  }
  J.wrapLength = j => geom(j).tot;
  J.wrapSync = j => geom(j, true).tot;
  J.wrapReset = j => { j.seq = null; };

  function add(list, b, x, y, w) {
    if (b.im === 0 && b.iI === 0) return;
    for (const e of list) if (e.b === b) { e.x += x; e.y += y; e.w += w; return; }
    list.push({ b, x, y, w });
  }
  // Row coefficients for sections ks. row . v = (speed leaving the start node) - (speed arriving at the end node).
  function rows(j, G, ks, noSpin) {
    const list = [], n = G.n;
    for (const k of ks) {
      const d = G.seg[k];
      if (k === 0) add(list, j.a, d.dx, d.dy, cross(j.rax, j.ray, d.dx, d.dy));
      else { const N = G.N[k]; add(list, N.b, d.dx, d.dy, (noSpin || N.auto ? 0 : N.s * N.R) + (N.auto ? cross(N.rx, N.ry, d.dx, d.dy) : 0)); }
      if (k === n) add(list, j.b, -d.dx, -d.dy, -cross(j.rbx, j.rby, d.dx, d.dy));
      else { const N = G.N[k + 1]; add(list, N.b, -d.dx, -d.dy, (noSpin || N.auto ? 0 : -N.s * N.R) - (N.auto ? cross(N.rx, N.ry, d.dx, d.dy) : 0)); }
    }
    return list;
  }
  const dot = L => { let s = 0; for (const e of L) s += e.x * e.b.vx + e.y * e.b.vy + e.w * e.b.w; return s; };
  const push = (L, lam) => { if (!lam) return; for (const e of L) { e.b.vx += e.b.im * e.x * lam; e.b.vy += e.b.im * e.y * lam; e.b.w += e.b.iI * e.w * lam; } };
  const kOf = L => { let k = 0; for (const e of L) k += e.b.im * (e.x * e.x + e.y * e.y) + e.b.iI * e.w * e.w; return k; };

  function spin(j) {
    const G = j.G, n = G.n, a = j.a, d0 = G.seg[0];
    let u = d0.dx * (a.vx - a.w * j.ray) + d0.dy * (a.vy + a.w * j.rax);
    for (let i = 1; i <= n; i++) {
      const N = G.N[i], w = N.b, s = N.s, din = G.seg[i - 1], dout = G.seg[i];
      const vx = w.vx - w.w * N.ry, vy = w.vy + w.w * N.rx;
      if (N.auto) u += (dout.dx - din.dx) * vx + (dout.dy - din.dy) * vy;
      else if (w.massless && !w.fixed) { w.w = s * (u - (din.dx * w.vx + din.dy * w.vy)) / w.r; u += (dout.dx - din.dx) * w.vx + (dout.dy - din.dy) * w.vy; }
      else u = dout.dx * w.vx + dout.dy * w.vy + s * w.r * w.w;
    }
  }

  T.wrap = {
    init(j, dt, ratio, cold) {
      const G = geom(j, true); j.G = G; j.dt = dt; if (j.ext) { j.gap = 0; return; }
      const n = G.n, groups = [[0]], key = G.N.map(q => q.e ? (q.e.i != null ? 'w' + q.e.i : 'a' + q.b.id + ':' + q.e.vi + ':' + q.s) : '').join();
      for (let i = 1; i <= n; i++) { if (G.N[i].b.massless || G.N[i].auto) groups[groups.length - 1].push(i); else groups.push([i]); }
      { const ks = []; for (let k = 0; k <= n; k++) ks.push(k); j.rowsP = rows(j, G, ks, true); j.kP = kOf(j.rowsP); }
      j.rowsG = groups.map(ks => rows(j, G, ks, false)); j.massG = j.rowsG.map(L => { const k = kOf(L); return k > 0 ? 1 / k : 0; });
      j.fbUsed = j.fbNext || 0; j.fbNext = 0; const moved = j.actKey !== key; j.gap = j.L - G.tot; j.actKey = key;
      if (!j.gimp || j.gimp.length !== groups.length || moved) j.gimp = new Array(groups.length).fill(0);
      else if (cold) j.gimp.fill(0); else if (ratio !== 1) for (let g = 0; g < j.gimp.length; g++) j.gimp[g] *= ratio;
      let S = 0; for (const L of j.rowsG) S += dot(L);
      if (j.gap > 1e-9 && -S * dt < j.gap) j.gimp.fill(0);
      else j.rowsG.forEach((L, g) => push(L, j.gimp[g]));
    },
    solveV(j, dt) {
      if (j.ext) { spin(j); return; }
      let S = 0; for (const L of j.rowsG) S += dot(L);
      if (j.gap > 1e-9 && -S * dt < j.gap) {
        j.rowsG.forEach((L, g) => { if (j.gimp[g]) { push(L, -j.gimp[g]); j.gimp[g] = 0; } });
      } else {
        j.rowsG.forEach((L, g) => {
          const old = j.gimp[g]; let lam = -j.massG[g] * dot(L); const nw = Math.max(0, old + lam); lam = nw - old; j.gimp[g] = nw; push(L, lam);
        });
      }
      spin(j);
    },
    solveP(j, dt) {
      if (j.ext) return 0;
      common(j);
      // While taut the rope behaves as an equality constraint (like a rod); the half-step position term for gravity
      // would otherwise leave it fractionally slack every step.
      const G = geom(j), C = G.tot - j.L, taut = j.gimp && j.gimp.some(v => v > 0);
      if (C <= 1e-9 && !(taut && C < -1e-12)) return 0;
      const L = j.rowsP, K = j.kP; if (!L || K <= 0) return 0;  // Jacobian frozen at the start of the step (as for rods)
      // Position error is removed and fed back into velocity (SHAKE/RATTLE style, as for rods). That feedback is undone by
      // the next step's velocity solve, so it is remembered and subtracted from the tension readout.
      const lam = clamp(C, -MAXC, MAXC) / K;
      for (const e of L) {
        H.mv(e.b, e.b.im * e.x * lam, e.b.im * e.y * lam, e.b.iI * e.w * lam, dt);
      }
      if (dt) j.fbNext += lam / dt;
      spin(j);
      return C;
    }
  };
  const common = H.common;

  // ---- extensible wrap: a rope that stretches ----
  // The sections that share one tension (runs of massless pulleys; a pulley with its own inertia starts a new run) are springs in series.
  // Each run keeps its stretch, which changes as the pulleys between runs turn; the total always matches the geometry.
  function runs(j) {
    const G = geom(j), n = G.n, groups = [[0]];
    for (let i = 1; i <= n; i++) { if (G.N[i].b.massless || G.N[i].auto) groups[groups.length - 1].push(i); else groups.push([i]); }
    return { G, rowsG: groups.map(ks => rows(j, G, ks, false)) };
  }
  J.wrapForces = function (j, h, phase) {
    const { G, rowsG } = runs(j), nG = rowsG.length, C = G.tot - j.L, k = j.k > 0 ? j.k : 2000, c = j.c > 0 ? j.c : 0;
    const key = G.N.map(q => q.e ? (q.e.i != null ? 'w' + q.e.i : 'a' + q.b.id + ':' + q.e.vi + ':' + q.s) : '').join();
    if (!j.eps || j.eps.length !== nG || j.epsKey !== key) { j.eps = new Array(nG).fill(C / nG); j.epsKey = key; }
    const v = rowsG.map(dot);
    if (phase === 0) j.v0 = v; else if (nG > 1 && j.v0 && j.v0.length === nG) for (let g = 0; g < nG; g++) j.eps[g] -= (j.v0[g] + v[g]) * h;
    { let s = 0; for (const e of j.eps) s += e; const adj = (C - s) / nG; for (let g = 0; g < nG; g++) j.eps[g] += adj; }
    j.tens = [];
    for (let g = 0; g < nG; g++) {
      const L = rowsG[g], K = kOf(L), e = j.eps[g]; let lam = e > 0 ? h * k * e : 0;
      if (e > 0 && c > 0 && K > 0) { const sr = -v[g]; lam += phase === 0 ? h * Math.min(c, 1 / (h * K)) * sr : h * c * sr / (1 + h * c * K); }
      if (lam < 0) lam = 0;
      push(L, lam); j.tens.push(lam / h);
    }
  };
  J.wrapOmega = function (j) { const { rowsG } = runs(j); let m = 0; for (const L of rowsG) m = Math.max(m, Math.sqrt((j.k > 0 ? j.k : 2000) * kOf(L))); return m; };
  J.wrapPE = function (j) { if (!j.eps) return 0; let e = 0; for (const x of j.eps) if (x > 0) e += 0.5 * (j.k > 0 ? j.k : 2000) * x * x; return e; };

  J.readWrap = function (j, r) {
    const G = geom(j), dt = j.dt || 1 / 240;
    if (j.ext) { r.len = G.tot; r.ext = G.tot - j.L; r.taut = r.ext > 0; r.tensions = (j.tens || [0]).slice(); r.tension = r.tensions[0] || 0; r.pe = J.wrapPE(j); return; } r.len = G.tot; r.ext = G.tot - j.L; r.taut = G.tot >= j.L - 1e-4;
    r.tensions = (j.gimp || [0]).map(v => Math.max(0, (v + (j.fbUsed || 0)) / dt)); r.tension = r.tensions[0] || 0;
  };
  // Points along the rope for drawing (arcs sampled).
  J.wrapPoly = function (j) {
    const G = geom(j), pts = [{ x: G.N[0].x, y: G.N[0].y }];
    for (let i = 1; i <= G.n; i++) {
      const N = G.N[i], d = G.seg[i - 1], s = N.s;
      if (!N.R) { pts.push({ x: N.x, y: N.y }); continue; }
      const a0 = Math.atan2(-s * d.dx, s * d.dy), sw = s * G.arc[i], m = Math.max(2, Math.ceil(Math.abs(sw) / 0.15));
      for (let t = 0; t <= m; t++) { const a = a0 + sw * t / m; pts.push({ x: N.x + N.R * Math.cos(a), y: N.y + N.R * Math.sin(a) }); }
    }
    pts.push({ x: G.N[G.n + 1].x, y: G.N[G.n + 1].y });
    return pts;
  };
  const dd = J.defaults;
  J.defaults = function (type) { return type === 'wrap' ? { L: 2, wh: [], sg: [], act: null, phi: [], seq: null, oc: true, ext: false, k: 2000, c: 20 } : dd(type); };
})(Joints);
(function (J) {
  'use strict';
  const T = J._T, H = J._h, pt = J._pt;
  const { clamp, cross, common, applyImp, angImp, geom, relV, mv, MAXC, KEYS } = H;

  // ---- point constraint shared by pin, weld and slider-free parts ----
  function ptK(j) {
    const a = j.a, b = j.b;
    j.k11 = a.im + b.im + a.iI * j.ray * j.ray + b.iI * j.rby * j.rby;
    j.k12 = -a.iI * j.rax * j.ray - b.iI * j.rbx * j.rby;
    j.k22 = a.im + b.im + a.iI * j.rax * j.rax + b.iI * j.rbx * j.rbx;
    const d = j.k11 * j.k22 - j.k12 * j.k12; j.kd = d !== 0 ? 1 / d : 0;
  }
  function ptV(j) {
    const v = relV(j);
    const lx = -j.kd * (j.k22 * v.x - j.k12 * v.y), ly = -j.kd * (-j.k12 * v.x + j.k11 * v.y);
    j.ix += lx; j.iy += ly; applyImp(j, lx, ly);
  }
  function ptP(j, dt) {
    const a = j.a, b = j.b, pa = pt(a, j.la), pb = pt(b, j.lb);
    let cx = pb.x - pa.x, cy = pb.y - pa.y;
    const err = Math.hypot(cx, cy);
    if (err > MAXC) { cx *= MAXC / err; cy *= MAXC / err; }
    if (!j.kd) return err;
    const lx = -j.kd * (j.k22 * cx - j.k12 * cy), ly = -j.kd * (-j.k12 * cx + j.k11 * cy);
    mv(a, -a.im * lx, -a.im * ly, -a.iI * cross(j.rax, j.ray, lx, ly), dt);
    mv(b, b.im * lx, b.im * ly, b.iI * cross(j.rbx, j.rby, lx, ly), dt);
    j.pix += lx; j.piy += ly; return err;
  }

  // ---- pin (revolute hinge) with optional motor, angle limits and torsion spring ----
  T.pin = {
    init(j, dt) {
      j.pix = 0; j.piy = 0; j.dt = dt; ptK(j); j.ka2 = j.a.iI + j.b.iI;
      applyImp(j, j.ix, j.iy); angImp(j, j.jm + j.jl - j.ju);
    },
    solveV(j, dt) {
      const a = j.a, b = j.b, k = j.ka2;
      if (k > 0) {
        if (j.motor) {
          let lam = -(b.w - a.w - j.ms) / k; const mx = j.mt * dt, o = j.jm;
          j.jm = clamp(o + lam, -mx, mx); lam = j.jm - o; angImp(j, lam);
        }
        if (j.lim || j.lock) {
          const th = b.a - a.a - j.ref, lo = j.lock ? 0 : j.lo, hi = j.lock ? 0 : j.hi;
          let C = th - lo, lam = -((b.w - a.w) + (C > 0 ? C / dt : 0)) / k, o = j.jl;
          j.jl = Math.max(0, o + lam); lam = j.jl - o; angImp(j, lam);
          C = hi - th; lam = -((a.w - b.w) + (C > 0 ? C / dt : 0)) / k; o = j.ju;
          j.ju = Math.max(0, o + lam); lam = j.ju - o; angImp(j, -lam);
        }
      }
      ptV(j);
    },
    solveP(j, dt) {
      const a = j.a, b = j.b; let e = 0;
      const k = a.iI + b.iI;
      if ((j.lim || j.lock) && k > 0) {
        const th = b.a - a.a - j.ref, lo = j.lock ? 0 : j.lo, hi = j.lock ? 0 : j.hi;
        if (th < lo) { const C = clamp(th - lo, -MAXC, 0), l = -C / k; mv(a, 0, 0, -a.iI * l, dt); mv(b, 0, 0, b.iI * l, dt); e = -C; }
        else if (th > hi) { const C = clamp(th - hi, 0, MAXC), l = -C / k; mv(a, 0, 0, -a.iI * l, dt); mv(b, 0, 0, b.iI * l, dt); e = C; }
      }
      return Math.max(e, ptP(j, dt));
    }
  };

  // ---- weld: fixes relative position and angle ----
  T.weld = {
    init(j, dt) { j.pix = 0; j.piy = 0; j.dt = dt; ptK(j); j.ka2 = j.a.iI + j.b.iI; applyImp(j, j.ix, j.iy); angImp(j, j.jm); },
    solveV(j) {
      const a = j.a, b = j.b;
      if (j.ka2 > 0) { const lam = -(b.w - a.w) / j.ka2; j.jm += lam; angImp(j, lam); }
      ptV(j);
    },
    solveP(j, dt) {
      const a = j.a, b = j.b; let e = 0;
      if (a.iI + b.iI > 0) {
        const k = a.iI + b.iI, C = clamp(b.a - a.a - j.ref, -MAXC, MAXC), l = -C / k;
        mv(a, 0, 0, -a.iI * l, dt); mv(b, 0, 0, b.iI * l, dt); e = Math.abs(C);
      }
      return Math.max(e, ptP(j, dt));
    }
  };

  // ---- slider (prismatic joint) along an axis fixed in body A ----
  function slGeom(j) {
    const a = j.a, b = j.b; common(j);
    const ang = a.a + j.ax; j.sax = Math.cos(ang); j.say = Math.sin(ang); j.spx = -j.say; j.spy = j.sax;
    j.dx = b.x + j.rbx - a.x - j.rax; j.dy = b.y + j.rby - a.y - j.ray;
    const px = j.dx + j.rax, py = j.dy + j.ray;
    j.a1 = cross(px, py, j.sax, j.say); j.a2 = cross(j.rbx, j.rby, j.sax, j.say);
    j.s1 = cross(px, py, j.spx, j.spy); j.s2 = cross(j.rbx, j.rby, j.spx, j.spy);
    j.k11 = a.im + b.im + a.iI * j.s1 * j.s1 + b.iI * j.s2 * j.s2;
    j.k12 = a.iI * j.s1 + b.iI * j.s2;
    j.k22 = a.iI + b.iI; if (j.k22 === 0) j.k22 = 1;
    const d = j.k11 * j.k22 - j.k12 * j.k12; j.kd = d !== 0 ? 1 / d : 0;
    const ka = a.im + b.im + a.iI * j.a1 * j.a1 + b.iI * j.a2 * j.a2; j.kax = ka > 0 ? 1 / ka : 0;
    j.trans = j.sax * j.dx + j.say * j.dy;
  }
  function slAxial(j, l) {   // axial impulse l on B (and -l on A)
    const a = j.a, b = j.b, px = l * j.sax, py = l * j.say;
    a.vx -= a.im * px; a.vy -= a.im * py; a.w -= a.iI * l * j.a1;
    b.vx += b.im * px; b.vy += b.im * py; b.w += b.iI * l * j.a2;
  }
  function slAxVel(j) {
    const a = j.a, b = j.b;
    return j.sax * (b.vx - a.vx) + j.say * (b.vy - a.vy) + j.a2 * b.w - j.a1 * a.w;
  }
  T.slider = {
    init(j, dt) {
      j.pix = 0; j.piy = 0; j.dt = dt; slGeom(j);
      const a = j.a, b = j.b, ax = j.jm + j.jl - j.ju;
      const px = j.ix * j.spx + ax * j.sax, py = j.ix * j.spy + ax * j.say;
      const LA = j.ix * j.s1 + j.iy + ax * j.a1, LB = j.ix * j.s2 + j.iy + ax * j.a2;
      a.vx -= a.im * px; a.vy -= a.im * py; a.w -= a.iI * LA;
      b.vx += b.im * px; b.vy += b.im * py; b.w += b.iI * LB;
    },
    solveV(j, dt) {
      const a = j.a, b = j.b;
      if (j.motor) {
        let lam = j.kax * (j.ms - slAxVel(j)); const mx = j.mf * dt, o = j.jm;
        j.jm = clamp(o + lam, -mx, mx); lam = j.jm - o; slAxial(j, lam);
      }
      if (j.lim) {
        let C = j.trans - j.lo, lam = -j.kax * (slAxVel(j) + (C > 0 ? C / dt : 0)), o = j.jl;
        j.jl = Math.max(0, o + lam); lam = j.jl - o; slAxial(j, lam);
        C = j.hi - j.trans; lam = -j.kax * (-slAxVel(j) + (C > 0 ? C / dt : 0)); o = j.ju;
        j.ju = Math.max(0, o + lam); lam = j.ju - o; slAxial(j, -lam);
      }
      const c1 = j.spx * (b.vx - a.vx) + j.spy * (b.vy - a.vy) + j.s2 * b.w - j.s1 * a.w, c2 = b.w - a.w;
      const lx = -j.kd * (j.k22 * c1 - j.k12 * c2), ly = -j.kd * (-j.k12 * c1 + j.k11 * c2);
      j.ix += lx; j.iy += ly;
      const px = lx * j.spx, py = lx * j.spy, LA = lx * j.s1 + ly, LB = lx * j.s2 + ly;
      a.vx -= a.im * px; a.vy -= a.im * py; a.w -= a.iI * LA;
      b.vx += b.im * px; b.vy += b.im * py; b.w += b.iI * LB;
    },
    solveP(j, dt) {
      const a = j.a, b = j.b, pa = pt(a, j.la), pb = pt(b, j.lb), dx = pb.x - pa.x, dy = pb.y - pa.y;
      const c1 = clamp(j.spx * dx + j.spy * dy, -MAXC, MAXC), c2 = clamp(b.a - a.a - j.ref, -MAXC, MAXC);
      let err = Math.max(Math.abs(c1), Math.abs(c2));
      if (j.kd) {
        const lx = -j.kd * (j.k22 * c1 - j.k12 * c2), ly = -j.kd * (-j.k12 * c1 + j.k11 * c2);
        const px = lx * j.spx, py = lx * j.spy, LA = lx * j.s1 + ly, LB = lx * j.s2 + ly;
        mv(a, -a.im * px, -a.im * py, -a.iI * LA, dt); mv(b, b.im * px, b.im * py, b.iI * LB, dt);
        j.pix += lx; j.piy += ly;
      }
      if (j.lim) {
        const t = j.sax * dx + j.say * dy, C = t < j.lo ? t - j.lo : t > j.hi ? t - j.hi : 0;
        if (C !== 0) {
          const l = -clamp(C, -MAXC, MAXC) * j.kax, px = l * j.sax, py = l * j.say;
          mv(a, -a.im * px, -a.im * py, -a.iI * l * j.a1, dt); mv(b, b.im * px, b.im * py, b.iI * l * j.a2, dt);
          err = Math.max(err, Math.abs(C));
        }
      }
      return err;
    }
  };

  // ---- hard angle locks at the ends of rods and springs ----
  // One extra row per locked end: the angle of the line between the attachment points, minus the angle of the object at that end.
  function lockRows(j) {
    const a = j.a, b = j.b, dx = b.x + j.rbx - a.x - j.rax, dy = b.y + j.rby - a.y - j.ray, L = Math.hypot(dx, dy);
    if (L < 1e-6) return null;
    const tx = -dy / L, ty = dx / L, ca = cross(j.rax, j.ray, tx, ty) / L, cb = cross(j.rbx, j.rby, tx, ty) / L, rows = [];
    for (let e = 0; e < 2; e++) {
      if (!(e ? j.lkB : j.lkA)) continue;
      const ja = { x: -tx / L, y: -ty / L, w: -ca - (e ? 0 : 1) }, jb = { x: tx / L, y: ty / L, w: cb - (e ? 1 : 0) };
      const K = a.im * (ja.x * ja.x + ja.y * ja.y) + a.iI * ja.w * ja.w + b.im * (jb.x * jb.x + jb.y * jb.y) + b.iI * jb.w * jb.w;
      rows.push({ e, ja, jb, m: K > 1e-12 ? 1 / K : 0 });
    }
    return rows;
  }
  function lockApply(j, r, l) {
    const a = j.a, b = j.b;
    a.vx += a.im * r.ja.x * l; a.vy += a.im * r.ja.y * l; a.w += a.iI * r.ja.w * l;
    b.vx += b.im * r.jb.x * l; b.vy += b.im * r.jb.y * l; b.w += b.iI * r.jb.w * l;
  }
  function lockInit(j) {
    j.lkr = lockRows(j) || [];
    if (!j.lkA) j.lk0 = 0; if (!j.lkB) j.lk1 = 0;
    for (const r of j.lkr) lockApply(j, r, j['lk' + r.e] || 0);
  }
  function lockV(j) {
    const a = j.a, b = j.b;
    for (const r of j.lkr) {
      const cd = r.ja.x * a.vx + r.ja.y * a.vy + r.ja.w * a.w + r.jb.x * b.vx + r.jb.y * b.vy + r.jb.w * b.w, lam = -r.m * cd;
      j['lk' + r.e] = (j['lk' + r.e] || 0) + lam; lockApply(j, r, lam);
    }
  }
  function lockP(j, dt) {
    common(j); const rows = lockRows(j); if (!rows) return 0;
    const a = j.a, b = j.b, phi = Math.atan2(b.y + j.rby - a.y - j.ray, b.x + j.rbx - a.x - j.rax); let err = 0;
    for (const r of rows) {
      const C = clamp(J.wrapAngle(phi + (r.e ? Math.PI - b.a - j.lB : -a.a - j.lA)), -MAXC, MAXC), lam = -C * r.m;
      mv(a, a.im * r.ja.x * lam, a.im * r.ja.y * lam, a.iI * r.ja.w * lam, dt); mv(b, b.im * r.jb.x * lam, b.im * r.jb.y * lam, b.iI * r.jb.w * lam, dt);
      err = Math.max(err, Math.abs(C));
    }
    return err;
  }
  const lockable = j => (j.lkA || j.lkB) && (j.type === 'rod' || j.type === 'spring') && !J.isVirtual(j);

  // ---- angle lock between two rods that meet at a joint of a linkage: their directions keep the angle between them ----
  // j.r1 and j.r2 are the rod joints; j.s1 / j.s2 are 1 when the shared joint is the b end of that rod (the rod then points away from it the other way round).
  function alTerms(j) {
    const m = new Map(), { slPos, addPt } = J._sl;
    for (const [r, s] of [[j.r1, 1], [j.r2, -1]]) {
      const pa = slPos(r.a, r.la), pb = slPos(r.b, r.lb), dx = pb.x - pa.x, dy = pb.y - pa.y, L = Math.hypot(dx, dy); if (L < 1e-6) return null;
      const tx = -dy / L, ty = dx / L; addPt(m, r.a, r.la, -s * tx / L, -s * ty / L); addPt(m, r.b, r.lb, s * tx / L, s * ty / L);
    }
    return [...m.values()];
  }
  const alPhi = (r, s) => { const pa = J.slPos(r.a, r.la), pb = J.slPos(r.b, r.lb); return Math.atan2(pb.y - pa.y, pb.x - pa.x) + (s ? Math.PI : 0); };
  J.captureAlock = function (j) { j.ref = J.wrapAngle(alPhi(j.r1, j.s1) - alPhi(j.r2, j.s2)); };
  T.alock = {
    init(j) {
      j.terms = alTerms(j) || []; let K = 0; for (const q of j.terms) K += q.b.im * (q.x * q.x + q.y * q.y) + q.b.iI * q.w * q.w; j.m = K > 1e-12 ? 1 / K : 0;
      for (const q of j.terms) { const l = j.imp || 0; q.b.vx += q.b.im * q.x * l; q.b.vy += q.b.im * q.y * l; q.b.w += q.b.iI * q.w * l; }
    },
    solveV(j) {
      let cd = 0; for (const q of j.terms) cd += q.x * q.b.vx + q.y * q.b.vy + q.w * q.b.w;
      const l = -j.m * cd; j.imp = (j.imp || 0) + l;
      for (const q of j.terms) { q.b.vx += q.b.im * q.x * l; q.b.vy += q.b.im * q.y * l; q.b.w += q.b.iI * q.w * l; }
    },
    solveP(j, dt) {
      const terms = alTerms(j); if (!terms) return 0;
      let K = 0; for (const q of terms) K += q.b.im * (q.x * q.x + q.y * q.y) + q.b.iI * q.w * q.w; if (K < 1e-12) return 0;
      const C = clamp(J.wrapAngle(alPhi(j.r1, j.s1) - alPhi(j.r2, j.s2) - j.ref), -MAXC, MAXC), l = -C / K;
      for (const q of terms) mv(q.b, q.b.im * q.x * l, q.b.im * q.y * l, q.b.iI * q.w * l, dt);
      return Math.abs(C);
    }
  };

  // ---- dispatch ----
  J.initAll = function (w, dt, ratio, cold) {
    J._w = w;
    for (const j of w.joints) {
      for (const k of KEYS) { if (cold) j[k] = 0; else if (ratio !== 1 && j[k]) j[k] *= ratio; }
      common(j);
      const t = T[j.type]; if (t && t.init) t.init(j, dt, ratio, cold);
      if (lockable(j)) lockInit(j);
    }
  };
  J.solveV = function (w, dt, rev) {
    const js = w.joints, n = js.length;
    for (let i = 0; i < n; i++) { const j = js[rev ? n - 1 - i : i], t = T[j.type]; if (t && t.solveV) t.solveV(j, dt); if (lockable(j)) lockV(j); }
  };
  J.solveP = function (w, iters, dt) {
    const js = w.joints, n = js.length;
    // linkage rods keep going past the usual count while still visibly off (a heavy load on light parts converges slowly)
    for (let it = 0, more = false; it < iters || (more && it < 60); it++) {
      let err = 0, el = 0;
      for (let i = 0; i < n; i++) {
        const j = js[(it & 1) ? n - 1 - i : i], t = T[j.type]; let e = 0;
        if (t && t.solveP) e = t.solveP(j, dt); if (lockable(j)) e = Math.max(e, lockP(j, dt));
        err = Math.max(err, e); if (j.lk) el = Math.max(el, e);
      }
      if (err < 1e-7) break;
      more = el > 2e-4;
    }
  };
  J.zero = function (w) { for (const j of w.joints) { for (const k of KEYS) j[k] = 0; if (j.gimp) j.gimp.fill(0); j.eps = null; } w.mouse = null; };

  // ---- force based elements: springs, extensible ropes, torsion springs ----
  // h is the length of the kick (half a step). phase 0: damping uses the start-of-step velocity (explicit);
  // phase 1: damping is implicit in the resulting velocity. Together they are second order and the
  // static equilibrium is exact.
  // Torque at one end (e = 0 for body a, 1 for body b) against the line between the attachment points.
  // The matching force couple acts at the two attachment points, so linear and angular momentum are conserved.
  function endTors(j, h, e, ks, cs, ref) {
    if (!(ks > 0 || cs > 0)) return;
    const a = j.a, b = j.b, L = j.len; if (L < 1e-6) return;
    const px = -j.ny / L, py = j.nx / L, phi = Math.atan2(j.ny, j.nx), v = relV(j), phid = (-j.ny * v.x + j.nx * v.y) / L;
    const bd = e ? b : a, th = wrapA(phi + (e ? Math.PI : 0) - bd.a - ref), thd = phid - bd.w;
    const eff = a.iI + b.iI + (a.im + b.im) / (L * L);
    let Q = -ks * th; if (cs > 0) Q -= thd * Math.min(cs, 1 / (h * Math.max(eff, 1e-9)));
    const tq = -Q * h, fx = Q * px * h, fy = Q * py * h;
    bd.w += bd.iI * tq;
    b.vx += b.im * fx; b.vy += b.im * fy; b.w += b.iI * (j.rbx * fy - j.rby * fx);
    a.vx -= a.im * fx; a.vy -= a.im * fy; a.w -= a.iI * (j.rax * fy - j.ray * fx);
  }
  const wrapA = x => { while (x > Math.PI) x -= 2 * Math.PI; while (x <= -Math.PI) x += 2 * Math.PI; return x; };
  J.forces = function (w, h, phase) {
    for (const j of w.joints) {
      if (j.type === 'wrap' && j.ext) { common(j); J.wrapForces(j, h, phase); continue; }
      if (j.type === 'spring' || (j.type === 'rope' && j.ext)) {
        common(j); geom(j);
        const rope = j.type === 'rope', x = j.len - j.L;
        if (rope && x <= 0) { j.force = 0; continue; }
        const lamE = -h * j.k * x;
        let lamD = 0;
        if (j.c > 0 && j.kk > 0) {
          if (phase === 0) { const v = relV(j), vr = j.nx * v.x + j.ny * v.y; lamD = -vr * h * Math.min(j.c, 1 / (h * j.kk)); }
        }
        if (lamE || lamD) {
          if (rope) lamD = Math.min(lamD, -lamE);
          applyImp(j, (lamE + lamD) * j.nx, (lamE + lamD) * j.ny);
        }
        if (phase === 1 && j.c > 0 && j.kk > 0) {
          const v = relV(j), vr = j.nx * v.x + j.ny * v.y;
          lamD = -vr * h * j.c / (1 + h * j.c * j.kk);
          if (rope) lamD = Math.min(lamD, -lamE);
          applyImp(j, lamD * j.nx, lamD * j.ny);
        }
        j.force = -(lamE + lamD) / h;
        if (j.fix && !j.pad) { // clamped ends: resist each object's turn against the spring line
          if (j.rA == null) J.setFixedAxis(j, true);
          const kb = J.bendStiff(j), eff = j.a.iI + j.b.iI + (j.a.im + j.b.im) / (Math.max(j.len, 0.05) ** 2);
          const cb = 0.6 * Math.sqrt(kb / Math.max(eff, 1e-9));
          if (J.clampsEnd(j, 0)) endTors(j, h, 0, kb, cb, j.rA);
          if (J.clampsEnd(j, 1)) endTors(j, h, 1, kb, cb, j.rB);
        }
      } else if (j.type === 'rod' && (j.ksA > 0 || j.ksB > 0 || j.csA > 0 || j.csB > 0)) {
        common(j); geom(j);
        endTors(j, h, 0, j.ksA, j.csA, j.rA); endTors(j, h, 1, j.ksB, j.csB, j.rB);
      } else if (j.type === 'pin' && (j.ks > 0 || j.cs > 0)) {
        const a = j.a, b = j.b, ka = a.iI + b.iI; if (ka <= 0) continue;
        const th = b.a - a.a - j.ref - j.ka, lamE = -h * j.ks * th;
        let lamD = 0;
        if (j.cs > 0 && phase === 0) lamD = -(b.w - a.w) * h * Math.min(j.cs, 1 / (h * ka));
        const l1 = lamE + lamD; if (l1) { a.w -= a.iI * l1; b.w += b.iI * l1; }
        if (j.cs > 0 && phase === 1) { lamD = -(b.w - a.w) * h * j.cs / (1 + h * j.cs * ka); a.w -= a.iI * lamD; b.w += b.iI * lamD; }
        j.torque = (lamE + lamD) / h;
      }
    }
  };
  J.omega = function (w) {
    let m = 0;
    for (const j of w.joints) {
      if (j.type === 'wrap' && j.ext) { common(j); m = Math.max(m, J.wrapOmega(j)); }
      else if (j.type === 'spring' || (j.type === 'rope' && j.ext)) { common(j); geom(j); m = Math.max(m, Math.sqrt(j.k * j.kk)); }
      else if (j.type === 'pin' && j.ks > 0) m = Math.max(m, Math.sqrt(j.ks * (j.a.iI + j.b.iI)));
      else if (j.type === 'spring' && j.fix && !j.pad) { common(j); geom(j); const L = Math.max(j.len, 0.05); m = Math.max(m, Math.sqrt(J.bendStiff(j) * (j.a.iI + j.b.iI + (j.a.im + j.b.im) / (L * L)))); }
      else if (j.type === 'rod' && (j.ksA > 0 || j.ksB > 0)) { common(j); geom(j); const L = Math.max(j.len, 0.05); m = Math.max(m, Math.sqrt(Math.max(j.ksA || 0, j.ksB || 0) * (j.a.iI + j.b.iI + (j.a.im + j.b.im) / (L * L)))); }
    }
    return m;
  };

  // ---- readouts and energy ----
  J.read = function (j) {
    const a = j.a, b = j.b; common(j); const r = {}, dt = j.dt || 1 / 240;
    if (j.type === 'spring' || j.type === 'rope' || j.type === 'rod') {
      geom(j); r.len = j.len; r.ext = j.len - j.L;
      if (j.type === 'rod') {
        const phi = Math.atan2(j.ny, j.nx); r.pe = 0;
        if (j.ksA > 0) { r.thA = wrapA(phi - a.a - j.rA); r.pe += 0.5 * j.ksA * r.thA * r.thA; }
        if (j.ksB > 0) { r.thB = wrapA(phi + Math.PI - b.a - j.rB); r.pe += 0.5 * j.ksB * r.thB * r.thB; }
      }
      if (j.type === 'spring') {
        r.force = j.force != null ? j.force : j.k * r.ext; r.pe = 0.5 * j.k * r.ext * r.ext;
        if (j.fix && !j.pad && j.rA != null) { const kb = J.bendStiff(j), phi = Math.atan2(j.ny, j.nx); for (let e = 0; e < 2; e++) if (J.clampsEnd(j, e)) { const th = wrapA(phi + (e ? Math.PI : 0) - (e ? b : a).a - (e ? j.rB : j.rA)); r.pe += 0.5 * kb * th * th; } }
      }
      else if (j.type === 'rope') {
        if (j.ext) { r.tension = r.ext > 0 ? (j.force || 0) : 0; r.pe = r.ext > 0 ? 0.5 * j.k * r.ext * r.ext : 0; r.taut = r.ext > 0; }
        else { r.tension = -(j.imp + (j.pimp || 0)) / dt; r.taut = j.len >= j.L - 1e-4; }
      } else r.tension = -(j.imp + (j.pimp || 0)) / dt;
    } else if (j.type === 'pin') {
      r.angle = b.a - a.a - j.ref; r.rate = b.w - a.w; r.reaction = Math.hypot(j.ix + (j.pix || 0), j.iy + (j.piy || 0)) / dt;
      r.torque = (j.torque || 0) + (j.jm + j.jl - j.ju) / dt; r.pe = j.ks > 0 ? 0.5 * j.ks * Math.pow(r.angle - j.ka, 2) : 0;
    } else if (j.type === 'weld') { r.reaction = Math.hypot(j.ix + (j.pix || 0), j.iy + (j.piy || 0)) / dt; }
    else if (j.type === 'slider') { slGeom(j); r.pos = j.trans; r.speed = slAxVel(j); r.force = (j.jm + j.jl - j.ju) / dt; r.reaction = Math.abs(j.ix + (j.pix || 0)) / dt; }
    else if (j.type === 'pulley') { pulGeomRead(j); r.lenA = j.lenA; r.lenB = j.lenB; r.tension = (j.imp + (j.pimp || 0)) / dt; r.total = j.lenA + j.ratio * j.lenB; }
    else if (j.type === 'wrap') J.readWrap(j, r);
    return r;
  };
  function pulGeomRead(j) {
    const a = j.a, b = j.b;
    j.lenA = Math.hypot(a.x + j.rax - j.ga.x, a.y + j.ray - j.ga.y); j.lenB = Math.hypot(b.x + j.rbx - j.gb.x, b.y + j.rby - j.gb.y);
  }
  J.elastic = function (w) {
    let e = 0;
    for (const j of w.joints) { if (j.type === 'spring' || j.type === 'rope' && j.ext || (j.type === 'wrap' && j.ext) || (j.type === 'pin' && j.ks > 0) || (j.type === 'rod' && (j.ksA > 0 || j.ksB > 0))) e += J.read(j).pe || 0; }
    return e;
  };

  // ---- mouse joint (soft point-to-target constraint used for dragging) ----
  J.mouseInit = function (m, dt, ratio, cold) {
    const b = m.b, c = Math.cos(b.a), s = Math.sin(b.a);
    m.rx = c * m.lx - s * m.ly; m.ry = s * m.lx + c * m.ly;
    const mass = b.im > 0 ? 1 / b.im : b.m, om = 2 * Math.PI * m.hertz, d = 2 * mass * m.zeta * om, k = mass * om * om;
    const g = dt * (d + dt * k); m.gamma = g !== 0 ? 1 / g : 0; m.beta = dt * k * m.gamma;
    m.k11 = b.im + b.iI * m.ry * m.ry + m.gamma; m.k12 = -b.iI * m.rx * m.ry; m.k22 = b.im + b.iI * m.rx * m.rx + m.gamma;
    const det = m.k11 * m.k22 - m.k12 * m.k12; m.kd = det !== 0 ? 1 / det : 0;
    m.cx = (b.x + m.rx - m.tx) * m.beta; m.cy = (b.y + m.ry - m.ty) * m.beta;
    if (cold || m.ix === undefined) { m.ix = 0; m.iy = 0; } else { m.ix *= ratio; m.iy *= ratio; }
    b.vx += b.im * m.ix; b.vy += b.im * m.iy; b.w += b.iI * (m.rx * m.iy - m.ry * m.ix);
  };
  J.mouseSolve = function (m, dt) {
    const b = m.b;
    const cx = b.vx - b.w * m.ry + m.cx + m.gamma * m.ix, cy = b.vy + b.w * m.rx + m.cy + m.gamma * m.iy;
    let lx = -m.kd * (m.k22 * cx - m.k12 * cy), ly = -m.kd * (-m.k12 * cx + m.k11 * cy);
    const ox = m.ix, oy = m.iy; m.ix += lx; m.iy += ly;
    const mx = dt * m.maxF, l = Math.hypot(m.ix, m.iy);
    if (l > mx) { m.ix *= mx / l; m.iy *= mx / l; }
    lx = m.ix - ox; ly = m.iy - oy;
    b.vx += b.im * lx; b.vy += b.im * ly; b.w += b.iI * (m.rx * ly - m.ry * lx);
  };
})(Joints);
if (typeof module !== 'undefined') module.exports = Joints;
