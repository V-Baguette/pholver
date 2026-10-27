// Pholver circuit interface. Loaded after ui.js; it adds the circuit toolbar, schematic editor, scope and field panel for 'ckt' documents.
(function () {
  'use strict';
  const P = window.__pholver, CKT = window.CKT; if (!P || !CKT) return;
  const $ = s => document.querySelector(s), S = P.S, cv = P.cv, ctx = P.ctx, ic = P.ic, app = $('#app'), stage = $('#stage');
  const TAU = Math.PI * 2, clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sx = (v, x) => v.ox + x * v.s, sy = (v, y) => v.oy - y * v.s;
  const DOCK_H = 226;
  const themeRGBA = (name, a) => { const hex = P.themeColor(name).replace('#', ''), n = parseInt(hex, 16); return 'rgba(' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',') + ',' + a + ')'; };

  // ---------- numbers with SI prefixes ----------
  const PRE = [[1e12, 'T'], [1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p'], [1e-15, 'f']];
  function fmtSI(x, unit, digits) {
    unit = unit || ''; digits = digits || 3; if (!isFinite(x)) return '–';
    const a = Math.abs(x); if (a < 1e-18) return '0 ' + unit;
    let p = PRE[PRE.length - 1]; for (const q of PRE) if (a >= q[0] * 0.9995) { p = q; break; }
    const q = x / p[0]; let s = Math.abs(q) >= Math.pow(10, digits) ? String(Math.round(q)) : q.toPrecision(digits); if (s.indexOf('e') < 0 && s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
    return s + ' ' + p[1] + unit;
  }
  const fmtArea = a => a >= 1 ? +a.toPrecision(3) + ' m²' : a >= 1e-4 ? +(a * 1e4).toPrecision(3) + ' cm²' : +(a * 1e6).toPrecision(3) + ' mm²';
  function parseSI(str) {
    const m = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*(meg|[TGMkKmuµnpf])?/i.exec(String(str).replace(',', '.')); if (!m) return NaN;
    let v = parseFloat(m[1]), s = m[2]; if (s) { if (/^meg$/i.test(s)) v *= 1e6; else { const f = { T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3, m: 1e-3, u: 1e-6, 'µ': 1e-6, n: 1e-9, p: 1e-12, f: 1e-15 }[s]; v *= f; } }
    return v;
  }
  const niceMax = v => { if (!(v > 0)) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; };

  // ---------- icons ----------
  Object.assign(P.ICON, {
    circuit: '<rect x="3.500" y="5" width="17" height="14" rx="2.500"/><path d="M3.500 12h4l1.500-3.500 3 7 1.500-3.500h7"/>',
    res: '<path d="M2 12h4l2-5 3 10 3-10 3 10 2-5h3"/>',
    cap: '<path d="M2 12h8M14 12h8M10 5v14M14 5v14"/>',
    ind: '<path d="M2 15h2c0-7 5-7 5 0 0-7 5-7 5 0 0-7 5-7 5 0h3"/>',
    vsrc: '<path d="M2 12h7M15 12h7M9 8v8M15 4.500v15"/>',
    acsrc: '<circle cx="12" cy="12" r="7"/><path d="M7.500 12c1.500-4 3-4 4.500 0s3 4 4.500 0"/>',
    isrc: '<circle cx="12" cy="12" r="7"/><path d="M7.500 12h9M13.500 8.500L17 12l-3.500 3.500"/>',
    sw: '<path d="M2 16h6M16 16h6M8 16l8-7"/><circle cx="8" cy="16" r="1.200" fill="currentColor"/><circle cx="16" cy="16" r="1.200" fill="currentColor"/>',
    lamp: '<circle cx="12" cy="12" r="7"/><path d="M7 7l10 10M17 7L7 17"/>',
    gnd: '<path d="M12 4v8M5 12h14M8 16h8M10.500 20h3"/>',
    diode: '<path d="M2 12h7M15 12h7M9 6.500v11l6-5.500zM15 6.500v11"/>',
    led: '<path d="M2 14h6M16 14h6M8 8.500v11l6-5.500zM14 8.500v11M12 7l3-3M15.500 8l3-3"/>',
    zener: '<path d="M2 12h7M15 12h7M9 6.500v11l6-5.500zM13.500 7.500l1.500-1.200v11.400l1.500-1.200"/>',
    npn: '<path d="M2 12h6M8 6v12M8 10l8-5h6M8 14l8 5h6M12.500 17.600l3 1.200-1-2.800"/>',
    pnp: '<path d="M2 12h6M8 6v12M8 10l8-5h6M8 14l8 5h6M11 15.200l-1.800-.6.600 1.800"/>',
    nmos: '<path d="M2 12h5M7 6v12M10 6.500v3M10 10.500v3M10 14.500v3M10 8h7V4h5M10 16h7v4h5M10 12h7v4"/>',
    pmos: '<path d="M2 12h5M7 6v12M10 6.500v3M10 10.500v3M10 14.500v3M10 8h7V4h5M10 16h7v4h5M10 12h7v4M13 12l-2.500 0"/>',
    opamp: '<path d="M2 8h5M2 16h5M7 4v16l14-8zM21 12h1M9.500 8h2M10.500 7v2M9.500 16h2"/>',
    ckwire: '<path d="M3 18h7V6h11"/><circle cx="3" cy="18" r="1.400" fill="currentColor"/><circle cx="21" cy="6" r="1.400" fill="currentColor"/>',
    rotate: '<path d="M20 12a8 8 0 1 1-2.500-5.800M20 4v5h-5"/>',
    flow: '<circle cx="4.500" cy="12" r="1.700" fill="currentColor"/><circle cx="12" cy="12" r="1.700" fill="currentColor"/><circle cx="19.500" cy="12" r="1.700" fill="currentColor"/>',
    volts: '<path d="M3 19L9 5l4 9 3-5 5 10"/>'
  });
  const PARTS = [['vsrc', 'Battery', 'Fixed voltage'], ['acsrc', 'AC source', 'Sine wave'], ['isrc', 'Current source', 'Fixed current'], ['res', 'Resistor', 'Ohm\'s law'], ['lamp', 'Lamp', 'Glows with power'], ['cap', 'Capacitor', 'Stores E field'], ['ind', 'Inductor', 'Stores B field'], ['sw', 'Switch', 'Click to toggle'], ['gnd', 'Ground', '0 V reference'], ['diode', 'Diode', 'One-way valve'], ['led', 'LED', 'Glows when forward'], ['zener', 'Zener diode', 'Holds a voltage'], ['npn', 'NPN transistor', 'Current amplifier'], ['pnp', 'PNP transistor', 'Current amplifier'], ['nmos', 'N-MOSFET', 'Voltage-controlled switch'], ['pmos', 'P-MOSFET', 'Voltage-controlled switch'], ['opamp', 'Op-amp', 'High-gain amplifier']];
  const LEDHEX = { red: '#ff3b30', orange: '#ff9500', yellow: '#ffd60a', green: '#34c759', blue: '#3a86ff', white: '#f2f2f2' };
  const PNAME = {}; PARTS.forEach(p => { PNAME[p[0]] = p[1]; }); PNAME.wire = 'Wire';

  // ---------- toolbar ----------
  const toolbar = $('#toolbar');
  const html = (tag, attrs, inner) => { const e = document.createElement(tag); Object.keys(attrs || {}).forEach(k => e.setAttribute(k, attrs[k])); e.innerHTML = inner || ''; return e; };
  const btn = (id, icon, label, title, modes, pressed) => { const b = html('button', { class: 'tb', id, 'data-kind': 'ckt', 'data-modes': modes, title }, ic(icon) + label); if (pressed != null) b.setAttribute('aria-pressed', pressed); b.style.display = ''; return b; };
  const sep = modes => html('span', { class: 'sep', 'data-kind': 'ckt', 'data-modes': modes });
  const field = (label, inner, modes, id, tip) => { const a = { class: 'tbfield', 'data-kind': 'ckt', 'data-modes': modes, id: id || '' }; if (tip) a['data-tip'] = tip; return html('label', a, label + inner); };
  document.head.appendChild(html('style', {}, `
    #cktTray { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px; min-width: 470px; max-height: 76vh; overflow-y: auto; }
    #cktTray[hidden] { display: none; }
    #cktTray button { flex-direction: column; align-items: center; gap: 3px; padding: 10px 6px; font-size: 13px; text-align: center; border-radius: var(--r-3); }
    #cktTray button svg { width: 32px; height: 32px; }
    #cktTray .sub { font-size: 10.5px; }
    #cktDock { position: absolute; left: 10px; right: 10px; bottom: 10px; height: ${DOCK_H}px; display: flex; gap: 10px; pointer-events: none; }
    #cktDock[hidden] { display: none; }
    #cktDock canvas { pointer-events: auto; display: block; border-radius: var(--r-4); box-shadow: 0 2px 8px rgba(20, 32, 42, .25); min-width: 0; }
    #cktScope { flex: 1.15 1 0; width: 0; height: 100%; }
    #cktField { flex: 1 1 0; width: 0; height: 100%; }
    #app[data-kind="ckt"] #scale { display: none; }
    #app[data-kind="ckt"]:not([data-mode="design"]) #status { bottom: ${DOCK_H + 18}px; }
    #app[data-kind="ckt"]:not([data-mode="design"]) #ws { max-height: calc(100% - ${DOCK_H + 66}px); }
    #app[data-kind="ckt"]:not([data-mode="design"]) #props { max-height: calc(100% - ${DOCK_H + 26}px); }
    #app[data-kind="ckt"][data-mode="design"] #props { max-height: calc(100% - 70px); }
    .row.si input[type=text] { font-family: var(--mono); text-align: right; }
    @media (max-width: 760px) { #cktDock { flex-direction: column; height: ${DOCK_H + 90}px; } #cktDock canvas { width: 100% !important; flex: 1 1 0; height: 0; } }
  `));
  const tray = html('div', { class: 'menu', id: 'cktTray', hidden: '', role: 'menu' }, PARTS.map(t => '<button role="menuitem" data-t="' + t[0] + '">' + ic(t[0]) + '<span>' + t[1] + '<span class="sub">' + t[2] + '</span></span></button>').join(''));
  app.appendChild(tray);
  const addBtn = btn('ckAdd', 'objects', 'Add', 'Add a battery, resistor, capacitor, inductor or other part', 'design'); addBtn.setAttribute('aria-haspopup', 'menu');
  const wireBtn = btn('ckWire', 'ckwire', 'Wire', 'Draw wires: click to start, click again for each corner, Esc or double-click to finish', 'design');
  const rotBtn = btn('ckRot', 'rotate', 'Rotate', 'Rotate the selected part, or the part you are about to place (R)', 'design');
  toolbar.insertBefore(addBtn, $('#selBtn')); addBtn.after(wireBtn);
  $('#delBtn').after(rotBtn, sep('design'));
  const flowBtn = btn('ckFlow', 'flow', 'Current', 'Moving dots show the conventional current in the wires', 'sim render', true);
  const voltBtn = btn('ckVolts', 'volts', 'Voltage', 'Colour the wires by their potential (red high, blue low)', 'sim render', true);
  const scaleF = field('Time scale', '<input id="ckScale" type="text" value="1 s/s">', 'sim render', 'ckScaleF', 'Simulated seconds per real second');
  const autoBtn = btn('ckAuto', 'reset', 'Auto', 'Pick a time scale that suits the circuit', 'sim render');
  $('#resetBtn').after(sep('sim render'), flowBtn, voltBtn, scaleF, autoBtn);

  // dock: scope and field panel
  const dock = html('div', { id: 'cktDock', 'data-kind': 'ckt', 'data-modes': 'sim render', hidden: '' }, '<canvas id="cktScope"></canvas><canvas id="cktField"></canvas>');
  stage.appendChild(dock);
  const scopeCv = $('#cktScope'), fieldCv = $('#cktField'), scopeX = scopeCv.getContext('2d'), fieldX = fieldCv.getContext('2d');
  function sizeDock() { [scopeCv, fieldCv].forEach(c => { const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, w = Math.max(10, Math.round(r.width * dpr)), h = Math.max(10, Math.round(r.height * dpr)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } c._w = r.width; c._h = r.height; c._dpr = dpr; }); }
  new ResizeObserver(sizeDock).observe(dock);

  // ---------- per-document state ----------
  const st = d => d.cs || (d.cs = { opts: { flow: true, volts: true }, acc: 0, hist: { t: [], v: {}, i: {} }, flow: null, flowSig: '', clip: null });
  const sel = d => d.sel != null ? d.ck.items.find(i => i.id === d.sel) || null : null;
  const toW = (d, px, py) => ({ x: (px - d.view.ox) / d.view.s, y: (d.view.oy - py) / d.view.s });
  const snapG = w => ({ x: Math.round(w.x), y: Math.round(w.y) });
  const size = () => P.size;
  const nameFor = (d, type) => { d.counts = d.counts || {}; const k = 'ck_' + type; d.counts[k] = (d.counts[k] || 0) + 1; return PNAME[type] + ' ' + d.counts[k]; };
  const valueText = it => {
    switch (it.type) {
      case 'vsrc': return fmtSI(it.V, 'V'); case 'acsrc': return fmtSI(it.A, 'V') + ' ∿ ' + fmtSI(it.f, 'Hz'); case 'isrc': return fmtSI(it.I, 'A');
      case 'res': case 'lamp': return fmtSI(it.R, 'Ω'); case 'cap': return fmtSI(it.C, 'F'); case 'ind': return fmtSI(it.L, 'H'); case 'sw': return it.closed ? 'closed' : 'open'; case 'led': return it.col || 'red'; case 'zener': return fmtSI(it.Vz, 'V'); case 'npn': case 'pnp': return 'β ' + fmtSI(it.bf, ''); case 'nmos': case 'pmos': return 'Vt ' + fmtSI(it.Vt, 'V'); case 'opamp': return '±' + fmtSI(it.Vr, 'V'); default: return '';
    }
  };

  // ---------- tools ----------
  function setTool(d, t) { if (d.mode !== 'design') return; d.tool = d.tool === t ? null : t; d.wireFrom = null; P.closeMenus(); P.updateHint(); sync(d); }
  function place(d, w, e) {
    const q = snapG(w), it = CKT.create(d.tool, { x: q.x, y: q.y, rot: d.rotNew || 0 }); it.name = nameFor(d, it.type);
    d.ck.items.push(it); if (!e.shiftKey) d.tool = null; P.select(it.id); P.updateHint(); sync(d);
  }
  function addWire(d, from, to) {
    const mid = from.x !== to.x && from.y !== to.y ? { x: to.x, y: from.y } : null, segs = mid ? [[from, mid], [mid, to]] : [[from, to]];
    let hid = null;
    segs.forEach(s => {
      if (s[0].x === s[1].x && s[0].y === s[1].y) return;
      const ov = CKT.across(d.ck, s[0].x, s[0].y, s[1].x, s[1].y); if (ov) { hid = ov; return; }
      d.ck.items.push(CKT.wire(s[0].x, s[0].y, s[1].x, s[1].y));
    });
    if (hid) P.flash(d, 'A wire cannot run across ' + hid.name + ' because that would short it out. Connect to each end of the part separately.');
  }
  addBtn.addEventListener('click', e => { e.stopPropagation(); const open = !tray.hidden; P.closeMenus(); if (!open) { P.placeMenu(tray, addBtn, 480); tray.hidden = false; } });
  tray.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setTool(P.cur, b.dataset.t); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('#cktTray') && !e.target.closest('#ckAdd')) tray.hidden = true; });
  wireBtn.addEventListener('click', () => { const d = P.cur; if (d.kind === 'ckt') setTool(d, 'wire'); });
  rotBtn.addEventListener('click', () => { const d = P.cur; if (d.kind === 'ckt') rotate(d); });
  $('#selBtn').addEventListener('click', () => { const d = P.cur; if (d.kind === 'ckt') { d.tool = null; d.wireFrom = null; sync(d); P.updateHint(); } });
  flowBtn.addEventListener('click', () => { const o = st(P.cur).opts; o.flow = !o.flow; flowBtn.setAttribute('aria-pressed', o.flow); });
  voltBtn.addEventListener('click', () => { const o = st(P.cur).opts; o.volts = !o.volts; voltBtn.setAttribute('aria-pressed', o.volts); });
  $('#ckScale').addEventListener('change', e => { const d = P.cur, v = parseSI(e.target.value); if (isFinite(v) && v > 0) d.ck.tscale = v; e.target.value = fmtSI(d.ck.tscale, 's/s'); });
  autoBtn.addEventListener('click', () => { const d = P.cur; CKT.autoScale(d.ck); $('#ckScale').value = fmtSI(d.ck.tscale, 's/s'); });
  function sync(d) {
    addBtn.classList.toggle('armed', !!d.tool && d.tool !== 'wire'); wireBtn.classList.toggle('armed', d.tool === 'wire'); $('#selBtn').classList.toggle('armed', !d.tool);
    cv.classList.toggle('placing', !!d.tool);
  }
  // ---------- selection, clipboard, arrangement ----------
  const ids = d => P.selIds(d).filter(id => d.ck.items.some(i => i.id === id));
  const selItems = d => { const s = new Set(ids(d)); return d.ck.items.filter(i => s.has(i.id)); };
  const clean = it => { const o = JSON.parse(JSON.stringify(it)); Object.keys(o).forEach(k => { if (k[0] === '_') delete o[k]; }); return o; };
  const ibox = it => { const t = CKT.terminals(it), pad = it.type === 'wire' ? 0 : 0.3, xs = t.map(p => p.x), ys = t.map(p => p.y); return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]; };
  // Apply a point map (and a rotation-index map for parts) to the selection. Wires that are not selected but end on a moved part follow it.
  function transform(d, mapPt, rotFn) {
    const its = selItems(d); if (!its.length || d.mode !== 'design') return;
    const set = new Set(its.map(i => i.id)), parts = its.filter(i => i.type !== 'wire'), loose = d.ck.items.filter(w => w.type === 'wire' && !set.has(w.id)), follow = new Map();
    parts.forEach(it => { CKT.terminals(it).forEach((p, k) => { const key = p.x + ',' + p.y; if (!follow.has(key)) follow.set(key, { it, k }); }); });
    its.forEach(it => {
      if (it.type === 'wire') { const a = mapPt(it.x1, it.y1), b = mapPt(it.x2, it.y2); it.x1 = a.x; it.y1 = a.y; it.x2 = b.x; it.y2 = b.y; }
      else { const q = mapPt(it.x, it.y); it.x = q.x; it.y = q.y; it.rot = rotFn(it.rot); }
    });
    const after = new Map(); follow.forEach((f, key) => { const t = CKT.terminals(f.it)[f.k]; if (t) after.set(key, t); });
    loose.forEach(w => { const a = after.get(w.x1 + ',' + w.y1), b = after.get(w.x2 + ',' + w.y2); if (a) { w.x1 = a.x; w.y1 = a.y; } if (b) { w.x2 = b.x; w.y2 = b.y; } });
    P.refreshFields(true);
  }
  function pivot(d) {
    const its = selItems(d); if (!its.length) return { x: 0, y: 0 };
    if (its.length === 1 && its[0].type !== 'wire') return { x: its[0].x, y: its[0].y };
    const bs = its.map(ibox); return { x: Math.round((Math.min(...bs.map(b => b[0])) + Math.max(...bs.map(b => b[2]))) / 2), y: Math.round((Math.min(...bs.map(b => b[1])) + Math.max(...bs.map(b => b[3]))) / 2) };
  }
  function rotate(d) {
    if (d.mode !== 'design') return;
    if (d.tool && d.tool !== 'wire') { d.rotNew = ((d.rotNew || 0) + 1) % 4; return; }
    const c = pivot(d); transform(d, (x, y) => ({ x: c.x - (y - c.y), y: c.y + (x - c.x) }), r => (r + 1) % 4);
  }
  function flip(d, vertical) {
    const c = pivot(d);
    if (vertical) transform(d, (x, y) => ({ x, y: 2 * c.y - y }), r => [0, 3, 2, 1][((r % 4) + 4) % 4]);
    else transform(d, (x, y) => ({ x: 2 * c.x - x, y }), r => [2, 1, 0, 3][((r % 4) + 4) % 4]);
  }
  function nudge(d, dx, dy) { transform(d, (x, y) => ({ x: x + dx, y: y + dy }), r => r); }
  function copySel(d, quiet) {
    const its = selItems(d); if (!its.length || d.mode !== 'design') return false;
    const set = new Set(its.map(i => i.id)), pts = new Set(); its.forEach(it => { if (it.type !== 'wire') CKT.terminals(it).forEach(p => pts.add(p.x + ',' + p.y)); });
    const extra = d.ck.items.filter(w => w.type === 'wire' && !set.has(w.id) && pts.has(w.x1 + ',' + w.y1) && pts.has(w.x2 + ',' + w.y2));
    const all = its.concat(extra); S.ckClip = { n: 0, items: all.map(clean) };
    if (!quiet) P.flash(d, 'Copied ' + its.filter(i => i.type !== 'wire').length + ' parts and ' + all.filter(i => i.type === 'wire').length + ' wires. Ctrl+V pastes.'); return true;
  }
  function pasteClip(d) {
    const cl = S.ckClip; if (!cl || d.mode !== 'design' || d.kind !== 'ckt') return false;
    const k = ++cl.n, out = [];
    cl.items.forEach(src => {
      const o = clean(src); delete o.id; let it;
      if (o.type === 'wire') it = CKT.wire(o.x1 + k, o.y1 - k, o.x2 + k, o.y2 - k);
      else { it = CKT.create(o.type, Object.assign(o, { x: o.x + k, y: o.y - k })); it.name = nameFor(d, it.type); }
      d.ck.items.push(it); out.push(it.id);
    });
    P.selectMany(d, out); sync(d); return true;
  }
  function selectAll(d) { P.selectMany(d, d.ck.items.map(i => i.id)); }
  function boxSelect(d, x0, y0, x1, y1, crossing) {
    const a = Math.min(x0, x1), b = Math.max(x0, x1), c = Math.min(y0, y1), e = Math.max(y0, y1);
    return d.ck.items.filter(it => { const q = ibox(it); return crossing ? !(q[2] < a || q[0] > b || q[3] < c || q[1] > e) : (q[0] >= a && q[2] <= b && q[1] >= c && q[3] <= e); }).map(i => i.id);
  }
  // every wire joined end to end with the given one
  function wireRun(d, w0) {
    const wires = d.ck.items.filter(i => i.type === 'wire'), seen = new Set([w0.id]), q = [w0];
    while (q.length) { const w = q.pop(); wires.forEach(o => { if (seen.has(o.id)) return; const hit = [[w.x1, w.y1], [w.x2, w.y2]].some(p => (o.x1 === p[0] && o.y1 === p[1]) || (o.x2 === p[0] && o.y2 === p[1])); if (hit) { seen.add(o.id); q.push(o); } }); }
    return Array.from(seen);
  }
  function btnRow(box, list) {
    const r = document.createElement('div'); r.className = 'row'; r.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
    list.forEach(([t, fn, tip]) => { const b = document.createElement('button'); b.className = 'btn2'; b.textContent = t; if (tip) b.title = tip; b.style.cssText = 'flex:1 1 auto;padding:6px 9px'; b.addEventListener('click', fn); r.appendChild(b); }); box.appendChild(r);
  }
  function multiProps(d, box, title, ro) {
    $('#props').classList.add('sel'); const its = selItems(d), np = its.filter(i => i.type !== 'wire').length, nw = its.length - np;
    title.textContent = 'Properties: ' + its.length + ' selected'; const H = P.mkHelpers(box, ro, () => { });
    H.note(np + (np === 1 ? ' part' : ' parts') + ' and ' + nw + (nw === 1 ? ' wire' : ' wires') + '. Drag any selected one to move them all; wires attached to moved parts follow. Arrow keys nudge. Shift-click adds or removes one; Shift-drag on empty space selects an area (drag right to left to take anything it touches). Double-click a wire to select the whole run.');
    if (ro) return;
    H.sect('Edit'); btnRow(box, [['Copy', () => copySel(d), 'Ctrl+C'], ['Cut', () => { if (copySel(d, true)) E.del(d); }, 'Ctrl+X'], ['Paste', () => pasteClip(d), 'Ctrl+V'], ['Duplicate', () => E.dup(d), 'Ctrl+D'], ['Delete', () => E.del(d), 'Del']]);
    H.sect('Arrange'); btnRow(box, [['Rotate 90°', () => rotate(d), 'R'], ['Flip left-right', () => flip(d, false), 'F'], ['Flip up-down', () => flip(d, true), 'Shift+F']]);
  }
  function drawBox(d) {
    if (!drag || drag.type !== 'box') return;
    const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1), w2 = Math.abs(drag.x1 - drag.x0), h2 = Math.abs(drag.y1 - drag.y0), cross = drag.x1 < drag.x0;
    ctx.save(); ctx.setTransform(P.size.dpr, 0, 0, P.size.dpr, 0, 0); ctx.fillStyle = themeRGBA('purple-600', .12); ctx.strokeStyle = P.themeColor('purple-600'); ctx.lineWidth = 1.5; ctx.setLineDash(cross ? [6, 4] : []);
    ctx.fillRect(x, y, w2, h2); ctx.strokeRect(x, y, w2, h2); ctx.restore();
  }
  // handles on the ends of a selected wire
  function wireHandles(d) { const w = sel(d); return d.mode === 'design' && !d.tool && w && w.type === 'wire' ? [{ x: w.x1, y: w.y1, e: 1 }, { x: w.x2, y: w.y2, e: 2 }] : []; }
  function drawHandles(d) {
    const v = d.view; wireHandles(d).forEach(h => { ctx.beginPath(); ctx.arc(sx(v, h.x), sy(v, h.y), 6, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = P.themeColor('blue-700'); ctx.lineWidth = 2; ctx.stroke(); });
  }

  // ---------- hooks used by ui.js ----------
  const E = window.CKTUI = {};
  E.applyMode = function (d) {
    const A = st(d); flowBtn.setAttribute('aria-pressed', A.opts.flow); voltBtn.setAttribute('aria-pressed', A.opts.volts); $('#ckScale').value = fmtSI(d.ck.tscale, 's/s');
    $('#undoBtn').title = 'Undo (Ctrl+Z)'; $('#selBtn').title = 'Select and move parts. Drag a part to move it; wires attached to its ends follow. Shift-click or Shift-drag selects several. Ctrl+C, X, V, D, A copy, cut, paste, duplicate and select all. Arrow keys nudge. R rotates, F flips.';
    sync(d); setTimeout(sizeDock, 0);
  };
  E.listItems = d => d.ck.items.filter(i => i.type !== 'wire').map(i => ({ id: i.id, name: i.name, ic: i.type }));
  E.hint = d => {
    if (d.ck.err) return '';
    if (d.tool === 'wire') return d.wireFrom ? 'Click to add a corner or finish at a part. Esc or double-click ends the wire.' : 'Click where the wire starts. Click again for each corner.';
    if (d.tool) return 'Click to place a ' + PNAME[d.tool].toLowerCase() + '. R turns it, Shift keeps the tool, Esc cancels.';
    if (d.mode === 'design' && !d.ck.items.length) return 'Add parts, then join their ends with wires. A ground symbol sets the 0 V reference.';
    if (d.mode !== 'design' && d.ck.items.some(i => i.type === 'sw')) return 'Click a switch to open or close it.';
    return '';
  };
  E.setMode = function (d, m) {
    if (m === d.mode) return;
    if (d.mode === 'design') { d.ckSaved = JSON.stringify(CKT.serialize(d.ck)); d.tool = null; d.wireFrom = null; CKT.init(d.ck); resetHist(d); }
    if (m === 'design') { if (d.ckSaved) d.ck = CKT.deserialize(JSON.parse(d.ckSaved)); d.playing = false; setTimeout(() => P.checkpoint(d), 0); }
    if (m === 'sim' && d.mode === 'design') { d.playing = true; if (!d.ck.items.some(i => i.type === 'cap' || i.type === 'ind') && d.ck.tscale !== 1) d.ck.tscale = 1; }
    if ((m === 'design') !== (d.mode === 'design')) d.view = null;
    d.mode = m; P.applyMode(); P.renderProps(); P.renderWorkspace(); P.updateHint();
  };
  E.reset = function (d) {
    if (d.mode === 'design' || !d.ckSaved) return;
    const keep = d.ck.tscale; d.ck = CKT.deserialize(JSON.parse(d.ckSaved)); d.ck.tscale = keep; d.playing = false; resetHist(d); P.updatePlayBtn(); P.renderProps();
  };
  E.step = function (d) { CKT.advance(d.ck, d.ck.tscale / 15); sample(d); P.refreshFields(true); };
  E.dup = function (d) { if (d.mode !== 'design') return; const keep = S.ckClip; if (copySel(d, true)) { S.ckClip.n = 0; pasteClip(d); } S.ckClip = keep; };
  E.del = function (d) {
    const its = selItems(d); if (!its.length) return; if (d.mode !== 'design') { P.flash(d, 'Switch to Design mode to delete parts.'); return; }
    const gone = new Set(its.map(i => i.id)); d.ck.items = d.ck.items.filter(i => !gone.has(i.id)); d.sel = null; d.ms = null; P.renderWorkspace(); P.renderProps();
  };
  E.fit = function (d) {
    const b = CKT.bounds(d.ck), { cw, ch } = size(), wide = cw > 760, L = wide && !$('#ws').classList.contains('collapsed') ? 250 : 20, R = wide && !$('#props').classList.contains('collapsed') ? 300 : 20;
    const dockH = d.mode === 'design' ? 0 : DOCK_H + 10, w = Math.max(6, b[2] - b[0] + 3), h = Math.max(4, b[3] - b[1] + 3), s = clamp(Math.min((cw - L - R - 40) / w, (ch - dockH - 110) / h), 14, 90);
    d.view = { s, ox: L + (cw - L - R) / 2 - (b[0] + b[2]) / 2 * s, oy: (ch - dockH) / 2 + (b[1] + b[3]) / 2 * s + 20 };
  };

  // ---------- history for the scope ----------
  function resetHist(d) { const A = st(d); A.hist = { t: [], v: {}, i: {} }; A.acc = 0; A.ipk = 0; }
  function sample(d) {
    const A = st(d), H = A.hist, sc = d.ck; if (H.t.length && sc.t < H.t[H.t.length - 1]) { resetHist(d); return resetHist.call ? sample(d) : 0; }
    H.t.push(sc.t); sc.items.forEach(it => { if (it.type === 'wire') return; (H.v[it.id] = H.v[it.id] || []).push(it._v || 0); (H.i[it.id] = H.i[it.id] || []).push(it._i || 0); });
    const win = Math.max(1e-12, sc.tscale * 10) * 1.05; let k = 0; while (k < H.t.length - 2 && H.t[k] < sc.t - win) k++;
    if (k > 0 || H.t.length > 2400) { if (H.t.length - k > 2400) k = H.t.length - 2400; H.t.splice(0, k); for (const id in H.v) { H.v[id].splice(0, k); H.i[id].splice(0, k); } }
  }

  // ---------- properties ----------
  function siRow(box, ro, label, unit, get, set, o) {
    o = o || {}; const id = 'q' + Math.random().toString(36).slice(2, 8), row = document.createElement('div'); row.className = 'row si';
    const lb = document.createElement('label'); lb.htmlFor = id; lb.textContent = label; row.appendChild(lb);
    const inp = document.createElement('input'); inp.type = 'text'; inp.id = id; inp.value = fmtSI(get(), unit); inp.readOnly = ro && !o.live; row.appendChild(inp);
    inp.addEventListener('change', () => {
      let v = parseSI(inp.value); if (!isFinite(v)) { inp.value = fmtSI(get(), unit); return; }
      if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v);
      set(v); inp.value = fmtSI(get(), unit); if (o.after) o.after(); P.refreshFields(true);
    });
    inp.addEventListener('focus', () => inp.select());
    box.appendChild(row); return inp;
  }
  const liveRows = [];
  function liveRow(box, label, unit, get, fm) {
    const row = document.createElement('div'); row.className = 'row'; const lb = document.createElement('label'); lb.textContent = label; row.appendChild(lb);
    const inp = document.createElement('input'); inp.type = 'text'; inp.readOnly = true; inp.style.textAlign = 'right'; inp.style.fontFamily = 'var(--mono)'; row.appendChild(inp); box.appendChild(row);
    const f = () => { inp.value = fm ? fm(get()) : fmtSI(get(), unit); }; f(); liveRows.push(f);
  }
  E.renderProps = function (d, box, title) {
    liveRows.length = 0; const ro = d.mode !== 'design', it = sel(d), sc = d.ck;
    $('#props').classList.toggle('sel', !!it);
    if (d.ms && d.ms.size > 1) { multiProps(d, box, title, ro); return; }
    const H = P.mkHelpers(box, ro, () => { }), si = (l, u, g, s, o) => siRow(box, ro, l, u, g, s, o);
    if (!it) { sceneProps(d, H, box, title); return; }
    title.textContent = 'Properties: ' + it.name;
    if (it.type === 'wire') {
      title.textContent = 'Properties: Wire'; H.sect('Wire');
      H.note('A wire has no resistance. Wires join where their ends or a part\'s ends meet, including a T where one wire ends on the side of another. Crossing wires do not connect. Drag the white dots on its ends to reroute it (every wire end at that point moves together). Double-click to select the whole run.');
      if (ro) { liveRow(box, 'Potential', 'V', () => { const n = sc._net; return n && sc._vn ? sc._vn[n.nodeId(it.x1, it.y1)] : NaN; }); }
      H.button('Delete wire', () => E.del(d)); return;
    }
    H.name(it, title);
    const reinit = () => { if (d.mode === 'design') CKT.init(sc); };
    switch (it.type) {
      case 'vsrc': H.sect('Battery'); si('Voltage', 'V', () => it.V, v => { it.V = v; }, { live: true }); H.note('The long plate is the + terminal. Positive voltage drives current out of it.'); break;
      case 'acsrc': H.sect('AC source'); si('Amplitude', 'V', () => it.A, v => { it.A = v; }, { live: true }); si('Frequency', 'Hz', () => it.f, v => { it.f = v; }, { min: 1e-3, live: true }); si('Offset', 'V', () => it.off, v => { it.off = v; }, { live: true }); si('Phase', '°', () => it.ph, v => { it.ph = v; }, { live: true }); break;
      case 'isrc': H.sect('Current source'); si('Current', 'A', () => it.I, v => { it.I = v; }, { live: true }); H.note('Pushes this current through itself from the left end to the right end, whatever the voltage.'); break;
      case 'res': H.sect('Resistor'); si('Resistance', 'Ω', () => it.R, v => { it.R = v; }, { min: 1e-6, live: true });
        H.sect('Physical model (for the field panel)'); si('Length', 'm', () => it.len, v => { it.len = v; }, { min: 1e-6, live: true }); si('Wire radius', 'm', () => it.rad, v => { it.rad = v; }, { min: 1e-7, live: true });
        H.note('Only the fields shown in the panel depend on this. The circuit sees just the resistance.'); break;
      case 'lamp': H.sect('Lamp'); si('Resistance', 'Ω', () => it.R, v => { it.R = v; }, { min: 1e-6, live: true }); si('Rated power', 'W', () => it.P, v => { it.P = v; }, { min: 1e-6, live: true }); H.note('Glows in proportion to the power it takes, full brightness at its rated power.'); break;
      case 'cap': H.sect('Capacitor'); si('Capacitance', 'F', () => it.C, v => { it.C = v; }, { min: 1e-15, live: true, after: reinit }); si('Starting voltage', 'V', () => it.v0, v => { it.v0 = v; }, { after: reinit, live: !ro });
        H.sect('Physical model (for the field panel)'); si('Plate gap', 'm', () => it.gap, v => { it.gap = v; }, { min: 1e-9, live: true }); si('Dielectric εr', '', () => it.er, v => { it.er = v; }, { min: 1, live: true });
        liveRow(box, 'Plate area (from C)', '', () => CKT.fieldsOf(it).area, fmtArea); H.note('Area follows from C = ε0 εr A / d, so the plates are as large as the capacitance demands.'); break;
      case 'ind': H.sect('Inductor'); si('Inductance', 'H', () => it.L, v => { it.L = v; }, { min: 1e-12, live: true, after: reinit }); si('Starting current', 'A', () => it.i0, v => { it.i0 = v; }, { after: reinit, live: !ro });
        H.sect('Physical model (for the field panel)'); si('Turns', '', () => it.N, v => { it.N = Math.max(1, Math.round(v)); }, { min: 1, live: true }); si('Coil length', 'm', () => it.len, v => { it.len = v; }, { min: 1e-6, live: true });
        liveRow(box, 'Coil radius (from L)', 'm', () => CKT.fieldsOf(it).Rc); H.note('The radius follows from L = μ0 N² A / ℓ for a long solenoid.'); break;
      case 'sw': H.sect('Switch'); H.check('Closed', () => it.closed, v => { it.closed = v; sc._be = true; }, { live: true }); H.note('In Simulate or Render you can also click the switch on the schematic.'); break;
      case 'diode': H.sect('Diode'); si('Saturation current', 'A', () => it.Is, v => { it.Is = v; }, { min: 1e-20, live: true }); si('Ideality n', '', () => it.n, v => { it.n = v; }, { min: 0.5, max: 4, live: true }); H.note('Current flows only from the flat triangle side (anode, left) to the bar (cathode). About 0.7 V is dropped when it conducts.'); break;
      case 'led': H.sect('LED'); H.select('Colour', Object.keys(CKT.LEDCOL).map(k => [k, k]), () => it.col || 'red', v => { it.col = v; it.Vf = CKT.LEDCOL[v]; }, { live: true }); si('Forward voltage', 'V', () => it.Vf, v => { it.Vf = v; }, { min: 0.5, max: 6, live: true }); si('Full brightness at', 'A', () => it.Imax, v => { it.Imax = v; }, { min: 1e-5, live: true }); H.note('Always use a series resistor. The LED drops about its forward voltage and lets the resistor set the current.'); break;
      case 'zener': H.sect('Zener diode'); si('Breakdown voltage', 'V', () => it.Vz, v => { it.Vz = v; }, { min: 0.5, live: true }); H.note('Forward it acts like a diode. Reverse-biased past Vz it conducts and holds the voltage near Vz.'); break;
      case 'npn': case 'pnp': H.sect(it.type === 'npn' ? 'NPN transistor' : 'PNP transistor'); si('Current gain β', '', () => it.bf, v => { it.bf = v; }, { min: 1, live: true }); si('Reverse gain', '', () => it.br, v => { it.br = v; }, { min: 0.01, live: true }); si('Saturation current', 'A', () => it.Is, v => { it.Is = v; }, { min: 1e-20, live: true }); H.note('Terminals: B (base, left), C (collector, top right), E (emitter, bottom right). A small base current controls a β times larger collector current.'); break;
      case 'nmos': case 'pmos': H.sect(it.type === 'nmos' ? 'N-MOSFET' : 'P-MOSFET'); si('Threshold Vt', 'V', () => it.Vt, v => { it.Vt = v; }, { min: 0.1, live: true }); si('Gain k', 'A/V²', () => it.k, v => { it.k = v; }, { min: 1e-6, live: true }); si('Channel length mod λ', '1/V', () => it.lam, v => { it.lam = v; }, { min: 0, live: true }); H.note('Terminals: G (gate, left), D (drain, top right), S (source, bottom right). The gate draws no current; its voltage sets the channel current.'); break;
      case 'opamp': H.sect('Op-amp'); si('Open-loop gain', '', () => it.A, v => { it.A = v; }, { min: 10, live: true }); si('Supply rail ±', 'V', () => it.Vr, v => { it.Vr = v; }, { min: 0.5, live: true }); si('Output resistance', 'Ω', () => it.Rout, v => { it.Rout = v; }, { min: 1e-3, live: true }); H.note('Inputs: − (top left) and + (bottom left). With feedback it makes the two inputs equal; the output cannot go past the rails.'); break;
      case 'gnd': H.sect('Ground'); H.note('The 0 V reference. Every voltage in the circuit is measured from here.'); break;
    }
    if (it.type !== 'gnd') {
      H.note(CKT.flip(it) !== 1 || ['res', 'lamp', 'sw'].includes(it.type) ? 'Readings are positive when current runs left to right (bottom to top for a vertical part). Turning the part round does not change them.' : 'Readings are for the left end (a) relative to the right end (b): Vab = V(a) − V(b); I runs from a to b. Turning the part round flips their sign.');
      if (ro) {
        H.sect('Live'); liveRow(box, 'Voltage', 'V', () => it._v * CKT.flip(it)); liveRow(box, 'Current', 'A', () => it._i * CKT.flip(it)); liveRow(box, 'Power', 'W', () => it._p);
        if (it.type === 'cap') { liveRow(box, 'Charge', 'C', () => it.C * it._v); liveRow(box, 'Energy', 'J', () => 0.5 * it.C * it._v * it._v); }
        if (it.type === 'ind') liveRow(box, 'Energy', 'J', () => 0.5 * it.L * it._i * it._i);
        if (CKT.NONLIN[it.type]) liveRow(box, 'Region', '', () => CKT.regionOf(it), v => v);
        if (it.type === 'npn' || it.type === 'pnp') { liveRow(box, 'Base current', 'A', () => it._ib); liveRow(box, 'Vbe', 'V', () => it._vbe); }
        if (it.type === 'nmos' || it.type === 'pmos') liveRow(box, 'Vgs', 'V', () => it._vgs);
      }
    }
  };
  E.refreshLive = () => liveRows.forEach(f => f());
  function sceneProps(d, H, box, title) {
    const sc = d.ck, ro = d.mode !== 'design'; title.textContent = 'Properties';
    H.sect('Circuit');
    siRow(box, false, 'Time scale', 's/s', () => sc.tscale, v => { sc.tscale = v; $('#ckScale').value = fmtSI(v, 's/s'); }, { min: 1e-15, live: true });
    H.button('Pick time scale automatically', () => { CKT.autoScale(sc); $('#ckScale').value = fmtSI(sc.tscale, 's/s'); P.renderProps(); });
    H.note('How much circuit time passes per second you watch. Real circuits are far faster than you can see, so the default slows them to a few seconds per cycle or time constant.');
    if (ro) {
      H.sect('Totals'); const tot = () => { let sup = 0, dis = 0, st = 0; sc.items.forEach(i => { if (i._p == null || i.type === 'wire') return; if (i.type === 'vsrc' || i.type === 'acsrc' || i.type === 'isrc') sup -= i._p; else if (i.type === 'res' || i.type === 'lamp' || i.type === 'sw') dis += i._p; if (i.type === 'cap') st += 0.5 * i.C * i._v * i._v; if (i.type === 'ind') st += 0.5 * i.L * i._i * i._i; }); return { sup, dis, st }; };
      liveRow(box, 'Time', 's', () => sc.t); liveRow(box, 'Sources deliver', 'W', () => tot().sup); liveRow(box, 'Heat in resistors', 'W', () => tot().dis); liveRow(box, 'Stored in C and L', 'J', () => tot().st);
    }
    if (!ro) {
      H.sect('Examples'); CKT.PRESETS.forEach(pr => H.button(pr.name, () => loadPreset(d, pr)));
      H.note('Loading an example replaces the circuit. Undo brings the old one back.');
    } else H.note('Examples can be loaded from Design mode.');
    H.sect('Tips'); H.note('Select a part to see its voltage and current on the scope and the electric and magnetic fields inside it in the panel beside it.');
    if (!sc.items.some(i => i.type === 'gnd') && sc.items.some(i => i.type === 'vsrc' || i.type === 'acsrc')) H.note('No ground symbol: the − side of the first source is taken as 0 V.');
  }
  function loadPreset(d, pr) {
    P.checkpoint(d); d.ck = CKT.createScene(); pr.build(d.ck); CKT.init(d.ck); CKT.autoScale(d.ck);
    d.title = d.title.replace(/^Circuit: .*/, 'Circuit: ' + pr.name); d.counts = {}; let n = 0; d.ck.items.forEach(i => { if (i.type !== 'wire' && !i.name) i.name = PNAME[i.type]; });
    d.sel = null; d.ms = null; d.view = null; d.playing = false; d.ckSaved = null; d.tool = null; d.wireFrom = null; resetHist(d); const t = d.ck.items.find(i => i.type === pr.sel); if (t) d.sel = t.id;
    P.applyMode(); P.renderTabs(); P.renderWorkspace(); P.renderProps(); P.flash(d, pr.note); P.checkpoint(d);
  }

  // ---------- picking and pointer ----------
  let drag = null, mouse = { px: 0, py: 0, x: 0, y: 0, in: false }, spaceDown = false;
  function pick(d, w, tol) {
    let best = null, bd = tol;
    d.ck.items.forEach(it => { const dd = CKT.dist(it, w.x, w.y) - (it.type === 'wire' ? 0 : 0.18); if (dd < bd) { bd = dd; best = it; } });
    return best;
  }
  function attachments(d, it) {
    const t = CKT.terminals(it), out = [];
    d.ck.items.forEach(w => { if (w.type !== 'wire') return; t.forEach((p, k) => { if (w.x1 === p.x && w.y1 === p.y) out.push({ w, e: 1, k }); if (w.x2 === p.x && w.y2 === p.y) out.push({ w, e: 2, k }); }); });
    return out;
  }
  cv.addEventListener('pointerdown', e => {
    const d = P.cur; if (!d || d.kind !== 'ckt') return; P.closeMenus();
    const p = P.posOf(e), w = toW(d, p.x, p.y); cv.setPointerCapture(e.pointerId);
    const pan = () => { drag = { type: 'pan', x: p.x, y: p.y, ox: d.view.ox, oy: d.view.oy }; cv.classList.add('panning'); };
    mouse = { px: p.x, py: p.y, x: w.x, y: w.y, in: true };
    if (e.button === 1 || spaceDown) { pan(); return; }
    if (e.button === 2) { if (d.tool === 'wire' && d.wireFrom) { d.wireFrom = null; P.updateHint(); return; } pan(); return; }
    if (e.button !== 0) return;
    if (d.mode === 'design' && d.tool === 'wire') {
      const q = snapG(w);
      if (!d.wireFrom) d.wireFrom = q;
      else if (q.x === d.wireFrom.x && q.y === d.wireFrom.y) d.wireFrom = null;
      else { addWire(d, d.wireFrom, q); d.wireFrom = q; P.renderWorkspace(); }
      P.updateHint(); return;
    }
    if (d.mode === 'design' && d.tool) { place(d, w, e); return; }
    if (d.mode === 'design') {
      const hh = wireHandles(d).find(h => Math.hypot(sx(d.view, h.x) - p.x, sy(d.view, h.y) - p.y) < 10);
      if (hh) { drag = { type: 'wend', pts: d.ck.items.filter(i => i.type === 'wire').flatMap(i => [[i, 1, i.x1, i.y1], [i, 2, i.x2, i.y2]]).filter(a => a[2] === hh.x && a[3] === hh.y) }; return; }
    }
    const hit = pick(d, w, 0.35);
    if (d.mode === 'design') {
      const additive = e.shiftKey || e.ctrlKey || e.metaKey;
      if (additive && hit) { P.toggleSel(d, hit.id); return; }
      if (additive && !(e.ctrlKey || e.metaKey)) { drag = { type: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y, w0: w, base: P.selIds(d) }; return; }
      if (hit && d.ms && d.ms.has(hit.id)) {
        const set = new Set(selItems(d).map(i => i.id)), parts = selItems(d).filter(i => i.type !== 'wire');
        drag = { type: 'gmove', wx: w.x, wy: w.y, parts: parts.map(it => ({ it, x0: it.x, y0: it.y, att: attachments(d, it).filter(a => !set.has(a.w.id)) })), wires: selItems(d).filter(i => i.type === 'wire').map(it => ({ it, o: [it.x1, it.y1, it.x2, it.y2] })) }; return;
      }
    }
    if (hit) {
      P.select(hit.id);
      if (d.mode !== 'design') { if (hit.type === 'sw') { CKT.toggle(hit, d.ck); d.swFlip = true; P.renderProps(); } return; }
      if (hit.type === 'wire') { drag = { type: 'wire', it: hit, x: w.x, y: w.y, o: [hit.x1, hit.y1, hit.x2, hit.y2] }; return; }
      drag = { type: 'move', it: hit, x0: hit.x, y0: hit.y, wx: w.x, wy: w.y, att: attachments(d, hit), o: CKT.terminals(hit) };
    } else { if (d.sel != null) P.select(null); pan(); }
  });
  cv.addEventListener('pointermove', e => {
    const d = P.cur; if (!d || d.kind !== 'ckt') return; const p = P.posOf(e), w = toW(d, p.x, p.y);
    mouse = { px: p.x, py: p.y, x: w.x, y: w.y, in: true };
    if (!drag) { cv.style.cursor = (d.mode !== 'design' && pick(d, w, 0.35) && pick(d, w, 0.35).type === 'sw') ? 'pointer' : ''; return; }
    if (drag.type === 'pan') { d.view.ox = drag.ox + p.x - drag.x; d.view.oy = drag.oy + p.y - drag.y; }
    else if (drag.type === 'move') {
      const nx = Math.round(drag.x0 + (w.x - drag.wx)), ny = Math.round(drag.y0 + (w.y - drag.wy)), it = drag.it;
      if (nx !== it.x || ny !== it.y) {
        it.x = nx; it.y = ny; const t = CKT.terminals(it);
        drag.att.forEach(a => { const q = t[a.k]; if (!q) return; if (a.e === 1) { a.w.x1 = q.x; a.w.y1 = q.y; } else { a.w.x2 = q.x; a.w.y2 = q.y; } });
        P.refreshFields(true);
      }
    } else if (drag.type === 'gmove') {
      const dx = Math.round(w.x - drag.wx), dy = Math.round(w.y - drag.wy);
      drag.parts.forEach(m => { m.it.x = m.x0 + dx; m.it.y = m.y0 + dy; const t = CKT.terminals(m.it); m.att.forEach(a => { const q = t[a.k]; if (!q) return; if (a.e === 1) { a.w.x1 = q.x; a.w.y1 = q.y; } else { a.w.x2 = q.x; a.w.y2 = q.y; } }); });
      drag.wires.forEach(m => { m.it.x1 = m.o[0] + dx; m.it.y1 = m.o[1] + dy; m.it.x2 = m.o[2] + dx; m.it.y2 = m.o[3] + dy; });
      P.refreshFields(true);
    } else if (drag.type === 'box') { drag.x1 = p.x; drag.y1 = p.y; }
    else if (drag.type === 'wend') { const q = snapG(w); drag.pts.forEach(a => { if (a[1] === 1) { a[0].x1 = q.x; a[0].y1 = q.y; } else { a[0].x2 = q.x; a[0].y2 = q.y; } }); }
    else if (drag.type === 'wire') {
      const dx = Math.round(w.x - drag.x), dy = Math.round(w.y - drag.y), it = drag.it; it.x1 = drag.o[0] + dx; it.y1 = drag.o[1] + dy; it.x2 = drag.o[2] + dx; it.y2 = drag.o[3] + dy;
    }
  });
  const endDrag = () => {
    const d = P.cur;
    if (drag && drag.type === 'box' && d && d.kind === 'ckt') {
      const w1 = toW(d, drag.x1, drag.y1);
      if (Math.hypot(drag.x1 - drag.x0, drag.y1 - drag.y0) > 4) P.selectMany(d, drag.base.concat(boxSelect(d, drag.w0.x, drag.w0.y, w1.x, w1.y, drag.x1 < drag.x0)));
    }
    drag = null; cv.classList.remove('panning'); P.refreshFields(true); };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', () => { mouse.in = false; });
  cv.addEventListener('dblclick', e => {
    const d = P.cur; if (d.kind !== 'ckt') return;
    if (d.tool === 'wire') { d.wireFrom = null; P.updateHint(); return; }
    if (d.mode !== 'design' || d.tool) return;
    const p = P.posOf(e), hit = pick(d, toW(d, p.x, p.y), 0.35); if (hit && hit.type === 'wire') P.selectMany(d, wireRun(d, hit));
  });
  cv.addEventListener('wheel', e => {
    const d = P.cur; if (!d || d.kind !== 'ckt') return; e.preventDefault();
    const p = P.posOf(e), w = toW(d, p.x, p.y), f = Math.exp(-e.deltaY * 0.0015), s = clamp(d.view.s * f, 8, 160);
    d.view.s = s; d.view.ox = p.x - w.x * s; d.view.oy = p.y + w.y * s;
  }, { passive: false });
  cv.addEventListener('contextmenu', e => { if (P.cur.kind === 'ckt') e.preventDefault(); });
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    const d = P.cur; if (!d || d.kind !== 'ckt') return;
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
    else if ((e.key === 'r' || e.key === 'R') && d.mode === 'design') rotate(d);
    else if (e.key === 'r' || e.key === 'R') E.reset(d);
    else if ((e.key === '[' || e.key === ']') && d.mode === 'design') rotate(d);
    else if ((e.key === 'w' || e.key === 'W') && d.mode === 'design') setTool(d, 'wire');
    else if ((e.key === 'f' || e.key === 'F') && d.mode === 'design' && !d.tool) flip(d, e.shiftKey)
    else if (e.key.startsWith('Arrow') && d.mode === 'design' && !d.tool && selItems(d).length) { nudge(d, e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0, e.key === 'ArrowDown' ? -1 : e.key === 'ArrowUp' ? 1 : 0); e.preventDefault(); }
    else if (e.key === 'Escape') { if (d.wireFrom) d.wireFrom = null; else if (d.tool) d.tool = null; else if (d.sel != null || d.ms) P.select(null); sync(d); P.updateHint(); P.closeMenus(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') E.del(d);
  });
  document.addEventListener('keyup', e => { if (e.key === ' ') spaceDown = false; });

  // ---------- frame ----------
  E.frame = function (d, dt) {
    const A = st(d), sc = d.ck; if (!d.view) E.fit(d);
    if (d.playing && d.mode !== 'design' && !sc.err) {
      CKT.advance(sc, dt * S.speed * sc.tscale); sample(d);
      if (sc.err) { d.playing = false; P.updatePlayBtn(); P.updateHint(); }
      E.refreshLive(); P.refreshFields();
    } else if (d.mode !== 'design') E.refreshLive();
    if (A.flow) A.flow.dt = dt;
    sizeDock(); draw(d, dt); drawHandles(d); drawBox(d); if (d.mode !== 'design') { drawScope(d); drawFields(d); } overlays(d); sync(d);
  };

  // ---------- drawing ----------
  const pal = T => {
    const dark = T !== P.THEMES.paper;
    return { dark, ink: dark ? '#e4eef5' : '#1c2830', soft: dark ? 'rgba(228,238,245,.55)' : 'rgba(28,40,48,.55)', hot: dark ? '#ff8a76' : '#d9362a', cold: dark ? '#7db4ff' : '#2468d6', flow: dark ? '#ffd27a' : '#d98a00', sel: P.themeColor('blue-700'), i: dark ? '#ffb768' : '#c2610a', e: dark ? '#ff8a76' : '#d9362a', b: dark ? '#4fdcb8' : '#0e7b63', s: dark ? '#e59bff' : '#a02fc9', card: dark ? '#1b2227' : '#f3f6f8', grid: dark ? 'rgba(255,255,255,.1)' : 'rgba(30,45,55,.12)' };
  };
  const mixCol = (c, t) => { // neutral grey -> red (t>0) or blue (t<0)
    const a = Math.min(1, Math.abs(t)), base = c.dark ? [200, 210, 218] : [40, 52, 60], tgt = t >= 0 ? (c.dark ? [255, 110, 90] : [214, 48, 38]) : (c.dark ? [110, 170, 255] : [36, 104, 214]);
    return 'rgb(' + base.map((b, k) => Math.round(b + (tgt[k] - b) * a)).join(',') + ')';
  };
  const wireLevels = d => {
    const sc = d.ck, net = sc._net, vn = sc._vn; if (!net || !vn || d.mode === 'design') return null;
    let m = 1e-9; vn.forEach(v => { m = Math.max(m, Math.abs(v)); }); return { net, vn, m };
  };
  function drawWires(d, T, C, lv) {
    const v = d.view, A = st(d), sc = d.ck;
    sc.items.forEach(it => {
      if (it.type !== 'wire') return;
      const selected = P.isSel(d, it.id); ctx.lineCap = 'round';
      if (selected) { ctx.strokeStyle = themeRGBA('blue-700', .4); ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(sx(v, it.x1), sy(v, it.y1)); ctx.lineTo(sx(v, it.x2), sy(v, it.y2)); ctx.stroke(); }
      let col = C.ink; if (lv && A.opts.volts) { const id = lv.net.nodeId(it.x1, it.y1); if (id != null && lv.vn[id] != null) col = mixCol(C, lv.vn[id] / lv.m); }
      ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(sx(v, it.x1), sy(v, it.y1)); ctx.lineTo(sx(v, it.x2), sy(v, it.y2)); ctx.stroke();
    });
  }
  // rings on part ends and wire ends that connect to nothing, so a missing wire is easy to spot
  function drawOpen(d, C) {
    const v = d.view, cnt = new Map(), key = (x, y) => x + ',' + y, add = (x, y) => cnt.set(key(x, y), (cnt.get(key(x, y)) || 0) + 1), ends = [];
    const pts = []; d.ck.items.forEach(it => CKT.terminals(it).forEach(p => pts.push(p)));
    d.ck.items.forEach(it => {
      if (it.type === 'wire') {
        add(it.x1, it.y1); add(it.x2, it.y2); ends.push({ x: it.x1, y: it.y1 }, { x: it.x2, y: it.y2 });
        if (it.x1 === it.x2 || it.y1 === it.y2) { const x0 = Math.min(it.x1, it.x2), x1 = Math.max(it.x1, it.x2), y0 = Math.min(it.y1, it.y2), y1 = Math.max(it.y1, it.y2); pts.forEach(p => { if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && !((p.x === it.x1 && p.y === it.y1) || (p.x === it.x2 && p.y === it.y2))) add(p.x, p.y); }); }
      } else CKT.terminals(it).forEach(p => { add(p.x, p.y); ends.push(p); });
    });
    ctx.save(); ctx.strokeStyle = P.themeColor('attention'); ctx.lineWidth = 2; const seen = new Set();
    ends.forEach(p => { const k = key(p.x, p.y); if (seen.has(k) || cnt.get(k) > 1) return; seen.add(k); ctx.beginPath(); ctx.arc(sx(v, p.x), sy(v, p.y), 6.5, 0, TAU); ctx.stroke(); });
    ctx.restore();
  }
  // junction dots where three or more things meet
  function drawJunctions(d, C) {
    const v = d.view, cnt = new Map(), key = (x, y) => x + ',' + y, add = (x, y, n) => { const k = key(x, y); cnt.set(k, (cnt.get(k) || 0) + n); };
    const pts = []; d.ck.items.forEach(it => CKT.terminals(it).forEach(p => pts.push(p)));
    d.ck.items.forEach(it => {
      if (it.type === 'wire') {
        add(it.x1, it.y1, 1); add(it.x2, it.y2, 1);
        if (it.x1 === it.x2 || it.y1 === it.y2) { const x0 = Math.min(it.x1, it.x2), x1 = Math.max(it.x1, it.x2), y0 = Math.min(it.y1, it.y2), y1 = Math.max(it.y1, it.y2); pts.forEach(p => { if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1 && !((p.x === it.x1 && p.y === it.y1) || (p.x === it.x2 && p.y === it.y2))) add(p.x, p.y, 1); }); }
      } else CKT.terminals(it).forEach(p => add(p.x, p.y, 1));
    });
    ctx.fillStyle = C.ink; cnt.forEach((n, k) => { if (n >= 3) { const [x, y] = k.split(',').map(Number); ctx.beginPath(); ctx.arc(sx(v, x), sy(v, y), 4.2, 0, TAU); ctx.fill(); } });
  }
  // ---- current flow in wires: a spanning forest of the wire network, with the part currents as sources and sinks ----
  function flowGraph(d) {
    const A = st(d), sc = d.ck, sig = sc.items.map(i => i.type + i.x + ',' + i.y + ',' + i.rot + ',' + i.x1 + ',' + i.y1 + ',' + i.x2 + ',' + i.y2).join(';');
    if (A.flow && A.flowSig === sig) return A.flow; A.flowSig = sig;
    const key = (x, y) => x + ',' + y, vid = new Map(), V = [], edges = [], termAt = new Map();
    const vtx = (x, y) => { const k = key(x, y); let i = vid.get(k); if (i == null) { i = V.length; vid.set(k, i); V.push({ x, y, adj: [] }); } return i; };
    const pts = [];
    sc.items.forEach(it => CKT.terminals(it).forEach((p, k) => { pts.push(p); if (it.type !== 'wire') { const i = vtx(p.x, p.y); (termAt.get(i) || termAt.set(i, []).get(i)).push({ it, k }); } }));
    sc.items.forEach(it => { if (it.type === 'wire') { pts.push({ x: it.x1, y: it.y1 }, { x: it.x2, y: it.y2 }); } });
    sc.items.forEach(it => {
      if (it.type !== 'wire') return;
      const on = [{ x: it.x1, y: it.y1, t: 0 }, { x: it.x2, y: it.y2, t: 1 }];
      if (it.x1 === it.x2 || it.y1 === it.y2) {
        const x0 = Math.min(it.x1, it.x2), x1 = Math.max(it.x1, it.x2), y0 = Math.min(it.y1, it.y2), y1 = Math.max(it.y1, it.y2), L = Math.hypot(it.x2 - it.x1, it.y2 - it.y1), seen = new Set();
        pts.forEach(p => { if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) { const k = key(p.x, p.y); if (!seen.has(k) && !((p.x === it.x1 && p.y === it.y1) || (p.x === it.x2 && p.y === it.y2))) { seen.add(k); on.push({ x: p.x, y: p.y, t: Math.hypot(p.x - it.x1, p.y - it.y1) / L }); } } });
      }
      on.sort((a, b) => a.t - b.t);
      for (let k = 0; k + 1 < on.length; k++) { const a = vtx(on[k].x, on[k].y), b = vtx(on[k + 1].x, on[k + 1].y); if (a !== b) { const e = { a, b, ph: 0, f: 0 }; edges.push(e); V[a].adj.push({ e, o: b }); V[b].adj.push({ e, o: a }); } }
    });
    const parent = new Array(V.length).fill(-2), pe = new Array(V.length).fill(null), order = [];
    for (let r = 0; r < V.length; r++) {
      if (parent[r] !== -2) continue; parent[r] = -1; const stack = [r];
      while (stack.length) { const u = stack.pop(); order.push(u); V[u].adj.forEach(q => { if (parent[q.o] === -2) { parent[q.o] = u; pe[q.o] = q.e; stack.push(q.o); } }); }
    }
    return (A.flow = { V, edges, parent, pe, order, termAt });
  }
  function updateFlow(d, dt) {
    const G = flowGraph(d), sub = new Float64Array(G.V.length), A = st(d); let imax = 1e-12;
    G.termAt.forEach((list, vi) => list.forEach(q => { const it = q.it; if (it.type === 'gnd') return; if (it._ti && it._ti.length === CKT.terminals(it).length && it._ti.length > 2) { const c = it._ti[q.k] || 0; sub[vi] += c; imax = Math.max(imax, Math.abs(c)); } else { sub[vi] += (q.k === 0 ? 1 : -1) * (it._i || 0); imax = Math.max(imax, Math.abs(it._i || 0)); } }));
    for (let k = G.order.length - 1; k >= 0; k--) {
      const u = G.order[k], p = G.parent[u]; if (p >= 0) {
        const e = G.pe[u]; e.f = (e.a === p ? 1 : -1) * sub[u];   // flow in the direction a -> b
        sub[p] += sub[u];
      }
    }
    // Dots are drawn relative to the strongest current. That reference remembers recent peaks (half life ~4 s of real time) and never drops below 1 uA,
    // so a decaying discharge fades out smoothly and the picoamp leakage of an idle circuit is never blown up into a flow.
    A.ipk = Math.max(imax, (A.ipk || 0) * Math.pow(0.5, (dt || 0) / 4)); imax = Math.max(A.ipk, 1e-6);
    G.edges.forEach(e => { const r = Math.abs(e.f) / imax, sp = r < 2e-3 ? 0 : 26 + 60 * Math.sqrt(r); e.ph += Math.sign(e.f) * sp * (dt || 0) * (d.playing ? 1 : 0); e.r = r; });
    G.imax = imax; return G;
  }
  function drawFlow(d, C) {
    const G = d.cs.flow, v = d.view; if (!G) return; ctx.fillStyle = C.flow;
    G.edges.forEach(e => {
      if (!(e.r > 2e-3)) return; const a = G.V[e.a], b = G.V[e.b], x0 = sx(v, a.x), y0 = sy(v, a.y), x1 = sx(v, b.x), y1 = sy(v, b.y), L = Math.hypot(x1 - x0, y1 - y0), sp = 15;
      if (L < 3) return; const ux = (x1 - x0) / L, uy = (y1 - y0) / L; let o = ((e.ph % sp) + sp) % sp; ctx.globalAlpha = clamp(0.35 + 0.65 * Math.sqrt(e.r), 0, 1);
      for (let t = o; t < L; t += sp) { ctx.beginPath(); ctx.arc(x0 + ux * t, y0 + uy * t, 3, 0, TAU); ctx.fill(); }
    }); ctx.globalAlpha = 1;
  }

  // ---- part symbols, drawn along a local +x axis from terminal a ----
  function drawPart(d, it, T, C, lv) {
    const v = d.view, t = CKT.terminals(it)[0], u = v.s, X = sx(v, t.x), Y = sy(v, t.y), run = d.mode !== 'design', selected = P.isSel(d, it.id);
    const L = (a, b, c, e) => { ctx.moveTo(a * u, b * u); ctx.lineTo(c * u, e * u); };
    ctx.save(); ctx.translate(X, Y); ctx.rotate(-(it.rot || 0) * Math.PI / 2); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (selected) { ctx.strokeStyle = themeRGBA('blue-700', .42); ctx.lineWidth = 14; ctx.beginPath(); if (it.type === 'gnd') { ctx.arc(0.3 * u, 0, 0.7 * u, 0, TAU); } else L(0, 0, 3, 0); ctx.stroke(); }
    ctx.strokeStyle = C.ink; ctx.fillStyle = C.ink; ctx.lineWidth = Math.max(2, u * 0.065);
    const txt = (s, lx, ly, size, col) => { ctx.save(); ctx.translate(lx * u, ly * u); ctx.rotate((it.rot || 0) * Math.PI / 2); ctx.font = 'bold ' + Math.round(u * size) + 'px Roboto, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col || C.ink; ctx.fillText(s, 0, 0); ctx.restore(); };
    const so = (it.rot === 0 || it.rot === 3) ? 1 : -1;   // local side that faces away from the label
    const lead = (a, b) => { ctx.beginPath(); L(a, 0, b, 0); ctx.stroke(); };
    const vsign = run ? Math.sign(it._v || 0) * (Math.abs(it._v) > 1e-9 ? 1 : 0) : 0;
    switch (it.type) {
      case 'res': { ctx.beginPath(); L(0, 0, 0.75, 0); const n = 6, x0 = 0.75, dx = 1.5 / n; for (let k = 0; k < n; k++) ctx.lineTo((x0 + dx * (k + 0.5)) * u, (k % 2 ? 1 : -1) * 0.27 * u); ctx.lineTo(2.25 * u, 0); ctx.lineTo(3 * u, 0); ctx.stroke(); break; }
      case 'lamp': {
        const br = run ? clamp(Math.abs(it._p || 0) / Math.max(it.P, 1e-9), 0, 1) : 0;
        if (br > 0.01) { const g = ctx.createRadialGradient(1.5 * u, 0, 0.2 * u, 1.5 * u, 0, 1.3 * u); g.addColorStop(0, 'rgba(255,214,90,' + (0.25 + 0.7 * br) + ')'); g.addColorStop(1, 'rgba(255,214,90,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(1.5 * u, 0, 1.3 * u, 0, TAU); ctx.fill(); }
        ctx.fillStyle = br > 0.01 ? 'rgba(255,226,120,' + (0.35 + 0.65 * br) + ')' : (C.dark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.55)'); ctx.beginPath(); ctx.arc(1.5 * u, 0, 0.55 * u, 0, TAU); ctx.fill();
        ctx.strokeStyle = C.ink; ctx.beginPath(); ctx.arc(1.5 * u, 0, 0.55 * u, 0, TAU); L(0, 0, 0.95, 0); L(2.05, 0, 3, 0); L(1.11, -0.39, 1.89, 0.39); L(1.11, 0.39, 1.89, -0.39); ctx.stroke(); break;
      }
      case 'cap': {
        lead(0, 1.3); lead(1.7, 3);
        const q = run ? clamp(Math.abs(it._v) / Math.max(1e-12, peakV(d, it)), 0, 1) : 0;
        ctx.lineWidth = Math.max(3, u * 0.1); ctx.beginPath(); L(1.3, -0.5, 1.3, 0.5); L(1.7, -0.5, 1.7, 0.5); ctx.stroke();
        if (run && q > 0.03) { ctx.globalAlpha = 0.35 + 0.65 * q; txt('+', vsign > 0 ? 0.95 : 2.05, 0.85 * so, 0.5, C.hot); txt('−', vsign > 0 ? 2.05 : 0.95, 0.85 * so, 0.5, C.cold); ctx.globalAlpha = 1; }
        break;
      }
      case 'ind': { ctx.beginPath(); L(0, 0, 0.75, 0); const n = 4, r = 1.5 / n / 2; for (let k = 0; k < n; k++) ctx.arc((0.75 + r * (2 * k + 1)) * u, 0, r * u, Math.PI, 0, false); L(2.25, 0, 3, 0); ctx.stroke(); break; }
      case 'vsrc': { lead(0, 1.28); lead(1.72, 3); ctx.beginPath(); ctx.lineWidth = Math.max(3, u * 0.1); L(1.28, -0.28, 1.28, 0.28); ctx.stroke(); ctx.beginPath(); L(1.72, -0.55, 1.72, 0.55); ctx.stroke(); txt('+', 2.35, 0.85 * so, 0.45); txt('−', 0.65, 0.85 * so, 0.45); break; }
      case 'acsrc': { lead(0, 0.9); lead(2.1, 3); ctx.beginPath(); ctx.arc(1.5 * u, 0, 0.6 * u, 0, TAU); ctx.stroke(); ctx.beginPath(); for (let k = 0; k <= 24; k++) { const xx = 1.5 + (k / 24 - 0.5) * 0.7, yy = -Math.sin((k / 24) * TAU) * 0.2; if (k) ctx.lineTo(xx * u, yy * u); else ctx.moveTo(xx * u, yy * u); } ctx.stroke(); txt('+', 2.55, 0.85 * so, 0.42); break; }
      case 'isrc': { lead(0, 0.9); lead(2.1, 3); ctx.beginPath(); ctx.arc(1.5 * u, 0, 0.6 * u, 0, TAU); L(1.1, 0, 1.9, 0); L(1.65, -0.22, 1.95, 0); L(1.65, 0.22, 1.95, 0); ctx.stroke(); break; }
      case 'sw': {
        lead(0, 0.75); lead(2.25, 3); ctx.beginPath(); L(0.75, 0, it.closed ? 2.25 : 2.05, it.closed ? 0 : -0.75); ctx.stroke();
        ctx.beginPath(); ctx.arc(0.75 * u, 0, 0.09 * u, 0, TAU); ctx.arc(2.25 * u, 0, 0.09 * u, 0, TAU); ctx.fill(); break;
      }
      case 'diode': case 'led': case 'zener': {
        const on = run && Math.abs(it._i || 0) > 1e-6;
        if (it.type === 'led' && run) {
          const br = clamp(Math.abs(Math.max(it._i || 0, 0)) / Math.max(it.Imax || 0.02, 1e-6), 0, 1.4), hex = LEDHEX[it.col] || LEDHEX.red;
          if (br > 0.02) { const g = ctx.createRadialGradient(1.5 * u, 0, 0.1 * u, 1.5 * u, 0, 1.7 * u); g.addColorStop(0, hex + Math.round(clamp(0.35 + 0.6 * br, 0, 1) * 255).toString(16).padStart(2, '0')); g.addColorStop(1, hex + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(1.5 * u, 0, 1.7 * u, 0, TAU); ctx.fill(); }
        }
        ctx.strokeStyle = C.ink; ctx.fillStyle = on ? (it.type === 'led' ? (LEDHEX[it.col] || LEDHEX.red) : C.flow) : (C.dark ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.6)');
        lead(0, 1.1); lead(1.9, 3); ctx.beginPath(); L(1.1, -0.5, 1.1, 0.5); L(1.1, 0.5, 1.9, 0); L(1.9, 0, 1.1, -0.5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.lineWidth = Math.max(3, u * 0.1); if (it.type === 'zener') { L(1.7, -0.7, 1.9, -0.5); L(1.9, -0.5, 1.9, 0.5); L(1.9, 0.5, 2.1, 0.7); } else L(1.9, -0.5, 1.9, 0.5); ctx.stroke();
        if (it.type === 'led') { ctx.lineWidth = Math.max(1.5, u * 0.05); ctx.beginPath(); L(1.55, -0.65, 2.05, -1.15); L(2.05, -1.15, 1.8, -1.12); L(2.05, -1.15, 2.02, -0.9); L(1.95, -0.5, 2.45, -1.0); L(2.45, -1.0, 2.2, -0.97); L(2.45, -1.0, 2.42, -0.75); ctx.stroke(); }
        break;
      }
      case 'npn': case 'pnp': {
        const pn = it.type === 'pnp'; ctx.lineWidth = Math.max(2, u * 0.065); lead(0, 1.0);
        ctx.beginPath(); ctx.lineWidth = Math.max(3, u * 0.11); L(1.0, -0.7, 1.0, 0.7); ctx.stroke(); ctx.lineWidth = Math.max(2, u * 0.065);
        ctx.beginPath(); L(1.0, -0.28, 2.0, -1.0); L(2.0, -1.0, 3, -1); L(1.0, 0.28, 2.0, 1.0); L(2.0, 1.0, 3, 1); ctx.stroke();
        ctx.beginPath(); if (!pn) { L(1.62, 0.72, 1.34, 0.43); L(1.62, 0.72, 1.28, 0.74); L(1.62, 0.72, 1.40, 0.45); } else { L(1.34, 0.43, 1.62, 0.72); L(1.34, 0.43, 1.30, 0.70); L(1.34, 0.43, 1.58, 0.47); } ctx.stroke();
        ctx.beginPath(); if (!pn) { ctx.moveTo(1.7 * u, 0.78 * u); ctx.lineTo(1.28 * u, 0.62 * u); ctx.lineTo(1.43 * u, 0.42 * u); } ctx.fill();
        if (run && Math.abs(it._ic || 0) > 1e-7) { ctx.fillStyle = C.flow; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.arc(1.0 * u, 0, 0.2 * u, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
        txt('B', 0.35, -0.38, 0.42, C.soft); txt('C', 2.6, -1.42, 0.42, C.soft); txt('E', 2.6, 1.48, 0.42, C.soft);
        break;
      }
      case 'nmos': case 'pmos': {
        const pm = it.type === 'pmos'; lead(0, 0.85);
        ctx.beginPath(); ctx.lineWidth = Math.max(3, u * 0.11); L(0.85, -0.7, 0.85, 0.7); ctx.stroke(); ctx.lineWidth = Math.max(2, u * 0.065);
        ctx.beginPath(); L(1.15, -0.85, 1.15, -0.42); L(1.15, -0.22, 1.15, 0.22); L(1.15, 0.42, 1.15, 0.85); L(1.15, -0.65, 2.2, -0.65); L(2.2, -0.65, 2.2, -1); L(2.2, -1, 3, -1); L(1.15, 0.65, 2.2, 0.65); L(2.2, 0.65, 2.2, 1); L(2.2, 1, 3, 1); L(1.15, 0, 2.2, 0); L(2.2, 0, 2.2, 0.65); ctx.stroke();
        ctx.beginPath(); if (!pm) { ctx.moveTo(1.15 * u, 0); ctx.lineTo(1.5 * u, -0.14 * u); ctx.lineTo(1.5 * u, 0.14 * u); } else { ctx.moveTo(1.9 * u, 0); ctx.lineTo(1.55 * u, -0.14 * u); ctx.lineTo(1.55 * u, 0.14 * u); } ctx.fill();
        if (run && Math.abs(it._i || 0) > 1e-7) { ctx.fillStyle = C.flow; ctx.globalAlpha = 0.45; ctx.fillRect(1.0 * u, -0.8 * u, 0.3 * u, 1.6 * u); ctx.globalAlpha = 1; }
        txt('G', 0.35, -0.38, 0.42, C.soft); txt('D', 2.6, -1.42, 0.42, C.soft); txt('S', 2.6, 1.48, 0.42, C.soft);
        break;
      }
      case 'opamp': {
        lead(0, 0.6); ctx.beginPath(); L(0, -1, 0.6, -1); L(0, 1, 0.6, 1); L(2.7, 0, 3, 0); ctx.stroke();
        ctx.fillStyle = C.dark ? 'rgba(255,255,255,.06)' : 'rgba(255,255,255,.55)'; ctx.beginPath(); L(0.6, -1.6, 0.6, 1.6); L(0.6, 1.6, 2.7, 0); L(2.7, 0, 0.6, -1.6); ctx.closePath(); ctx.fill(); ctx.stroke();
        txt('−', 0.95, -1.0, 0.7, C.ink); txt('+', 0.95, 1.0, 0.7, C.ink);
        if (run && Math.abs(it._v) * (it.A || 1e5) > 0.9 * (it.Vr || 12)) { ctx.fillStyle = C.hot; ctx.beginPath(); ctx.arc(2.2 * u, 0, 0.1 * u, 0, TAU); ctx.fill(); }
        break;
      }
      case 'gnd': { ctx.beginPath(); L(0, 0, 0.55, 0); L(0.55, -0.5, 0.55, 0.5); L(0.78, -0.32, 0.78, 0.32); L(1.0, -0.14, 1.0, 0.14); ctx.stroke(); break; }
    }
    // terminal pins
    ctx.fillStyle = C.ink; const tn = CKT.terminals(it), lc = CKT.LOC[it.type]; tn.forEach((q, k) => { ctx.beginPath(); ctx.arc(lc ? lc[k][0] * u : k === 0 ? 0 : 3 * u, lc ? -lc[k][1] * u : 0, 3, 0, TAU); ctx.fill(); });
    ctx.restore();
    // label
    if (it.type === 'gnd') return;
    const mid = tn.length > 2 ? { x: sx(v, tn.reduce((a, q) => a + q.x, 0) / tn.length), y: sy(v, tn.reduce((a, q) => a + q.y, 0) / tn.length) } : { x: sx(v, (tn[0].x + tn[1].x) / 2), y: sy(v, (tn[0].y + tn[1].y) / 2) }, vert = (it.rot & 1) === 1, big = tn.length > 2;
    ctx.font = '600 ' + clamp(Math.round(u * 0.33), 11, 15) + 'px Roboto, sans-serif'; ctx.fillStyle = C.ink;
    const val = valueText(it);
    if (big) { ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; const ox = it.type === 'opamp' ? u * 0.2 : u * 0.9; ctx.fillText(it.name || '', mid.x + (vert ? u * 1.15 : ox), mid.y + (vert ? -2 : u * 1.75)); ctx.font = clamp(Math.round(u * 0.31), 10, 14) + 'px "Roboto Mono", monospace'; ctx.fillStyle = C.soft; ctx.fillText(val, mid.x + (vert ? u * 1.15 : ox), mid.y + (vert ? -2 : u * 1.75) + clamp(Math.round(u * 0.36), 13, 17)); }
    else if (!vert) { ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(it.name || '', mid.x, mid.y - u * 0.95); ctx.font = clamp(Math.round(u * 0.31), 10, 14) + 'px "Roboto Mono", monospace'; ctx.fillStyle = C.soft; ctx.fillText(val, mid.x, mid.y - u * 0.95 + clamp(Math.round(u * 0.36), 13, 17)); }
    else { ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillText(it.name || '', mid.x + u * 0.8, mid.y - 2); ctx.font = clamp(Math.round(u * 0.31), 10, 14) + 'px "Roboto Mono", monospace'; ctx.fillStyle = C.soft; ctx.fillText(val, mid.x + u * 0.8, mid.y - 2 + clamp(Math.round(u * 0.36), 13, 17)); }
  }
  function peakV(d, it) { const H = st(d).hist.v[it.id]; let m = Math.abs(it._v || 0); if (H) for (let k = 0; k < H.length; k++) m = Math.max(m, Math.abs(H[k])); return m; }
  function peakI(d, it) { const H = st(d).hist.i[it.id]; let m = Math.abs(it._i || 0); if (H) for (let k = 0; k < H.length; k++) m = Math.max(m, Math.abs(H[k])); return m; }

  function draw(d, dt) {
    const render = d.mode === 'render', T = P.THEMES[render ? S.bg : 'paper'], C = pal(T), v = d.view, A = st(d), sc = d.ck, { cw, ch, dpr } = size();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = T.bg; ctx.fillRect(0, 0, cw, ch);
    if (d.mode === 'design' || S.showGrid) {
      ctx.fillStyle = C.dark ? 'rgba(255,255,255,.2)' : 'rgba(30,45,55,.26)'; const x0 = Math.floor((0 - v.ox) / v.s), x1 = Math.ceil((cw - v.ox) / v.s), y0 = Math.floor((v.oy - ch) / v.s), y1 = Math.ceil(v.oy / v.s);
      if (v.s >= 12 && (x1 - x0) * (y1 - y0) < 12000) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) ctx.fillRect(Math.round(sx(v, x)) - 1, Math.round(sy(v, y)) - 1, 2, 2);
    }
    const lv = wireLevels(d); drawWires(d, T, C, lv); drawJunctions(d, C); if (d.mode === 'design') drawOpen(d, C);
    if (d.mode !== 'design' && A.opts.flow) { updateFlow(d, dt); drawFlow(d, C); }
    sc.items.forEach(it => { if (it.type !== 'wire') drawPart(d, it, T, C, lv); });
    // tool previews
    if (d.mode === 'design' && mouse.in) {
      if (d.tool === 'wire') {
        const q = snapG(mouse); ctx.fillStyle = C.sel; ctx.beginPath(); ctx.arc(sx(v, q.x), sy(v, q.y), 5, 0, TAU); ctx.fill();
        if (d.wireFrom) { const a = d.wireFrom, mid = a.x !== q.x && a.y !== q.y ? { x: q.x, y: a.y } : null; ctx.strokeStyle = C.sel; ctx.lineWidth = 3; ctx.setLineDash([7, 5]); ctx.beginPath(); ctx.moveTo(sx(v, a.x), sy(v, a.y)); if (mid) ctx.lineTo(sx(v, mid.x), sy(v, mid.y)); ctx.lineTo(sx(v, q.x), sy(v, q.y)); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(sx(v, a.x), sy(v, a.y), 5, 0, TAU); ctx.fill(); }
      } else if (d.tool) {
        const q = snapG(mouse), g = CKT.create(d.tool, { x: q.x, y: q.y, rot: d.rotNew || 0 }); g.id = -1; ctx.globalAlpha = 0.55; drawPart(d, g, T, C, null); ctx.globalAlpha = 1;
      }
    }
    if (sc.err) { ctx.font = '600 14px Roboto, sans-serif'; const m = '⚠ ' + sc.err, w = ctx.measureText(m).width + 28; ctx.fillStyle = '#b3261e'; ctx.beginPath(); ctx.roundRect(cw / 2 - w / 2, 44, w, 30, 15); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m, cw / 2, 59); }
  }

  // ---------- scope ----------
  function drawScope(d) {
    const c = scopeCv, x = scopeX, W = c._w, Hh = c._h, dpr = c._dpr; if (!W) return;
    const render = d.mode === 'render', T = P.THEMES[render ? S.bg : 'paper'], C = pal(T), A = st(d), H = A.hist, it = sel(d), sc = d.ck;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = C.card; x.fillRect(0, 0, W, Hh);
    x.font = '600 13px Roboto, sans-serif'; x.fillStyle = C.ink; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    const part = it && it.type !== 'wire' && it.type !== 'gnd' ? it : null;
    x.fillText(part ? 'Scope: ' + part.name : 'Scope', 16, 22);
    if (!part) { x.font = '13px Roboto, sans-serif'; x.fillStyle = C.soft; x.fillText('Click a part in the circuit to see its voltage and current over time.', 16, 48); return; }
    const fl = CKT.flip(part), L = 66, R = 70, Tp = 36, B = 28, w = W - L - R, h = Hh - Tp - B, ts = H.t, vs = (H.v[part.id] || []).map(q => q * fl), is = (H.i[part.id] || []).map(q => q * fl), win = Math.max(1e-12, sc.tscale * 10), t0 = Math.max(0, sc.t - win);
    let vm = 0, im = 0; for (let k = 0; k < ts.length; k++) { if (ts[k] < t0) continue; vm = Math.max(vm, Math.abs(vs[k])); im = Math.max(im, Math.abs(is[k])); }
    vm = niceMax(Math.max(vm * 1.08, 1e-9)); im = niceMax(Math.max(im * 1.08, 1e-12));
    x.strokeStyle = C.grid; x.lineWidth = 1; x.beginPath(); for (let k = 0; k <= 4; k++) { const X = Math.round(L + w * k / 4) + 0.5; x.moveTo(X, Tp); x.lineTo(X, Tp + h); } for (let k = 0; k <= 4; k++) { const Y = Math.round(Tp + h * k / 4) + 0.5; x.moveTo(L, Y); x.lineTo(L + w, Y); } x.stroke();
    x.strokeStyle = C.soft; x.beginPath(); x.moveTo(L, Tp + h / 2 + 0.5); x.lineTo(L + w, Tp + h / 2 + 0.5); x.stroke();
    x.font = '11px "Roboto Mono", monospace'; x.textBaseline = 'middle';
    x.fillStyle = C.cold; x.textAlign = 'right'; [[1, 0], [0.5, 1], [0, 2], [-0.5, 3], [-1, 4]].forEach(q => x.fillText(fmtSI(vm * q[0], 'V', 2), L - 6, Tp + h * q[1] / 4 + (q[1] === 0 ? 5 : q[1] === 4 ? -5 : 0)));
    x.fillStyle = C.i; x.textAlign = 'left'; [[1, 0], [0.5, 1], [0, 2], [-0.5, 3], [-1, 4]].forEach(q => x.fillText(fmtSI(im * q[0], 'A', 2), L + w + 6, Tp + h * q[1] / 4 + (q[1] === 0 ? 5 : q[1] === 4 ? -5 : 0)));
    x.fillStyle = C.soft; x.textAlign = 'center'; x.textBaseline = 'top'; for (let k = 0; k <= 4; k++) x.fillText(fmtSI(t0 + win * k / 4, 's', 2), L + w * k / 4, Tp + h + 6);
    const trace = (arr, m, col) => {
      x.strokeStyle = col; x.lineWidth = 2.6; x.lineJoin = 'round'; x.beginPath(); let started = false;
      for (let k = 0; k < ts.length; k++) { if (ts[k] < t0 - win * 0.02) continue; const X = L + (ts[k] - t0) / win * w, Y = Tp + h / 2 - clamp(arr[k] / m, -1.05, 1.05) * h / 2; if (!started) { x.moveTo(X, Y); started = true; } else x.lineTo(X, Y); }
      x.stroke();
    };
    x.save(); x.beginPath(); x.rect(L, Tp - 4, w, h + 8); x.clip(); trace(vs, vm, C.cold); x.setLineDash([6, 4]); trace(is, im, C.i); x.setLineDash([]); x.restore();
    x.font = '12px Roboto, sans-serif'; x.textBaseline = 'alphabetic'; x.textAlign = 'left';
    x.fillStyle = C.cold; x.fillRect(L, 30 - 4, 14, 3); x.fillText('V ' + fmtSI(part._v * fl, 'V'), L + 20, 33);
    const w1 = x.measureText('V ' + fmtSI(part._v * fl, 'V')).width + 44; x.fillStyle = C.i; x.fillRect(L + w1, 30 - 4, 14, 3); x.fillText('I ' + fmtSI(part._i * fl, 'A'), L + w1 + 20, 33);
    x.fillStyle = C.soft; x.textAlign = 'right'; x.fillText('t = ' + fmtSI(sc.t, 's'), W - 14, 22);
  }

  // ---------- field panel ----------
  const glyph = (x, cx, cy, r, out, col) => {   // out of the page = dot in a circle, into the page = cross
    x.strokeStyle = col; x.fillStyle = col; x.lineWidth = Math.max(1, r * 0.22); x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke();
    if (out) { x.beginPath(); x.arc(cx, cy, r * 0.32, 0, TAU); x.fill(); } else { const q = r * 0.62; x.beginPath(); x.moveTo(cx - q * 0.7, cy - q * 0.7); x.lineTo(cx + q * 0.7, cy + q * 0.7); x.moveTo(cx + q * 0.7, cy - q * 0.7); x.lineTo(cx - q * 0.7, cy + q * 0.7); x.stroke(); }
  };
  const arr = (x, x0, y0, x1, y1, col, w, hd) => {
    const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy); if (L < 1) return; const ux = dx / L, uy = dy / L; hd = Math.min(hd || 8, L * 0.6);
    x.strokeStyle = col; x.fillStyle = col; x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1 - ux * hd * 0.6, y1 - uy * hd * 0.6); x.stroke();
    x.beginPath(); x.moveTo(x1, y1); x.lineTo(x1 - ux * hd + uy * hd * 0.5, y1 - uy * hd - ux * hd * 0.5); x.lineTo(x1 - ux * hd - uy * hd * 0.5, y1 - uy * hd + ux * hd * 0.5); x.closePath(); x.fill();
  };
  const legend = (x, items, px, py) => { x.font = '11px Roboto, sans-serif'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; items.forEach(q => { x.fillStyle = q[1]; x.fillText(q[0], px, py); px += x.measureText(q[0]).width + 14; }); };
  function drawFields(d) {
    const c = fieldCv, x = fieldX, W = c._w, Hh = c._h, dpr = c._dpr; if (!W) return;
    const render = d.mode === 'render', T = P.THEMES[render ? S.bg : 'paper'], C = pal(T), it = sel(d), sc = d.ck;
    x.setTransform(dpr, 0, 0, dpr, 0, 0); x.fillStyle = C.card; x.fillRect(0, 0, W, Hh); x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.font = '600 13px Roboto, sans-serif'; x.fillStyle = C.ink;
    if (!it || it.type === 'wire' || it.type === 'gnd') { x.fillText('Fields', 16, 22); x.font = '13px Roboto, sans-serif'; x.fillStyle = C.soft; x.fillText(it && it.type === 'wire' ? 'A wire carries current but has no field model here. Pick a part.' : 'Select a resistor, capacitor or inductor to see its E and B fields.', 16, 48); return; }
    const f = CKT.fieldsOf(it), pv = Math.max(peakV(d, it), 1e-30), pi = Math.max(peakI(d, it), 1e-30);
    x.fillText('Fields in ' + it.name, 16, 22);
    const split = W > 470 ? 0.56 : 1, bx = 10, by = 34, bw = (W - 20) * split - 6, bh = Hh - 44, tx = W > 470 ? bx + bw + 14 : 16, lines = [];
    const cx = bx + bw / 2, cy = by + bh / 2;
    const ln = (t, col, bold) => lines.push([t, col || C.ink, bold]);
    if (it.type === 'cap') {
      const fe = clamp(Math.abs(f.V) / pv, 0, 1), fi = clamp(Math.abs(f.I) / pi, 0, 1), pw = bw * 0.62, gap = Math.min(bh * 0.34, 70), top = cy - gap / 2, bot = cy + gap / 2, q = Math.sign(f.V) * (Math.abs(f.V) > 1e-9 ? 1 : 0);
      x.fillStyle = C.dark ? '#aeb9c1' : '#4d5a63'; x.fillRect(cx - pw / 2, top - 8, pw, 8); x.fillRect(cx - pw / 2, bot, pw, 8);
      x.font = 'bold 13px Roboto, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      const nq = Math.round(7 * clamp(fe * 1.2, 0, 1)); for (let k = 0; k < nq; k++) { const px = cx - pw / 2 + pw * (k + 0.5) / 7; x.fillStyle = q > 0 ? C.hot : C.cold; x.fillText(q > 0 ? '+' : '−', px, top + 8); x.fillStyle = q > 0 ? C.cold : C.hot; x.fillText(q > 0 ? '−' : '+', px, bot - 8); }
      x.textBaseline = 'alphabetic';
      if (q !== 0) { const n = 7; for (let k = 0; k < n; k++) { const px = cx - pw / 2 + pw * (k + 0.5) / n; if (q > 0) arr(x, px, top + 14, px, bot - 14, C.e, 1 + 2.4 * fe, 7); else arr(x, px, bot - 14, px, top + 14, C.e, 1 + 2.4 * fe, 7); }
        [-1, 1].forEach(s => { x.globalAlpha = 0.6; x.strokeStyle = C.e; x.lineWidth = 1.2; x.beginPath(); x.moveTo(cx + s * pw / 2, top + 10); x.quadraticCurveTo(cx + s * (pw / 2 + 26), cy, cx + s * pw / 2, bot - 10); x.stroke(); x.globalAlpha = 1; }); }
      // B ringing the displacement current: out of the page on the right, into it on the left when I > 0 (current from the upper to the lower plate)
      if (fi > 0.02) { const rs = [0.2, 0.45, 0.7, 0.95, 1.3, 1.6], sgn = Math.sign(f.I); rs.forEach(r => { const Br = r <= 1 ? r : 1 / r, rad = 2 + 7 * Br * Math.sqrt(fi); [-1, 1].forEach(s => { glyph(x, cx + s * r * pw / 2 * 1.0, cy, rad, s * sgn > 0, C.b); }); }); }
      legend(x, [['E between the plates', C.e], ['B round the displacement current', C.b], ['side view', C.soft]], bx + 4, by + bh - 2);
      ln('C = ' + fmtSI(it.C, 'F'), C.ink, 1); ln('V = ' + fmtSI(f.V, 'V')); ln('E = V/d = ' + fmtSI(f.E, 'V/m'), C.e); ln('Charge  Q = CV = ' + fmtSI(f.Q, 'C')); ln('Energy  ½CV² = ' + fmtSI(f.U, 'J'), C.e);
      ln('I = C dV/dt = ' + fmtSI(f.I, 'A')); ln('dE/dt = ' + fmtSI(f.dEdt, 'V/m/s'), C.e); ln('B at plate edge = μ₀I/2πR = ' + fmtSI(f.B, 'T'), C.b); ln('Poynting into rim = ' + fmtSI(f.S, 'W/m²'), C.s);
      ln('gap ' + fmtSI(f.gap, 'm') + ', area ' + fmtArea(f.area) + ', εr ' + f.er, C.soft);
    } else if (it.type === 'ind') {
      const fb = clamp(Math.abs(f.B) / Math.max(1e-30, MUB(d, it)), 0, 1), fe = clamp(Math.abs(f.V) / pv, 0, 1), cw2 = bw * 0.86, ch2 = Math.min(bh * 0.84, 150), l = cx - cw2 / 2, t = cy - ch2 / 2, sg = Math.sign(f.I) * (Math.abs(f.I) > 1e-12 ? 1 : 0), dg = Math.sign(f.dIdt) * (Math.abs(f.dIdt) > 1e-6 * (pv / Math.max(it.L, 1e-12)) ? 1 : 0);
      x.strokeStyle = C.soft; x.lineWidth = 2; x.strokeRect(l, t, cw2, ch2);
      const nw = 8; for (let k = 0; k < nw; k++) { const px = l + cw2 * (k + 0.5) / nw; glyph(x, px, t, 4.5, sg >= 0, C.i); glyph(x, px, t + ch2, 4.5, sg < 0, C.i); }
      // B along the axis (+x for I > 0)
      if (sg !== 0) { for (let k = -1; k <= 1; k++) { const y = cy + k * ch2 * 0.1; if (sg > 0) arr(x, l + 10, y, l + cw2 - 10, y, C.b, 1 + 3 * fb, 9); else arr(x, l + cw2 - 10, y, l + 10, y, C.b, 1 + 3 * fb, 9); } }
      // induced E circulating round the axis: opposes dI/dt (against the winding current when I is rising)
      if (dg !== 0) { [[0.26, 4], [0.38, 6]].forEach(q => { const yy = ch2 * q[0]; for (let k = 0; k < 4; k++) { const px = l + cw2 * (k + 0.5) / 4; glyph(x, px, cy - yy, q[1] * (0.6 + 0.8 * fe), dg < 0, C.e); glyph(x, px, cy + yy, q[1] * (0.6 + 0.8 * fe), dg > 0, C.e); } }); }
      legend(x, [['winding current', C.i], ['B along the axis', C.b], ['induced E', C.e], ['cut along the axis', C.soft]], bx + 4, by + bh - 2);
      ln('L = ' + fmtSI(it.L, 'H') + ',  N = ' + f.N, C.ink, 1); ln('I = ' + fmtSI(f.I, 'A')); ln('B = μ₀NI/ℓ = ' + fmtSI(f.B, 'T'), C.b); ln('Flux per turn = ' + fmtSI(f.flux, 'Wb'), C.b); ln('Energy  ½LI² = ' + fmtSI(f.U, 'J'), C.b);
      ln('dI/dt = V/L = ' + fmtSI(f.dIdt, 'A/s')); ln('Vab = L dI/dt = ' + fmtSI(f.V, 'V')); ln('dB/dt = ' + fmtSI(f.dBdt, 'T/s'), C.e); ln('Induced E at the coil = ' + fmtSI(f.Eind, 'V/m'), C.e); ln('ℓ ' + fmtSI(f.len, 'm') + ', radius ' + fmtSI(f.Rc, 'm'), C.soft);
    } else if (it.type === 'res' || it.type === 'lamp') {
      const fe = clamp(Math.abs(f.V) / pv, 0, 1), fp = clamp(Math.abs(f.P) / Math.max(1e-30, MUP(d, it)), 0, 1), w2 = bw * 0.78, h2 = Math.min(bh * 0.24, 52), l = cx - w2 / 2, t = cy - h2 / 2, sg = Math.sign(f.V) * (Math.abs(f.V) > 1e-12 ? 1 : 0);
      x.fillStyle = 'rgb(' + Math.round(150 + 105 * fp) + ',' + Math.round(150 - 50 * fp) + ',' + Math.round(140 - 90 * fp) + ')'; x.fillRect(l, t, w2, h2);
      x.strokeStyle = C.ink; x.lineWidth = 1.6; x.strokeRect(l, t, w2, h2);
      if (sg !== 0) for (let k = 0; k < 3; k++) { const y = t + h2 * (k + 1) / 4; if (sg > 0) arr(x, l + 10, y, l + w2 - 10, y, k === 1 ? C.e : 'rgba(120,20,10,.7)', k === 1 ? 2.4 : 1.4, 8); else arr(x, l + w2 - 10, y, l + 10, y, k === 1 ? C.e : 'rgba(120,20,10,.7)', k === 1 ? 2.4 : 1.4, 8); }
      const sgI = Math.sign(f.I) * (Math.abs(f.I) > 1e-12 ? 1 : 0);
      if (sgI !== 0) for (let k = 0; k < 4; k++) { const px = l + w2 * (k + 0.5) / 4, r = 4 + 3 * Math.sqrt(clamp(Math.abs(f.I) / pi, 0, 1)); glyph(x, px, t - 20, r, sgI > 0, C.b); glyph(x, px, t + h2 + 20, r, sgI < 0, C.b); }
      if (fp > 0.02) for (let k = 0; k < 4; k++) { const px = l + w2 * (k + 0.5) / 4, ll = 8 + 16 * Math.sqrt(fp); arr(x, px, t - 28 - ll, px, t - 2, C.s, 1.6 + 1.6 * fp, 7); arr(x, px, t + h2 + 28 + ll, px, t + h2 + 2, C.s, 1.6 + 1.6 * fp, 7); }
      legend(x, [['E and J', C.e], ['B', C.b], ['Poynting S = E × H into the surface', C.s]], bx + 4, by + bh - 2);
      ln((it.type === 'lamp' ? 'Lamp ' : 'R = ') + fmtSI(it.R, 'Ω'), C.ink, 1); ln('V = ' + fmtSI(f.V, 'V')); ln('I = ' + fmtSI(f.I, 'A')); ln('E = V/ℓ = ' + fmtSI(f.E, 'V/m'), C.e); ln('J = I/A = ' + fmtSI(f.J, 'A/m²'), C.e); ln('B at the surface = μ₀I/2πa = ' + fmtSI(f.B, 'T'), C.b);
      ln('S = EH = ' + fmtSI(f.S, 'W/m²'), C.s); ln('S × surface = P = VI = ' + fmtSI(f.P, 'W'), C.s); ln('ℓ ' + fmtSI(f.len, 'm') + ', radius ' + fmtSI(f.rad, 'm') + ', ρ ' + fmtSI(f.rho, 'Ω·m'), C.soft);
    } else if (it.type === 'vsrc' || it.type === 'acsrc' || it.type === 'isrc') {
      const del = -f.P, fp = clamp(Math.abs(f.P) / Math.max(1e-30, MUP(d, it)), 0, 1), w2 = bw * 0.4, h2 = Math.min(bh * 0.4, 64), l = cx - w2 / 2, t = cy - h2 / 2;
      x.fillStyle = C.dark ? '#2a3640' : '#dfe7ed'; x.fillRect(l, t, w2, h2); x.strokeStyle = C.ink; x.lineWidth = 1.6; x.strokeRect(l, t, w2, h2); x.fillStyle = C.ink; x.font = 'bold 14px Roboto, sans-serif'; x.textAlign = 'center'; x.fillText(it.type === 'vsrc' ? 'emf' : it.type === 'acsrc' ? '∿' : 'I', cx, cy + 5);
      const dir = del >= 0 ? 1 : -1; [-1, 1].forEach(s => { for (let k = 0; k < 2; k++) { const y = t + h2 * (k + 1) / 3; if (fp > 0.02) arr(x, s > 0 ? l + w2 + (dir > 0 ? 4 : 44) : l - (dir > 0 ? 4 : 44), y, s > 0 ? l + w2 + (dir > 0 ? 44 : 4) : l - (dir > 0 ? 44 : 4), y, C.s, 1.6 + 2 * fp, 8); } });
      x.font = '11px Roboto, sans-serif'; x.textAlign = 'left'; x.fillStyle = C.s; x.fillText(del >= 0 ? 'Poynting flux leaves the source along the wires' : 'Poynting flux enters the source (it is being charged)', bx + 4, by + bh - 2);
      ln(it.name, C.ink, 1); ln('V = ' + fmtSI(f.V, 'V')); ln('I = ' + fmtSI(f.I, 'A')); ln((del >= 0 ? 'Delivers ' : 'Absorbs ') + fmtSI(Math.abs(f.P), 'W'), C.s); ln('The energy travels in the fields around the wires, not inside them.', C.soft);
    } else if (CKT.NONLIN[it.type]) {
      const ch = CKT.charac(it);
      if (ch) {
        const L0 = bx + 44, T0 = by + 8, w = bw - 54, h = bh - 36, X = v => L0 + w * (v - ch.xr[0]) / ((ch.xr[1] - ch.xr[0]) || 1), Y = v => T0 + h * (1 - (v - ch.yr[0]) / ((ch.yr[1] - ch.yr[0]) || 1));
        x.strokeStyle = C.grid || 'rgba(128,128,128,.35)'; x.lineWidth = 1; x.strokeRect(L0, T0, w, h);
        x.strokeStyle = C.soft; x.beginPath(); if (ch.xr[0] < 0) { x.moveTo(X(0), T0); x.lineTo(X(0), T0 + h); } if (ch.yr[0] < 0) { x.moveTo(L0, Y(0)); x.lineTo(L0 + w, Y(0)); } x.stroke();
        const cols = [C.cold, C.e, C.i, C.hot, C.flow];
        (ch.curves || []).forEach((c, k) => { x.strokeStyle = cols[k % cols.length]; x.lineWidth = 1.8; x.beginPath(); c.pts.forEach((p, j) => { const px = clamp(X(p[0]), L0, L0 + w), py = clamp(Y(p[1]), T0, T0 + h); j ? x.lineTo(px, py) : x.moveTo(px, py); }); x.stroke(); });
        x.fillStyle = C.ink; x.beginPath(); x.arc(clamp(X(ch.op[0]), L0, L0 + w), clamp(Y(ch.op[1]), T0, T0 + h), 5, 0, TAU); x.fill();
        x.font = '11px Roboto, sans-serif'; x.fillStyle = C.soft; x.textAlign = 'center'; x.fillText(ch.xl, L0 + w / 2, T0 + h + 24); x.save(); x.translate(bx + 10, T0 + h / 2); x.rotate(-Math.PI / 2); x.fillText(ch.yl, 0, 0); x.restore();
        x.textAlign = 'right'; x.fillText(fmtSI(ch.yr[1], ''), L0 - 4, T0 + 8); x.fillText(fmtSI(ch.yr[0], ''), L0 - 4, T0 + h); x.textAlign = 'left'; x.fillText(fmtSI(ch.xr[0], ''), L0, T0 + h + 12); x.textAlign = 'right'; x.fillText(fmtSI(ch.xr[1], ''), L0 + w, T0 + h + 12);
      }
      ln(it.name, C.ink, 1); ln('Region: ' + CKT.regionOf(it), C.hot, 1); ln('V = ' + fmtSI(f.V, 'V')); ln('I = ' + fmtSI(f.I, 'A')); ln('P = ' + fmtSI(it._p || 0, 'W'));
      if (it.type === 'npn' || it.type === 'pnp') { ln('Ib = ' + fmtSI(it._ib || 0, 'A')); ln('Ic = ' + fmtSI(it._ic || 0, 'A')); ln('Vbe = ' + fmtSI(it._vbe || 0, 'V')); }
      if (it.type === 'nmos' || it.type === 'pmos') ln('Vgs = ' + fmtSI(it._vgs || 0, 'V'));
      if (ch && ch.note) ln(ch.note, C.soft);
    } else {
      ln(it.name, C.ink, 1); ln('V = ' + fmtSI(f.V, 'V')); ln('I = ' + fmtSI(f.I, 'A')); if (it.type === 'sw') ln(it.closed ? 'Closed: it behaves like a wire.' : 'Open: no current can pass.', C.soft);
      x.font = '12px Roboto, sans-serif'; x.fillStyle = C.soft; x.fillText('No field model for this part.', bx + 4, by + 18);
    }
    x.font = '12px "Roboto Mono", monospace'; x.textAlign = 'left'; x.textBaseline = 'alphabetic'; let y = split < 1 ? by + 14 : by + bh + 2;
    if (split === 1) return;
    lines.forEach(q => { x.font = (q[2] ? '600 ' : '') + '12px "Roboto Mono", monospace'; x.fillStyle = q[1]; x.fillText(q[0], tx, y); y += 17; });
  }
  // peaks used to scale the pictures
  function MUB(d, it) { const H = st(d).hist.i[it.id]; let m = Math.abs(it._i || 0); if (H) for (let k = 0; k < H.length; k++) m = Math.max(m, Math.abs(H[k])); return Math.max(CKT.MU0 * (it.N || 1) * m / (it.len || 1), 1e-30); }
  function MUP(d, it) { const H = st(d).hist.v[it.id], I = st(d).hist.i[it.id]; let m = Math.abs(it._p || 0); if (H) for (let k = 0; k < H.length; k++) m = Math.max(m, Math.abs(H[k] * I[k])); return Math.max(m, 1e-30); }

  // ---------- overlays ----------
  function overlays(d) {
    const sc = d.ck, n = sc.items.filter(i => i.type !== 'wire').length;
    let hover = '';
    if (mouse.in && cv.matches(':hover')) {
      const w = { x: mouse.x, y: mouse.y }, hit = pick(d, w, 0.35);
      if (hit && hit.type !== 'wire' && hit.type !== 'gnd' && d.mode !== 'design') hover = ' · ' + hit.name + ': V ' + fmtSI(hit._v * CKT.flip(hit), 'V') + ', I ' + fmtSI(hit._i * CKT.flip(hit), 'A');
      else if (hit && hit.type === 'wire' && d.mode !== 'design' && sc._net && sc._vn) { const id = sc._net.nodeId(hit.x1, hit.y1); if (id != null) hover = ' · node at ' + fmtSI(sc._vn[id], 'V'); }
    }
    if (d.mode === 'design') $('#status').textContent = 'Design · ' + n + (n === 1 ? ' part' : ' parts') + ' · ' + sc.items.filter(i => i.type === 'wire').length + ' wires';
    else $('#status').textContent = (d.playing ? 'Running' : 'Paused') + ' · t ' + fmtSI(sc.t, 's') + ' · ' + fmtSI(sc.tscale, 's') + ' of circuit time per second' + hover;
  }

  // ---------- boot ----------
  if (!P.docs.some(x => x.kind === 'ckt')) P.mkDoc('Circuit: RC Charging', 'ckt', true);
  const first = P.docs.find(x => x.kind === 'ckt'); if (first && !first.sel) { const t = first.ck.items.find(i => i.type === 'cap'); if (t) first.sel = t.id; }
  P.applyMode(); P.renderTabs(); P.renderWorkspace(); P.renderProps();
})();
