(function () {
  'use strict';
  const P = (typeof Phys !== 'undefined') ? Phys : require('./engine.js');
  const J = P.J, pt = J.pt;

  P.localOf = function (b, wx, wy) {
    if (!b || b.kind === 'anchor') return { x: wx, y: wy };
    const c = Math.cos(-b.a), s = Math.sin(-b.a), dx = wx - b.x, dy = wy - b.y;
    return { x: c * dx - s * dy, y: s * dx + c * dy };
  };
  P.pick = function (w, x, y, all) {
    for (let i = w.bodies.length - 1; i >= 0; i--) { const b = w.bodies[i]; if ((all || !b.hidden) && P.pointInBody(b, x, y)) return b; }
    return null;
  };
  P.attachAt = function (w, x, y) {
    const b = P.pick(w, x, y);
    return b ? { b, l: P.localOf(b, x, y) } : { b: null, l: { x, y } };
  };
  P.attachPos = att => att.b ? pt(att.b, att.l) : { x: att.l.x, y: att.l.y };

  // ---- joints ----
  P.createJoint = function (w, type, a, b, la, lb, opts) {
    const j = Object.assign({ id: P.nextId(), type, name: type, a: a || w.anchor, b: b || w.anchor, la: { x: la.x, y: la.y }, lb: { x: lb.x, y: lb.y }, imp: 0, ix: 0, iy: 0, jm: 0, jl: 0, ju: 0 }, J.defaults(type), opts || {});
    w.joints.push(j); w.linkDirty = true; return j;
  };
  P.removeJoint = function (w, j) {
    const i = w.joints.indexOf(j); if (i >= 0) w.joints.splice(i, 1);
    if (j.pad) { w.bodies = w.bodies.filter(b => b !== j.pad); w.joints = w.joints.filter(q => q !== j.rail); j.pad = j.rail = null; }
    w.linkDirty = true;
  };
  // ---- stoppers: a spring with a free end ----
  // A spring whose far end is not on any object can carry a small pad on that end. The pad runs on a rail along the spring's axis,
  // so a body that hits it compresses the spring against the fixed end and is pushed back, like a buffer or a cart bumper.
  // Spring.mode: 'auto' (both ends in empty space), 'stopper' (an end in empty space becomes the pad), 'rigid' (that end stays pinned).
  const PAD_R = 0.1, PAD_M = 0.05;
  P.stopperWanted = (w, j) => {
    if (j.type !== 'spring' || j.owner != null) return false;
    if (j.pad) return j.mode !== 'rigid';
    const aW = j.a === w.anchor, bW = j.b === w.anchor;
    if (j.mode === 'rigid') return false;
    if (j.mode === 'stopper') return aW || bW;
    return aW && bW;
  };
  P.applyStopper = function (w, j) {
    if (j.type !== 'spring') return;
    const want = P.stopperWanted(w, j);
    if (want && !j.pad) {
      const aW = j.a === w.anchor, bW = j.b === w.anchor;
      const mount = bW ? j.a : j.b, ml = bW ? j.la : j.lb, tip = bW ? j.lb : j.la;
      const tp = tip, mp = pt(mount, ml), dx = tp.x - mp.x, dy = tp.y - mp.y, L = Math.hypot(dx, dy);
      if (L < 0.05) return;
      const pad = P.createBody('sphere', { r: PAD_R, m: PAD_M, x: tp.x, y: tp.y, mus: 0, muk: 0, e: 0.2, name: j.name + ' pad', owner: j.id, hidden: true });
      w.bodies.push(pad);
      const rail = P.createJoint(w, 'slider', mount, pad, ml, { x: 0, y: 0 }, { owner: j.id, ax: Math.atan2(dy, dx) - mount.a, ref: pad.a - mount.a, lim: true, lo: 0.15 * L, hi: 1.6 * L });
      j.a = mount; j.la = { x: ml.x, y: ml.y }; j.b = pad; j.lb = { x: 0, y: 0 }; j.pad = pad; j.rail = rail; j.L = L;
      w.linkDirty = true;
    } else if (!want && j.pad) {
      const tip = { x: j.pad.x, y: j.pad.y };
      w.bodies = w.bodies.filter(b => b !== j.pad); w.joints = w.joints.filter(q => q !== j.rail);
      j.b = w.anchor; j.lb = tip; j.pad = j.rail = null; w.linkDirty = true;
    }
  };
  // Keep each pad on its rail, at the spring's rest length, while objects are moved in Design mode.
  P.layoutStoppers = function (w) {
    for (const j of w.joints) {
      if (!j.pad) continue;
      const m = j.a, ang = m.a + j.rail.ax, p = pt(m, j.la), L = Math.max(0.05, j.L);
      j.pad.x = p.x + L * Math.cos(ang); j.pad.y = p.y + L * Math.sin(ang); j.pad.vx = j.pad.vy = j.pad.w = 0; j.pad.a = m.a + j.rail.ref;
      j.rail.lo = 0.15 * L; j.rail.hi = 1.6 * L;
    }
  };
  // The spring as the user drew it: mount end, and the free tip as a world point (used when copying).
  P.stopperTip = j => ({ x: j.pad.x, y: j.pad.y });
  P.removeBody = function (w, b) {
    for (const c of w.chains.slice()) if (c.a.b === b || c.b.b === b) P.removeChain(w, c);
    for (const c of w.links.slice()) if (c.nodes.some(n => n.b === b)) P.removeLink(w, c);
    for (const j of w.joints.slice()) if (j.a === b || j.b === b || (j.wh && j.wh.includes(b))) P.removeJoint(w, j);
    w.bodies = w.bodies.filter(q => q !== b); w.linkDirty = true;
  };
  // ---- pulley wheels and ropes routed over them ----
  // A wheel with an axle is held at its centre but spins freely (its inverse mass is zero, its inverse inertia is not).
  P.setAxle = function (w, b, on) { b.axle = !!on; if (on) { b.vx = 0; b.vy = 0; } P.rebuild(b); };
  P.createWheel = function (w, x, y, o) {
    const b = P.createBody('wheel', Object.assign({ x, y }, o || {})); w.bodies.push(b); P.setAxle(w, b, true); return b;
  };
  // a and b are attachments {b, l}; wheels are wheel bodies in order along the rope.
  P.createWrap = function (w, a, b, wheels, o) {
    const pa = P.attachPos(a), pb = P.attachPos(b), cs = [pa].concat(wheels.map(q => ({ x: q.x, y: q.y })), [pb]), sg = [];
    wheels.forEach((q, i) => { const p = cs[i], n = cs[i + 2], cr = (q.x - p.x) * (n.y - q.y) - (q.y - p.y) * (n.x - q.x); sg.push(cr >= 0 ? 1 : -1); });
    const j = P.createJoint(w, 'wrap', a.b, b.b, a.l, b.l, Object.assign({ wh: wheels.slice(), sg }, o || {}));
    J._w = w; J._h.common(j); j.L = J.wrapSync(j);
    return j;
  };
  // A rope is either inextensible ('wrap': bends round pulleys and objects in its way) or extensible (a straight spring that only pulls).
  P.setRopeType = function (w, j, ext) {
    if (!!ext === ((j.type === 'rope' || j.type === 'wrap') && !!j.ext)) return;
    j.imp = 0; j.force = 0; j.gimp = null; j.seq = null; j.eps = null;
    if (j.type === 'wrap') {   // a rope over pulleys keeps its pulleys: only its stretch changes
      j.ext = !!ext; if (ext) { const d = J.defaults('rope'); if (!(j.k > 0)) j.k = d.k; if (j.c == null) j.c = d.c; }
      else { J._w = w; J._h.common(j); j.L = Math.max(j.L, J.wrapSync(j)); }
    } else if (ext) { const d = J.defaults('rope'); j.type = 'rope'; j.ext = true; j.k = d.k; j.c = d.c; j.L = Math.max(0.05, j.L); }
    else { j.type = 'wrap'; j.ext = false; Object.assign(j, { wh: [], sg: [], act: null, phi: [], seq: null, oc: true }); J._w = w; J._h.common(j); j.L = Math.max(j.L, J.wrapSync(j)); }
    w.linkDirty = true;
  };
  const anchorDist = j => { const a = J.slPos(j.a, j.la), b = J.slPos(j.b, j.lb); return Math.hypot(b.x - a.x, b.y - a.y); };
  P.anchorDist = anchorDist;

  // Sets a rod or rope length by moving whichever attached body is free to move.
  P.setDistance = function (w, j, L) {
    const pa = pt(j.a, j.la), pb = pt(j.b, j.lb);
    let dx = pb.x - pa.x, dy = pb.y - pa.y; const d = Math.hypot(dx, dy);
    if (d > 1e-9) { dx /= d; dy /= d; } else { dx = 1; dy = 0; }
    if (!(j.type === 'rope' && L >= d)) {
      const delta = L - d;
      if (j.b !== w.anchor && !j.b.fixed) { j.b.x += dx * delta; j.b.y += dy * delta; }
      else if (j.a !== w.anchor && !j.a.fixed) { j.a.x -= dx * delta; j.a.y -= dy * delta; }
    }
    j.L = L;
  };

  // ---- chains ----
  function layout(p0, p1, L, n) {
    let flip = false;
    if (p1.x < p0.x) { const t = p0; p0 = p1; p1 = t; flip = true; }
    const dx = p1.x - p0.x, dy = p1.y - p0.y, chord = Math.hypot(dx, dy), out = [];
    if (L <= chord * 1.0005) {
      for (let i = 0; i <= n; i++) out.push({ x: p0.x + dx * i / n, y: p0.y + dy * i / n });
    } else if (dx < 1e-3 * L) {
      const len = h => { let s = 0, px = p0.x, py = p0.y; for (let i = 1; i <= 200; i++) { const t = i / 200, x = p0.x + dx * t + h * Math.sin(Math.PI * t), y = p0.y + dy * t; s += Math.hypot(x - px, y - py); px = x; py = y; } return s; };
      let lo = 0, hi = L; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (len(m) < L) lo = m; else hi = m; }
      const h = (lo + hi) / 2;
      for (let i = 0; i <= n; i++) { const t = i / n; out.push({ x: p0.x + dx * t + h * Math.sin(Math.PI * t), y: p0.y + dy * t }); }
    } else {
      const S = Math.sqrt(Math.max(L * L - dy * dy, dx * dx)), target = S / dx;
      let lo = 1e-9, hi = 600; for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (Math.sinh(m) / m < target) lo = m; else hi = m; }
      const u = (lo + hi) / 2, a = dx / (2 * u), x0 = (p0.x + p1.x) / 2 - a * Math.asinh(dy / S);
      const c0 = p0.y - a * Math.cosh((p0.x - x0) / a), s0 = Math.sinh((p0.x - x0) / a);
      for (let i = 0; i <= n; i++) { const X = x0 + a * Math.asinh(i * L / n / a + s0); out.push({ x: X, y: a * Math.cosh((X - x0) / a) + c0 }); }
      out[0] = { x: p0.x, y: p0.y }; out[n] = { x: p1.x, y: p1.y };
    }
    return flip ? out.reverse() : out;
  }
  P.catenaryLayout = layout;
  const endPos = att => P.attachPos(att);
  function chainPts(c) {
    const p0 = endPos(c.a), p1 = endPos(c.b), chord = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    if (c.L < chord) c.L = chord;
    return layout(p0, p1, c.L, c.n);
  }
  function buildChain(w, c) {
    const n = c.n, pts = chainPts(c), z = { x: 0, y: 0 };
    c.nodes = [];
    for (let i = 0; i <= n; i++) {
      const m = c.mass / n * (i === 0 || i === n ? 0.5 : 1);
      const b = P.createBody('sphere', { r: c.r, m, x: pts[i].x, y: pts[i].y, name: c.name + ' link ' + i, owner: c.id, group: c.id, hidden: true, massless: !!c.massless, mm: 0.05, ld: c.damp, e: 0, mus: 0.4, muk: 0.3 });
      c.nodes.push(b); w.bodies.push(b);
    }
    P.createJoint(w, 'pin', c.a.b, c.nodes[0], c.a.l, z, { owner: c.id });
    for (let i = 0; i < n; i++) P.createJoint(w, 'rod', c.nodes[i], c.nodes[i + 1], z, z, { L: c.L / n, owner: c.id });
    P.createJoint(w, 'pin', c.b.b, c.nodes[n], c.b.l, z, { owner: c.id });
    w.linkDirty = true;
  }
  P.createChain = function (w, a, b, o) {
    const c = Object.assign({ id: P.nextId(), type: 'chain', name: 'Chain', a, b, n: 24, mass: 4, r: 0.05, L: 0, damp: 0.3, massless: false, nodes: [] }, o || {});
    const p0 = endPos(a), p1 = endPos(b);
    if (!c.L) c.L = Math.max(0.2, Math.hypot(p1.x - p0.x, p1.y - p0.y) * 1.12);
    buildChain(w, c); w.chains.push(c); return c;
  };
  P.removeChain = function (w, c) {
    w.bodies = w.bodies.filter(b => b.owner !== c.id); w.joints = w.joints.filter(j => j.owner !== c.id);
    w.chains = w.chains.filter(q => q !== c); w.linkDirty = true;
  };
  P.rebuildChain = function (w, c) {
    w.bodies = w.bodies.filter(b => b.owner !== c.id); w.joints = w.joints.filter(j => j.owner !== c.id);
    c.n = Math.max(2, Math.min(100, Math.round(c.n))); buildChain(w, c);
  };
  P.layoutChain = function (w, c) {
    const pts = chainPts(c);
    c.nodes.forEach((b, i) => { b.x = pts[i].x; b.y = pts[i].y; b.a = 0; b.vx = b.vy = b.w = 0; });
    for (const j of w.joints) if (j.owner === c.id && j.type === 'rod') j.L = c.L / c.n;
  };
  P.chainLength = c => { let s = 0; for (let i = 1; i < c.nodes.length; i++) s += Math.hypot(c.nodes[i].x - c.nodes[i - 1].x, c.nodes[i].y - c.nodes[i - 1].y); return s; };

  // ---- linkages: rods joined end to end at joints, which may sit on objects or float in space ----
  // A node is {b, l} (a point l, in the frame of object b) or {b: null, x, y} (a free joint, kept as a small ghost body).
  // A third kind is a tap {on: [i, j], t, x, y}: a point a fraction t along the rod between joints i and j. The rod stays whole; the tap is a point on a rigid ghost bar pinned to both of its ends.
  const nodePos = n => n.on ? (n.body ? J.slPos(n.body, n.lo) : { x: n.x, y: n.y }) : n.b ? pt(n.b, n.l) : { x: n.body.x, y: n.body.y };
  P.nodeSpec = n => Object.assign(n.on ? { on: n.on.slice(), t: n.t } : n.b ? { b: n.b.id, l: { x: n.l.x, y: n.l.y } } : { b: null, x: n.body.x, y: n.body.y, fixed: !!n.body.fixed }, n.lock ? { lock: true } : {});
  P.nodeFrom = (r, map, dx, dy) => Object.assign(r.on ? { on: r.on.slice(), t: r.t, x: 0, y: 0 } : r.b == null ? { b: null, x: r.x + (dx || 0), y: r.y + (dy || 0), fixed: r.fixed } : { b: map ? map.get(r.b) : r.b, l: r.l }, r.lock ? { lock: true } : {});
  P.linkNodePos = nodePos;
  function buildLink(w, c) {
    // free joints of a massless linkage get a little inertia, scaled to the heaviest object on the linkage, so loads never meet a nearly weightless point
    let heavy = 0; for (const n of c.nodes) if (n.b && !n.b.fixed && n.b.m > heavy) heavy = n.b.m;
    const gm = Math.max(0.05, Math.min(5, 0.02 * heavy));
    c.nodes.forEach((n, i) => {
      if (n.on) return;
      if (n.b) { n.body = n.b; n.lo = n.l; return; }
      const b = P.createBody('sphere', { r: 0.035, m: Math.max(c.mass, gm), x: n.x, y: n.y, name: c.name + ' joint ' + i, owner: c.id, group: c.id, hidden: true, massless: !!c.massless, mm: gm, e: 0, mus: 0, muk: 0, ghost: true, fixed: !!n.fixed, ld: c.damp });
      n.body = b; n.lo = { x: 0, y: 0 }; w.bodies.push(b);
    });
    c._bars = {};
    c.nodes.forEach((n, i) => {   // taps: one rigid ghost bar per rod that has any
      if (!n.on) return;
      const A = c.nodes[n.on[0]], B = c.nodes[n.on[1]], key = n.on[0] + '-' + n.on[1]; let bar = c._bars[key];
      const pa = nodePos(A), pb = nodePos(B), L = Math.max(Math.hypot(pb.x - pa.x, pb.y - pa.y), 0.05);
      if (!bar) {   // the bar is only the straight line between its two ends (see J.slPos); it carries no mass of its own
        const R = P.createBody('rect', { base: L, height: 0.03, m: 1, x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, name: c.name + ' bar ' + key, owner: c.id, group: c.id, hidden: true, e: 0, mus: 0, muk: 0, ghost: true, fixed: true });
        R.a = Math.atan2(pb.y - pa.y, pb.x - pa.x); R.sl = { a: A.body, la: A.lo, b: B.body, lb: B.lo, L }; w.bodies.push(R);
        bar = c._bars[key] = { R, i: n.on[0], j: n.on[1], taps: [] };
      }
      n.body = bar.R; n.lo = { x: (n.t - 0.5) * L, y: 0 }; bar.taps.push(n);
    });
    c.edges.forEach((e, k) => {
      const A = c.nodes[e[0]], B = c.nodes[e[1]]; if (!A || !B || A.body === B.body) return;
      const pa = nodePos(A), pb = nodePos(B);
      P.createJoint(w, 'rod', A.body, B.body, A.lo, B.lo, { L: Math.hypot(pb.x - pa.x, pb.y - pa.y), owner: c.id, lk: true, oc: c.oc, ei: k });
    });
    // locked joints: rods on an object (or a rod bar) keep their angle against it; rods meeting at a free joint keep their angles between each other
    c.nodes.forEach((n, i) => {
      if (!n.lock) return;
      const inc = []; c.edges.forEach((e, k) => { const r = w.joints.find(j => j.owner === c.id && j.lk && j.ei === k); if (r && (e[0] === i || e[1] === i)) inc.push({ r, end: e[0] === i ? 0 : 1 }); });
      if (n.b || n.on || (n.body && n.body.fixed)) inc.forEach(q => { q.r[q.end ? 'lkB' : 'lkA'] = true; J.captureLocks(q.r); });
      else for (let m = 1; m < inc.length; m++) {
        const aj = { id: P.nextId(), type: 'alock', owner: c.id, r1: inc[0].r, r2: inc[m].r, s1: inc[0].end, s2: inc[m].end, ref: 0, a: inc[0].r.a, b: inc[0].r.b, la: inc[0].r.la, lb: inc[0].r.lb, name: 'lock', imp: 0 };
        J.captureAlock(aj); w.joints.push(aj);
      }
    });
    w.linkDirty = true;
  }
  P.createLink = function (w, spec, o) {
    const c = Object.assign({ id: P.nextId(), type: 'linkage', name: 'Linkage', massless: true, mass: 0.05, damp: 0.02, oc: true }, o || {});
    c.nodes = spec.nodes.map(n => Object.assign({}, n, n.l ? { l: { x: n.l.x, y: n.l.y } } : {}, n.on ? { on: n.on.slice() } : {})); c.edges = spec.edges.map(e => [e[0], e[1]]);
    buildLink(w, c); w.links.push(c); return c;
  };
  P.removeLink = function (w, c) {
    w.bodies = w.bodies.filter(b => b.owner !== c.id); w.joints = w.joints.filter(j => j.owner !== c.id);
    w.links = w.links.filter(q => q !== c); w.linkDirty = true;
  };
  P.rebuildLink = function (w, c) {   // after a change of structure or settings; free joints keep where they are
    c.nodes.forEach(n => { if (!n.b && !n.on && n.body) { n.x = n.body.x; n.y = n.body.y; n.fixed = !!n.body.fixed; } });
    w.bodies = w.bodies.filter(b => b.owner !== c.id); w.joints = w.joints.filter(j => j.owner !== c.id);
    buildLink(w, c);
  };
  P.removeLinkNode = function (w, c, i) {
    c.nodes.forEach(n => { if (!n.b && !n.on && n.body) { n.x = n.body.x; n.y = n.body.y; n.fixed = !!n.body.fixed; } });
    const gone = new Set([i]); let grow = true;   // taps that sit on a rod ending at a removed joint go with it
    while (grow) { grow = false; c.nodes.forEach((n, k) => { if (n.on && !gone.has(k) && (gone.has(n.on[0]) || gone.has(n.on[1]))) { gone.add(k); grow = true; } }); }
    c.edges = c.edges.filter(e => !gone.has(e[0]) && !gone.has(e[1]));
    const prune = () => { let ch = true; while (ch) { ch = false; c.nodes.forEach((n, k) => { if (!gone.has(k) && !c.edges.some(e => e[0] === k || e[1] === k) && !c.nodes.some((m, q) => m.on && !gone.has(q) && (m.on[0] === k || m.on[1] === k))) { gone.add(k); ch = true; } }); } }; prune();
    const map = new Map(); let nn = 0; c.nodes.forEach((n, k) => { if (!gone.has(k)) map.set(k, nn++); });
    c.nodes = c.nodes.filter((n, k) => !gone.has(k)); c.nodes.forEach(n => { if (n.on) n.on = [map.get(n.on[0]), map.get(n.on[1])]; });
    c.edges = c.edges.map(e => [map.get(e[0]), map.get(e[1])]);
    if (!c.edges.length) { P.removeLink(w, c); return false; }
    w.bodies = w.bodies.filter(b => b.owner !== c.id); w.joints = w.joints.filter(j => j.owner !== c.id); buildLink(w, c); return true;
  };
  // In Design mode the rods take their lengths from the drawn geometry, and free joints stay put.
  P.syncLink = function (w, c) {
    for (const key in c._bars || {}) {
      const bar = c._bars[key], s = bar.R.sl, pa = J.slPos(s.a, s.la), pb = J.slPos(s.b, s.lb), L = Math.max(Math.hypot(pb.x - pa.x, pb.y - pa.y), 0.05);
      s.L = L; bar.taps.forEach(n => { n.lo = { x: (n.t - 0.5) * L, y: 0 }; });
    }
    J.syncSlaves(w);
    for (const j of w.joints) if (j.owner === c.id && j.lk) { j.L = anchorDist(j); J.captureLocks(j); }
    for (const j of w.joints) if (j.owner === c.id && j.type === 'alock') J.captureAlock(j);
    for (const n of c.nodes) if (!n.b && !n.on && n.body) { n.body.vx = n.body.vy = n.body.w = 0; }
  };
  // ---- applied forces and mouse dragging ----
  P.addPush = (w, b, fx, fy, px, py) => { w.pushes.push({ b, fx, fy, px, py }); };
  P.startDrag = function (w, b, wx, wy, o) {
    const l = P.localOf(b, wx, wy), op = Object.assign({ hertz: 5, zeta: 0.7, maxF: 1000 * (b.im > 0 ? 1 / b.im : b.m) }, o || {});
    w.mouse = { b, lx: l.x, ly: l.y, tx: wx, ty: wy, hertz: op.hertz, zeta: op.zeta, maxF: op.maxF, ix: 0, iy: 0 };
    return w.mouse;
  };
  P.moveDrag = (w, tx, ty) => { if (w.mouse) { w.mouse.tx = tx; w.mouse.ty = ty; } };
  P.endDrag = w => { w.mouse = null; };


  // ---- saving and loading: a plain JSON description of the design (bodies, connectors, chains, world settings) ----
  const SKIP_BODY = new Set(['lks', 'wc', 'wl', 'wlSet', 'parts', 'hulled', 'verts', 'area', 'ipm', 'br', 'cornerLocal', '_wv', '_wn', '_hv', '_hi', '_ct', '_gx', '_gy', '_ga', 'nc', 'im', 'iI']);
  P.serialize = function (w) {
    const idOf = b => (b === w.anchor || !b) ? null : b.id, out = { v: 1, world: { g: w.g, ground: w.ground }, bodies: [], joints: [], chains: [] };
    for (const b of w.bodies) {
      if (b.owner != null || b === w.groundBody) continue;
      const o = {}; for (const k in b) if (!SKIP_BODY.has(k)) o[k] = b[k];
      if (o.pts) o.pts = o.pts.map(p => ({ x: p.x, y: p.y }));
      out.bodies.push(o);
    }
    for (const j of w.joints) {
      if (j.owner != null) continue;
      const keys = Object.keys(J.defaults(j.type)).concat(['name', 'cc', 'oc', 'L']), o = {};
      keys.forEach(k => { if (j[k] !== undefined && !['wh', 'sg', 'act', 'phi', 'seq', 'pad', 'rail'].includes(k)) o[k] = j[k]; });
      const rec = { id: j.id, type: j.type, a: idOf(j.a), b: idOf(j.b), la: { x: j.la.x, y: j.la.y }, lb: { x: j.lb.x, y: j.lb.y }, o, wh: (j.wh || []).map(q => q.id), sg: (j.sg || []).slice() };
      if (j.pad) { rec.b = null; rec.lb = { x: j.pad.x, y: j.pad.y }; o.mode = 'stopper'; }
      out.joints.push(rec);
    }
    out.links = w.links.map(c => ({ id: c.id, nodes: c.nodes.map(P.nodeSpec), edges: c.edges.map(e => [e[0], e[1]]), o: { name: c.name, massless: c.massless, mass: c.mass, damp: c.damp, oc: c.oc } }));
    for (const c of w.chains) out.chains.push({ id: c.id, a: { b: idOf(c.a.b), l: Object.assign({}, c.a.l) }, b: { b: idOf(c.b.b), l: Object.assign({}, c.b.l) }, o: { name: c.name, n: c.n, mass: c.mass, r: c.r, L: c.L, damp: c.damp, massless: c.massless } });
    return out;
  };
  P.deserialize = function (data) {
    const w = P.createWorld(), map = new Map(); let top = 0;
    Object.assign(w, { g: data.world.g, ground: data.world.ground });
    for (const o of data.bodies) { const b = P.createBody(o.kind, o); w.bodies.push(b); map.set(b.id, b); top = Math.max(top, b.id); }
    for (const c of data.chains) top = Math.max(top, c.id);
    for (const c of data.links || []) top = Math.max(top, c.id);
    for (const r of data.joints) top = Math.max(top, r.id);
    P.bumpId(top);
    const end = (id, l) => id == null ? { b: null, l: { x: l.x, y: l.y } } : { b: map.get(id), l: { x: l.x, y: l.y } };
    for (const r of data.joints) {
      const A = end(r.a, r.la), B = end(r.b, r.lb); let j;
      if (r.type === 'wrap') {
        j = P.createWrap(w, A, B, r.wh.map(id => map.get(id)), Object.assign({}, r.o, { id: r.id })); j.oc = r.o.oc; j.L = Math.max(r.o.L || 0, j.L);
      } else {
        j = P.createJoint(w, r.type, A.b, B.b, A.l, B.l, Object.assign({}, r.o, { id: r.id }));
        if (r.type === 'spring') P.applyStopper(w, j);
      }
    }
    for (const r of data.chains) P.createChain(w, end(r.a.b, r.a.l), end(r.b.b, r.b.l), Object.assign({}, r.o, { id: r.id }));
    for (const r of data.links || []) P.createLink(w, { nodes: r.nodes.map(n => P.nodeFrom(n, map)), edges: r.edges }, Object.assign({}, r.o, { id: r.id }));
    P.layoutStoppers(w); w.linkDirty = true;
    return w;
  };

  // ---- design to simulation hand-off: make every connector consistent with the current poses ----
  P.reconcile = function (w) {
    for (const j of w.joints) {
      if (j.owner != null) continue;
      if (j.type === 'wrap') { J._w = w; J.wrapReset(j); J._h.common(j); j.L = Math.max(j.L, J.wrapSync(j)); continue; }
      if (j.type === 'rod') { j.L = anchorDist(j); J.captureLocks(j); }
      else if (j.type === 'spring') J.captureLocks(j);
      else if (j.type === 'rope' && !j.ext) j.L = Math.max(j.L, anchorDist(j));
      else if (j.type === 'pin' || j.type === 'weld' || j.type === 'slider') {
        const bMaster = j.b === w.anchor || j.b.fixed, m = bMaster ? j.b : j.a, o = bMaster ? j.a : j.b;
        const wp = pt(m, bMaster ? j.lb : j.la), l = P.localOf(o, wp.x, wp.y);
        if (bMaster) j.la = l; else j.lb = l;
        j.ref = j.b.a - j.a.a;
      } else if (j.type === 'pulley') {
        const a = pt(j.a, j.la), b = pt(j.b, j.lb);
        j.L = Math.hypot(a.x - j.ga.x, a.y - j.ga.y) + j.ratio * Math.hypot(b.x - j.gb.x, b.y - j.gb.y);
      }
    }
    for (const c of w.chains) P.layoutChain(w, c);
    for (const c of w.links) P.syncLink(w, c);
    P.layoutStoppers(w);
    w.linkDirty = true;
  };
})();
if (typeof module !== 'undefined') module.exports = (typeof Phys !== 'undefined') ? Phys : require('./engine.js');
