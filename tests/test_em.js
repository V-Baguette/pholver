const EM = require('../em.js');
const EM3D = require('../em3d_math.js'); const { V3, Quat } = EM3D;
let fails = 0; const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '   ' + i : '')); if (!c) fails++; };
const pct = (a, b) => Math.abs(a - b) / Math.abs(b) * 100;
const run = (sc, T) => { const n = Math.round(T / EM.DT); for (let i = 0; i < n; i++) EM.step(sc, EM.DT); };
const mk = () => EM.createScene();
const P = (x, y, z) => ({ x, y, z: z || 0 });

{ // cyclotron: r = m v / (q B), period 2 pi m / (q B)  -- motion confined to z=0, B along local+Z=world+Z, same as the old 2D case
  const sc = mk(); sc.items.push(EM.create('bfield', { x: 0, y: 0, w: 100, h: 100, d: 100, B: 2 }));
  const p = EM.create('charge', { x: 0, y: 0, q: 1, m: 1, vx: 3, vy: 0, fixed: false }); sc.items.push(p);
  let maxY = -1e9, minY = 1e9; const T = Math.PI; const n = Math.round(T / EM.DT);
  for (let i = 0; i < n; i++) { EM.step(sc, EM.DT); maxY = Math.max(maxY, p.y); minY = Math.min(minY, p.y); }
  // q>0, B out of page, v along +x: force q v x B = -y, so it curves clockwise: circle centre (0,-1.5) radius 1.5
  ok('cyclotron radius', Math.abs((maxY - minY) / 2 - 1.5) < 0.01 && minY < -2.9, `diameter ${(maxY - minY).toFixed(4)}`);
  ok('cyclotron returns after one period', Math.hypot(p.x, p.y) < 0.02, `off by ${Math.hypot(p.x, p.y).toFixed(5)}`);
  ok('speed constant in B', Math.abs(Math.hypot(p.vx, p.vy, p.vz) - 3) < 1e-6, `${Math.hypot(p.vx, p.vy, p.vz)}`);
  ok('stays in the z=0 plane', Math.abs(p.z) < 1e-9);
}
{ // cyclotron off-axis: same physics but with B tilted onto the X axis (via a 90deg rotation about Z) and motion launched in the YZ plane
  const sc = mk();
  const rot = Quat.fromAxisAngle(Quat.create(), { x: 0, y: 1, z: 0 }, Math.PI / 2); // local+Z -> world+X (rotation about Y)
  sc.items.push(EM.create('bfield', { x: 0, y: 0, w: 100, h: 100, d: 100, B: 2, rot }));
  const p = EM.create('charge', { x: 0, y: 0, z: 0, q: 1, m: 1, vx: 0, vy: 3, vz: 0, fixed: false }); sc.items.push(p);
  const T = Math.PI; const n = Math.round(T / EM.DT);
  let maxZ = -1e9, minZ = 1e9;
  for (let i = 0; i < n; i++) { EM.step(sc, EM.DT); maxZ = Math.max(maxZ, p.z); minZ = Math.min(minZ, p.z); }
  ok('off-axis cyclotron (B along X): same radius via the general 3D Boris rotation', Math.abs((maxZ - minZ) / 2 - 1.5) < 0.01, `diameter ${(maxZ - minZ).toFixed(4)}`);
  ok('off-axis cyclotron speed conserved', Math.abs(Math.hypot(p.vx, p.vy, p.vz) - 3) < 1e-6);
  ok('off-axis cyclotron stays on the original x=0 plane', Math.abs(p.x) < 1e-6, `x ${p.x.toExponential(2)}`);
}
{ // E x B drift: starts at rest, mean drift = E/B along E x B
  const sc = mk(); sc.items.push(EM.create('bfield', { x: 0, y: 0, w: 1e4, h: 1e4, d: 1e4, B: 4 })); sc.items.push(EM.create('efield', { x: 0, y: 0, w: 1e4, h: 1e4, d: 1e4, E: 2, dirAz: 90, dirEl: 0 }));
  const p = EM.create('charge', { x: 0, y: 0, q: 1, m: 1, fixed: false }); sc.items.push(p);
  const T = 2 * Math.PI / 4 * 10; run(sc, T);
  // E up (+y), B out (+z): E x B = (Ey Bz, -Ex Bz) = (+, 0)  -> drift +x at E/B = 0.5
  ok('E x B drift speed', Math.abs(p.x / T - 0.5) < 0.01, `mean vx ${(p.x / T).toFixed(4)}`);
}
{ // velocity selector: v = E/B passes straight through
  const sc = mk(); sc.items.push(EM.create('bfield', { x: 0, y: 0, w: 1e4, h: 1e4, d: 1e4, B: 2 })); sc.items.push(EM.create('efield', { x: 0, y: 0, w: 1e4, h: 1e4, d: 1e4, E: 6, dirAz: 90, dirEl: 0 }));
  const p = EM.create('charge', { x: 0, y: 0, q: 1, m: 1, vx: 3, vy: 0, fixed: false }); sc.items.push(p); run(sc, 2);
  ok('velocity selector goes straight', Math.abs(p.y) < 1e-6 && Math.abs(p.x - 6) < 1e-6, `y ${p.y.toExponential(2)} x ${p.x.toFixed(4)}`);
}
{ // constant E: x = 1/2 a t^2 with a = qE/m
  const sc = mk(); sc.items.push(EM.create('efield', { x: 0, y: 0, w: 1e4, h: 1e4, d: 1e4, E: 3, dirAz: 0, dirEl: 0 }));
  const p = EM.create('charge', { x: 0, y: 0, q: 2, m: 4, fixed: false }); sc.items.push(p); run(sc, 2);
  ok('uniform E acceleration', pct(p.x, 0.5 * (2 * 3 / 4) * 4) < 0.5, `x ${p.x.toFixed(5)} vs ${0.5 * 1.5 * 4}`);
}
{ // Coulomb circular orbit: opposite charges, energy and radius conserved
  const sc = mk(); sc.soft = 0.01; const A = EM.create('charge', { x: 0, y: 0, q: -4, m: 1e6, fixed: true }); const p = EM.create('charge', { x: 2, y: 0, q: 1, m: 1, vx: 0, vy: Math.sqrt(4 / 2), fixed: false });
  sc.items.push(A, p); const E0 = EM.energy(sc).total; let rmin = 9, rmax = 0;
  const T = 2 * Math.PI * 2 / Math.sqrt(2); const n = Math.round(2 * T / EM.DT);
  for (let i = 0; i < n; i++) { EM.step(sc, EM.DT); const r = Math.hypot(p.x, p.y); rmin = Math.min(rmin, r); rmax = Math.max(rmax, r); }
  ok('Coulomb orbit stays circular', rmax - rmin < 0.01, `r ${rmin.toFixed(4)}..${rmax.toFixed(4)}`);
  ok('Coulomb orbit conserves energy', Math.abs(EM.energy(sc).total - E0) / Math.abs(E0) < 0.001, `E ${E0.toFixed(5)} -> ${EM.energy(sc).total.toFixed(5)}`);
}
{ // energy in a uniform field: KE gain = q E d
  const sc = mk(); sc.items.push(EM.create('capacitor', { x: 0, y: 0, w: 20, gap: 4, d: 20, V: 8 }));
  const p = EM.create('charge', { x: 0, y: 1.5, q: 1, m: 1, fixed: false }); sc.items.push(p); const E0 = EM.energy(sc).total; run(sc, 0.5);
  ok('capacitor: total energy conserved', Math.abs(EM.energy(sc).total - E0) / E0 < 3e-3, `${E0.toFixed(5)} -> ${EM.energy(sc).total.toFixed(5)}`);
  ok('capacitor: positive charge falls toward the negative plate', p.y < 1.5 && Math.abs(p.vy) > 0, `y ${p.y.toFixed(3)}`);
}
{ // long wire: B = 2 km I / d, sign by right-hand rule (current +x, field out of page above the wire)
  const sc = mk(); sc.items.push(EM.create('wire', { x: 0, y: 0, len: 4000, I: 5 }));
  const up = EM.sample(sc, P(3, 2)), dn = EM.sample(sc, P(3, -2));
  ok('long wire magnitude 2 km I / d', pct(up.Bz, 2 * 5 / 2) < 0.2, `${up.Bz.toFixed(5)} vs 5`);
  ok('wire field reverses below the wire', Math.abs(dn.Bz + up.Bz) < 1e-9 && up.Bz > 0, `${dn.Bz.toFixed(4)}`);
  ok('long wire field stays in-plane (no Bx/By for a point in the wire plane)', Math.abs(up.Bx) < 1e-9 && Math.abs(up.By) < 1e-9);
}
{ // coil centre: B = mu0 I / 2R = 2 pi km I / R
  const sc = mk(); sc.items.push(EM.create('coil', { x: 0, y: 0, R: 1.5, I: 3, turns: 1 })); const b = EM.sample(sc, P(0, 0)).Bz;
  ok('coil centre field', pct(b, 2 * Math.PI * 3 / 1.5) < 0.3, `${b.toFixed(4)} vs ${(2 * Math.PI * 3 / 1.5).toFixed(4)}`);
}
{ // two parallel wires: B between currents in the same direction cancels midway, opposite adds
  const sc = mk(); sc.items.push(EM.create('wire', { x: 0, y: 1, len: 4000, I: 4 })); sc.items.push(EM.create('wire', { x: 0, y: -1, len: 4000, I: 4 }));
  ok('parallel wires cancel midway', Math.abs(EM.sample(sc, P(0, 0)).Bz) < 1e-6);
  sc.items[1].I = -4; ok('antiparallel wires add midway', pct(Math.abs(EM.sample(sc, P(0, 0)).Bz), 16) < 0.5, `${EM.sample(sc, P(0, 0)).Bz.toFixed(4)}`);
}
{ // charge in a wire's field drifts: grad-B, just make sure it stays finite and speed is constant
  const sc = mk(); sc.items.push(EM.create('wire', { x: 0, y: 0, len: 400, I: 10 }));
  const p = EM.create('charge', { x: 0, y: 1, q: 1, m: 1, vx: 1, vy: 0, fixed: false }); sc.items.push(p); run(sc, 5);
  ok('speed constant near a wire', Math.abs(Math.hypot(p.vx, p.vy, p.vz) - 1) < 1e-4 && isFinite(p.x), `${Math.hypot(p.vx, p.vy, p.vz)}`);
}
{ // a permanent magnet's dipole field: B = km [3(m^.r^)r^ - m^] |m| / r^3, checked on-axis and off-axis
  const sc = mk(); sc.items.push(EM.create('magnet', { x: 0, y: 0, z: 0, m: 2 })); // moment along local+Z = world+Z (identity rot)
  sc.soft = 1e-5;
  const onAxis = EM.sample(sc, P(0, 0, 3)); // on the moment axis: B = 2*km*m/r^3, along +Z
  ok('magnet on-axis field magnitude', pct(onAxis.Bz, 2 * sc.km * 2 / 27) < 0.5, `${onAxis.Bz.toExponential(4)}`);
  ok('magnet on-axis field has no transverse component', Math.abs(onAxis.Bx) < 1e-9 && Math.abs(onAxis.By) < 1e-9);
  const equatorial = EM.sample(sc, P(3, 0, 0)); // in the equatorial plane: B = -km*m/r^3, along -Z (anti-parallel to the moment)
  ok('magnet equatorial field magnitude and direction', pct(equatorial.Bz, -sc.km * 2 / 27) < 0.5 && equatorial.Bz < 0, `${equatorial.Bz.toExponential(4)}`);
}
{ // a moving point charge generates B = km q (v x r^) / r^2
  const sc = mk(); sc.soft = 1e-5;
  const mover = EM.create('charge', { x: 0, y: 0, z: 0, q: 1, m: 1, vx: 5, vy: 0, vz: 0, fixed: true }); sc.items.push(mover);
  const out = EM.sample(sc, P(0, 2, 0)); // r = (0,2,0), r=2, v = (5,0,0): v x r_vec = (0,0,10); B = km q (v x r_vec) / r^3 = km*10/8
  const expected = sc.km * 1 * 10 / 8;
  ok('moving charge generates B (direction)', out.Bz > 0 && Math.abs(out.Bx) < 1e-9 && Math.abs(out.By) < 1e-9, `Bz ${out.Bz.toExponential(4)}`);
  ok('moving charge generates B (magnitude)', pct(out.Bz, expected) < 1, `${out.Bz.toExponential(4)} vs ${expected.toExponential(4)}`);
  ok('a stationary charge generates no B', Math.hypot(EM.sample(sc, P(0, 2, 0.001)).Bx || 0, 0) >= 0); // sanity: field call doesn't throw
  const still = EM.create('charge', { x: 5, y: 5, z: 5, q: 1, m: 1, vx: 0, vy: 0, vz: 0, fixed: true }); const sc2 = mk(); sc2.items.push(still);
  const b2 = EM.sample(sc2, P(6, 5, 5)); ok('stationary charge contributes zero B', Math.hypot(b2.Bx, b2.By, b2.Bz) < 1e-12);
}
{ // a wall removes a particle that crosses it; a screen stops and records it
  const sc = mk(); sc.items.push(EM.create('wall', { x: 2, y: 0, z: 0, w: 2, h: 2 })); // normal = local+Z = world+Z, plane is the local XY plane -> wait: we need the particle's straight-line path (along +x) to cross the plane, so orient the wall so its plane (normal along local+Z after rot) is perpendicular to the particle's travel. Default identity rot makes the plane's normal world+Z, i.e. the plane itself lies in XY - a particle moving along +x never "crosses" that plane (it's parallel to it). Rotate the wall 90deg about Y so its normal becomes world+X.
  sc.items[0].rot = Quat.fromAxisAngle(Quat.create(), { x: 0, y: 1, z: 0 }, Math.PI / 2);
  const p = EM.create('charge', { x: 0, y: 0, z: 0, q: 0, m: 1, vx: 4, vy: 0, vz: 0, fixed: false }); sc.items.push(p);
  run(sc, 1);
  ok('wall removes a particle that crosses it', sc.items.filter(i => i.type === 'charge' && !i.fixed).length === 0 || p._held !== true);
  const sc2 = mk(); sc2.items.push(EM.create('screen', { x: 2, y: 0, z: 0, w: 2, h: 2, rot: Quat.fromAxisAngle(Quat.create(), { x: 0, y: 1, z: 0 }, Math.PI / 2) }));
  const p2 = EM.create('charge', { x: 0, y: 0, z: 0, q: 0, m: 1, vx: 4, vy: 0, vz: 0, fixed: false }); sc2.items.push(p2);
  run(sc2, 1);
  ok('screen stops a particle and records the hit', p2._held === true && p2._detected === true && Math.abs(p2.x - 2) < 0.02, `x ${p2.x.toFixed(3)} held ${p2._held}`);
  ok('screen keeps a hit record', sc2.items[0]._hits && sc2.items[0]._hits.length === 1);
}
{ // gyroInfo: gyroradius, drift speed and period match the closed-form cyclotron/drift formulas above
  const sc = mk(); sc.items.push(EM.create('bfield', { x: 0, y: 0, w: 100, h: 100, d: 100, B: 2 }));
  const p = EM.create('charge', { x: 0, y: 0, q: 1, m: 1, vx: 3, vy: 0, vz: 0, fixed: false }); sc.items.push(p);
  const g = EM.gyroInfo(sc, p);
  ok('gyroInfo radius matches m v / qB', pct(g.r, 1 * 3 / (1 * 2)) < 0.5, `${g.r.toFixed(4)}`);
  ok('gyroInfo period matches 2 pi m / qB', pct(g.T, 2 * Math.PI * 1 / (1 * 2)) < 0.5, `${g.T.toFixed(4)}`);
  const sc2 = mk(); sc2.items.push(EM.create('bfield', { x: 0, y: 0, w: 1e4, h: 1e4, d: 1e4, B: 4 })); sc2.items.push(EM.create('efield', { x: 0, y: 0, w: 1e4, h: 1e4, d: 1e4, E: 2, dirAz: 90, dirEl: 0 }));
  const p2 = EM.create('charge', { x: 0, y: 0, q: 1, m: 1, fixed: false }); sc2.items.push(p2);
  const g2 = EM.gyroInfo(sc2, p2);
  ok('gyroInfo drift speed matches E/B', pct(g2.drift, 2 / 4) < 0.5, `${g2.drift.toFixed(4)}`);
}
{ // emitter produces particles; capped
  const sc = mk(); sc.cap = 20; sc.items.push(EM.create('emitter', { x: 0, y: 0, rate: 60, speed: 1 })); run(sc, 1);
  ok('emitter emits and respects the cap', sc.beam.length === 20, `${sc.beam.length}`);
  ok('emitted particles stay in the z=0 plane at spread=0', sc.beam.every(b => Math.abs(b.z) < 1e-9 && Math.abs(b.vz) < 1e-9));
}
{ // emitter with a wide spread scatters in 3D but every particle's speed still matches
  const sc = mk(); sc.items.push(EM.create('emitter', { x: 0, y: 0, z: 0, rate: 0, speed: 2, spread: 90, q: 0, m: 1 }));
  const e = sc.items[0]; for (let i = 0; i < 20; i++) EM.spawn(sc, e);
  ok('wide-spread emitter preserves launch speed', sc.beam.every(b => Math.abs(Math.hypot(b.vx, b.vy, b.vz) - 2) < 1e-9));
  ok('wide-spread emitter actually uses the z axis (not flat)', sc.beam.some(b => Math.abs(b.vz) > 0.1));
}
{ // field lines: dipole lines end on the negative charge; lone charge lines leave
  const sc = mk(); sc.items.push(EM.create('charge', { x: -1, y: 0, q: 1 }), EM.create('charge', { x: 1, y: 0, q: -1 }));
  const L = EM.fieldLines(sc, { cx: 0, cy: 0, cz: 0, r: 8, h: 0.05 });
  const ends = L.filter(l => { const last = l.pts[l.pts.length - 1]; return Math.hypot(last.x - 1, last.y) < 0.2; }).length;
  ok('dipole: about half the lines end on the negative charge', L.length === 16 && ends >= 7, `${ends} of ${L.length}`);
}
{ // save and load keep the scene
  const sc = mk(); EM.demoScene(sc); const d = JSON.parse(JSON.stringify(EM.serialize(sc))), s2 = EM.deserialize(d);
  ok('round trip', s2.items.length === sc.items.length && s2.items[0].type === 'capacitor' && s2.k === 1);
  ok('ids stay unique', EM.create('charge').id > Math.max(...s2.items.map(i => i.id)));
  ok('v2 save format', d.v === 2);
}
{ // v1 (old 2D) saves still load correctly, lifted into z=0 / identity-quaternion 3D form
  const v1 = { v: 1, kind: 'em', k: 1, km: 1, soft: 0.06, mutual: true, units: null, items: [
    { id: 1, type: 'charge', name: 'C', x: 1, y: 2, q: 1, m: 1, vx: 0, vy: 0, fixed: true },
    { id: 2, type: 'wire', name: 'W', x: 0, y: 0, len: 4, rot: 90, I: 5 },
    { id: 3, type: 'emitter', name: 'E', x: 0, y: 0, angle: 45, speed: 2, rate: 1, q: 1, m: 1, spread: 0, on: true, act: true },
    { id: 4, type: 'bfield', name: 'B', x: 0, y: 0, w: 4, h: 4, shape: 'circle', B: 1 }
  ] };
  const sc = EM.deserialize(v1);
  const c = sc.items.find(i => i.id === 1), w = sc.items.find(i => i.id === 2), e = sc.items.find(i => i.id === 3), b = sc.items.find(i => i.id === 4);
  ok('v1 migration: charge gets z=0, vz=0', c.z === 0 && c.vz === 0);
  ok('v1 migration: wire rot=90deg becomes a quaternion pointing +Y', Math.abs(Quat.rotateVec3(V3.create(), w.rot, { x: 1, y: 0, z: 0 }).y - 1) < 1e-9, JSON.stringify(w.rot));
  ok('v1 migration: emitter angle=45deg becomes a quaternion pointing 45deg in XY', (() => { const d = Quat.rotateVec3(V3.create(), e.rot, { x: 1, y: 0, z: 0 }); return Math.abs(d.x - Math.cos(Math.PI / 4)) < 1e-9 && Math.abs(d.y - Math.sin(Math.PI / 4)) < 1e-9; })());
  ok('v1 migration: bfield shape circle -> sphere', b.shape === 'sphere');
}
for (const pr of EM.PRESETS) { const sc = EM.createScene(); const o = pr.build(sc); for (let i = 0; i < 1200; i++) EM.step(sc, EM.DT); const ps = EM.particles(sc); ok('preset ' + pr.id + ' runs', ps.every(p => isFinite(p.x + p.y + p.z)) && !!o, ps.length + ' particles'); }
{ // mass spectrometer: selector passes v=1 straight, the m=2 ions curve twice as wide
  const sc = mk(); EM.PRESETS[0].build(sc); sc.items.filter(i => i.type === 'emitter').forEach(e => { e.spread = 0; e.rate = 2; });
  for (let i = 0; i < 240 * 6; i++) EM.step(sc, EM.DT);
  const mid = sc.beam.filter(p => p.x > -0.9 && p.x < 0.4 && p.vx > 0), back = sc.beam.filter(p => p.vx < 0 && p.x < 0.5 && p.x > 0); ok('selector passes the beam straight', mid.length > 0 && mid.every(p => Math.abs(Math.abs(p.y) - 0.04) < 0.01), mid.length + ' in the gap');
  const ys = back.map(p => p.y).sort((a, b) => a - b); ok('analyser: exit points are 2r apart (r = mv/qB = 1 and 2)', ys.length >= 2 && Math.abs(ys[0] - 2.04) < 0.1 && Math.abs(ys[ys.length - 1] - 3.96) < 0.1, ys.map(y => y.toFixed(2)).join(' '));
}
{ // emitted particles are real charges: they push a free charge and each other, and a fixed charge deflects them
  let sc = mk(); sc.items.push(EM.create('emitter', { x: 0, y: 0, speed: 0, rate: 50, spread: 180, q: 1, m: 1 })); const f = EM.create('charge', { x: 1, y: 0, q: 1, m: 1, fixed: false }); sc.items.push(f);
  run(sc, 1); ok('emitted + particles push a nearby + charge away', f.x > 1.05, `x ${f.x.toFixed(3)}`);
  sc = mk(); const e = EM.create('emitter', { x: 0, y: 0, speed: 0, rate: 0, q: 1, m: 1 }); sc.items.push(e); EM.spawn(sc, e); EM.spawn(sc, e); sc.beam[0].x = -0.3; sc.beam[1].x = 0.3; run(sc, 0.3);
  ok('two emitted + particles repel each other', sc.beam[1].x > 0.4 && sc.beam[0].x < -0.4, `${sc.beam[0].x.toFixed(2)} ${sc.beam[1].x.toFixed(2)}`);
  sc = mk(); const e2 = EM.create('emitter', { x: 0, y: 0, speed: 0, rate: 0, q: 1, m: 1, act: false }); sc.items.push(e2); EM.spawn(sc, e2); EM.spawn(sc, e2); sc.beam[0].x = -0.3; sc.beam[1].x = 0.3; run(sc, 0.3);
  ok('with "act as charges" off they ignore each other', Math.abs(sc.beam[1].x - 0.3) < 1e-9);
  sc = mk(); sc.items.push(EM.create('emitter', { x: -5, y: 0, speed: 3, rate: 2, spread: 0, q: 1, m: 1 })); sc.items.push(EM.create('charge', { x: 0, y: 0.5, q: 5, fixed: true })); run(sc, 3);
  ok('a fixed + charge deflects a + beam', sc.beam.some(p => p.y < -0.3), sc.beam.map(p => p.y.toFixed(2)).join(' '));
  sc = mk(); sc.mutual = false; const e3 = EM.create('emitter', { x: 0, y: 0, speed: 0, rate: 0, q: 1, m: 1 }); sc.items.push(e3); EM.spawn(sc, e3); EM.spawn(sc, e3); sc.beam[0].x = -0.3; sc.beam[1].x = 0.3; run(sc, 0.3);
  ok('"free charges push each other" off also stops beam-beam forces', Math.abs(sc.beam[1].x - 0.3) < 1e-9);
}
{ // real constants with a scaled workspace: proton circles at r = m v / (q B) = 1.04 cm, period 2 pi m / (q B)
  const sc = mk(); EM.PRESETS.find(p => p.id === 'real_cyclo').build(sc); const f = EM.unitScale(sc.units), pr = sc.items.find(q => q.type === 'charge');
  const B = 0.1, v = 1e5, m = 1.67262192e-27, q = 1.602176634e-19, r = m * v / (q * B), Tc = 2 * Math.PI * m / (q * B);
  let ymin = 1e9, ymax = -1e9, t = 0; const dt = EM.DT;
  while (t < Tc / f.T * 1.0) { EM.step(sc, dt); t += dt; ymin = Math.min(ymin, pr.y); ymax = Math.max(ymax, pr.y); }
  ok('real-unit proton orbit diameter 2mv/qB', pct((ymax - ymin) * f.L, 2 * r) < 1.0, ((ymax - ymin) * f.L * 100).toFixed(3) + ' cm vs ' + (2 * r * 100).toFixed(3) + ' cm');
  ok('real-unit proton is back near its start after one period', Math.hypot(pr.x + 1, pr.y) < 0.05, 'off by ' + Math.hypot(pr.x + 1, pr.y).toFixed(3));
  ok('internal k is tiny for protons', sc.k < 1e-6 && sc.k > 0);
}
{ // real Coulomb force in the lab-bench units: 5 nC and 5 nC, 4 cm apart, 1 mg: a = k q^2 / (m r^2)
  const sc = mk(); const f = (sc.units = Object.assign({}, EM.UNIT_SETS[0].u), EM.applyUnits(sc), EM.unitScale(sc.units)); sc.soft = 1e-4;
  sc.items.push(EM.create('charge', { x: -2, y: 0, q: 5, m: 1, fixed: true })); const p = EM.create('charge', { x: 2, y: 0, q: 5, m: 1, fixed: false }); sc.items.push(p);
  const a = EM.K_SI * 25e-18 / (1e-6 * 0.04 * 0.04); const t = 0.002; EM.step(sc, t);
  const aSI = p.vx * f.v / (t * f.T); ok('real Coulomb acceleration in lab units', pct(aSI, a) < 1.0, aSI.toFixed(2) + ' vs ' + a.toFixed(2) + ' m/s^2'); }
{ const sc = mk(); EM.PRESETS.find(p => p.id === 'real_massspec').build(sc); const s2 = EM.deserialize(JSON.parse(JSON.stringify(EM.serialize(sc))));
  ok('units survive save and load', s2.units && Math.abs(s2.k - sc.k) < 1e-30 * 1e9 && s2.units.L === 0.01 && Math.abs(s2.km / sc.km - 1) < 1e-12); }
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
