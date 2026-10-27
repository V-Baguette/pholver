// Pholver E&M interface. Loaded after ui_em3d.js; it adds the E&M toolbar, tools, properties and pointer
// handling for 'em' documents, driving the WebGL renderer in ui_em3d.js. Phase A4: real 3D interaction
// (orbit camera, ray-cast placement/picking/drag, box-select). Phase A6: the work plane is user-selectable
// (XY/XZ/YZ/camera-facing) rather than fixed at z=0, so objects can be placed and dragged freely in 3D;
// PageUp/PageDown nudge the plane's depth while placing, or the selected object's depth along the plane
// normal while selected.
// Not yet in this pass (left for a later polish phase): draggable rotation-arc handles (use the Rotate X/Y/Z
// fields in the property panel instead - they edit the same quaternion).
(function () {
  'use strict';
  const P = window.__pholver, EM = window.EM, EM3D = window.EM3D; if (!P || !EM || !EM3D) return;
  const $ = s => document.querySelector(s), S = P.S, ic = P.ic, app = $('#app');
  const cvEm = $('#cvEm'), emFallback = $('#emFallback'), emBoxSel = $('#emBoxSel'), emRulerLabel = $('#emRulerLabel');
  let gl3dReady = false;
  const TAU = Math.PI * 2, rad = a => a * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- workspace units ----------
  // Abstract scenes show plain numbers with SI unit names. Scenes with units show real SI values (with prefixes) converted from workspace units.
  let CUR = null;
  const PRE = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f'], [1e-18, 'a']];
  function fmtSI(x, unit, digits) {
    digits = digits || 3; if (!isFinite(x)) return '–'; const a = Math.abs(x); if (a < 1e-30) return '0 ' + unit;
    let p = PRE[PRE.length - 1]; for (const t of PRE) if (a >= t[0] * 0.9995) { p = t; break; }
    const q = x / p[0]; let s = Math.abs(q) >= Math.pow(10, digits) ? String(Math.round(q)) : q.toPrecision(digits); if (s.indexOf('e') < 0 && s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
    return s + ' ' + p[1] + unit;
  }
  // "1.5 cm", "50 mT", "2e-3", "5 m" (metres, not milli) with the unit known
  function parseSI(str, unit) {
    const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)\s*(.*)$/.exec(String(str).replace(',', '.')); if (!m) return NaN;
    let v = parseFloat(m[1]), rest = m[2].trim(); if (!rest) return v;
    if (rest === unit) return v;
    let pre = rest; if (unit && rest.length > unit.length && rest.endsWith(unit)) pre = rest.slice(0, rest.length - unit.length);
    if (/^meg$/i.test(pre)) return v * 1e6;
    const f = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3, c: 1e-2, m: 1e-3, u: 1e-6, 'µ': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15, a: 1e-18 }[pre]; return f ? v * f : NaN;
  }
  const ABS = { L: 'm', Q: 'C', E: 'V/m', B: 'T', V: 'V', I: 'A', U: 'J', T: 's', v: 'm/s', F: 'N' };
  const sc_ = () => CUR && CUR.units ? EM.unitScale(CUR.units) : null;
  // value of a given kind as text, in the scene's own units
  function show(kind, x, n) { const f = sc_(); return f ? fmtSI(x * f[kind], ABS[kind]) : (+x.toFixed(n == null ? 2 : n)) + ' ' + ABS[kind]; }
  const DIMS = { 'm': 'L', 'C': 'Q', 'kg': 'M', 'm/s': 'v', 'N/C': 'E', 'T': 'B', 'V': 'V', 'J': 'U', 'N': 'F', 's': 'T', 'A': 'I' };
  function siInput(box, ro, label, unit, get, set, o) {   // get/set work in real SI; shown with prefixes
    o = o || {}; const id = 'q' + Math.random().toString(36).slice(2, 8), row = document.createElement('div'); row.className = 'row si';
    const lb = document.createElement('label'); lb.htmlFor = id; lb.textContent = label; row.appendChild(lb);
    const inp = document.createElement('input'); inp.type = 'text'; inp.id = id; inp.readOnly = ro && !o.live || !!o.ro; row.appendChild(inp); box.appendChild(row);
    const fm = x => fmtSI(x, unit); inp.value = fm(get()); P.regField(inp, get, fm);
    inp.addEventListener('focus', () => inp.select());
    inp.addEventListener('change', () => {
      let v = parseSI(inp.value, unit); if (!isFinite(v)) { inp.value = fm(get()); return; }
      if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v);
      set(v); if (o.after) o.after(); inp.value = fm(get()); P.refreshFields(true);
    });
    return inp;
  }
  // swap the number fields of a helper set for SI text fields when the scene has units
  function unitHelpers(H, box, sc) {
    if (!sc.units) return H; const f = EM.unitScale(sc.units), K = {}; Object.keys(DIMS).forEach(u => { K[u] = f[DIMS[u]]; }); K['1/s'] = 1 / f.T;
    const num0 = H.num, read0 = H.read;
    H.num = (label, unit, get, set, o) => {
      const k = K[unit]; if (!k) return num0(label, unit, get, set, o);
      o = o || {}; const so = Object.assign({}, o); if (o.min != null) so.min = o.min * k; if (o.max != null) so.max = o.max * k;
      return siInput(box, H.ro, label, unit === '1/s' ? 'Hz' : unit === 'N/C' ? 'V/m' : unit, () => get() * k, v => set(v / k), so);
    };
    H.read = (label, unit, get) => { const k = K[unit]; if (!k) return read0(label, unit, get); siInput(box, true, label, unit === '1/s' ? 'Hz' : unit === 'N/C' ? 'V/m' : unit, () => get() * k, () => { }, { ro: true }); };
    return H;
  }

  // ---------- icons, labels, tools ----------
  Object.assign(P.ICON, {
    pcharge: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/>',
    ncharge: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8"/>',
    particle: '<circle cx="8.500" cy="12" r="4.500"/><path d="M15 12h6M18 9l3 3-3 3"/>',
    emitter: '<rect x="3" y="8" width="6" height="8" rx="1"/><path d="M9 12h3"/><circle cx="15" cy="12" r="1.200" fill="currentColor"/><circle cx="19" cy="12" r="1.200" fill="currentColor"/>',
    efield: '<rect x="3" y="5" width="18" height="14" rx="1.500"/><path d="M6.500 12h9M12.500 8.500l3.500 3.500-3.500 3.500"/>',
    capacitor: '<path d="M4 7h16M4 17h16M12 9.500v5M9.500 12.500l2.500 2.500 2.500-2.500"/>',
    bfield: '<rect x="3" y="5" width="18" height="14" rx="1.500"/><circle cx="8.500" cy="9.500" r=".9" fill="currentColor"/><circle cx="15.500" cy="9.500" r=".9" fill="currentColor"/><circle cx="8.500" cy="14.500" r=".9" fill="currentColor"/><circle cx="15.500" cy="14.500" r=".9" fill="currentColor"/>',
    wire: '<path d="M3 12h17M15 7l5 5-5 5"/>',
    coil: '<circle cx="12" cy="12" r="8"/><path d="M14 4.500L10.500 4 12 7"/>',
    magnet: '<rect x="4" y="4" width="7" height="16" rx="2"/><rect x="13" y="4" width="7" height="16" rx="2"/><rect x="4" y="4" width="7" height="7" rx="2" fill="currentColor"/><rect x="13" y="13" width="7" height="7" rx="2" fill="currentColor"/>',
    screen: '<rect x="4" y="4" width="16" height="16" rx="1.500"/><path d="M4 9h16M4 14h16M9 4v16M14 4v16"/>',
    wall: '<rect x="4" y="4" width="16" height="16" rx="1" fill="currentColor" opacity=".25"/><rect x="4" y="4" width="16" height="16" rx="1"/>',
    probeobj: '<circle cx="12" cy="12" r="3"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
    ruler: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
    probe: '<circle cx="12" cy="12" r="3"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/>',
    lines: '<circle cx="12" cy="12" r="2"/><path d="M12 10c0-5 4-7 8-7M12 14c0 5 4 7 8 7M10 12c-5 0-7-4-7-8M10 12c-5 0-7 4-7 8"/>',
    species: '<circle cx="8" cy="9" r="3.200" fill="currentColor"/><circle cx="16.500" cy="8" r="2.400" fill="currentColor"/><circle cx="12" cy="16.500" r="2.800" fill="currentColor"/>'
  });
  const LABEL = { charge: 'Charge', particle: 'Particle', emitter: 'Emitter', efield: 'E field', capacitor: 'Capacitor', bfield: 'B field', wire: 'Wire', coil: 'Coil', magnet: 'Magnet', screen: 'Screen', wall: 'Wall', probe: 'Field probe' };
  const TOOLS = [
    ['cpos', 'Positive charge', 'Fixed source', 'pcharge'], ['cneg', 'Negative charge', 'Fixed source', 'ncharge'], ['cfree', 'Free particle', 'Moves under the fields', 'particle'],
    ['emitter', 'Emitter', 'Fires a stream of particles', 'emitter'], ['efield', 'Uniform E field', 'Region of constant E', 'efield'], ['capacitor', 'Capacitor', 'Plates at a set voltage', 'capacitor'],
    ['bfield', 'Uniform B field', 'Region of constant B', 'bfield'], ['wire', 'Wire', 'Straight current', 'wire'], ['coil', 'Coil', 'Circular current loop', 'coil'],
    ['magnet', 'Magnet', 'Permanent dipole', 'magnet'], ['screen', 'Screen', 'Detects and stops particles', 'screen'], ['wall', 'Wall', 'Absorbs particles', 'wall'],
    ['probeobj', 'Field probe', 'Reads the field at a fixed point', 'probeobj']
  ];
  const TOOL_LABEL = {}; TOOLS.forEach(t => { TOOL_LABEL[t[0]] = t[1]; });
  const SIDES = { cpos: 'charge', cneg: 'charge', cfree: 'particle' };
  const COLOURS = [['#e28b2c', 'Orange'], ['#1f9d8a', 'Teal'], ['#8a5cd0', 'Violet'], ['#d9483b', 'Red'], ['#2f6fd6', 'Blue']];

  // ---------- toolbar ----------
  const toolbar = $('#toolbar');
  const html = (tag, attrs, inner) => { const e = document.createElement(tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); e.innerHTML = inner || ''; return e; };
  const btn = (id, icon, label, title, modes, pressed) => {
    const b = html('button', { class: 'tb', id, 'data-kind': 'em', 'data-modes': modes, title }, ic(icon) + label);
    if (pressed != null) b.setAttribute('aria-pressed', pressed); b.style.display = ''; return b;
  };
  const sep = modes => html('span', { class: 'sep', 'data-kind': 'em', 'data-modes': modes });
  const field = (label, inner, modes, id, tip) => { const a = { class: 'tbfield', 'data-kind': 'em', 'data-modes': modes, id: id || '' }; if (tip) a['data-tip'] = tip; return html('label', a, label + inner); };
  const style = html('style', {}, `
    #emTray { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; min-width: 470px; }
    #emTray[hidden] { display: none; }
    #emTray button { flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px; font-size: 13px; text-align: center; border-radius: var(--r-3); }
    #emTray button svg { width: 32px; height: 32px; }
    #emTray .sub { font-size: 10.5px; }
    #coords { white-space: pre; text-align: right; line-height: 1.35; }
    #app[data-kind="em"] #props { max-height: calc(100% - 150px); }
    .tb.wide { width: 84px; }
  `);
  document.head.appendChild(style);
  const emTray = html('div', { class: 'menu', id: 'emTray', hidden: '', role: 'menu' }, TOOLS.map(t => '<button role="menuitem" data-t="' + t[0] + '">' + ic(t[3]) + '<span>' + t[1] + '<span class="sub">' + t[2] + '</span></span></button>').join(''));
  app.appendChild(emTray);

  const addBtn = btn('emAdd', 'objects', 'Add', 'Add a charge, field, wire or other object', 'design'); addBtn.setAttribute('aria-haspopup', 'menu');
  toolbar.insertBefore(addBtn, $('#selBtn'));
  const planeSel = field('Plane', '<select id="emPlane"><option value="xy">XY</option><option value="xz">XZ</option><option value="yz">YZ</option><option value="cam">Camera-facing</option></select>', 'design sim render', '', 'The work plane: where new objects land and what dragging moves across. PageUp/PageDown nudge its depth while placing, or a selected object\'s depth while selected.');
  addBtn.after(planeSel);
  $('#emPlane').addEventListener('change', e => {
    const d = P.cur; if (!d || d.kind !== 'em') return; const wp = st(d).wp; wp.axis = e.target.value; wp.off = 0; P.updateHint();
  });
  const delBtn = $('#delBtn'); delBtn.after(sep('design'));
  const resetBtn = $('#resetBtn');
  const probe = btn('emProbe', 'probe', 'Probe', 'Drop a test particle: click to place it, drag before releasing to launch it', 'sim render');
  const pq = field('Probe q', '<input id="emPq" type="number" step="0.1" value="1">', 'sim render', 'emPqF'), pm = field('Probe m', '<input id="emPm" type="number" step="0.1" min="0.001" value="1">', 'sim render', 'emPmF');
  resetBtn.after(sep('sim render'), probe, pq, pm);
  const lines = btn('emLines', 'lines', 'E lines', 'Electric field lines (from + charges to − charges)', 'design sim render', true);
  const species = btn('emSpecies', 'species', 'By species', 'Colour moving charges by charge-to-mass ratio instead of sign, so different species (e.g. protons vs electrons) get distinct colours', 'design sim render', false);
  const regions = btn('emFieldVis', 'bfield', 'Field regions', 'Show or hide E field, B field and capacitor region boxes (and the B field direction arrow). Emitters, screens and walls stay visible either way.', 'design sim render', true);
  const ruler = btn('emRuler', 'ruler', 'Ruler', 'Measure: drag between two points to read the distance. Esc clears it.', 'design sim render', false);
  $('#vecBtn').before(sep('design sim render'), lines, species, regions, ruler);
  $('#vecBtn').title = 'Velocity arrows (green)';
  // Whole-view field arrows/map and per-item force-vector toolbar buttons from the 2D-era view were removed
  // (A7): there's no natural "whole view" grid left once the camera can orbit freely. Per-selected-item
  // readouts in the property panel (gyroradius, drift, etc., via EM.gyroInfo) are their replacement.

  // ---------- per-document state ----------
  const st = d => d.es || (d.es = { opts: { lines: true, species: false, regions: true }, acc: 0, lineCache: null, wp: { axis: 'xy', off: 0 } });
  lines.addEventListener('click', () => { const d = P.cur; if (d.kind !== 'em') return; const o = st(d).opts; o.lines = !o.lines; lines.setAttribute('aria-pressed', o.lines); });
  species.addEventListener('click', () => { const d = P.cur; if (d.kind !== 'em') return; const o = st(d).opts; o.species = !o.species; species.setAttribute('aria-pressed', o.species); });
  regions.addEventListener('click', () => { const d = P.cur; if (d.kind !== 'em') return; const o = st(d).opts; o.regions = !o.regions; regions.setAttribute('aria-pressed', o.regions); });
  const sel = d => d.sel != null ? d.em.items.find(i => i.id === d.sel) || null : null;
  const nameFor = (d, key) => { d.counts = d.counts || {}; const k = 'em_' + key; d.counts[k] = (d.counts[k] || 0) + 1; return LABEL[key] + ' ' + d.counts[k]; };
  // Axis mapping for a work plane: h/v are the two in-plane coordinates (what snapping/nudging/dragging act
  // on), n is the plane-normal coordinate (what PageUp/PageDown and the plane offset act on). 'cam' (an
  // arbitrary camera-facing plane) has no clean world-axis mapping, so it borrows xy's for key-nudge purposes.
  const AXES = { xy: { h: 'x', v: 'y', n: 'z' }, xz: { h: 'x', v: 'z', n: 'y' }, yz: { h: 'y', v: 'z', n: 'x' } };
  const axesFor = axis => AXES[axis] || AXES.xy;
  function snapPt(d, w) {
    if (!S.snap) return w;
    const A = axesFor(st(d).wp.axis), q = Object.assign({}, w);
    q[A.h] = Math.round(w[A.h] / S.grid) * S.grid; q[A.v] = Math.round(w[A.v] / S.grid) * S.grid;
    return q;
  }
  const size = () => P.size;

  // ---------- camera / rays / work plane ----------
  function camOf(d) {
    if (!d.cam) { const b = window.EM3DGL ? window.EM3DGL.sceneBounds(d.em) : { center: { x: 0, y: 0, z: 0 }, radius: 4 }; d.cam = { target: b.center, yaw: -0.7, pitch: 0.5, dist: Math.max(b.radius * 2.3, 3) }; }
    return d.cam;
  }
  function camMat(d) { const { cw, ch } = size(); return EM3D.orbitCamera(camOf(d), cw / Math.max(1, ch)); }
  function rayFor(cam, p) { const { cw, ch } = size(), ndcX = (p.x / cw) * 2 - 1, ndcY = 1 - (p.y / ch) * 2; return EM3D.rayFromScreen(cam.invViewProj, ndcX, ndcY); }
  // The active work plane as a {point, normal} pair. XY/XZ/YZ are axis-aligned planes offset along their
  // normal by st(d).wp.off; 'cam' is the plane through the orbit target, facing the camera, at the same offset.
  function planeOf(d, cam) {
    const wp = st(d).wp;
    if (wp.axis === 'cam') {
      const V3 = EM3D.V3, t = camOf(d).target, n = V3.normalize(V3.create(), V3.sub(V3.create(), cam.eye, t));
      return { point: V3.addScaled(V3.create(), t, n, wp.off), normal: n };
    }
    const n = wp.axis === 'xz' ? { x: 0, y: 1, z: 0 } : wp.axis === 'yz' ? { x: 1, y: 0, z: 0 } : { x: 0, y: 0, z: 1 };
    return { point: { x: n.x * wp.off, y: n.y * wp.off, z: n.z * wp.off }, normal: n };
  }
  function rayPlane(cam, p, plane) { const ray = rayFor(cam, p); return EM3D.intersectRayPlane(ray.origin, ray.dir, plane.point, plane.normal) || plane.point; }
  // A plane through a captured world point, oriented like the given plane's normal - used to anchor a drag
  // (move/gmove/ruler/probe) to the item's/anchor's own depth rather than snapping it back onto the work plane.
  const planeThrough = (plane, pt) => ({ point: pt, normal: plane.normal });
  function worldToScreen(d, p) { return window.EM3DGL.worldToScreen(camOf(d), p); }
  // E field-line segments for the renderer's extraLines. EM.fieldLines (A2) traces real 3D curves, but tracing
  // is O(seed lines x steps x scene items) - too expensive to redo at 60fps on top of the sim step itself, so this
  // recomputes on a ~200ms cadence (plenty for a visualization that doesn't need to track every substep) and
  // caches the result between recomputes; the renderer's own line-buffer cap (CAP_LINE_V) is the hard backstop
  // if a scene has enough charges that even the throttled trace would produce more segments than fit.
  function fieldLineSegs(d) {
    const A = st(d), now = performance.now();
    if (A.lineCache && now - A.lineCache.t < 200) return A.lineCache.segs;
    const sc = d.em, b = window.EM3DGL.sceneBounds(sc);
    // Diverging lines (e.g. two like charges repelling) stop once they leave this radius - sizing it from the
    // scene's own object bounds alone meant zooming out left them visibly stopping well inside the view. Fold
    // in the camera's distance too, so they keep going out toward roughly what's actually on screen.
    const r = Math.max(b.radius, 2, camOf(d).dist * 1.4), h = Math.max(r / 80, 0.03);
    const bound = { cx: b.center.x, cy: b.center.y, cz: b.center.z, r, h };
    // A curved field line between two charges needs well more than their straight-line separation of arc
    // length to actually close (it bows out before bending back); a flat step cap sized for a typical small
    // scene left plenty of lines visibly dangling short of the charge they were headed for. Size the cap to
    // the scene instead - enough steps to cover several bound radii - capped so a huge scene can't runaway;
    // divergent lines (which don't converge) still self-terminate earlier via the inView bound in EM.fieldLines.
    const maxSteps = Math.min(400, Math.ceil(r * 6 / h));
    let lines; try { lines = EM.fieldLines(sc, bound, { maxSteps }); } catch (e) { lines = []; }
    const segs = [];
    for (const l of lines) {
      const src = sc.items.find(it => it.id === l.src), col = src ? (src.q > 0 ? [0.85, 0.3, 0.25, 0.85] : [0.25, 0.45, 0.85, 0.85]) : [0.8, 0.75, 0.4, 0.8];
      for (let k = 0; k + 1 < l.pts.length; k++) segs.push({ a: l.pts[k], b: l.pts[k + 1], color: col });
    }
    A.lineCache = { t: now, segs }; return segs;
  }
  function rayAABB(o, dir, b) {
    let tmin = -1e18, tmax = 1e18;
    for (const ax of ['x', 'y', 'z']) {
      const od = o[ax], dd = Math.abs(dir[ax]) < 1e-12 ? 1e-12 : dir[ax], lo = b.min[ax], hi = b.max[ax];
      let t1 = (lo - od) / dd, t2 = (hi - od) / dd; if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
    return tmin >= 0 ? tmin : (tmax >= 0 ? tmax : null);
  }
  // Ray-AABB pick, biased toward the active work plane: with the camera often looking down at an angle, a
  // thick field-region box (its bounds3 reaches well off the work plane) can lie along the same ray as an
  // empty-looking click on that plane, past where the ray actually crosses it. Rejecting any hit whose
  // nearest box intersection is farther from the camera than the plane point keeps clicks on empty plane
  // space empty.
  function pickAt(d, cam, p, tol) {
    const ray = rayFor(cam, p), g = rayPlane(cam, p, planeOf(d, cam));
    const t0 = g ? Math.hypot(g.x - ray.origin.x, g.y - ray.origin.y, g.z - ray.origin.z) + 1e-6 : Infinity;
    let best = null, bestT = Infinity;
    for (const it of d.em.items) {
      const b = EM.bounds3(it); b.min = { x: b.min.x - tol, y: b.min.y - tol, z: b.min.z - tol }; b.max = { x: b.max.x + tol, y: b.max.y + tol, z: b.max.z + tol };
      const t = rayAABB(ray.origin, ray.dir, b);
      if (t != null && t <= t0 && t < bestT) { bestT = t; best = it; }
    }
    return best;
  }

  // ---------- tools and creation ----------
  function make(tool, x, y, z) {
    switch (tool) {
      case 'cpos': return EM.create('charge', { x, y, z, q: 1, m: 1, fixed: true });
      case 'cneg': return EM.create('charge', { x, y, z, q: -1, m: 1, fixed: true });
      case 'cfree': return EM.create('charge', { x, y, z, q: 1, m: 1, fixed: false });
      case 'probeobj': return EM.create('probe', { x, y, z });
      default: return EM.create(tool, { x, y, z });
    }
  }
  function setTool(d, t) { if (d.mode !== 'design') return; d.tool = d.tool === t ? null : t; d.probe = false; d.ruler = false; P.closeMenus(); P.updateHint(); sync(d); }
  function place(d, w, e) {
    const q = snapPt(d, w), it = make(d.tool, q.x, q.y, q.z); it.name = nameFor(d, SIDES[d.tool] || it.type);
    d.em.items.push(it); if (!e.shiftKey) d.tool = null; P.select(it.id); P.updateHint(); sync(d);
  }
  addBtn.addEventListener('click', e => { e.stopPropagation(); const open = !emTray.hidden; P.closeMenus(); if (!open) { P.placeMenu(emTray, addBtn, 480); emTray.hidden = false; } });
  emTray.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTool(P.cur, b.dataset.t); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#emTray') && !e.target.closest('#emAdd')) emTray.hidden = true; });
  ruler.addEventListener('click', () => { const d = P.cur; if (d.kind !== 'em') return; d.ruler = !d.ruler; if (d.ruler) { d.tool = null; d.probe = false; } else st(d).ruler = null; P.closeMenus(); P.updateHint(); sync(d); });
  probe.addEventListener('click', () => { const d = P.cur; if (d.kind !== 'em') return; d.probe = !d.probe; d.ruler = false; d.tool = null; P.updateHint(); sync(d); });
  $('#selBtn').addEventListener('click', () => { const d = P.cur; if (d.kind === 'em') { d.probe = false; d.ruler = false; d.tool = null; sync(d); P.updateHint(); } });

  function sync(d) {
    $('#emAdd').classList.toggle('armed', !!d.tool); $('#emProbe').classList.toggle('armed', !!d.probe);
    $('#emRuler').classList.toggle('armed', !!d.ruler); $('#selBtn').classList.toggle('armed', !d.tool && !d.probe && !d.ruler);
    cvEm.classList.toggle('placing', !!d.tool || !!d.probe || !!d.ruler);
    if (!d.ruler) emRulerLabel.hidden = true;
  }

  // ---------- hooks used by ui.js ----------
  const E = window.EMUI = {};
  E.applyMode = function (d) {
    $('#snapBtn').setAttribute('aria-pressed', S.snap); sync(d);
    $('#emPlane').value = st(d).wp.axis;
    $('#undoBtn').title = 'Undo (Ctrl+Z)';
    $('#selBtn').title = 'Select and move. Left-drag to select or box-select; right-drag orbits the camera; wheel zooms. Shift-click or shift-drag selects several. Ctrl+C, X, V, D, A copy, cut, paste, duplicate and select all. Arrow keys nudge within the work plane, PageUp/PageDown nudge along its normal. [ and ] rotate by 15 degrees about z.';
  };
  const GRIDS = [0.1, 0.25, 0.5, 1];
  E.gridLabels = function (d) {
    const sel = $('#gridSel'); if (!sel) return; const un = d && d.kind === 'em' && d.em && d.em.units ? EM.unitScale(d.em.units) : null;
    const lab = (id, t, unit, k) => { const el = $(id); if (!el) return; el.firstChild.nodeValue = t + (un ? ' (×' + fmtSI(un[k], unit) + ')' : ''); el.title = un ? 'In workspace units: 1 = ' + fmtSI(un[k], unit) : ''; };
    lab('#emPqF', 'Probe q', 'C', 'Q'); lab('#emPmF', 'Probe m', 'kg', 'M');
    [...sel.options].forEach(o => { const v = parseFloat(o.value); o.textContent = un ? fmtSI(v * un.L, 'm') : v + ' m'; });
  };
  E.listItems = d => d.em.items.map(it => ({ id: it.id, name: it.name, ic: it.type === 'charge' ? (!it.fixed ? 'particle' : it.q < 0 ? 'ncharge' : 'pcharge') : it.type === 'probe' ? 'probeobj' : it.type }));
  const PLANE_LABEL = { xy: 'XY', xz: 'XZ', yz: 'YZ', cam: 'camera-facing' };
  E.hint = d => {
    if (d.ruler) return 'Drag from one point to another (on the ' + PLANE_LABEL[st(d).wp.axis] + ' plane) to measure. The reading stays until you drag again or press Esc.';
    if (d.tool) return 'Click to place ' + TOOL_LABEL[d.tool] + ' on the ' + PLANE_LABEL[st(d).wp.axis] + ' plane. PageUp/PageDown move the plane in/out. Shift keeps the tool. Esc cancels.';
    if (d.mode !== 'design' && d.probe) return 'Click to drop a probe particle. Drag before letting go to launch it; its charge and mass are in the toolbar.';
    if (d.mode === 'design') return 'Left-drag to select, right-drag to orbit the camera, wheel to zoom.';
    return '';
  };
  E.setMode = function (d, m) {
    if (m === d.mode) return;
    if (d.mode === 'design') { d.emSaved = JSON.stringify(EM.serialize(d.em)); d.tool = null; d.probe = false; st(d).acc = 0; }
    if (m === 'design') { if (d.emSaved) d.em = EM.deserialize(JSON.parse(d.emSaved)); d.playing = false; setTimeout(() => P.checkpoint(d), 0); }
    if (m === 'sim' && d.mode === 'design') d.playing = true;
    d.mode = m; P.applyMode(); P.renderProps(); P.renderWorkspace(); P.updateHint();
  };
  E.reset = function (d) {
    if (d.mode === 'design' || !d.emSaved) return;
    d.em = EM.deserialize(JSON.parse(d.emSaved)); d.playing = false; st(d).acc = 0; P.updatePlayBtn(); P.renderProps();
  };
  E.step = function (d) { for (let i = 0; i < 4; i++) EM.step(d.em, EM.DT); P.refreshFields(true); };

  // ---------- selection, clipboard, arrangement ----------
  const ids = d => P.selIds(d).filter(id => d.em.items.some(i => i.id === id));
  const selItems = d => { const s = new Set(ids(d)); return d.em.items.filter(i => s.has(i.id)); };
  const clean = it => { const o = JSON.parse(JSON.stringify(it)); Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };
  function copySel(d, quiet) {
    const its = selItems(d); if (!its.length || d.mode !== 'design') return false;
    S.emClip = { n: 0, items: its.map(clean) }; if (!quiet) P.flash(d, 'Copied ' + its.length + (its.length === 1 ? ' object' : ' objects') + '. Ctrl+V pastes.'); return true;
  }
  function pasteClip(d) {
    const cl = S.emClip; if (!cl || d.mode !== 'design' || d.kind !== 'em') return false;
    const off = 0.6 * ++cl.n, out = [];
    cl.items.forEach(src => {
      const o = clean(src), it = Object.assign(EM.create(o.type, {}), o, { id: EM.nextId(), x: o.x + off, y: o.y - off });
      it.name = nameFor(d, it.type === 'charge' && !it.fixed ? 'particle' : it.type); d.em.items.push(it); out.push(it.id);
    });
    P.selectMany(d, out); sync(d); return true;
  }
  E.dup = function (d) { if (d.mode !== 'design') return; const keep = S.emClip; if (copySel(d, true)) { S.emClip.n = 0; pasteClip(d); } S.emClip = keep; };
  E.del = function (d) {
    const its = selItems(d); if (!its.length) return; if (d.mode !== 'design') { P.flash(d, 'Switch to Design mode to delete objects.'); return; }
    const gone = new Set(its.map(i => i.id)); d.em.items = d.em.items.filter(i => !gone.has(i.id)); d.sel = null; d.ms = null; P.renderWorkspace(); P.renderProps();
  };
  function selectAll(d) { P.selectMany(d, d.em.items.map(i => i.id)); }
  function screenBoundsOf(d, it) {
    const b = EM.bounds3(it), xs = [], ys = [];
    for (const cx of [b.min.x, b.max.x]) for (const cy of [b.min.y, b.max.y]) for (const cz of [b.min.z, b.max.z]) { const s = worldToScreen(d, { x: cx, y: cy, z: cz }); xs.push(s.x); ys.push(s.y); }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  }
  function boxSelect(d, x0, y0, x1, y1, crossing) {
    const a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(y0, y1), e = Math.max(y0, y1);
    return d.em.items.filter(it => { const q = screenBoundsOf(d, it); return crossing ? !(q[2] < a || q[0] > b || q[3] < c || q[1] > e) : (q[0] >= a && q[2] <= b && q[1] >= c && q[3] <= e); }).map(i => i.id);
  }
  // dh/dv move along the active work plane's in-plane axes (arrow keys); dn moves along its normal axis
  // (PageUp/PageDown) - for 'cam' mode, which has no single world normal axis, PageUp/PageDown fall back to
  // nudging world z (xy's normal), a reasonable default since most scenes are built up mainly in z depth.
  function nudge(d, dh, dv, dn) {
    const A = axesFor(st(d).wp.axis);
    selItems(d).forEach(it => { it[A.h] += dh; it[A.v] += dv; if (dn) it[A.n] = (it[A.n] || 0) + dn; });
    P.refreshFields(true);
  }
  function turn(d, dr) {
    const dq = EM3D.Quat.fromAxisAngle(EM3D.Quat.create(), { x: 0, y: 0, z: 1 }, rad(dr));
    selItems(d).forEach(it => { if (it.rot) EM3D.Quat.multiply(it.rot, dq, it.rot); });
    P.refreshFields(true);
  }
  function arrange(d, how) {
    const its = selItems(d); if (its.length < 2 || d.mode !== 'design') return;
    const bs = its.map(it => EM.bounds3(it)), g = [Math.min(...bs.map(b => b.min.x)), Math.min(...bs.map(b => b.min.y)), Math.max(...bs.map(b => b.max.x)), Math.max(...bs.map(b => b.max.y))];
    const move = (i, dx, dy) => { its[i].x += dx; its[i].y += dy; };
    if (how === 'left') bs.forEach((b, i) => move(i, g[0] - b.min.x, 0));
    else if (how === 'right') bs.forEach((b, i) => move(i, g[2] - b.max.x, 0));
    else if (how === 'top') bs.forEach((b, i) => move(i, 0, g[3] - b.max.y));
    else if (how === 'bottom') bs.forEach((b, i) => move(i, 0, g[1] - b.min.y));
    else if (how === 'midx') bs.forEach((b, i) => move(i, (g[0] + g[2]) / 2 - (b.min.x + b.max.x) / 2, 0));
    else if (how === 'midy') bs.forEach((b, i) => move(i, 0, (g[1] + g[3]) / 2 - (b.min.y + b.max.y) / 2));
    else if (how === 'spreadx' || how === 'spready') {
      const X = how === 'spreadx', c = bs.map(b => X ? (b.min.x + b.max.x) / 2 : (b.min.y + b.max.y) / 2), order = c.map((v, i) => i).sort((p, q) => c[p] - c[q]), lo = c[order[0]], hi = c[order[order.length - 1]];
      order.forEach((i, k) => { const t = lo + (hi - lo) * k / (order.length - 1); move(i, X ? t - c[i] : 0, X ? 0 : t - c[i]); });
    }
    P.refreshFields(true);
  }
  function btnRow(box, list) {
    const r = document.createElement('div'); r.className = 'row'; r.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    list.forEach(([t, fn, tip]) => { const b = document.createElement('button'); b.className = 'btn2'; b.textContent = t; if (tip) b.title = tip; b.style.cssText = 'flex:1 1 auto;padding:6px 9px'; b.addEventListener('click', fn); r.appendChild(b); }); box.appendChild(r);
  }
  function multiProps(d, box, title, ro) {
    $('#props').classList.add('sel'); title.textContent = 'Properties: ' + d.ms.size + ' selected';
    const H = P.mkHelpers(box, ro, () => { });
    H.note('Drag any selected object to move them all across the work plane (see the Plane selector in the toolbar). Arrow keys nudge within the plane, PageUp/PageDown nudge along its normal. Shift-click adds or removes one object; shift-drag on empty space selects an area (drag right to left to take anything it touches).');
    if (ro) return;
    H.sect('Edit'); btnRow(box, [['Copy', () => copySel(d), 'Ctrl+C'], ['Cut', () => { if (copySel(d, true)) E.del(d); }, 'Ctrl+X'], ['Paste', () => pasteClip(d), 'Ctrl+V'], ['Duplicate', () => E.dup(d), 'Ctrl+D'], ['Delete', () => E.del(d), 'Del']]);
    H.sect('Align (x/y)'); btnRow(box, [['Left', () => arrange(d, 'left')], ['Centre', () => arrange(d, 'midx')], ['Right', () => arrange(d, 'right')], ['Top', () => arrange(d, 'top')], ['Middle', () => arrange(d, 'midy')], ['Bottom', () => arrange(d, 'bottom')]]);
    H.sect('Space evenly'); btnRow(box, [['Across', () => arrange(d, 'spreadx'), 'Equal gaps from left to right'], ['Down', () => arrange(d, 'spready'), 'Equal gaps from top to bottom']]);
    H.sect('Turn (about z)'); btnRow(box, [['⟲ 15°', () => turn(d, 15), '[ key'], ['⟳ 15°', () => turn(d, -15), '] key']]);
  }

  // ---------- view ----------
  E.fit = function (d) { d.cam = null; };

  // ---------- properties ----------
  function rotFields(H, it) {
    if (!it.rot) return; H.sect('Rotate');
    const euler = () => EM3D.Quat.toEuler(it.rot);
    const setAxis = (axis, v) => { const e = euler(); e[axis] = v; const q = EM3D.Quat.fromEuler(EM3D.Quat.create(), e.x, e.y, e.z); Object.assign(it.rot, q); };
    H.num('Rotate X', '°', () => euler().x, v => setAxis('x', v), { step: 5, live: true });
    H.num('Rotate Y', '°', () => euler().y, v => setAxis('y', v), { step: 5, live: true });
    H.num('Rotate Z', '°', () => euler().z, v => setAxis('z', v), { step: 5, live: true });
  }
  E.renderProps = function (d, box, title) {
    const ro = d.mode !== 'design', it = sel(d), sc = d.em;
    $('#props').classList.toggle('sel', !!it);
    if (d.ms && d.ms.size > 1) { multiProps(d, box, title, ro); return; }
    CUR = sc; const H = unitHelpers(P.mkHelpers(box, ro, () => { }), box, sc), { sect, num, check } = H;
    if (!it) { sceneProps(d, H, box, title); return; }
    title.textContent = 'Properties: ' + it.name; H.name(it, title);
    sect('Position'); num('x', 'm', () => it.x, v => { it.x = v; }); num('y', 'm', () => it.y, v => { it.y = v; }); num('z', 'm', () => it.z, v => { it.z = v; });
    const live = (fn) => { const el = document.createElement('div'); el.className = 'live'; box.appendChild(el); fn(unitHelpers(P.mkHelpers(el, true, () => { }), el, sc)); };
    switch (it.type) {
      case 'charge': {
        sect(it.fixed ? 'Source' : 'Particle');
        num('Charge q', 'C', () => it.q, v => { it.q = v; }, { step: 0.1, live: true }); num('Mass', 'kg', () => it.m, v => { it.m = v; }, { min: 0.001, step: 0.1, live: true });
        check('Fixed in place', () => it.fixed, v => { it.fixed = v; if (v) { it.vx = it.vy = it.vz = 0; it._tr = null; } }, { live: true });
        if (!it.fixed) {
          sect(ro ? 'Velocity (live)' : 'Initial velocity');
          num('vx', 'm/s', () => it.vx, v => { it.vx = v; }, { step: 0.1 }); num('vy', 'm/s', () => it.vy, v => { it.vy = v; }, { step: 0.1 }); num('vz', 'm/s', () => it.vz, v => { it.vz = v; }, { step: 0.1 });
          if (ro) live(L => {
            const g = () => EM.gyroInfo(sc, it), F = () => EM.forces(sc, it), sp = () => Math.hypot(it.vx, it.vy, it.vz);
            L.sect('Live'); L.read('Speed', 'm/s', sp); L.read('Kinetic energy', 'J', () => 0.5 * it.m * sp() * sp());
            L.read('|E| here', 'N/C', () => Math.hypot(F().Ex, F().Ey, F().Ez)); L.read('|B| here', 'T', () => g().Bmag); L.read('Potential', 'V', () => F().V);
            L.read('Electric force', 'N', () => Math.hypot(F().fex, F().fey, F().fez)); L.read('Magnetic force', 'N', () => Math.hypot(F().fmx, F().fmy, F().fmz));
            L.read('Gyroradius m v⊥ / |q B|', 'm', () => g().r); L.read('Gyro period 2π m / |q B|', 's', () => g().T); L.read('E×B drift speed', 'm/s', () => g().drift);
          });
        }
        break;
      }
      case 'emitter':
        sect('Beam');
        num('Speed', 'm/s', () => it.speed, v => { it.speed = v; }, { min: 0, step: 0.1, live: true });
        num('Rate', '1/s', () => it.rate, v => { it.rate = v; }, { min: 0, step: 1, live: true }); num('Spread (cone half-angle) ±', '°', () => it.spread, v => { it.spread = v; }, { min: 0, step: 1, live: true });
        sect('Each particle'); num('Charge q', 'C', () => it.q, v => { it.q = v; }, { step: 0.1, live: true }); num('Mass', 'kg', () => it.m, v => { it.m = v; }, { min: 0.001, step: 0.1, live: true });
        H.select('Colour', COLOURS.map(c => [c[0], c[1]]), () => it.col, v => { it.col = v; }, { live: true });
        check('Emitting', () => it.on, v => { it.on = v; }, { live: true });
        check('Particles act as charges', () => it.act !== false, v => { it.act = v; }, { live: true });
        H.note('Fires along local +x (Rotate below aims it). On: each emitted particle is a real charge and feels/pushes other charges and particles. Off: it only feels the fields. Changes apply to particles emitted from now on.');
        rotFields(H, it);
        break;
      case 'efield':
        sect('Field'); num('E', 'N/C', () => it.E, v => { it.E = v; }, { step: 0.5, live: true });
        num('Azimuth', '°', () => it.dirAz, v => { it.dirAz = v; }, { step: 15, live: true }); num('Elevation', '°', () => it.dirEl, v => { it.dirEl = v; }, { step: 15, min: -90, max: 90, live: true });
        sect('Region'); num('Width', 'm', () => it.w, v => { it.w = v; }, { min: 0.2, step: 0.25 }); num('Height', 'm', () => it.h, v => { it.h = v; }, { min: 0.2, step: 0.25 }); num('Depth', 'm', () => it.d, v => { it.d = v; }, { min: 0.2, step: 0.25 });
        H.note('Constant E inside the box, zero outside. Azimuth/elevation give the field direction in world space (0°,0° points along +x); Rotate below turns the box itself.');
        rotFields(H, it);
        break;
      case 'capacitor':
        sect('Plates'); num('Voltage V', 'V', () => it.V, v => { it.V = v; }, { step: 0.5, live: true }); num('Gap', 'm', () => it.gap, v => { it.gap = v; }, { min: 0.2, step: 0.25 });
        num('Plate width', 'm', () => it.w, v => { it.w = v; }, { min: 0.2, step: 0.25 }); num('Plate depth', 'm', () => it.d, v => { it.d = v; }, { min: 0.2, step: 0.25 });
        H.read('Field E = V / gap', 'N/C', () => it.V / it.gap);
        H.note('The +y plate (in the object frame) is at +V/2 and the −y plate at −V/2 when V is positive. Positive charges are pushed toward the −y plate. Negative V flips it.');
        rotFields(H, it);
        break;
      case 'bfield':
        sect('Field'); num('B', 'T', () => it.B, v => { it.B = v; }, { step: 0.5, live: true }); H.note('Positive B points along local +z.');
        sect('Region'); H.select('Shape', [['box', 'Box'], ['sphere', 'Sphere']], () => it.shape, v => { it.shape = v; });
        num(it.shape === 'sphere' ? 'Diameter' : 'Width', 'm', () => it.w, v => { it.w = v; }, { min: 0.2, step: 0.25 });
        if (it.shape !== 'sphere') { num('Height', 'm', () => it.h, v => { it.h = v; }, { min: 0.2, step: 0.25 }); num('Depth', 'm', () => it.d, v => { it.d = v; }, { min: 0.2, step: 0.25 }); }
        rotFields(H, it);
        break;
      case 'wire':
        sect('Current'); num('I', 'A', () => it.I, v => { it.I = v; }, { step: 1, live: true }); num('Length', 'm', () => it.len, v => { it.len = v; }, { min: 0.2, step: 0.5 });
        H.note('Straight wire; current runs along local +x (Rotate below aims it). Field circles the wire by the right-hand rule.');
        rotFields(H, it);
        break;
      case 'coil':
        sect('Current loop'); num('I', 'A', () => it.I, v => { it.I = v; }, { step: 1, live: true }); num('Radius', 'm', () => it.R, v => { it.R = v; }, { min: 0.2, step: 0.25 }); num('Turns', '', () => it.turns, v => { it.turns = Math.max(1, Math.round(v)); }, { min: 1, step: 1, live: true });
        H.read('Field at the centre', 'T', () => sc.km * 2 * Math.PI * it.I * it.turns / it.R);
        H.note('A flat loop in the local xy plane; positive current runs counter-clockwise about local +z, so the field at the centre points along local +z.');
        rotFields(H, it);
        break;
      case 'magnet':
        sect('Dipole'); num('Moment m', 'A·m²', () => it.m, v => { it.m = v; }, { step: 0.5, live: true });
        H.note('A permanent dipole; its moment points along local +z (Rotate below aims it). Field: B = kₘ[3(m̂·r̂)r̂ − m̂]|m|/r³.');
        rotFields(H, it);
        break;
      case 'screen':
        sect('Detector'); num('Width', 'm', () => it.w, v => { it.w = v; }, { min: 0.2, step: 0.25 }); num('Height', 'm', () => it.h, v => { it.h = v; }, { min: 0.2, step: 0.25 });
        H.read('Hits recorded', '', () => (it._hits || []).length);
        H.note('A plane facing local +z. A particle that crosses it stops and its hit position is recorded (feeds a mass-spectrometer-style hit pattern).');
        rotFields(H, it);
        break;
      case 'wall':
        sect('Absorber'); num('Width', 'm', () => it.w, v => { it.w = v; }, { min: 0.2, step: 0.25 }); num('Height', 'm', () => it.h, v => { it.h = v; }, { min: 0.2, step: 0.25 });
        H.note('A plane facing local +z. A particle that crosses it is removed from the simulation.');
        rotFields(H, it);
        break;
      case 'probe': {
        sect('Field probe');
        const f = () => EM.sample(sc, { x: it.x, y: it.y, z: it.z });
        H.read('|E| here', 'N/C', () => Math.hypot(f().Ex, f().Ey, f().Ez)); H.read('|B| here', 'T', () => Math.hypot(f().Bx, f().By, f().Bz)); H.read('Potential', 'V', () => f().V);
        H.note('A fixed point that reads the field there, live, in either mode.');
        break;
      }
    }
  };
  function sceneProps(d, H, box, title) {
    const sc = d.em, ro = d.mode !== 'design'; title.textContent = 'Properties'; CUR = sc;
    H.sect('Scene');
    const uopts = [['abstract', 'Abstract']].concat(EM.UNIT_SETS.map(q => [q.id, q.name]), [['custom', 'Custom units']]);
    const cur = () => { if (!sc.units) return 'abstract'; const m = EM.UNIT_SETS.find(q => q.u.L === sc.units.L && q.u.Q === sc.units.Q && q.u.M === sc.units.M && q.u.T === sc.units.T); return m ? m.id : 'custom'; };
    H.select('Workspace units', uopts, cur, v => {
      if (v === 'abstract') { sc.units = null; sc.k = 1; sc.km = 1; }
      else if (v === 'custom') { if (!sc.units) sc.units = Object.assign({}, EM.UNIT_SETS[0].u); }
      else sc.units = Object.assign({}, EM.UNIT_SETS.find(q => q.id === v).u);
      EM.applyUnits(sc); E.gridLabels(d); d.cam = null;
    }, { live: !ro, tip: 'Picks the real-world unit scale for this scene (e.g. volts and meters) instead of plain abstract numbers. Changing it rescales the workspace but keeps every object\'s size and speed consistent.' });
    H.note('Switching units keeps every number in the scene and rescales the workspace, so objects keep their size and speed in workspace units.');
    if (!sc.units) {
      H.num('Coulomb k', 'N·m²/C²', () => sc.k, v => { sc.k = v; }, { min: 0, step: 0.5, live: true }); H.num('μ₀ / 4π', 'T·m/A', () => sc.km, v => { sc.km = v; }, { min: 0, step: 0.5, live: true });
      H.note('Abstract units: the constants are scaled to k = 1 and μ₀/4π = 1 so that charges of a coulomb and fields of a tesla behave visibly. Choose units above to keep the real constants and scale the workspace instead.');
    } else {
      const u = sc.units, ua = () => EM.applyUnits(sc);
      H.sect('One workspace unit is');
      siInput(box, ro, 'Length', 'm', () => u.L, v => { u.L = v; }, { min: 1e-18, after: ua, live: false });
      siInput(box, ro, 'Charge', 'C', () => u.Q, v => { u.Q = v; }, { min: 1e-30, after: ua, live: false });
      siInput(box, ro, 'Mass', 'kg', () => u.M, v => { u.M = v; }, { min: 1e-40, after: ua, live: false });
      siInput(box, ro, 'Time', 's', () => u.T, v => { u.T = v; }, { min: 1e-21, after: ua, live: false });
      H.sect('Constants (real SI)');
      siInput(box, true, 'Coulomb k', 'N·m²/C²', () => EM.K_SI, () => { }, { ro: true }); siInput(box, true, 'μ₀ / 4π', 'T·m/A', () => EM.KM_SI, () => { }, { ro: true });
      const num = (l, g) => { const row = document.createElement('div'); row.className = 'row'; const lb = document.createElement('label'); lb.textContent = l; row.appendChild(lb); const i = document.createElement('input'); i.type = 'text'; i.readOnly = true; i.value = g().toExponential(3); i.style.textAlign = 'right'; i.style.fontFamily = 'var(--mono)'; row.appendChild(i); box.appendChild(row); };
      num('k in workspace units', () => sc.k); num('μ₀/4π in workspace units', () => sc.km);
      H.note('The constants are the real ones; what is scaled is the workspace. Positions, charges, masses and times you type, and every reading, are real SI values (use prefixes: 1.5 cm, 5 nC, 50 mT). The engine works in these workspace units, where the equations take the same form with the two constants above.');
      siInput(box, true, 'Speed of 1 unit/unit', 'm/s', () => EM.unitScale(u).v, () => { }, { ro: true });
      H.note('One second on screen is one workspace time unit (' + fmtSI(u.T, 's') + ' of simulated time). The Speed control scales that.');
    }
    H.num('Softening', 'm', () => sc.soft, v => { sc.soft = v; }, { min: 0.005, step: 0.01, live: true });
    H.check('Free charges push each other', () => sc.mutual, v => { sc.mutual = v; }, { live: true });
    if (ro) { H.sect('Totals'); const En = () => EM.energy(sc); H.read('Particles', '', () => EM.particles(sc).length); H.read('Kinetic energy', 'J', () => En().ke); H.read('Electric PE', 'J', () => En().pe); H.read('Total', 'J', () => En().total); }
    if (!ro) {
      H.sect('Examples');
      EM.PRESETS.forEach(pr => H.button(pr.name, () => loadPreset(d, pr)));
      H.note('Loading an example replaces the scene. Undo brings the old one back.');
    } else H.note('Examples can be loaded from Design mode.');
    H.sect('View'); H.button('Fit view', () => { d.cam = null; });
    H.sect('Tips');
    H.note('Select an object to edit it. Left-drag to select or move, right-drag to orbit, wheel to zoom. In Simulate, drag any object to move it (on the z=0 plane), or use Probe to launch test particles.');
  }
  function loadPreset(d, pr) {
    P.checkpoint(d); d.em = EM.createScene(); const o = pr.build(d.em) || {}, A = st(d);
    if (o.trails != null) { S.trails = !!o.trails; $('#trailBtn').setAttribute('aria-pressed', S.trails); }
    d.title = d.title.replace(/^E&M: .*/, 'E&M: ' + pr.name); d.counts = {}; d.sel = null; d.ms = null; d.cam = null; d.playing = false; d.emSaved = null;
    P.applyMode(); P.renderTabs(); P.renderWorkspace(); P.renderProps(); P.flash(d, pr.note); P.checkpoint(d);
  }

  // ---------- pointer ----------
  let drag = null, mouse = { px: 0, py: 0, in: false }, spaceDown = false;
  const probeQ = () => parseFloat($('#emPq').value) || 1, probeM = () => Math.max(0.001, parseFloat($('#emPm').value) || 1);

  function showBoxDom(x0, y0, x1, y1) {
    const x = Math.min(x0, x1), y = Math.min(y0, y1); emBoxSel.style.left = x + 'px'; emBoxSel.style.top = y + 'px';
    emBoxSel.style.width = Math.abs(x1 - x0) + 'px'; emBoxSel.style.height = Math.abs(y1 - y0) + 'px'; emBoxSel.hidden = false;
  }
  function hideBoxDom() { emBoxSel.hidden = true; }

  cvEm.addEventListener('pointerdown', e => {
    const d = P.cur; if (!d || d.kind !== 'em') return; P.closeMenus();
    const p = P.posOf(e); cvEm.setPointerCapture(e.pointerId); mouse = { px: p.x, py: p.y, in: true };
    const cam = camMat(d), wp = planeOf(d, cam), A = axesFor(st(d).wp.axis);
    if (e.button === 2 || e.button === 1 || spaceDown) {
      drag = { type: (e.shiftKey || e.button === 1) ? 'camPan' : 'camOrbit', x: p.x, y: p.y, cam0: Object.assign({}, camOf(d)), target0: Object.assign({}, camOf(d).target), view: cam.view };
      cvEm.classList.add('panning'); return;
    }
    if (e.button !== 0) return;
    if (d.ruler) { const w = rayPlane(cam, p, wp), q = d.mode === 'design' ? snapPt(d, w) : w; st(d).ruler = { x0: q.x, y0: q.y, z0: q.z, x1: q.x, y1: q.y, z1: q.z, plane: wp }; drag = { type: 'ruler' }; return; }
    if (d.mode === 'design' && d.tool) { place(d, rayPlane(cam, p, wp), e); return; }
    if (d.mode !== 'design' && d.probe) { const w = rayPlane(cam, p, wp); drag = { type: 'probe', plane: wp, x0: w.x, y0: w.y, z0: w.z, x1: w.x, y1: w.y, z1: w.z }; return; }
    const hit = pickAt(d, cam, p, 0.15);
    if (d.mode === 'design') {
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (additive && hit) { P.toggleSel(d, hit.id); return; }
      if (additive) { drag = { type: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y, base: P.selIds(d) }; showBoxDom(p.x, p.y, p.x, p.y); return; }
      if (hit && d.ms && d.ms.has(hit.id)) {
        const plane = planeThrough(wp, hit), w = rayPlane(cam, p, plane);
        drag = { type: 'gmove', plane, items: selItems(d).map(it => ({ it, dh: it[A.h] - w[A.h], dv: it[A.v] - w[A.v] })) };
        return;
      }
    }
    if (hit) {
      P.select(hit.id);
      const held = hit.type === 'charge' && !hit.fixed && d.mode !== 'design';
      if (held) { hit._held = true; hit.vx = 0; hit.vy = 0; hit.vz = 0; hit._tr = null; }
      const plane = planeThrough(wp, hit), w = rayPlane(cam, p, plane);
      drag = { type: 'move', it: hit, plane, dh: hit[A.h] - w[A.h], dv: hit[A.v] - w[A.v], held };
    } else {
      if (d.sel != null || d.ms) P.select(null);
      if (d.mode === 'design') { drag = { type: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y, base: [] }; showBoxDom(p.x, p.y, p.x, p.y); }
    }
  });
  cvEm.addEventListener('pointermove', e => {
    const d = P.cur; if (!d || d.kind !== 'em') return; const p = P.posOf(e); mouse = { px: p.x, py: p.y, in: true };
    if (!drag) return;
    if (drag.type === 'camOrbit') {
      d.cam.yaw = drag.cam0.yaw - (p.x - drag.x) * 0.008; d.cam.pitch = clamp(drag.cam0.pitch - (p.y - drag.y) * 0.008, -1.5, 1.5);
    } else if (drag.type === 'camPan') {
      const right = { x: drag.view[0], y: drag.view[4], z: drag.view[8] }, up = { x: drag.view[1], y: drag.view[5], z: drag.view[9] };
      const k = drag.cam0.dist * 0.0016, dx = p.x - drag.x, dy = p.y - drag.y;
      d.cam.target = { x: drag.target0.x - right.x * dx * k + up.x * dy * k, y: drag.target0.y - right.y * dx * k + up.y * dy * k, z: drag.target0.z - right.z * dx * k + up.z * dy * k };
    } else if (drag.type === 'move') {
      const A = axesFor(st(d).wp.axis), w = rayPlane(camMat(d), p, drag.plane), q = d.mode === 'design' ? snapPt(d, w) : w;
      drag.it[A.h] = q[A.h]; drag.it[A.v] = q[A.v]; P.refreshFields();
    } else if (drag.type === 'gmove') {
      const A = axesFor(st(d).wp.axis), w = rayPlane(camMat(d), p, drag.plane), f = drag.items[0];
      const raw = Object.assign({}, w); raw[A.h] = w[A.h] + f.dh; raw[A.v] = w[A.v] + f.dv;
      const q = snapPt(d, raw), eh = q[A.h] - raw[A.h], ev = q[A.v] - raw[A.v];
      drag.items.forEach(m => { m.it[A.h] = w[A.h] + m.dh + eh; m.it[A.v] = w[A.v] + m.dv + ev; }); P.refreshFields();
    } else if (drag.type === 'box') { drag.x1 = p.x; drag.y1 = p.y; showBoxDom(drag.x0, drag.y0, drag.x1, drag.y1); }
    else if (drag.type === 'ruler') { const r = st(d).ruler; if (r) { const w = rayPlane(camMat(d), p, r.plane), q = d.mode === 'design' ? snapPt(d, w) : w; r.x1 = q.x; r.y1 = q.y; r.z1 = q.z; } }
    else if (drag.type === 'probe') { const w = rayPlane(camMat(d), p, drag.plane); drag.x1 = w.x; drag.y1 = w.y; drag.z1 = w.z; }
  });
  const endDrag = () => {
    const d = P.cur;
    if (drag && drag.type === 'move' && drag.held) drag.it._held = false;
    if (drag && drag.type === 'box' && d && d.kind === 'em') {
      if (Math.hypot(drag.x1 - drag.x0, drag.y1 - drag.y0) > 4) P.selectMany(d, drag.base.concat(boxSelect(d, drag.x0, drag.y0, drag.x1, drag.y1, drag.x1 < drag.x0)));
      hideBoxDom();
    }
    if (drag && drag.type === 'probe' && d && d.kind === 'em') {
      const dx = drag.x1 - drag.x0, dy = drag.y1 - drag.y0, dz = drag.z1 - drag.z0, k = 2;
      if (d.em.beam.length < d.em.cap) d.em.beam.push({ x: drag.x0, y: drag.y0, z: drag.z0, vx: dx * k, vy: dy * k, vz: dz * k, q: probeQ(), m: probeM(), age: 0, beam: true, col: probeQ() < 0 ? '#2f6fd6' : '#d9483b', probe: true });
      if (!d.playing) { d.playing = true; P.updatePlayBtn(); }
    }
    drag = null; cvEm.classList.remove('panning'); P.refreshFields(true);
  };
  cvEm.addEventListener('pointerup', endDrag); cvEm.addEventListener('pointercancel', endDrag);
  cvEm.addEventListener('pointerleave', () => { mouse.in = false; });
  cvEm.addEventListener('wheel', e => {
    const d = P.cur; if (!d || d.kind !== 'em') return; e.preventDefault();
    const cam = camOf(d), f = Math.exp(-e.deltaY * 0.0015); cam.dist = clamp(cam.dist * f, 0.5, 400);
  }, { passive: false });
  cvEm.addEventListener('contextmenu', e => { if (P.cur.kind === 'em') e.preventDefault(); });

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    const d = P.cur; if (!d || d.kind !== 'em') return;
    if (e.ctrlKey || e.metaKey) {
      const k = e.key.toLowerCase();
      if (k === 'z') { P.undoRedo(d, e.shiftKey ? 1 : -1); e.preventDefault(); } else if (k === 'y') { P.undoRedo(d, 1); e.preventDefault(); }
      else if (k === 'd') { E.dup(d); e.preventDefault(); }
      else if (k === 'c') { copySel(d); e.preventDefault(); }
      else if (k === 'x') { if (copySel(d, true)) E.del(d); e.preventDefault(); }
      else if (k === 'v') { pasteClip(d); e.preventDefault(); }
      else if (k === 'a' && d.mode === 'design') { selectAll(d); e.preventDefault(); }
      return;
    }
    if (e.key === ' ') { spaceDown = true; if (d.mode !== 'design') { d.playing = !d.playing; P.updatePlayBtn(); } e.preventDefault(); }
    else if (e.key === '1') P.setMode('design'); else if (e.key === '2') P.setMode('sim'); else if (e.key === '3') P.setMode('render');
    else if (e.key === 'r' || e.key === 'R') E.reset(d);
    else if (e.key === 'Escape') { if (st(d).ruler) st(d).ruler = null; else if (!d.tool && !d.probe && !d.ruler && (d.sel != null || d.ms)) P.select(null); d.tool = null; d.probe = false; d.ruler = false; sync(d); P.updateHint(); P.closeMenus(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') E.del(d);
    else if ((e.key === '[' || e.key === ']') && d.mode === 'design') turn(d, e.key === ']' ? -15 : 15);
    else if (e.key.startsWith('Arrow') && d.mode === 'design' && !d.tool && selItems(d).length) {
      const st0 = (S.snap ? S.grid : 0.1) * (e.shiftKey ? 4 : 1), dx = e.key === 'ArrowLeft' ? -st0 : e.key === 'ArrowRight' ? st0 : 0, dy = e.key === 'ArrowDown' ? -st0 : e.key === 'ArrowUp' ? st0 : 0;
      nudge(d, dx, dy, 0); e.preventDefault();
    } else if ((e.key === 'PageUp' || e.key === 'PageDown') && d.mode === 'design') {
      const st0 = (S.snap ? S.grid : 0.1) * (e.shiftKey ? 4 : 1), delta = e.key === 'PageUp' ? st0 : -st0;
      if (d.tool) { st(d).wp.off += delta; e.preventDefault(); }
      else if (selItems(d).length) { nudge(d, 0, 0, delta); e.preventDefault(); }
    }
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') spaceDown = false; });

  // ---------- frame ----------
  // Physics stepping is the real 3D engine (A2). The renderer (ui_em3d.js, A3) draws the scene plus a
  // persisted per-doc orbit camera, selection highlight, the ruler and a placement ghost (all A4).
  E.frame = function (d, dt) {
    CUR = d.em; const A = st(d);
    if (d.playing && d.mode !== 'design') {
      A.acc += dt * S.speed; let n = 0;
      while (A.acc >= EM.DT && n < 30) { EM.step(d.em, EM.DT); A.acc -= EM.DT; n++; }
      if (n >= 30) A.acc = 0;
      P.refreshFields();
    }
    try {
      if (!gl3dReady) gl3dReady = !!(window.EM3DGL && cvEm && EM3DGL.init(cvEm));
      if (!gl3dReady) throw new Error('E&M 3D renderer unavailable');
      // Keeps the renderer's aspect ratio in sync with the actual canvas every frame - cheap, and more
      // reliable than depending solely on a ResizeObserver callback firing before the first render (it can
      // otherwise stay on the renderer's hardcoded fallback size, distorting the projection and every
      // world<->screen conversion derived from it).
      { const sz = P.size; EM3DGL.resize(sz.cw, sz.ch, sz.dpr); }
      const cam = camOf(d), selectedIds = new Set(P.selIds(d)), r = st(d).ruler, extraLines = [];
      if (r) extraLines.push({ a: { x: r.x0, y: r.y0, z: r.z0 }, b: { x: r.x1, y: r.y1, z: r.z1 }, color: [0.96, 0.6, 0.2, 1] });
      if (st(d).opts.lines) extraLines.push.apply(extraLines, fieldLineSegs(d));
      let ghost = null;
      if (d.mode === 'design' && d.tool && mouse.in) { const cm = camMat(d), w = rayPlane(cm, { x: mouse.px, y: mouse.py }, planeOf(d, cm)), q = snapPt(d, w); ghost = make(d.tool, q.x, q.y, q.z); }
      if (!window.EM3DGL.render(d.em, { camState: cam, selectedIds, extraLines, ghost, colorBySpecies: st(d).opts.species, workPlane: planeOf(d, camMat(d)), showRegions: st(d).opts.regions })) throw new Error('render failed');
      if (emFallback) emFallback.hidden = true;
      if (r) { const mid = { x: (r.x0 + r.x1) / 2, y: (r.y0 + r.y1) / 2, z: (r.z0 + r.z1) / 2 }, s = worldToScreen(d, mid), L = Math.hypot(r.x1 - r.x0, r.y1 - r.y0, r.z1 - r.z0), un = sc_();
        emRulerLabel.style.left = s.x + 'px'; emRulerLabel.style.top = (s.y - 10) + 'px';
        emRulerLabel.textContent = (un ? fmtSI(L * un.L, 'm') : L.toFixed(3) + ' m'); emRulerLabel.hidden = false;
      } else emRulerLabel.hidden = true;
    } catch (e) {
      console.error('[E&M] 3D renderer not ready yet:', e);
      if (emFallback) emFallback.hidden = false; emRulerLabel.hidden = true;
    }
    overlays(d);
  };

  // ---------- overlays ----------
  const num = (x, n) => { const a = Math.abs(x); return a === 0 ? '0' : (a >= 1e4 || a < 1e-2) ? x.toExponential(1) : x.toFixed(n == null ? (a >= 100 ? 0 : a >= 10 ? 1 : 2) : n); };
  function overlays(d) {
    CUR = d.em; const un = sc_();
    if (mouse.in) {
      const cm = camMat(d), w = rayPlane(cm, { x: mouse.px, y: mouse.py }, planeOf(d, cm)), f = EM.sample(d.em, w), E_ = Math.hypot(f.Ex, f.Ey, f.Ez), B_ = Math.hypot(f.Bx, f.By, f.Bz);
      $('#coords').textContent = (un ? 'x ' + fmtSI(w.x * un.L, 'm') + '  y ' + fmtSI(w.y * un.L, 'm') + '  z ' + fmtSI(w.z * un.L, 'm') : 'x ' + w.x.toFixed(2) + '  y ' + w.y.toFixed(2) + '  z ' + w.z.toFixed(2) + ' m') + ' (' + PLANE_LABEL[st(d).wp.axis] + ' plane)\n|E| ' + (un ? fmtSI(E_ * un.E, 'V/m') : num(E_) + ' N/C') + '  |B| ' + (un ? fmtSI(B_ * un.B, 'T') : num(B_) + ' T') + '  V ' + (un ? fmtSI(f.V * un.V, 'V') : num(f.V) + ' V');
    } else $('#coords').textContent = '';
    $('#zoomTxt').textContent = 'drag to orbit · wheel to zoom';
    const n = d.em.items.length;
    if (d.mode === 'design') $('#status').textContent = 'Design · ' + n + (n === 1 ? ' object' : ' objects') + ' · snap ' + (S.snap ? (un ? fmtSI(S.grid * un.L, 'm') : S.grid + ' m') : 'off');
    else { const En = EM.energy(d.em); $('#status').textContent = (d.playing ? 'Running' : 'Paused') + ' · t ' + (un ? fmtSI(d.em.t * un.T, 's') : d.em.t.toFixed(2) + ' s') + ' · ' + EM.particles(d.em).length + ' particles · KE ' + (un ? fmtSI(En.ke * un.U, 'J') : num(En.ke) + ' J') + ' · PE ' + (un ? fmtSI(En.pe * un.U, 'J') : num(En.pe) + ' J') + (un ? ' · 1 s on screen = ' + fmtSI(un.T * S.speed, 's') : ''); }
  }

  // ---------- boot ----------
  P.applyMode(); P.renderTabs(); P.renderWorkspace(); P.renderProps();
})();
