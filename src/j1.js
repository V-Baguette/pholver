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
