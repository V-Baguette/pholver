const Phys = (function () {
  'use strict';
  const J = (typeof Joints !== 'undefined') ? Joints : require('./joints.js');
  const MARGIN = 0.004, SLOP = 0.004, BETA = 0.2, ITER = 24;
  let uid = 1;
  const nextId = () => uid++;
  const bumpId = n => { if (n >= uid) uid = n + 1; };

  function hull(pts) {
    const p = pts.map(q => ({ x: q.x, y: q.y })).sort((a, b) => a.x - b.x || a.y - b.y);
    if (p.length < 3) return p;
    const cr = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const lo = [];
    for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
    const up = [];
    for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
    lo.pop(); up.pop();
    return lo.concat(up);
  }

  // area, centroid and inertia per unit mass (about the centroid) of a CCW polygon
  function polyProps(v) {
    let A = 0, cx = 0, cy = 0, J = 0;
    for (let i = 0; i < v.length; i++) {
      const p = v[i], q = v[(i + 1) % v.length], c = p.x * q.y - q.x * p.y;
      A += c / 2; cx += (p.x + q.x) * c; cy += (p.y + q.y) * c;
      J += c * (p.x * p.x + p.x * q.x + q.x * q.x + p.y * p.y + p.y * q.y + q.y * q.y) / 12;
    }
    cx /= 6 * A; cy /= 6 * A;
    return { area: A, cx, cy, ipm: (J - A * (cx * cx + cy * cy)) / A };
  }

  const DEF = {
    sphere: { r: 0.5, m: 2, mus: 0.6, muk: 0.5, e: 0.3 },
    rect: { W: 1.2, H: 0.6, m: 4, mus: 0.5, muk: 0.4, e: 0.1 },
    poly: { n: 5, R: 0.6, m: 3, mus: 0.5, muk: 0.4, e: 0.1 },
    incline: { base: 10, height: 3, flip: false, m: 300, fixed: false, mus: 0.6, muk: 0.5, e: 0 },
    custom: { m: 3, mus: 0.5, muk: 0.4, e: 0.1 },
    wheel: { r: 0.4, m: 1.5, mus: 0.4, muk: 0.3, e: 0.1, massless: true, axle: true }
  };
  // ---- concave outlines: split into convex pieces for collision (ear clipping, then merge pieces while they stay convex) ----
  const cross3 = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const signedArea = p => { let A = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; A += a.x * b.y - b.x * a.y; } return A / 2; };
  function isConvex(p) { const n = p.length; for (let i = 0; i < n; i++) if (cross3(p[i], p[(i + 1) % n], p[(i + 2) % n]) < -1e-9) return false; return true; }
  function segHit(a, b, c, d) {   // proper crossing of segments ab and cd
    const d1 = cross3(a, b, c), d2 = cross3(a, b, d), d3 = cross3(c, d, a), d4 = cross3(c, d, b), e = 1e-12;
    return ((d1 > e && d2 < -e) || (d1 < -e && d2 > e)) && ((d3 > e && d4 < -e) || (d3 < -e && d4 > e));
  }
  function isSimple(p) {
    const n = p.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { if (j === i + 1 || (i === 0 && j === n - 1)) continue; if (segHit(p[i], p[(i + 1) % n], p[j], p[(j + 1) % n])) return false; }
    return true;
  }
  // drop repeated and collinear points; keep the outline as drawn otherwise
  function cleanPoly(pts, tol) {
    tol = tol || 1e-3; let p = pts.map(q => ({ x: q.x, y: q.y })), ch = true;
    while (ch && p.length > 3) {
      ch = false;
      for (let i = 0; i < p.length; i++) {
        const a = p[(i + p.length - 1) % p.length], b = p[i], c = p[(i + 1) % p.length], l = Math.hypot(c.x - a.x, c.y - a.y) || 1e-12;
        if (Math.hypot(b.x - a.x, b.y - a.y) < tol || Math.abs(cross3(a, b, c)) / l < tol * 0.5) { p.splice(i, 1); ch = true; break; }
      }
    }
    return p;
  }
  function triangulate(p) {   // p is CCW and simple; returns index triples
    const idx = p.map((_, i) => i), tris = []; let guard = 0;
    const inside = (a, b, c, q) => cross3(a, b, q) > 1e-12 && cross3(b, c, q) > 1e-12 && cross3(c, a, q) > 1e-12;
    while (idx.length > 3 && guard++ < 10000) {
      let ear = -1, best = -Infinity;
      for (let k = 0; k < idx.length; k++) {
        const a = p[idx[(k + idx.length - 1) % idx.length]], b = p[idx[k]], c = p[idx[(k + 1) % idx.length]], cr = cross3(a, b, c);
        if (cr <= 1e-12) continue;
        let ok = true; for (let m = 0; m < idx.length && ok; m++) { const q = p[idx[m]]; if (q !== a && q !== b && q !== c && inside(a, b, c, q)) ok = false; }
        if (ok) { ear = k; break; }
        if (cr > best) best = cr;
      }
      if (ear < 0) { ear = 0; let bc = -Infinity; for (let k = 0; k < idx.length; k++) { const cr = cross3(p[idx[(k + idx.length - 1) % idx.length]], p[idx[k]], p[idx[(k + 1) % idx.length]]); if (cr > bc) { bc = cr; ear = k; } } }
      tris.push([idx[(ear + idx.length - 1) % idx.length], idx[ear], idx[(ear + 1) % idx.length]]); idx.splice(ear, 1);
    }
    if (idx.length === 3) tris.push([idx[0], idx[1], idx[2]]);
    return tris;
  }
  function decompose(p) {
    let polys = triangulate(p).filter(t => Math.abs(cross3(p[t[0]], p[t[1]], p[t[2]])) > 1e-12);
    const convexIdx = L => { const n = L.length; for (let i = 0; i < n; i++) if (cross3(p[L[i]], p[L[(i + 1) % n]], p[L[(i + 2) % n]]) < -1e-9) return false; return true; };
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < polys.length; i++) for (let j = i + 1; j < polys.length; j++) {
        const A = polys[i], B = polys[j];
        for (let ia = 0; ia < A.length; ia++) {
          const u = A[ia], v = A[(ia + 1) % A.length], ib = B.findIndex((q, k) => q === v && B[(k + 1) % B.length] === u); if (ib < 0) continue;
          const M = []; for (let k = 1; k <= A.length; k++) M.push(A[(ia + k) % A.length]);   // v ... u
          for (let k = 2; k < B.length; k++) M.push(B[(ib + k) % B.length]);                   // vertices of B after u, before v
          if (convexIdx(M)) { polys[i] = M; polys.splice(j, 1); merged = true; break outer; }
        }
      }
    }
    return polys.map(L => L.map(i => ({ x: p[i].x, y: p[i].y })));
  }
  const MLESS = 0.01; // effective mass of a body flagged massless; it also feels no weight

  function setInv(b) {
    if (b.fixed) { b.im = 0; b.iI = 0; }
    else if (b.massless && !b.wl) { const mm = b.mm || MLESS; b.im = 1 / mm; b.iI = 1 / (mm * (b.ipm || 0.1)); }
    else { b.im = 1 / b.m; b.iI = 1 / b.I; }
    if (b.axle && !b.fixed) b.im = 0; // pulley axle held at a point: free to spin, cannot translate
  }

  function buildShape(b) {
    if (b.kind === 'sphere' || b.kind === 'wheel') {
      b.verts = null; b.area = Math.PI * b.r * b.r; b.ipm = b.r * b.r / 2; b.br = b.r;
    } else {
      let raw;
      if (b.kind === 'rect') raw = [{ x: -b.W / 2, y: -b.H / 2 }, { x: b.W / 2, y: -b.H / 2 }, { x: b.W / 2, y: b.H / 2 }, { x: -b.W / 2, y: b.H / 2 }];
      else if (b.kind === 'poly') {
        raw = [];
        for (let i = 0; i < b.n; i++) { const t = Math.PI / 2 + 2 * Math.PI * i / b.n; raw.push({ x: b.R * Math.cos(t), y: b.R * Math.sin(t) }); }
      } else if (b.kind === 'incline') {
        raw = b.flip
          ? [{ x: 0, y: 0 }, { x: b.base, y: 0 }, { x: b.base, y: b.height }]
          : [{ x: 0, y: 0 }, { x: b.base, y: 0 }, { x: 0, y: b.height }];
      } else raw = b.pts;
      if (signedArea(raw) < 0) raw = raw.slice().reverse();
      b.parts = null; b.hulled = false;
      if (b.kind === 'custom' && !isConvex(raw)) { if (!isSimple(raw)) { raw = hull(raw); b.hulled = true; } }
      const p = polyProps(raw);
      b.verts = raw.map(v => ({ x: v.x - p.cx, y: v.y - p.cy }));
      if (b.kind === 'custom' && !isConvex(b.verts)) b.parts = decompose(b.verts).map(v => ({ v, verts: v, body: b }));
      b.area = p.area; b.ipm = p.ipm; b.cornerLocal = { x: -p.cx, y: -p.cy };
      b.br = Math.max.apply(null, b.verts.map(v => Math.hypot(v.x, v.y)));
    }
    if (b.autoI || !(b.I > 0)) b.I = b.m * b.ipm;
    setInv(b);
  }

  function createBody(kind, o) {
    const b = Object.assign({ id: uid++, kind, name: kind, x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, autoI: true, fixed: false, fx: 0, fy: 0, tq: 0, ld: 0 }, DEF[kind], o || {});
    buildShape(b);
    return b;
  }

  // Rebuild after a parameter edit. Inclines keep their base corner in place.
  function rebuild(b) {
    let corner = null;
    if (b.kind === 'incline' && b.cornerLocal) {
      const c = Math.cos(b.a), s = Math.sin(b.a), l = b.cornerLocal;
      corner = { x: b.x + l.x * c - l.y * s, y: b.y + l.x * s + l.y * c };
    }
    buildShape(b);
    if (corner) {
      const c = Math.cos(b.a), s = Math.sin(b.a), l = b.cornerLocal;
      b.x = corner.x - (l.x * c - l.y * s); b.y = corner.y - (l.x * s + l.y * c);
    }
  }

  function createWorld() {
    const w = { bodies: [], joints: [], chains: [], links: [], g: 9.81, ground: true, t: 0, pose: false, pushes: [], mouse: null, dtPrev: 0, linkDirty: true };
    w.groundBody = createBody('rect', { W: 4000, H: 20, x: 0, y: -10, fixed: true, name: 'Ground', mus: 0.6, muk: 0.5, e: 0 });
    w.anchor = { id: 0, kind: 'anchor', name: 'World', x: 0, y: 0, a: 0, vx: 0, vy: 0, w: 0, im: 0, iI: 0, m: 1, fixed: true };
    return w;
  }

  function relink(w) {
    // A massless body that is welded (or hinge-locked) to others cannot be a near-zero mass: the solver would drag the whole assembly
    // through it and it comes apart. It keeps no weight, but takes its real inertia while it is held rigidly to something.
    for (const b of w.bodies) b.wl = false;
    for (const j of w.joints) if (j.type === 'weld' || (j.type === 'pin' && j.lock)) for (const b of [j.a, j.b]) if (b && b !== w.anchor && b.massless) b.wl = true;
    // a massless wheel with a rod, spring or rope tied off its centre would spin without limit (no inertia to resist the torque); it keeps its real inertia
    for (const j of w.joints) if (j.type === 'rod' || j.type === 'spring' || j.type === 'rope' || j.type === 'pin' || j.type === 'slider') {
      if (j.a && j.a !== w.anchor && j.a.massless && j.a.kind === 'wheel' && Math.hypot(j.la.x, j.la.y) > 1e-6) j.a.wl = true;
      if (j.b && j.b !== w.anchor && j.b.massless && j.b.kind === 'wheel' && Math.hypot(j.lb.x, j.lb.y) > 1e-6) j.b.wl = true;
    }
    for (const b of w.bodies) if (b.massless && !!b.wl !== !!b.wlSet) { b.wlSet = !!b.wl; setInv(b); }
    // Bodies welded together form one rigid piece (b.wc); a connector does not collide with the piece it is fixed to.
    for (const b of w.bodies) b.wc = b.id;
    const root = b => { while (b.wc !== b.id) { const p = w.bodies.find(q => q.id === b.wc); if (!p || p === b) break; b = p; } return b.wc; };
    for (const j of w.joints) if (j.type === 'weld' && j.a !== w.anchor && j.b !== w.anchor) { const ra = root(j.a), rb = root(j.b); if (ra !== rb) { const o = w.bodies.find(q => q.id === rb); if (o) o.wc = ra; } }
    for (const b of w.bodies) { b.nc = null; b.lks = null; }
    for (const c of w.links) for (const n of c.nodes) if (n.b) (n.b.lks || (n.b.lks = new Set())).add(c.id);   // objects a linkage is built on
    for (const j of w.joints) {
      if (!J.noCollide(j)) continue;
      [[j.a, j.b], [j.b, j.a]].forEach(p => { if (p[0] !== w.anchor) (p[0].nc || (p[0].nc = new Set())).add(p[1].id); });
    }
    // a slack rope does not collide with the objects it is tied to: its first links start inside them
    for (const c of w.chains) for (const e of [c.a.b, c.b.b]) if (e && e !== w.anchor) for (const n of c.nodes) {
      (n.nc || (n.nc = new Set())).add(e.id); (e.nc || (e.nc = new Set())).add(n.id);
    }
    w.linkDirty = false;
  }

  function refresh(b) {
    if (!b.verts) return;
    const c = Math.cos(b.a), s = Math.sin(b.a), n = b.verts.length;
    const wv = b._wv || (b._wv = []), wn = b._wn || (b._wn = []);
    wv.length = n; wn.length = n;
    for (let i = 0; i < n; i++) { const v = b.verts[i]; wv[i] = { x: b.x + v.x * c - v.y * s, y: b.y + v.x * s + v.y * c }; }
    for (let i = 0; i < n; i++) {
      const p = wv[i], q = wv[(i + 1) % n], ex = q.x - p.x, ey = q.y - p.y, l = Math.hypot(ex, ey) || 1;
      wn[i] = { x: ey / l, y: -ex / l };
    }
    if (b.parts) for (const q of b.parts) {
      const m = q.v.length, pw = q._wv || (q._wv = []), pn = q._wn || (q._wn = []); pw.length = m; pn.length = m;
      for (let i = 0; i < m; i++) { const v = q.v[i]; pw[i] = { x: b.x + v.x * c - v.y * s, y: b.y + v.x * s + v.y * c }; }
      for (let i = 0; i < m; i++) { const p0 = pw[i], p1 = pw[(i + 1) % m], ex = p1.x - p0.x, ey = p1.y - p0.y, l = Math.hypot(ex, ey) || 1; pn[i] = { x: ey / l, y: -ex / l }; }
    }
  }

  function pointInBody(b, x, y) {
    if (!b.verts) return Math.hypot(x - b.x, y - b.y) <= b.r;
    refresh(b);
    const inP = q => { for (let i = 0; i < q._wv.length; i++) if ((x - q._wv[i].x) * q._wn[i].x + (y - q._wv[i].y) * q._wn[i].y > 0) return false; return true; };
    if (b.parts) return b.parts.some(inP);
    return inP(b);
  }

  function ccContact(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), rr = a.r + b.r;
    if (d - rr > MARGIN) return [];
    const nx = d > 1e-9 ? dx / d : 1, ny = d > 1e-9 ? dy / d : 0, pen = rr - d;
    return [{ a, b, nx, ny, pen, px: a.x + nx * (a.r - pen / 2), py: a.y + ny * (a.r - pen / 2) }];
  }

  // circle c, polygon p; normal points from c to p
  function cpContact(c, p) {
    const wv = p._wv, wn = p._wn, n = wv.length;
    let maxSep = -Infinity, mi = 0, dmin = Infinity, qx = 0, qy = 0;
    for (let i = 0; i < n; i++) {
      const s = (c.x - wv[i].x) * wn[i].x + (c.y - wv[i].y) * wn[i].y;
      if (s > maxSep) { maxSep = s; mi = i; }
      const a = wv[i], b = wv[(i + 1) % n], ex = b.x - a.x, ey = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((c.x - a.x) * ex + (c.y - a.y) * ey) / (ex * ex + ey * ey)));
      const x = a.x + ex * t, y = a.y + ey * t, d = Math.hypot(c.x - x, c.y - y);
      if (d < dmin) { dmin = d; qx = x; qy = y; }
    }
    let Nx, Ny, pen;
    if (maxSep < 0) { Nx = wn[mi].x; Ny = wn[mi].y; pen = c.r - maxSep; }
    else {
      if (dmin - c.r > MARGIN) return [];
      Nx = dmin > 1e-9 ? (c.x - qx) / dmin : wn[mi].x; Ny = dmin > 1e-9 ? (c.y - qy) / dmin : wn[mi].y;
      pen = c.r - dmin;
    }
    const nx = -Nx, ny = -Ny;
    return [{ a: c, b: p, nx, ny, pen, px: c.x + nx * (c.r - pen / 2), py: c.y + ny * (c.r - pen / 2) }];
  }

  function sepAxis(A, B) {
    let best = -Infinity, idx = 0;
    for (let i = 0; i < A._wv.length; i++) {
      const n = A._wn[i], v = A._wv[i];
      let m = Infinity;
      for (const w of B._wv) { const d = (w.x - v.x) * n.x + (w.y - v.y) * n.y; if (d < m) m = d; }
      if (m > best) { best = m; idx = i; }
    }
    return { sep: best, idx };
  }

  function ppContact(A, B) {
    const sa = sepAxis(A, B); if (sa.sep > MARGIN) return [];
    const sb = sepAxis(B, A); if (sb.sep > MARGIN) return [];
    let R, I, idx, flip;
    if (sa.sep >= sb.sep - 0.0005) { R = A; I = B; idx = sa.idx; flip = false; }
    else { R = B; I = A; idx = sb.idx; flip = true; }
    const N = R._wn[idx], rv = R._wv[idx];
    const cand = I._wv.map(v => ({ v, s: (v.x - rv.x) * N.x + (v.y - rv.y) * N.y })).sort((p, q) => p.s - q.s);
    const minS = cand[0].s, out = [];
    const nx = flip ? -N.x : N.x, ny = flip ? -N.y : N.y;
    for (let i = 0; i < cand.length && out.length < 2; i++) {
      if (cand[i].s > minS + 0.02 || cand[i].s > MARGIN) break;
      out.push({ a: A, b: B, nx, ny, pen: -cand[i].s, px: cand[i].v.x, py: cand[i].v.y });
    }
    return out;
  }

  function collide1(a, b) {
    const ca = !a.verts, cb = !b.verts;
    if (ca && cb) return ccContact(a, b);
    if (ca) return cpContact(a, b);
    if (cb) return cpContact(b, a);
    return ppContact(a, b);
  }
  // a concave body is a set of convex pieces; contacts are found piece by piece and reported against the whole body
  function collide(a, b) {
    if (!a.parts && !b.parts) return collide1(a, b);
    const out = [];
    for (const x of (a.parts || [a])) for (const y of (b.parts || [b])) {
      for (const c of collide1(x, y)) { c.a = c.a === x ? a : b; c.b = c.b === x ? a : b; out.push(c); }
    }
    return out;
  }

  function relVel(c) {
    const a = c.a, b = c.b;
    return {
      x: (b.vx - b.w * c.rby) - (a.vx - a.w * c.ray),
      y: (b.vy + b.w * c.rbx) - (a.vy + a.w * c.rax)
    };
  }

  function applyImpulse(c, px, py) {
    const a = c.a, b = c.b;
    a.vx -= px * a.im; a.vy -= py * a.im; a.w -= (c.rax * py - c.ray * px) * a.iI;
    b.vx += px * b.im; b.vy += py * b.im; b.w += (c.rbx * py - c.rby * px) * b.iI;
  }


  // ---- contact between bodies and straight connectors (springs, rods, extensible ropes) ----
  // The connector is a massless line from attachment A to attachment B. A body that touches it at parameter t pushes on it with
  // force F; the line passes that on to its two ends as (1-t)F and tF, so a ball hitting the middle of a spring loads both ends.
  const LINE = { spring: 1, rod: 1, rope: 1 };
  const rootOf = (w, b) => { let g = 0; while (b.wc !== b.id && g++ < 64) { const p = w.bodies.find(q => q.id === b.wc); if (!p) break; b = p; } return b.wc; };
  function lineContacts(w, list, out) {
    const chainEnds = new Map(); for (const c of w.chains) chainEnds.set(c.id, [c.a.b, c.b.b]);
    const held = new Set(); for (const q of w.joints) if (q.type === 'rod' && q.a && q.b) { held.add(q.a.id + '|' + q.b.id); held.add(q.b.id + '|' + q.a.id); }
    for (const j of w.joints) {
      if (!LINE[j.type] || (j.owner != null && !j.lk) || j.oc === false || (j.type === 'rope' && !j.ext)) continue;
      const pa = J._pt(j.a, j.la), pb = J._pt(j.b, j.lb), dx = pb.x - pa.x, dy = pb.y - pa.y, L = Math.hypot(dx, dy);
      if (L < 1e-6) continue;
      const ux = dx / L, uy = dy / L, mx = -uy, my = ux, mxp = (pa.x + pb.x) / 2, myp = (pa.y + pb.y) / 2;
      for (const X of list) {
        if (X === j.a || X === j.b || X.ghost) continue;
        if (X.owner != null) { const ce = chainEnds.get(X.owner); if (ce && (ce.includes(j.a) || ce.includes(j.b))) continue; }   // a slack rope tied to this connector's end body
        if (X.group && ((j.a.group && j.a.group === X.group) || (j.b.group && j.b.group === X.group))) continue;
        // an object held to either end of the connector (welded, pinned, or on a slider) is part of what the connector is attached to
        if (X.nc && (X.nc.has(j.a.id) || X.nc.has(j.b.id))) continue;
        if (j.owner != null && X.lks && X.lks.has(j.owner)) continue;   // a linkage does not collide with the objects it is built on
        if (held.has(X.id + '|' + j.a.id) || held.has(X.id + '|' + j.b.id)) continue;   // joined by a rod
        if (X.wc !== X.id || j.a.wc !== j.a.id || j.b.wc !== j.b.id) { const rx = rootOf(w, X); if (rx === rootOf(w, j.a) || rx === rootOf(w, j.b)) continue; }
        if (Math.hypot(X.x - mxp, X.y - myp) > X.br + L / 2 + 0.05) continue;
        if (X.fixed && j.a.im === 0 && j.b.im === 0 && !j.a.sl && !j.b.sl) continue;
        // a connector rooted in X (pinned to a wall, say) does not collide with it
        if (pointInBody(X, pa.x, pa.y) || pointInBody(X, pb.x, pb.y)) continue;
        for (const S of (X.parts || [X])) {
        let n = null, pen = 0, t = 0, px = 0, py = 0;
        if (!S.verts) {
          t = Math.max(0, Math.min(1, ((X.x - pa.x) * ux + (X.y - pa.y) * uy) / L));
          const qx = pa.x + ux * L * t, qy = pa.y + uy * L * t, d = Math.hypot(X.x - qx, X.y - qy);
          if (d - X.r > MARGIN) continue;
          if (d > 1e-6) n = { x: (X.x - qx) / d, y: (X.y - qy) / d };
          else { n = { x: mx, y: my }; if (n.x * X.vx + n.y * X.vy > 0) n = { x: -mx, y: -my }; }
          pen = X.r - d; px = X.x - n.x * X.r + n.x * pen / 2; py = X.y - n.y * X.r + n.y * pen / 2;
        } else {
          const wv = S._wv, wn = S._wn, nv = wv.length; let sepP = -Infinity, ip = 0, kp = 0;
          for (let i = 0; i < nv; i++) {
            const sa = (pa.x - wv[i].x) * wn[i].x + (pa.y - wv[i].y) * wn[i].y, sb = (pb.x - wv[i].x) * wn[i].x + (pb.y - wv[i].y) * wn[i].y, sm = Math.min(sa, sb);
            if (sm > sepP) { sepP = sm; ip = i; kp = sa <= sb ? 0 : 1; }
          }
          if (sepP > MARGIN) continue;
          let lo = Infinity, hi = -Infinity, vlo = 0, vhi = 0;
          for (let i = 0; i < nv; i++) { const p = (wv[i].x - pa.x) * mx + (wv[i].y - pa.y) * my; if (p < lo) { lo = p; vlo = i; } if (p > hi) { hi = p; vhi = i; } }
          const sepS = Math.max(lo, -hi); if (sepS > MARGIN) continue;
          if (sepP >= sepS) { n = { x: -wn[ip].x, y: -wn[ip].y }; pen = -sepP; t = kp; px = kp ? pb.x : pa.x; py = kp ? pb.y : pa.y; }
          else {
            const up = -lo <= hi, v = wv[up ? vlo : vhi]; n = up ? { x: mx, y: my } : { x: -mx, y: -my }; pen = -sepS;
            t = Math.max(0, Math.min(1, ((v.x - pa.x) * ux + (v.y - pa.y) * uy) / L)); px = v.x; py = v.y;
          }
        }
        out.push({ j, X, t, nx: n.x, ny: n.y, pen, px, py, jn: 0 });
        }
      }
    }
  }
  function lineInit(c, dt) {
    const j = c.j, X = c.X, A = j.a, B = j.b, wa = 1 - c.t, wb = c.t, nx = c.nx, ny = c.ny;
    c.rx = c.px - X.x; c.ry = c.py - X.y;
    const rXn = c.rx * ny - c.ry * nx, rAn = j.rax * ny - j.ray * nx, rBn = j.rbx * ny - j.rby * nx;
    c.wa = wa; c.wb = wb; c.tm = null;
    if (A.sl || B.sl) {   // the line ends on a tap: its load goes to the real bodies behind it
      const m = new Map(), S = J._sl; S.addPt(m, A, j.la, wa * nx, wa * ny); S.addPt(m, B, j.lb, wb * nx, wb * ny); c.tm = [...m.values()];
      let K = X.im + rXn * rXn * X.iI; for (const q of c.tm) K += q.b.im * (q.x * q.x + q.y * q.y) + q.b.iI * q.w * q.w;
      c.kn = K;
    } else
    c.kn = X.im + rXn * rXn * X.iI + wa * wa * (A.im + rAn * rAn * A.iI) + wb * wb * (B.im + rBn * rBn * B.iI);
    const rv = lineRel(c), vn = rv; // approach speed
    const bounce = vn < -1 ? -X.e * vn : 0;
    const req = c.pen < 0 ? c.pen / dt : (c.pen > SLOP ? Math.min(3, BETA * (c.pen - SLOP) / dt) : 0);
    c.req = Math.max(req, bounce);
  }
  function lineRel(c) {
    const j = c.j, X = c.X, A = j.a, B = j.b;
    const vx = X.vx - X.w * c.ry, vy = X.vy + X.w * c.rx;
    if (c.tm) { let s = vx * c.nx + vy * c.ny; for (const q of c.tm) s -= q.x * q.b.vx + q.y * q.b.vy + q.w * q.b.w; return s; }
    const ax = A.vx - A.w * j.ray, ay = A.vy + A.w * j.rax, bx = B.vx - B.w * j.rby, by = B.vy + B.w * j.rbx;
    return (vx - (c.wa * ax + c.wb * bx)) * c.nx + (vy - (c.wa * ay + c.wb * by)) * c.ny;
  }
  function lineSolve(c) {
    if (c.kn <= 0) return;
    let lam = (c.req - lineRel(c)) / c.kn; const old = c.jn; c.jn = Math.max(0, old + lam); lam = c.jn - old; if (!lam) return;
    const j = c.j, X = c.X, A = j.a, B = j.b, nx = c.nx, ny = c.ny, wa = c.wa, wb = c.wb;
    X.vx += X.im * nx * lam; X.vy += X.im * ny * lam; X.w += X.iI * (c.rx * ny - c.ry * nx) * lam;
    if (c.tm) { for (const q of c.tm) { q.b.vx -= q.b.im * q.x * lam; q.b.vy -= q.b.im * q.y * lam; q.b.w -= q.b.iI * q.w * lam; } return; }
    A.vx -= A.im * wa * nx * lam; A.vy -= A.im * wa * ny * lam; A.w -= A.iI * wa * (j.rax * ny - j.ray * nx) * lam;
    B.vx -= B.im * wb * nx * lam; B.vy -= B.im * wb * ny * lam; B.w -= B.iI * wb * (j.rbx * ny - j.rby * nx) * lam;
  }


  function stepOnce(w, dt) {
    const pose = w.pose;
    if (w.linkDirty) relink(w);
    J.syncSlaves(w);
    const ratio = w.dtPrev ? dt / w.dtPrev : 1; w.dtPrev = dt;
    const list = w.ground ? w.bodies.concat([w.groundBody]) : w.bodies;
    if (!pose && w.joints.length) J.forces(w, dt / 2, 0);
    for (const b of list) {
      if (!b.fixed && !b.axle && !pose) {
        if (!b.massless && !b.nog) b.vy -= w.g * dt;
        if (b.fx || b.fy) { b.vx += b.fx * b.im * dt; b.vy += b.fy * b.im * dt; }
        if (b.tq) b.w += b.tq * b.iI * dt;
        if (b.ld) { const f = Math.exp(-b.ld * dt); b.vx *= f; b.vy *= f; b.w *= f; }
      }
      if (b.axle && !b.fixed && !pose && b.iI > 0) {   // a pulley on a fixed axle: applied torque, motor and axle friction act on its spin
        if (b.tq) b.w += b.tq * b.iI * dt;
        if (b.motor) { const mx = Math.max(b.mt, 0) * b.iI * dt, dw = (b.ms || 0) - b.w; b.w += dw > mx ? mx : dw < -mx ? -mx : dw; }
        if (b.ld) b.w *= Math.exp(-b.ld * dt);
      }
      b._ct = false; refresh(b);
    }
    if (!pose) {
      for (const p of w.pushes) {
        const b = p.b; if (b.fixed) continue;
        b.vx += p.fx * b.im * dt; b.vy += p.fy * b.im * dt; b.w += ((p.px - b.x) * p.fy - (p.py - b.y) * p.fx) * b.iI * dt;
      }
    }
    const contacts = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.fixed && b.fixed) continue;
        if (a.nc && a.nc.has(b.id)) continue;
        if (a.group && a.group === b.group) continue;
        if (a.ghost || b.ghost) continue;
        if (Math.hypot(a.x - b.x, a.y - b.y) > a.br + b.br + 0.1) continue;
        const cs = collide(a, b);
        for (const c of cs) contacts.push(c);
      }
    }
    for (const c of contacts) {
      const a = c.a, b = c.b, nx = c.nx, ny = c.ny;
      c.rax = c.px - a.x; c.ray = c.py - a.y; c.rbx = c.px - b.x; c.rby = c.py - b.y;
      const rv = relVel(c), vn = rv.x * nx + rv.y * ny, tx = -ny, ty = nx;
      const rnA = c.rax * ny - c.ray * nx, rnB = c.rbx * ny - c.rby * nx;
      const rtA = c.rax * ty - c.ray * tx, rtB = c.rbx * ty - c.rby * tx;
      c.kn = a.im + b.im + rnA * rnA * a.iI + rnB * rnB * b.iI;
      c.kt = a.im + b.im + rtA * rtA * a.iI + rtB * rtB * b.iI;
      const bounce = vn < -1 ? -Math.max(a.e, b.e) * vn : 0;
      let req = c.pen < 0 ? c.pen / dt : (c.pen > SLOP ? Math.min(3, BETA * (c.pen - SLOP) / dt) : 0);
      c.req = Math.max(req, bounce);
      const vt0 = rv.x * tx + rv.y * ty;
      c.mu = Math.abs(vt0) < 0.05 ? Math.sqrt(a.mus * b.mus) : Math.sqrt(a.muk * b.muk);
      c.jn = 0; c.jt = 0;
    }
    const nJ = w.joints.length;
    if (nJ) J.initAll(w, dt, ratio, pose);
    const lc = []; if (nJ) { lineContacts(w, list, lc); for (const c of lc) lineInit(c, dt); } w._lcN = lc.length;
    if (w.mouse) J.mouseInit(w.mouse, dt, ratio, pose);
    const iters = nJ ? Math.min(150, Math.max(ITER, 14 + 3 * nJ)) : ITER;
    for (let it = 0; it < iters; it++) {
      if (nJ) J.solveV(w, dt, it & 1);
      if (w.mouse) J.mouseSolve(w.mouse, dt);
      for (const c of lc) lineSolve(c);
      for (const c of contacts) {
        if (c.kn <= 0) continue;
        let rv = relVel(c);
        let lam = (c.req - (rv.x * c.nx + rv.y * c.ny)) / c.kn;
        let old = c.jn; c.jn = Math.max(0, old + lam); lam = c.jn - old;
        applyImpulse(c, c.nx * lam, c.ny * lam);
        const tx = -c.ny, ty = c.nx;
        rv = relVel(c);
        let lt = -(rv.x * tx + rv.y * ty) / c.kt;
        const max = c.mu * c.jn;
        old = c.jt; c.jt = Math.max(-max, Math.min(max, old + lt)); lt = c.jt - old;
        applyImpulse(c, tx * lt, ty * lt);
      }
    }
    for (const c of contacts) if (c.jn > 0) { c.a._ct = true; c.b._ct = true; }
    for (const c of lc) if (c.jn > 0) { c.X._ct = true; c.j.a._ct = true; c.j.b._ct = true; }
    const hh = 0.5 * dt * dt;
    for (const b of w.bodies) {
      if (b.fixed) continue;
      if (b.axle) { b.a += b.w * dt; continue; }
      b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
      // velocity-Verlet position term for constant accelerations (gravity, applied forces)
      // The position term assumes the body accelerates freely. Joints that hold the body taut cancel the part along their
      // constraint; they read this displacement (_gx, _gy, _ga) so they can do that without disturbing the velocity.
      b._gx = 0; b._gy = 0; b._ga = 0;
      if (!pose && !b._ct) {
        b._gx = -b.fx * b.im * hh; b._gy = -(b.fy * b.im - (b.massless || b.nog ? 0 : w.g)) * hh; b._ga = -b.tq * b.iI * hh;
        b.x += b._gx; b.y += b._gy; b.a += b._ga;
      }
    }
    if (nJ) J.solveP(w, Math.min(60, Math.max(8, 4 + nJ)), pose ? 0 : (w.pdt || dt));
    if (nJ && !pose) J.forces(w, dt / 2, 1);
    if (pose) for (const b of w.bodies) { b.vx = 0; b.vy = 0; b.w = 0; }
    J.syncSlaves(w);
    w.t += dt;
  }

  // Splits a step into substeps when springs are stiff enough that one step would be inaccurate.
  function step(w, dt) {
    const om = w.joints.length ? J.omega(w) : 0;
    // long slack ropes are stiff chains of many small links; shorter sub-steps keep them from stretching under a heavy load
    let links = 0; for (const c of w.chains) links = Math.max(links, c.n || 0);
    const ns = Math.max(1, Math.min(16, Math.ceil(om * dt / 0.2))), nc = links > 16 ? Math.min(8, Math.ceil(links / (w.chainSub || 12))) : 1;
    const n = Math.max(ns, nc);
    // position corrections feed velocity as dx/dt; with chain substeps keep that at the full step so a stretched rope is not kicked n times harder
    w.pdt = nc > ns ? dt : 0;
    for (let i = 0; i < n; i++) stepOnce(w, dt / n);
    w.pdt = 0;
  }

  function energy(w) {
    let ke = 0, pe = 0;
    for (const b of w.bodies) {
      if (b.fixed || b.massless) continue;
      ke += 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy) + 0.5 * b.I * b.w * b.w;
      if (!b.nog) pe += b.m * w.g * b.y;
    }
    const ee = w.joints.length ? J.elastic(w) : 0;
    return { ke, pe, ee, total: ke + pe + ee };
  }

  function snapshot(w) { return w.bodies.map(b => ({ id: b.id, x: b.x, y: b.y, a: b.a, vx: b.vx, vy: b.vy, w: b.w })); }
  function restore(w, s) {
    for (const o of s) { const b = w.bodies.find(q => q.id === o.id); if (b) { b.x = o.x; b.y = o.y; b.a = o.a; b.vx = o.vx; b.vy = o.vy; b.w = o.w; } }
    J.zero(w); w.pushes = []; w.pose = false; w.dtPrev = 0; w.t = 0;
  }

  // Ball on a 10 m by 3 m slope, high side on the left.
  function demoScene(w) {
    const inc = createBody('incline', { name: 'Inclined Plane 1' });
    inc.x = -5 - inc.cornerLocal.x; inc.y = 0 - inc.cornerLocal.y;
    const hyp = Math.hypot(10, 3), nx = 3 / hyp, ny = 10 / hyp, t = 0.12, r = 0.5;
    const ball = createBody('sphere', { name: 'Sphere 1', r, m: 2 });
    ball.x = -5 + t * 10 + nx * (r + 0.001); ball.y = 3 * (1 - t) + ny * (r + 0.001);
    w.bodies.push(inc, ball);
    return { inc, ball };
  }

  return { cleanPoly, isSimple, isConvex, decompose, createBody, rebuild, createWorld, step, energy, snapshot, restore, hull, pointInBody, refresh, demoScene, relink, nextId, bumpId, J, DT: 1 / 240 };
})();
if (typeof module !== 'undefined') module.exports = Phys;
