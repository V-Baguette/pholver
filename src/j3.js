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
