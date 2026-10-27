// Pholver E&M engine: full 3D sandbox. Positions and fields are vec3; orientation is a quaternion (em3d_math.js).
// Units are SI in form but the constants are scaled (k = 1, mu0/4pi = 1) so scenes stay human-sized; sc.k and sc.km can be set to the real values.
// Per-type "forward/normal" axis convention (local, before `rot` is applied): wire/emitter -> +X, coil/bfield/magnet/screen/wall -> +Z,
// capacitor -> +Y (its gap axis). This matches the old 2D math exactly when `rot` is the identity quaternion, which is what every
// migrated (and un-rotated new) item gets by default, so z=0 scenes behave exactly as the 2D engine did.
(function (root) {
  'use strict';
  const EM3D = (typeof module !== 'undefined' && module.exports) ? require('./em3d_math.js') : root.EM3D;
  const { V3, Quat } = EM3D;
  const EM = {}, TAU = Math.PI * 2, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  let uid = 1;
  EM.DT = 1 / 240;
  EM.nextId = () => uid++;
  EM.bump = n => { if (n >= uid) uid = n + 1; };
  EM.K_SI = 8.9875517923e9; EM.KM_SI = 1e-7;
  const Q0 = () => ({ x: 0, y: 0, z: 0, w: 1 });
  const AXIS_X = { x: 1, y: 0, z: 0 }, AXIS_Y = { x: 0, y: 1, z: 0 }, AXIS_Z = { x: 0, y: 0, z: 1 };

  const DEF = {
    charge: { q: 1, m: 1, vx: 0, vy: 0, vz: 0, fixed: true },
    emitter: { speed: 4, rate: 6, q: 1, m: 1, spread: 0, on: true, act: true, col: '#e28b2c' },
    efield: { w: 4, h: 2.5, d: 2.5, E: 2, dirAz: 270, dirEl: 0 },
    capacitor: { w: 4, gap: 2, d: 2, V: 4 },
    bfield: { w: 4, h: 3, d: 3, shape: 'box', B: 1 },
    wire: { len: 5, I: 5 },
    coil: { R: 1.2, I: 5, turns: 1 },
    magnet: { m: 1 },
    screen: { w: 3, h: 3 },
    wall: { w: 3, h: 3 },
    probe: {}
  };
  EM.TYPES = Object.keys(DEF);
  const ROT_TYPES = new Set(['emitter', 'efield', 'capacitor', 'bfield', 'wire', 'coil', 'magnet', 'screen', 'wall']);
  EM.create = (type, o) => {
    const it = Object.assign({ id: EM.nextId(), type, name: type, x: 0, y: 0, z: 0 }, DEF[type], o || {});
    if (ROT_TYPES.has(type) && !it.rot) it.rot = Q0();
    return it;
  };

  EM.createScene = () => ({ items: [], beam: [], t: 0, k: 1, km: 1, soft: 0.06, mutual: true, cap: 300, maxAge: 120, units: null, _emit: {} });
  // Workspace units. With units set, the constants are the real SI ones and the workspace is what is scaled: one length unit is L metres,
  // one charge unit Q coulombs, one mass unit M kilograms and one time unit T seconds. Every other quantity follows from those four, and
  // k and mu0/4pi (the numbers the engine uses) come out as k Q^2 T^2 / (M L^3) and (mu0/4pi) Q^2 / (M L).
  EM.unitScale = u => { const F = u.M * u.L / (u.T * u.T), E = F / u.Q; return { L: u.L, Q: u.Q, M: u.M, T: u.T, v: u.L / u.T, F, E, B: u.M / (u.Q * u.T), V: E * u.L, U: F * u.L, I: u.Q / u.T }; };
  EM.applyUnits = sc => { if (!sc.units) return sc; const u = sc.units; sc.k = EM.K_SI * u.Q * u.Q * u.T * u.T / (u.M * u.L * u.L * u.L); sc.km = EM.KM_SI * u.Q * u.Q / (u.M * u.L); return sc; };
  EM.UNIT_SETS = [
    { id: 'lab', name: 'Lab: cm, nC, mg', u: { L: 0.01, Q: 1e-9, M: 1e-6, T: 0.01 }, note: 'Charges of nanocoulombs a few centimetres apart push each other visibly.' },
    { id: 'proton', name: 'Protons: cm, e', u: { L: 0.01, Q: 1.602176634e-19, M: 1.67262192e-27, T: 1e-7 }, note: 'Real protons at 100 km/s in a field of 0.1 T, so a gyro-orbit is about a centimetre.' },
    { id: 'electron', name: 'Electrons: mm, e', u: { L: 0.001, Q: 1.602176634e-19, M: 9.1093837e-31, T: 1e-9 }, note: 'Real electrons at 1000 km/s; a millitesla bends them on a millimetre scale.' }
  ];

  // ---------- geometry ----------
  const invQ = q => Quat.conjugate(Quat.create(), q);
  // point (vec3) in the local frame of an oriented item (position + quaternion)
  function local(it, p) { return Quat.rotateVec3(V3.create(), invQ(it.rot), V3.sub(V3.create(), p, it)); }
  EM.local = local;
  function inside(it, p) {
    const l = local(it, p);
    if (it.type === 'capacitor') return Math.abs(l.x) <= it.w / 2 && Math.abs(l.y) <= it.gap / 2 && Math.abs(l.z) <= it.d / 2;
    if (it.shape === 'sphere') return V3.length(l) <= it.w / 2;
    return Math.abs(l.x) <= it.w / 2 && Math.abs(l.y) <= it.h / 2 && Math.abs(l.z) <= it.d / 2;
  }
  EM.inside = inside;
  EM.wireEnds = it => {
    const dir = Quat.rotateVec3(V3.create(), it.rot, AXIS_X), h = it.len / 2;
    return { a: V3.addScaled(V3.create(), it, dir, -h), b: V3.addScaled(V3.create(), it, dir, h) };
  };
  const coilSegs = it => {
    if (it._cs && it._cx === it.x && it._cy === it.y && it._cz === it.z && it._cR === it.R && it._cq && it._cq.x === it.rot.x && it._cq.y === it.rot.y && it._cq.z === it.rot.z && it._cq.w === it.rot.w) return it._cs;
    const n = Math.max(72, Math.min(200, Math.round(it.R * 48))), out = [];
    const pt = a => { const l = { x: it.R * Math.cos(a), y: it.R * Math.sin(a), z: 0 }; return V3.add(V3.create(), it, Quat.rotateVec3(V3.create(), it.rot, l)); };
    for (let i = 0; i < n; i++) out.push([pt(TAU * i / n), pt(TAU * (i + 1) / n)]);
    it._cx = it.x; it._cy = it.y; it._cz = it.z; it._cR = it.R; it._cq = { x: it.rot.x, y: it.rot.y, z: it.rot.z, w: it.rot.w }; it._cs = out; return out;
  };
  // Field of a straight current segment A->B at P (Biot-Savart), vector form; e2 softens the perpendicular distance.
  // u = unit(B-A); crossVec = u x (P-A) has magnitude = perpendicular distance from the infinite line through A,B (the component
  // of (P-A) along u contributes nothing to the cross product) and points in the right-hand "circulation" direction - this is
  // the exact 3D generalization of the old 2D scalar-cross-product trick, not a new formula.
  const _sb = { x: 0, y: 0, z: 0 };
  function segB(out, a, b, p, I, km, e2) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, L = Math.hypot(dx, dy, dz);
    if (L < 1e-12) return out;
    const ux = dx / L, uy = dy / L, uz = dz / L, wx = p.x - a.x, wy = p.y - a.y, wz = p.z - a.z;
    const s1 = wx * ux + wy * uy + wz * uz;
    const cx = uy * wz - uz * wy, cy = uz * wx - ux * wz, cz = ux * wy - uy * wx; // = u x w, magnitude = perp distance
    const d2 = cx * cx + cy * cy + cz * cz;
    const f = s1 / Math.sqrt(s1 * s1 + d2 + e2) - (s1 - L) / Math.sqrt((s1 - L) * (s1 - L) + d2 + e2);
    const scale = km * I / (d2 + e2) * f;
    out.x += cx * scale; out.y += cy * scale; out.z += cz * scale;
    return out;
  }
  function sphDir(azDeg, elDeg) { const az = rad(azDeg), el = rad(elDeg), ce = Math.cos(el); return { x: ce * Math.cos(az), y: ce * Math.sin(az), z: Math.sin(el) }; }

  // ---------- fields ----------
  // Fills out.Ex,Ey,Ez,Bx,By,Bz,V at point p={x,y,z}. skip is a charge/particle that should not act on itself.
  EM.field = function (sc, p, out, skip, which) {   // which: 'E' for electric sources only, 'B' for magnetic only, omitted for both
    let Ex = 0, Ey = 0, Ez = 0, Bx = 0, By = 0, Bz = 0, V = 0;
    const e2 = sc.soft * sc.soft, k = sc.k, km = sc.km, wantE = which !== 'B', wantB = which !== 'E' && which !== 'V', mapV = which === 'V';
    const bAcc = _sb; bAcc.x = 0; bAcc.y = 0; bAcc.z = 0;
    for (const it of sc.items) {
      const electric = it.type === 'charge' || it.type === 'efield' || it.type === 'capacitor';
      if (electric ? !wantE : !wantB) continue;
      switch (it.type) {
        case 'charge': {
          if (it === skip || !it.q) break;
          if (!sc.mutual && !it.fixed && skip) break;
          const dx = p.x - it.x, dy = p.y - it.y, dz = p.z - it.z, r2 = dx * dx + dy * dy + dz * dz + e2, ir = 1 / Math.sqrt(r2), ir2 = ir * ir, f = k * it.q * ir2 * ir;
          Ex += f * dx; Ey += f * dy; Ez += f * dz; V += k * it.q * ir;
          if (wantB && (it.vx || it.vy || it.vz)) { bAcc.x += km * it.q * ir2 * ir * (it.vy * dz - it.vz * dy); bAcc.y += km * it.q * ir2 * ir * (it.vz * dx - it.vx * dz); bAcc.z += km * it.q * ir2 * ir * (it.vx * dy - it.vy * dx); }
          break;
        }
        case 'efield': {
          const dirVec = sphDir(it.dirAz, it.dirEl), dirLocal = Quat.rotateVec3(V3.create(), invQ(it.rot), dirVec);
          const ext = it.w / 2 * Math.abs(dirLocal.x) + it.h / 2 * Math.abs(dirLocal.y) + it.d / 2 * Math.abs(dirLocal.z);
          const s = (p.x - it.x) * dirVec.x + (p.y - it.y) * dirVec.y + (p.z - it.z) * dirVec.z;
          const inReg = inside(it, p);
          if (!mapV || inReg) V += -it.E * Math.max(-ext, Math.min(ext, s));
          if (inReg) { Ex += it.E * dirVec.x; Ey += it.E * dirVec.y; Ez += it.E * dirVec.z; }
          break;
        }
        case 'capacitor': {
          const l = local(it, p), g = it.gap / 2, inReg = Math.abs(l.x) <= it.w / 2 && Math.abs(l.y) <= g && Math.abs(l.z) <= it.d / 2;
          if (!mapV || inReg) V += it.V * Math.max(-g, Math.min(g, l.y)) / it.gap;
          if (inReg) { const gaxis = Quat.rotateVec3(V3.create(), it.rot, AXIS_Y), e = it.V / it.gap; Ex -= e * gaxis.x; Ey -= e * gaxis.y; Ez -= e * gaxis.z; }
          break;
        }
        case 'bfield': if (inside(it, p)) { const n = Quat.rotateVec3(V3.create(), it.rot, AXIS_Z); bAcc.x += it.B * n.x; bAcc.y += it.B * n.y; bAcc.z += it.B * n.z; } break;
        case 'wire': { const w = EM.wireEnds(it); segB(bAcc, w.a, w.b, p, it.I, km, e2); break; }
        case 'coil': { const I = it.I * (it.turns || 1); for (const s of coilSegs(it)) segB(bAcc, s[0], s[1], p, I, km, e2); break; }
        case 'magnet': {
          const dx = p.x - it.x, dy = p.y - it.y, dz = p.z - it.z, r2 = dx * dx + dy * dy + dz * dz + e2, ir = 1 / Math.sqrt(r2), ir3 = ir * ir * ir;
          const rhx = dx * ir, rhy = dy * ir, rhz = dz * ir, mh = Quat.rotateVec3(V3.create(), it.rot, AXIS_Z);
          const md = mh.x * rhx + mh.y * rhy + mh.z * rhz, c = km * it.m * ir3;
          bAcc.x += c * (3 * md * rhx - mh.x); bAcc.y += c * (3 * md * rhy - mh.y); bAcc.z += c * (3 * md * rhz - mh.z);
          break;
        }
        // screen/wall/probe are passive: no field contribution.
      }
    }
    // emitted particles that are set to act as charges are sources too (for the maps and lines only when there are few of them)
    if (sc.beam.length && (skip || sc.beam.length <= 40) && !(skip && !sc.mutual)) {
      for (const pt of sc.beam) {
        if (!pt.act || pt === skip || !pt.q) continue;
        const dx = p.x - pt.x, dy = p.y - pt.y, dz = p.z - pt.z, r2 = dx * dx + dy * dy + dz * dz + e2, ir = 1 / Math.sqrt(r2), ir2 = ir * ir, f = k * pt.q * ir2 * ir;
        if (wantE) { Ex += f * dx; Ey += f * dy; Ez += f * dz; V += k * pt.q * ir; }
        if (wantB && (pt.vx || pt.vy || pt.vz)) { bAcc.x += km * pt.q * ir2 * ir * (pt.vy * dz - pt.vz * dy); bAcc.y += km * pt.q * ir2 * ir * (pt.vz * dx - pt.vx * dz); bAcc.z += km * pt.q * ir2 * ir * (pt.vx * dy - pt.vy * dx); }
      }
    }
    out.Ex = Ex; out.Ey = Ey; out.Ez = Ez; out.Bx = bAcc.x; out.By = bAcc.y; out.Bz = bAcc.z; out.V = V; return out;
  };
  const _f = { Ex: 0, Ey: 0, Ez: 0, Bx: 0, By: 0, Bz: 0, V: 0 };
  EM.sample = (sc, p) => EM.field(sc, p, { Ex: 0, Ey: 0, Ez: 0, Bx: 0, By: 0, Bz: 0, V: 0 });

  // ---------- particles ----------
  const freeCharges = sc => sc.items.filter(it => it.type === 'charge' && !it.fixed);
  EM.particles = sc => freeCharges(sc).concat(sc.beam);
  // General 3D Boris leapfrog: half electric kick, exact rotation by the local B, half electric kick.
  function pushBoris(p, Ex, Ey, Ez, Bx, By, Bz, h) {
    const hh = 0.5 * h * p.q / p.m;
    let vx = p.vx + hh * Ex, vy = p.vy + hh * Ey, vz = p.vz + hh * Ez;
    const tx = hh * Bx, ty = hh * By, tz = hh * Bz, t2 = tx * tx + ty * ty + tz * tz, s = 2 / (1 + t2);
    const vpx = vx + (vy * tz - vz * ty), vpy = vy + (vz * tx - vx * tz), vpz = vz + (vx * ty - vy * tx);
    vx += (vpy * tz - vpz * ty) * s; vy += (vpz * tx - vpx * tz) * s; vz += (vpx * ty - vpy * tx) * s;
    p.vx = vx + hh * Ex; p.vy = vy + hh * Ey; p.vz = vz + hh * Ez;
  }
  function trail(p) {
    const t = p._tr || (p._tr = []), l = t[t.length - 1];
    if (!l || Math.hypot(p.x - l[0], p.y - l[1], p.z - l[2]) > 0.04) { t.push([p.x, p.y, p.z]); if (t.length > 500) t.shift(); }
  }
  EM.spawn = (sc, em) => {
    const dev = rad((Math.random() - 0.5) * 2 * em.spread), az = Math.random() * TAU;
    const tiltAxis = { x: 0, y: Math.cos(az), z: Math.sin(az) }; // perpendicular to local +X, parametrized around it: a random tilt cone axis
    const localDir = Quat.rotateVec3(V3.create(), Quat.fromAxisAngle(Quat.create(), tiltAxis, dev), AXIS_X);
    const dir = Quat.rotateVec3(V3.create(), em.rot, localDir);
    sc.beam.push({ x: em.x, y: em.y, z: em.z, vx: dir.x * em.speed, vy: dir.y * em.speed, vz: dir.z * em.speed, q: em.q, m: em.m, age: 0, src: em.id, beam: true, act: em.act !== false, col: em.col });
  };
  function crossPlane(it, prev, next) {
    const lp = local(it, prev), ln = local(it, next);
    if ((lp.z > 0) === (ln.z > 0)) return null;
    const t = lp.z / (lp.z - ln.z), lx = lp.x + (ln.x - lp.x) * t, ly = lp.y + (ln.y - lp.y) * t;
    if (Math.abs(lx) > it.w / 2 || Math.abs(ly) > it.h / 2) return null;
    return V3.lerp(V3.create(), prev, next, t);
  }
  EM.step = function (sc, dt) {
    for (const it of sc.items) if (it.type === 'emitter' && it.on) {
      const acc = (sc._emit[it.id] || 0) + it.rate * dt; let a = acc;
      while (a >= 1) { a -= 1; if (sc.beam.length < sc.cap) EM.spawn(sc, it); }
      sc._emit[it.id] = a;
    }
    const parts = EM.particles(sc).filter(p => !p._held); if (!parts.length) { sc.t += dt; return; }
    // sub-step so the gyration and close encounters stay resolved
    let wmax = 0, vmax = 0, dmin2 = 1e18; const chg = sc.items.filter(it => it.type === 'charge');
    for (const p of parts) {
      EM.field(sc, p, _f, p, 'B'); wmax = Math.max(wmax, Math.abs(p.q / p.m * Math.hypot(_f.Bx, _f.By, _f.Bz))); vmax = Math.max(vmax, Math.hypot(p.vx, p.vy, p.vz));
      for (const c of chg) if (c !== p && c.q) dmin2 = Math.min(dmin2, (p.x - c.x) * (p.x - c.x) + (p.y - c.y) * (p.y - c.y) + (p.z - c.z) * (p.z - c.z));
      if (sc.mutual) for (const c of sc.beam) if (c !== p && c.act && c.q) { const dx = p.x - c.x, dy = p.y - c.y, dz = p.z - c.z, d2 = dx * dx + dy * dy + dz * dz; if (d2 < dmin2) dmin2 = d2; }
    }
    const dmin = Math.sqrt(dmin2), nCap = sc.beam.length > 60 ? 6 : 48;   // dense interacting beams: keep the cost bounded, softening handles close pairs
    const n = Math.max(1, Math.min(nCap, Math.ceil(Math.max(wmax * dt / 0.12, vmax * dt / (0.2 * Math.max(dmin, sc.soft * 2))))));
    const h = dt / n;
    const walls = sc.items.filter(it => it.type === 'screen' || it.type === 'wall');
    const removeIds = new Set();
    for (let i = 0; i < n; i++) {
      for (const p of parts) { EM.field(sc, p, _f, p); pushBoris(p, _f.Ex, _f.Ey, _f.Ez, _f.Bx, _f.By, _f.Bz, h); }
      for (const p of parts) {
        if (removeIds.has(p)) continue;
        const prev = { x: p.x, y: p.y, z: p.z };
        p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
        for (const w of walls) {
          const hit = crossPlane(w, prev, p);
          if (!hit) continue;
          if (w.type === 'wall') { removeIds.add(p); }
          else { p.x = hit.x; p.y = hit.y; p.z = hit.z; p.vx = p.vy = p.vz = 0; p._held = true; p._detected = true; (w._hits || (w._hits = [])).push({ x: hit.x, y: hit.y, z: hit.z, id: p.id, q: p.q, m: p.m }); if (w._hits.length > 200) w._hits.shift(); }
          break;
        }
      }
    }
    sc.t += dt;
    for (const p of parts) { trail(p); if (p.beam) p.age += dt; }
    if (removeIds.size) { for (let i = sc.beam.length - 1; i >= 0; i--) if (removeIds.has(sc.beam[i])) sc.beam.splice(i, 1); }
    for (let i = sc.beam.length - 1; i >= 0; i--) { const p = sc.beam[i]; if (p.age > sc.maxAge || Math.abs(p.x) > 500 || Math.abs(p.y) > 500 || Math.abs(p.z) > 500 || !isFinite(p.x + p.y + p.z)) sc.beam.splice(i, 1); }
    for (const p of freeCharges(sc)) if (!isFinite(p.x + p.y + p.z + p.vx + p.vy + p.vz)) { p.vx = p.vy = p.vz = 0; p.fixed = true; }
  };
  EM.energy = function (sc) {
    let ke = 0, pe = 0; const ch = sc.items.filter(it => it.type === 'charge'), o = { Ex: 0, Ey: 0, Ez: 0, Bx: 0, By: 0, Bz: 0, V: 0 };
    for (const p of EM.particles(sc)) ke += 0.5 * p.m * (p.vx * p.vx + p.vy * p.vy + p.vz * p.vz);
    for (const p of freeCharges(sc)) { EM.field(sc, p, o, p); pe += p.q * o.V; }
    const dist2 = (a, b) => Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2) + Math.pow(a.z - b.z, 2);
    for (let i = 0; i < ch.length; i++) for (let j = i + 1; j < ch.length; j++) if (ch[i].fixed && ch[j].fixed) pe += sc.k * ch[i].q * ch[j].q / Math.sqrt(dist2(ch[i], ch[j]) + sc.soft * sc.soft);
    // free-free pairs were counted twice through the free-side loop
    const fr = freeCharges(sc);
    for (let i = 0; i < fr.length; i++) for (let j = i + 1; j < fr.length; j++) pe -= sc.k * fr[i].q * fr[j].q / Math.sqrt(dist2(fr[i], fr[j]) + sc.soft * sc.soft);
    return { ke, pe, total: ke + pe };
  };
  // Forces on a particle at its position, for the force arrows. Magnetic force is the full q v x B.
  EM.forces = function (sc, p) {
    EM.field(sc, p, _f, p);
    return {
      fex: p.q * _f.Ex, fey: p.q * _f.Ey, fez: p.q * _f.Ez,
      fmx: p.q * (p.vy * _f.Bz - p.vz * _f.By), fmy: p.q * (p.vz * _f.Bx - p.vx * _f.Bz), fmz: p.q * (p.vx * _f.By - p.vy * _f.Bx),
      Ex: _f.Ex, Ey: _f.Ey, Ez: _f.Ez, Bx: _f.Bx, By: _f.By, Bz: _f.Bz, V: _f.V
    };
  };
  // Live equation readout for a selected particle: gyroradius r=m|v_perp|/|q||B|, drift speed |ExB|/|B|^2, period T=2*pi*m/(|q||B|).
  EM.gyroInfo = function (sc, p) {
    EM.field(sc, p, _f, p);
    const B = { x: _f.Bx, y: _f.By, z: _f.Bz }, Bmag = V3.length(B), v = { x: p.vx, y: p.vy, z: p.vz };
    let r = NaN, T = NaN, drift = NaN;
    if (Bmag > 1e-9) {
      const Bhat = V3.scale(V3.create(), B, 1 / Bmag), vPar = V3.dot(v, Bhat);
      const vPerp = V3.length(V3.sub(V3.create(), v, V3.scale(V3.create(), Bhat, vPar)));
      r = p.m * vPerp / (Math.abs(p.q) * Bmag);
      T = TAU * p.m / (Math.abs(p.q) * Bmag);
      const EcrossB = V3.cross(V3.create(), { x: _f.Ex, y: _f.Ey, z: _f.Ez }, B);
      drift = V3.length(EcrossB) / (Bmag * Bmag);
    }
    return { r, T, drift, Bmag, Ex: _f.Ex, Ey: _f.Ey, Ez: _f.Ez, Bx: _f.Bx, By: _f.By, Bz: _f.Bz };
  };

  // ---------- field lines ----------
  // Lines of E from positive charges (and into negative ones). bound = {cx,cy,cz,r}, a world bounding sphere; h is the step length.
  EM.fieldLines = function (sc, bound, o) {
    o = o || {}; const lines = [], out = { Ex: 0, Ey: 0, Ez: 0, Bx: 0, By: 0, Bz: 0, V: 0 }, h = bound.h || 0.1, maxSteps = o.maxSteps || 300;
    const ch = sc.items.filter(it => it.type === 'charge' && it.q), qmax = ch.reduce((m, c) => Math.max(m, Math.abs(c.q)), 0);
    const Qp = ch.reduce((s, c) => s + Math.max(0, c.q), 0), Qn = ch.reduce((s, c) => s + Math.max(0, -c.q), 0);
    const margin = bound.r * 1.25;
    const inView = p => Math.hypot(p.x - bound.cx, p.y - bound.cy, p.z - bound.cz) < margin;
    const dirAt = (p, sgn) => { EM.field(sc, p, out); const m = Math.hypot(out.Ex, out.Ey, out.Ez); return m < 1e-9 ? null : { x: sgn * out.Ex / m, y: sgn * out.Ey / m, z: sgn * out.Ez / m }; };
    const trace = (start, sgn, own) => {
      const pts = [start]; let p = start;
      for (let i = 0; i < maxSteps; i++) {
        const d1 = dirAt(p, sgn); if (!d1) break;
        const mid = V3.addScaled(V3.create(), p, d1, h / 2);
        const d2 = dirAt(mid, sgn); if (!d2) break;
        p = V3.addScaled(V3.create(), p, d2, h); pts.push(p);
        if (!inView(p)) break;
        let stop = false;
        for (const c of ch) if (c !== own && V3.distance(p, c) < Math.max(h * 1.1, 0.1)) { stop = true; break; }
        if (stop) break;
      }
      return pts;
    };
    // Seed directions spread over the FULL sphere around each charge (golden-angle/Fibonacci lattice - even
    // coverage, deterministic, no Math.random), not a single ring confined to the charge's local XY plane.
    // A charge pair's true field is 3D even when both charges happen to sit in one plane (a dipole field is a
    // surface of revolution about the axis joining them); restricting seeds to one planar ring only ever drew
    // one slice of that surface and made any depth along another axis (e.g. two charges placed in XZ) look
    // like it was "mostly in XY" - a leftover from the engine's pre-3D form that the A2 migration missed.
    const r0 = Math.max(h * 1.6, 0.14);
    const nFor = c => Math.max(4, Math.min(28, Math.round(16 * Math.abs(c.q) / qmax)));
    const GOLDEN = Math.PI * (3 - Math.sqrt(5));
    const sphereDir = (i, n) => { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(Math.max(0, 1 - y * y)), a = GOLDEN * i; return { x: Math.cos(a) * r, y, z: Math.sin(a) * r }; };
    for (const c of ch) {
      if (c.q > 0) { const n = nFor(c); for (let i = 0; i < n; i++) { const dir = sphereDir(i, n); lines.push({ pts: trace({ x: c.x + r0 * dir.x, y: c.y + r0 * dir.y, z: c.z + r0 * dir.z }, 1, c), src: c.id }); } }
      else if (Qp < Qn) {
        const n = Math.round(nFor(c) * (1 - Qp / Qn));
        for (let i = 0; i < n; i++) { const dir = sphereDir(i, n); const p = trace({ x: c.x + r0 * dir.x, y: c.y + r0 * dir.y, z: c.z + r0 * dir.z }, -1, c); lines.push({ pts: p.slice().reverse(), src: c.id }); }
      }
    }
    for (const seed of (o.extraSeeds || [])) lines.push({ pts: trace(seed, 1, null), src: 'seed' });
    return lines;
  };

  // ---------- picking / bounds ----------
  EM.bounds3 = function (it) {
    if (it.type === 'charge' || it.type === 'emitter' || it.type === 'probe') return { min: { x: it.x - 0.3, y: it.y - 0.3, z: it.z - 0.3 }, max: { x: it.x + 0.3, y: it.y + 0.3, z: it.z + 0.3 } };
    if (it.type === 'wire') { const w = EM.wireEnds(it); return { min: { x: Math.min(w.a.x, w.b.x) - 0.1, y: Math.min(w.a.y, w.b.y) - 0.1, z: Math.min(w.a.z, w.b.z) - 0.1 }, max: { x: Math.max(w.a.x, w.b.x) + 0.1, y: Math.max(w.a.y, w.b.y) + 0.1, z: Math.max(w.a.z, w.b.z) + 0.1 } }; }
    if (it.type === 'coil' || it.type === 'magnet') { const r = it.R || 0.3; return { min: { x: it.x - r, y: it.y - r, z: it.z - r }, max: { x: it.x + r, y: it.y + r, z: it.z + r } }; }
    const hx = it.w / 2, hy = (it.type === 'capacitor' ? it.gap : it.h) / 2, hz = (it.type === 'capacitor' ? it.d : it.d) / 2;
    let mn = { x: 1e18, y: 1e18, z: 1e18 }, mx = { x: -1e18, y: -1e18, z: -1e18 };
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const c = Quat.rotateVec3(V3.create(), it.rot, { x: sx * hx, y: sy * hy, z: sz * hz });
      const w = { x: it.x + c.x, y: it.y + c.y, z: it.z + c.z };
      mn = { x: Math.min(mn.x, w.x), y: Math.min(mn.y, w.y), z: Math.min(mn.z, w.z) };
      mx = { x: Math.max(mx.x, w.x), y: Math.max(mx.y, w.y), z: Math.max(mx.z, w.z) };
    }
    return { min: mn, max: mx };
  };
  function rayAABB(origin, dir, box) {
    let tmin = -1e18, tmax = 1e18;
    for (const ax of ['x', 'y', 'z']) {
      const o = origin[ax], d = Math.abs(dir[ax]) < 1e-12 ? 1e-12 : dir[ax], lo = box.min[ax], hi = box.max[ax];
      let t1 = (lo - o) / d, t2 = (hi - o) / d; if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
  }
  EM.pickRay = function (sc, origin, dir, tol) {
    let best = null, bestT = Infinity;
    for (const it of sc.items) {
      const b = EM.bounds3(it);
      b.min = { x: b.min.x - tol, y: b.min.y - tol, z: b.min.z - tol }; b.max = { x: b.max.x + tol, y: b.max.y + tol, z: b.max.z + tol };
      const t = rayAABB(origin, dir, b);
      if (t != null && t < bestT) { bestT = t; best = it; }
    }
    return best;
  };

  // ---------- snapshot, save, load ----------
  EM.snapshot = sc => ({ t: sc.t, p: sc.items.filter(it => it.type === 'charge').map(c => ({ id: c.id, x: c.x, y: c.y, z: c.z, vx: c.vx, vy: c.vy, vz: c.vz })) });
  EM.restore = (sc, s) => { for (const o of s.p) { const c = sc.items.find(q => q.id === o.id); if (c) { c.x = o.x; c.y = o.y; c.z = o.z; c.vx = o.vx; c.vy = o.vy; c.vz = o.vz; c._tr = null; } } sc.beam.length = 0; sc._emit = {}; sc.t = 0; };
  EM.serialize = sc => ({ v: 2, kind: 'em', k: sc.k, km: sc.km, soft: sc.soft, mutual: sc.mutual, units: sc.units ? Object.assign({}, sc.units) : null, items: sc.items.map(it => { const o = {}; for (const key in it) if (key[0] !== '_') o[key] = it[key]; return o; }) });
  // Lifts an old (v1, flat-2D) saved item into the v2 3D shape: z=0, numeric `rot` degrees -> quaternion, old `angle`/`dir` -> the new convention.
  function migrateItem(o) {
    o = Object.assign({}, o);
    if (o.z === undefined) o.z = 0;
    if (o.type === 'charge') { if (o.vz === undefined) o.vz = 0; return o; }
    if (o.type === 'emitter') { o.rot = Quat.fromAxisAngle(Quat.create(), AXIS_Z, rad(o.angle || 0)); delete o.angle; return o; }
    if (o.type === 'efield') { o.dirAz = o.dir; o.dirEl = 0; delete o.dir; if (o.d === undefined) o.d = o.h; }
    if (o.type === 'bfield') { if (o.shape === 'circle') o.shape = 'sphere'; if (o.shape === 'rect' || !o.shape) o.shape = 'box'; if (o.d === undefined) o.d = o.h; }
    if (o.type === 'capacitor' && o.d === undefined) o.d = o.w;
    if (typeof o.rot === 'number') { o.rot = Quat.fromAxisAngle(Quat.create(), AXIS_Z, rad(o.rot)); }
    else if (ROT_TYPES.has(o.type) && !o.rot) o.rot = Q0();
    return o;
  }
  EM.deserialize = data => {
    const sc = EM.createScene(); Object.assign(sc, { k: data.k, km: data.km, soft: data.soft, mutual: data.mutual, units: data.units || null }); if (sc.units) EM.applyUnits(sc);
    const migrate = !data.v || data.v < 2;
    for (let o of data.items || []) {
      if (migrate) o = migrateItem(o);
      const it = Object.assign(EM.create(o.type, {}), o); EM.bump(it.id); sc.items.push(it);
    }
    return sc;
  };

  // ---------- example scenes ----------
  // Each builds into an empty scene and returns the display options that suit it. All lie in z=0 with identity
  // orientation, which (per the axis convention above) reproduces the original 2D layouts exactly.
  const add = (sc, type, o) => { const it = EM.create(type, o); sc.items.push(it); return it; };
  EM.PRESETS = [
    { id: 'massspec', name: 'Mass spectrometer', note: 'A velocity selector (E = vB) passes only ions at 3 m/s; the analyser magnet then bends heavier ions on wider arcs (r = mv / qB).',
      build(sc) {
        add(sc, 'capacitor', { name: 'Selector plates', x: -3, y: 0, w: 4, gap: 1.6, V: -9.6 });
        add(sc, 'bfield', { name: 'Selector B', x: -3, y: 0, w: 4, h: 1.6, B: 2 });
        add(sc, 'emitter', { name: 'Source (m = 1)', x: -6.5, y: 0.04, speed: 3, rate: 6, q: 1, m: 1, spread: 1.5, act: false, col: '#e28b2c' });
        add(sc, 'emitter', { name: 'Source (m = 2)', x: -6.5, y: -0.04, speed: 3, rate: 6, q: 1, m: 2, spread: 1.5, act: false, col: '#1f9d8a' });
        add(sc, 'bfield', { name: 'Analyser B', x: 2.75, y: 0.5, w: 4.5, h: 9, B: -3 });
        return { lines: false, arrows: false, map: 'none', trails: true };
      } },
    { id: 'cyclotron', name: 'Circular motion in B', note: 'F = qv x B bends the path into a circle of radius mv / qB. Change B, q, m or the launch speed and watch the radius.',
      build(sc) {
        add(sc, 'bfield', { name: 'Magnetic field', x: 0, y: 0, w: 9, h: 7, B: 2 });
        add(sc, 'charge', { name: 'Particle', x: -1, y: 0, q: 1, m: 1, vx: 0, vy: 3, fixed: false });
        return { lines: false, arrows: false, map: 'none', trails: true };
      } },
    { id: 'dipole', name: 'Electric dipole', note: 'Field lines leave + and end on −. The map shows potential with equipotential bands. Drop a probe particle (Simulate) to see it follow the field.',
      build(sc) {
        add(sc, 'charge', { name: 'Charge +', x: -1.6, y: 0, q: 2, m: 1, fixed: true });
        add(sc, 'charge', { name: 'Charge −', x: 1.6, y: 0, q: -2, m: 1, fixed: true });
        add(sc, 'charge', { name: 'Test charge', x: -0.6, y: 1.4, q: 0.1, m: 0.05, fixed: false });
        return { lines: true, arrows: false, map: 'V', trails: true };
      } },
    { id: 'wires', name: 'Parallel wires', note: 'Equal currents the same way: B cancels between them and the wires attract. Flip one current to make the middle field add.',
      build(sc) {
        add(sc, 'wire', { name: 'Wire 1', x: 0, y: 1.5, len: 12, I: 5 });
        add(sc, 'wire', { name: 'Wire 2', x: 0, y: -1.5, len: 12, I: -5 });
        add(sc, 'charge', { name: 'Particle', x: -4, y: 0, q: 1, m: 1, vx: 3, vy: 0, fixed: false });
        return { lines: false, arrows: false, map: 'B', trails: true };
      } },
    { id: 'exb', name: 'E × B drift', note: 'With crossed E and B a charge released from rest does not follow E: it traces a cycloid and drifts at E / B.',
      build(sc) {
        add(sc, 'efield', { name: 'Electric field', x: 0, y: 0, w: 16, h: 6, E: 2, dirAz: 90, dirEl: 0 });
        add(sc, 'bfield', { name: 'Magnetic field', x: 0, y: 0, w: 16, h: 6, B: 4 });
        add(sc, 'charge', { name: 'Particle', x: -7, y: -1, q: 1, m: 1, fixed: false });
        return { lines: false, arrows: false, map: 'none', trails: true };
      } },
    { id: 'orbit', name: 'Coulomb orbits', note: 'A light + charge circles a heavy − charge. v = sqrt(k Q q / m r) gives the circle; slower launches give ellipses.',
      build(sc) {
        add(sc, 'charge', { name: 'Nucleus', x: 0, y: 0, q: -6, m: 100, fixed: true });
        add(sc, 'charge', { name: 'Circular', x: 2, y: 0, q: 1, m: 1, vx: 0, vy: Math.sqrt(3), fixed: false });
        add(sc, 'charge', { name: 'Elliptical', x: -3, y: 0, q: 1, m: 1, vx: 0, vy: -0.8, fixed: false });
        return { lines: true, arrows: false, map: 'none', trails: true };
      } }
  ];
  const realUnits = (sc, id) => { sc.units = Object.assign({}, EM.UNIT_SETS.find(q => q.id === id).u); EM.applyUnits(sc); return EM.unitScale(sc.units); };
  EM.PRESETS.push(
    { id: 'real_cyclo', name: 'Proton in 0.1 T (real units)', note: 'Real SI constants, workspace in cm and 0.1 µs. A proton at 100 km/s in 0.1 T circles at r = mv/qB = 1.04 cm with a period of 0.66 µs. Every value is in real units; edit them with prefixes (1.5 cm, 50 mT).',
      build(sc) {
        const f = realUnits(sc, 'proton');
        add(sc, 'bfield', { name: 'Magnetic field', x: 0, y: 0, w: 9, h: 7, B: 0.1 / f.B });
        add(sc, 'charge', { name: 'Proton', x: -1, y: 0, q: 1, m: 1, vx: 0, vy: 1e5 / f.v, fixed: false });
        return { lines: false, arrows: false, map: 'none', trails: true };
      } },
    { id: 'real_massspec', name: 'Mass spectrometer (real units)', note: 'Protons and deuterons at 100 km/s. The selector passes them when E = vB (10 kV/m with 0.1 T, so 160 V across 1.6 cm); the analyser at 0.1 T bends them on 1.04 cm and 2.08 cm radii.',
      build(sc) {
        const f = realUnits(sc, 'proton'), B = 0.1 / f.B, E = 1e5 / f.v * B;
        add(sc, 'capacitor', { name: 'Selector plates', x: -3, y: 0, w: 4, gap: 1.6, V: -E * 1.6 });
        add(sc, 'bfield', { name: 'Selector B', x: -3, y: 0, w: 4, h: 1.6, B });
        add(sc, 'emitter', { name: 'Protons', x: -6.5, y: 0.04, speed: 1e5 / f.v, rate: 6, q: 1, m: 1, spread: 1.5, act: false, col: '#e28b2c' });
        add(sc, 'emitter', { name: 'Deuterons', x: -6.5, y: -0.04, speed: 1e5 / f.v, rate: 6, q: 1, m: 2, spread: 1.5, act: false, col: '#1f9d8a' });
        add(sc, 'bfield', { name: 'Analyser B', x: 2.75, y: 0.5, w: 4.5, h: 9, B: -B });
        return { lines: false, arrows: false, map: 'none', trails: true };
      } },
    { id: 'real_electrostatic', name: 'Nanocoulomb charges (real units)', note: 'Two 5 nC charges 4 cm apart repel with F = kq²/r² = 0.14 mN. The workspace is cm, nC and mg, so the numbers are all real and the motion is visible.',
      build(sc) {
        const f = realUnits(sc, 'lab');
        add(sc, 'charge', { name: 'Charge 1', x: -2, y: 0, q: 5, m: 1, fixed: true });
        add(sc, 'charge', { name: 'Charge 2', x: 2, y: 0, q: 5, m: 1, fixed: false, vx: 0, vy: 0 });
        add(sc, 'charge', { name: 'Charge 3', x: 0, y: 3, q: -3, m: 1, fixed: false, vx: 0, vy: 0 });
        return { lines: true, arrows: false, map: 'V', trails: true };
      } }
  );
  EM.demoScene = function (sc) { return EM.PRESETS[0].build(sc); };

  root.EM = EM;
  if (typeof module !== 'undefined' && module.exports) module.exports = EM;
})(typeof window !== 'undefined' ? window : globalThis);
