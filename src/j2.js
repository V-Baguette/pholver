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
