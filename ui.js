(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const app = $('#app'), cv = $('#cv'), ctx = cv.getContext('2d'), stage = $('#stage'), cvEm = $('#cvEm');
  const S = { snap: true, grid: 0.25, vectors: true, trails: false, showGrid: true, shading: true, bg: 'paper', speed: 1 };
  const LABEL = { sphere: 'Sphere', rect: 'Rectangle', poly: 'Polygon', incline: 'Inclined Plane', custom: 'Custom', wheel: 'Pulley', wrap: 'Rope', spring: 'Spring', rod: 'Rod', rope: 'Rope', chain: 'Slack rope', linkage: 'Linkage', pin: 'Pin Joint', tspring: 'Torsion Spring', weld: 'Weld', slider: 'Slider', pulley: 'Pulley' };
  const CONN = { spring: 2, rod: 2, rope: 2, chain: 2, linkage: 9, pin: 1, tspring: 1, weld: 1, slider: 1 };
  const CONN_SUB = { spring: 'Hooke, with damping', rod: 'Rigid length, hinged at both ends', rope: 'Bends round pulleys and objects', chain: 'Hangs and drapes, many links', linkage: 'Rods joined at shared joints', pin: 'Hinge, motor, limits', tspring: 'Hinge that springs back', weld: 'Locks two bodies', slider: 'Prismatic rail' };
  const MODES = { design: 'Design', sim: 'Simulate', render: 'Render' };
  const ICON = {
    sphere: '<circle cx="12" cy="12" r="8"/><path d="M12 12h8"/>',
    rect: '<rect x="4" y="7" width="16" height="10" rx="1"/>',
    poly: '<path d="M12 3.5l8 5.8-3 9.4H7l-3-9.4z"/>',
    custom: '<path d="M5 15c-1-5 3-10 8-9 4 1 7 4 5 9-2 4-8 5-13 0z"/>',
    incline: '<path d="M4 18V7l16 11z"/>',
    objects: '<circle cx="9" cy="9" r="5"/><rect x="12" y="12" width="8" height="8" rx="1"/>',
    select: '<path d="M6 4l12 7-5 1.5L11 18z"/>',
    dup: '<rect x="8" y="8" width="11" height="11" rx="1"/><path d="M5 15V5h10"/>',
    del: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    snap: '<path d="M4 4h16v16H4zM4 12h16M12 4v16"/>',
    fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    play: '<path d="M7 4l13 8-13 8z"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    step: '<path d="M5 5l9 7-9 7zM18 5v14"/>',
    reset: '<path d="M5 12a7 7 0 1 0 2.3-5.2M5 4v4h4"/>',
    vec: '<path d="M5 19L18 6M18 6h-7M18 6v7"/>',
    trail: '<path d="M3 17c4-10 8 4 12-6 2-4 4-3 6-3"/>',
    ground: '<path d="M3 14h18M6 19l2-5M11 19l2-5M16 19l2-5"/>',
    shade: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    charge: '<circle cx="12" cy="12" r="8"/><path d="M8 12h8M12 8v8"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    conn: '<circle cx="4" cy="12" r="1.8"/><circle cx="20" cy="12" r="1.8"/><path d="M6 12h2l1.5-4 3 8 3-8 1.5 4h2"/>',
    spring: '<path d="M2 12h3l2-6 3 12 3-12 3 12 2-6h4"/>',
    rod: '<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.8"/><circle cx="19" cy="5" r="1.8"/>',
    rope: '<path d="M3 7h9l5 5v6"/><circle cx="3" cy="7" r="1.4"/><circle cx="17" cy="19" r="1.4"/>',
    linkage: '<path d="M3 18L9 8l6 6 6-9"/><circle cx="3" cy="18" r="1.6"/><circle cx="9" cy="8" r="1.6"/><circle cx="15" cy="14" r="1.6"/><circle cx="21" cy="5" r="1.6"/>',
    chain: '<path d="M3 6c2 12 16 12 18 0"/><circle cx="3" cy="6" r="1.4"/><circle cx="21" cy="6" r="1.4"/>',
    pin: '<circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1" fill="currentColor"/><path d="M3 12h5M16 12h5"/>',
    tspring: '<path d="M3 12h4"/><path d="M12 12m-5 0a5 5 0 1 1 5 5"/><path d="M12 12m-2.5 0a2.5 2.5 0 1 1 2.5 2.5"/><path d="M12 17h9"/>',
    weld: '<rect x="3" y="8" width="8" height="8" rx="1"/><rect x="13" y="8" width="8" height="8" rx="1"/><path d="M9 12h6"/>',
    slider: '<path d="M3 8h18M3 18h18"/><rect x="8" y="10" width="8" height="6" rx="1.5"/>',
    pulley: '<circle cx="12" cy="8" r="4"/><circle cx="12" cy="8" r="1" fill="currentColor"/><path d="M8 8v12M16 8v8"/><rect x="14" y="16" width="4" height="4" rx="1"/>',
    wheel: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><path d="M12 6.5v-3M12 20.5v-3"/>',
    grab: '<path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V11M11 10.5V5a1.5 1.5 0 0 1 3 0v6M14 10.5V7a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-3 0-4.500-2-6-5l-1.500-3a1.500 1.500 0 0 1 2.500-1.500L8 14"/>',
    push: '<rect x="13" y="6" width="8" height="12" rx="1.5"/><path d="M3 12h9M8 8l4 4-4 4"/>',
    undo: '<path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12"/>',
    redo: '<path d="M15 7l5 5-5 5M20 12H10a6 6 0 0 0 0 12"/>',
    save: '<path d="M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6"/>',
    open: '<path d="M3 19V6h6l2 2h8v3M3 19l3-8h16l-3 8z"/>',
    design: '<path d="M4 20l4-1 11-11-3-3L5 16z"/>',
    simulate: '<path d="M7 4l13 8-13 8z"/>',
    render: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor"/>'
  };
  const ic = n => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">' + ICON[n] + '</svg>';
  document.querySelectorAll('[data-ic]').forEach(el => { el.innerHTML = ic(el.dataset.ic); el.style.display = 'contents'; });

  // ---------- documents (file tabs) ----------
  const docs = []; let cur = null, docSeq = 1, untitled = 0;
  const KU = d => d ? (d.kind === 'em' ? window.EMUI : d.kind === 'ckt' ? window.CKTUI : null) : null;   // interface module of a non-mechanics file
  const isDoc = d => !!d && (d.kind === 'mech' || d.kind === 'em' || d.kind === 'ckt');
  const serDoc = d => d.kind === 'em' ? EM.serialize(d.em) : d.kind === 'ckt' ? CKT.serialize(d.ck) : Phys.serialize(d.world);
  function mkDoc(title, kind, demo) {
    const d = { id: docSeq++, title, kind, world: Phys.createWorld(), sel: null, view: null, mode: 'design', playing: false, snap: null, trails: {}, counts: {}, tool: null, custom: [], cx: [], stool: 'grab' };
    if (kind === 'mech' && demo) { Phys.demoScene(d.world); d.world.bodies.forEach(b => { b.name = nextName(d, b.kind); }); }
    if (kind === 'em' && window.EM) { d.em = EM.createScene(); if (demo) EM.demoScene(d.em); }
    if (kind === 'ckt' && window.CKT) { d.ck = CKT.createScene(); if (demo) CKT.demoScene(d.ck); }
    docs.push(d); return d;
  }
  function nextName(d, kind) { d.counts[kind] = (d.counts[kind] || 0) + 1; return LABEL[kind] + ' ' + d.counts[kind]; }
  const getSel = d => d && d.sel != null ? d.world.bodies.find(b => b.id === d.sel && !b.hidden) || null : null;
  const getConn = d => d && d.sel != null ? d.world.joints.find(j => j.id === d.sel && j.owner == null) || d.world.chains.find(c => c.id === d.sel) || d.world.links.find(c => c.id === d.sel) || null : null;
  const visBodies = d => d.world.bodies.filter(b => !b.hidden);
  const conns = d => d.world.joints.filter(j => j.owner == null).concat(d.world.chains, d.world.links);

  function renderTabs() {
    const el = $('#tabs'); el.innerHTML = '';
    docs.forEach(d => {
      const t = document.createElement('div');
      t.className = 'tab' + (d === cur ? ' active' : ''); t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', d === cur);
      t.innerHTML = '<span class="tic">' + ic(d.kind === 'mech' ? 'gear' : d.kind === 'ckt' ? 'circuit' : 'charge') + '</span><span class="tt"></span><button class="tx" aria-label="Close tab">' + ic('close') + '</button>';
      t.querySelector('.tt').textContent = d.title;
      t.addEventListener('click', e => { if (e.target.closest('.tx')) closeDoc(d); else switchDoc(d); });
      el.appendChild(t);
    });
    const n = document.createElement('button'); n.id = 'newTab'; n.textContent = '+'; n.title = 'New mechanics file'; n.setAttribute('aria-label', 'New mechanics file');
    n.addEventListener('click', () => { const d = mkDoc('Mechanics: Untitled ' + (++untitled), 'mech', false); switchDoc(d); });
    el.appendChild(n);
    if (window.EM) {
      const m = document.createElement('button'); m.id = 'newTabEm'; m.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>E&M'; m.title = 'New E&M file'; m.setAttribute('aria-label', 'New E&M file');
      m.style.cssText = 'flex:none;display:flex;align-items:center;gap:3px;height:22px;margin:0 0 3px 4px;padding:0 9px 0 6px;border:0;border-radius:11px;background:rgba(255,255,255,.14);color:var(--muted);font-size:12px';
      m.addEventListener('click', () => { const d = mkDoc('E&M: Untitled ' + (++untitled), 'em', false); switchDoc(d); });
      el.appendChild(m);
    }
    if (window.CKT) {
      const m = document.createElement('button'); m.id = 'newTabCkt'; m.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>Circuit'; m.title = 'New circuit file'; m.setAttribute('aria-label', 'New circuit file');
      m.style.cssText = 'flex:none;display:flex;align-items:center;gap:3px;height:22px;margin:0 0 3px 4px;padding:0 9px 0 6px;border:0;border-radius:11px;background:rgba(255,255,255,.14);color:var(--muted);font-size:12px';
      m.addEventListener('click', () => { const d = mkDoc('Circuit: Untitled ' + (++untitled), 'ckt', false); switchDoc(d); });
      el.appendChild(m);
    }
  }
  function closeDoc(d) {
    const i = docs.indexOf(d); docs.splice(i, 1);
    if (!docs.length) mkDoc('Mechanics: Untitled ' + (++untitled), 'mech', false);
    if (cur === d) cur = docs[Math.min(i, docs.length - 1)];
    switchDoc(cur);
  }
  function switchDoc(d) { cur = d; closeMenus(); applyMode(); renderTabs(); renderWorkspace(); renderProps(); refreshToolUI(); updateHint(); checkpoint(d); persist(); }

  // ---------- modes ----------
  function applyMode() {
    const d = cur, em = d.kind !== 'mech';
    app.dataset.mode = d.mode; app.dataset.kind = d.kind;
    $('#modeLabel').textContent = MODES[d.mode];
    $('#modeBtn').disabled = false; $('#modeBtn').style.opacity = 1;
    document.querySelectorAll('[data-modes]').forEach(el => { el.hidden = !((el.dataset.kind || 'mech').split(' ').includes(d.kind) && el.dataset.modes.split(' ').includes(d.mode)); });
    cv.hidden = d.kind === 'em'; cvEm.hidden = d.kind !== 'em';
    $('#ws').hidden = false; $('#props').hidden = false; $('#scale').hidden = false; $('#status').hidden = false;
    if (!em) {
      $('#gIn').value = d.world.g; $('#groundBtn').setAttribute('aria-pressed', d.world.ground);
    } else { const k = KU(d); if (k) k.applyMode(d); }
    if (window.EMUI) EMUI.gridLabels(d);
    updatePlayBtn();
  }
  function updatePlayBtn() {
    const d = cur; $('#playLbl').textContent = d.playing ? 'Pause' : 'Play';
    $('#playBtn').querySelector('[data-ic]').innerHTML = ic(d.playing ? 'pause' : 'play');
  }
  function setMode(m) {
    const d = cur; if (d.kind !== 'mech') { closeMenus(); const k = KU(d); if (k) k.setMode(d, m); return; } closeMenus();
    if (m === d.mode) return;
    if (d.mode === 'design') { Phys.reconcile(d.world); d.snap = Phys.snapshot(d.world); d.trails = {}; d.tool = null; d.custom = []; d.cx = []; refreshToolUI(); updateHint(); }
    if (m === 'design') { endGrab(); if (d.snap) Phys.restore(d.world, d.snap); d.playing = false; d.trails = {}; d.world.t = 0; setTimeout(() => checkpoint(d), 0); }
    if (m === 'sim' && d.mode === 'design') d.playing = true;
    d.mode = m; applyMode(); renderProps();
  }
  function resetSim() {
    const d = cur; if (d.kind !== 'mech') { const k = KU(d); if (k) k.reset(d); return; } if (d.mode === 'design' || !d.snap) return;
    endGrab(); Phys.restore(d.world, d.snap); d.playing = false; d.trails = {}; updatePlayBtn(); refreshFields();
  }

  // ---------- menus ----------
  const modeMenu = $('#modeMenu'), tray = $('#tray'), cxTray = $('#cxTray');
  const MODE_INFO = { design: ['Edit the scene', '1'], sim: ['Run the physics', '2'], render: ['Shaded view with trails', '3'] };
  modeMenu.innerHTML = Object.keys(MODES).map(k => '<button role="menuitem" data-m="' + k + '">' + ic(k === 'sim' ? 'simulate' : k) + '<span>' + MODES[k] + '<span class="sub">' + MODE_INFO[k][0] + '</span></span><span class="k">' + MODE_INFO[k][1] + '</span></button>').join('');
  tray.innerHTML = ['sphere', 'rect', 'poly', 'custom', 'wheel'].map(k => '<button role="menuitem" data-t="' + k + '">' + ic(k) + LABEL[k === 'rect' ? 'rect' : k] + '</button>').join('');
  cxTray.innerHTML = Object.keys(CONN).map(k => '<button role="menuitem" data-t="' + k + '">' + ic(k) + '<span>' + LABEL[k] + '<span class="sub">' + CONN_SUB[k] + '</span></span></button>').join('');
  function placeMenu(m, anchor, wid) {
    const r = anchor.getBoundingClientRect(), a = app.getBoundingClientRect();
    m.style.left = Math.max(0, Math.min(r.left - a.left, a.width - (wid || 200))) + 'px'; m.style.top = (r.bottom - a.top + 4) + 'px';
  }
  function closeMenus() { modeMenu.hidden = true; tray.hidden = true; cxTray.hidden = true; ['emTray', 'cktTray'].forEach(id => { const t = document.getElementById(id); if (t) t.hidden = true; }); }
  $('#modeBtn').addEventListener('click', e => {
    e.stopPropagation(); const open = !modeMenu.hidden; closeMenus();
    if (!open) { modeMenu.querySelectorAll('button').forEach(b => b.classList.toggle('cur', b.dataset.m === cur.mode)); placeMenu(modeMenu, $('#modeBtn')); modeMenu.hidden = false; }
  });
  $('#objBtn').addEventListener('click', e => { e.stopPropagation(); const open = !tray.hidden; closeMenus(); if (!open) { placeMenu(tray, $('#objBtn')); tray.hidden = false; } });
  $('#cxBtn').addEventListener('click', e => { e.stopPropagation(); const open = !cxTray.hidden; closeMenus(); if (!open) { placeMenu(cxTray, $('#cxBtn'), 360); cxTray.hidden = false; } });
  cxTray.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setTool(b.dataset.t); closeMenus(); } });
  modeMenu.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setMode(b.dataset.m); });
  tray.addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setTool(b.dataset.t); closeMenus(); } });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.menu') && !e.target.closest('#modeBtn') && !e.target.closest('#objBtn') && !e.target.closest('#cxBtn')) closeMenus(); });

  // ---------- tools ----------
  function setTool(t) { const d = cur; if (d.mode !== 'design') return; d.tool = d.tool === t ? null : t; d.custom = []; d.cx = []; refreshToolUI(); updateHint(); cv.classList.toggle('placing', !!d.tool); }
  function refreshToolUI() {
    const d = cur; if (!d) return;
    $('#inclineBtn').classList.toggle('armed', d.tool === 'incline');
    $('#objBtn').classList.toggle('armed', ['sphere', 'rect', 'poly', 'custom', 'wheel'].includes(d.tool));
    $('#cxBtn').classList.toggle('armed', !!CONN[d.tool]);
    $('#selBtn').classList.toggle('armed', !d.tool);
    $('#grabBtn').classList.toggle('armed', d.stool === 'grab'); $('#pushBtn').classList.toggle('armed', d.stool === 'push');
    cv.classList.toggle('placing', !!d.tool);
  }
  const CXHINT = {
    spring: ['Click the first end (on an object, or empty space to pin it to the world).', 'Click the other end. With both ends in empty space the spring becomes a stopper: the second end carries a pad that bodies can hit.'],
    rod: ['Click the first end of the rod. Each end is a free hinge.', 'Click the other end. Length is the distance between the ends; both ends can rotate.'],
    rope: ['Click where the rope starts (on an object, or empty space to tie it to the world).', 'Click a pulley to wrap the rope over it (an Atwood machine is: object, pulley, object), or click where the rope ends. Extensible or inextensible is set in Properties.'],
    linkage: ['Click the first joint: on an object, on a joint of an existing linkage, or in empty space for a free joint.', 'Click each next joint. Click the last joint again, double-click or press Enter to finish. Esc cancels. Start from a joint that already exists to branch, or click along a rod to attach to it (the rod stays whole). Alt-click a rod to split it with a hinge instead.'],
    chain: ['Click where the slack rope starts.', 'Click where it ends. It hangs and drapes over things, and collides with them.'],
    pin: ['Click a point on an object to hinge it. Click where two objects overlap to join them, or on one object to hinge it to the world.'],
    tspring: ['Click an existing hinge or the end of a rod to give it a torsion spring. Or click where two objects overlap to hinge them with one. A click on a single object hinges it to the world. The spring is relaxed at the pose you place it in.'],
    weld: ['Click where two objects overlap to weld them, or on one object to fix it to the world.'],
    slider: ['Click on an object (or where two overlap) to give it a sliding rail. Set the angle in Properties.']
  };
  function updateHint() {
    const d = cur, h = $('#hint');
    if (d && d.kind !== 'mech') { const t = (d.msg ? d.msg + ' ' : '') + (KU(d) ? KU(d).hint(d) : ''); h.hidden = !t.trim(); h.textContent = t; return; }
    if (d && d.kind === 'mech' && d.mode !== 'design') { h.hidden = d.stool !== 'push' && !d.msg; h.textContent = d.msg || (d.stool === 'push' ? 'Press on an object and drag toward where the force should point. The force is set in the toolbar.' : ''); return; }
    if (!d || d.kind !== 'mech' || !d.tool) { h.hidden = !(d && d.msg); h.textContent = d && d.msg || ''; return; }
    h.hidden = false;
    if (CONN[d.tool]) { h.textContent = (d.msg ? d.msg + ' ' : '') + CXHINT[d.tool][Math.min(d.cx.length, CXHINT[d.tool].length - 1)] + ' Shift keeps the tool. Esc cancels.'; return; }
    h.textContent = d.tool === 'custom' ? 'Click to add points (' + d.custom.length + '). Hold Shift for a straight line. Click the first point or press Enter to close. Backspace removes a point. Esc cancels.' : 'Click to place ' + LABEL[d.tool] + '. Shift keeps the tool. Esc cancels.';
  }
  $('#inclineBtn').addEventListener('click', () => setTool('incline'));
  $('#grabBtn').addEventListener('click', () => { cur.stool = 'grab'; refreshToolUI(); updateHint(); });
  $('#pushBtn').addEventListener('click', () => { cur.stool = 'push'; refreshToolUI(); updateHint(); });
  $('#selBtn').addEventListener('click', () => { cur.tool = null; cur.custom = []; cur.cx = []; refreshToolUI(); updateHint(); });
  $('#delBtn').addEventListener('click', deleteSel);
  $('#dupBtn').addEventListener('click', () => { const d = cur; if (d.kind !== 'mech') { const k = KU(d); if (k) k.dup(d); return; } if (d.mode !== 'design') return; const keep = S.clip; if (copySel(d)) { S.clip.n = 0; pasteClip(d); } else if (keep) S.clip = keep; });
  function removeConn(d, c) { if (c.type === 'chain') Phys.removeChain(d.world, c); else if (c.type === 'linkage') Phys.removeLink(d.world, c); else Phys.removeJoint(d.world, c); }
  function deleteSel() {
    const d = cur; if (d.kind !== 'mech') { const k = KU(d); if (k) k.del(d); return; } if (d.mode !== 'design') return;
    if (d.ms) { selIds(d).forEach(id => { const b = d.world.bodies.find(q => q.id === id && !q.hidden), c = conns(d).find(q => q.id === id); if (b) Phys.removeBody(d.world, b); else if (c) { removeConn(d, c); } }); d.sel = null; d.ms = null; renderWorkspace(); renderProps(); return; }
    const b = getSel(d), c = getConn(d);
    if (b) Phys.removeBody(d.world, b); else if (c) { removeConn(d, c); } else return;
    d.sel = null; d.ms = null; renderWorkspace(); renderProps();
  }
  $('#snapBtn').addEventListener('click', e => { S.snap = !S.snap; e.currentTarget.setAttribute('aria-pressed', S.snap); });
  $('#gridSel').addEventListener('change', e => { S.grid = parseFloat(e.target.value); });
  $('#fitBtn').addEventListener('click', () => fit(cur));
  $('#playBtn').addEventListener('click', () => { cur.playing = !cur.playing; updatePlayBtn(); });
  $('#stepBtn').addEventListener('click', () => { const d = cur; if (d.kind !== 'mech') { d.playing = false; updatePlayBtn(); const k = KU(d); if (k) k.step(d); return; } d.playing = false; updatePlayBtn(); for (let i = 0; i < 4; i++) Phys.step(d.world, Phys.DT); sampleTrails(d, true); refreshFields(); });
  $('#resetBtn').addEventListener('click', resetSim);
  $('#speedSel').addEventListener('change', e => { S.speed = parseFloat(e.target.value); });
  $('#gIn').addEventListener('change', e => { const v = parseFloat(e.target.value); if (isFinite(v)) cur.world.g = v; else e.target.value = cur.world.g; });
  $('#groundBtn').addEventListener('click', e => { cur.world.ground = !cur.world.ground; e.currentTarget.setAttribute('aria-pressed', cur.world.ground); });
  [['vecBtn', 'vectors'], ['trailBtn', 'trails'], ['gridBtn', 'showGrid'], ['shadeBtn', 'shading']].forEach(p => $('#' + p[0]).addEventListener('click', e => { S[p[1]] = !S[p[1]]; e.currentTarget.setAttribute('aria-pressed', S[p[1]]); }));
  $('#bgSel').addEventListener('change', e => { S.bg = e.target.value; });
  $('#wsHead').addEventListener('click', () => $('#ws').classList.toggle('collapsed'));
  $('#propsHead').addEventListener('click', () => $('#props').classList.toggle('collapsed'));
  if (window.matchMedia('(max-width: 760px)').matches) { $('#ws').classList.add('collapsed'); $('#props').classList.add('collapsed'); }

  function select(id) { cur.sel = id; cur.ms = null; cur.lnode = null; renderWorkspace(); renderProps(); }
  const isSel = (d, id) => id === d.sel || !!(d.ms && d.ms.has(id));
  const selIds = d => d.ms ? Array.from(d.ms) : (d.sel != null ? [d.sel] : []);
  function selectMany(d, ids) {
    ids = Array.from(new Set(ids));
    if (ids.length <= 1) { d.ms = null; d.sel = ids.length ? ids[0] : null; } else { d.ms = new Set(ids); d.sel = null; }
    renderWorkspace(); renderProps();
  }
  function toggleSel(d, id) { const ids = selIds(d), i = ids.indexOf(id); if (i >= 0) ids.splice(i, 1); else ids.push(id); selectMany(d, ids); }

  // ---------- undo, redo, saving ----------
  const SESSION_KEY = 'pholver.session.v1';
  const histOf = d => d.hist || (d.hist = { s: [], i: -1 });
  function checkpoint(d) {
    d = d || cur; if (!isDoc(d) || d.mode !== 'design') return;
    let s; try { s = JSON.stringify(serDoc(d)); } catch (e) { return; }
    const h = histOf(d); if (h.i >= 0 && h.s[h.i] === s) return;
    h.s.length = h.i + 1; h.s.push(s); if (h.s.length > 120) h.s.shift(); h.i = h.s.length - 1; persist();
  }
  function recount(d) {
    d.counts = {}; const seen = (kind, name) => { const m = /^(.*) (\d+)$/.exec(name || ''); if (m && m[1] === LABEL[kind]) d.counts[kind] = Math.max(d.counts[kind] || 0, +m[2]); };
    d.world.bodies.forEach(b => { if (!b.hidden) seen(b.kind, b.name); }); d.world.joints.forEach(j => { if (j.owner == null) seen(j.type, j.name); }); d.world.chains.forEach(c => seen('chain', c.name)); d.world.links.forEach(c => seen('linkage', c.name));
  }
  function loadWorld(d, data) {
    if (d.kind === 'em') { d.em = EM.deserialize(data); d.sel = null; d.ms = null; d.tool = null; applyMode(); renderWorkspace(); renderProps(); refreshToolUI(); updateHint(); return; }
    if (d.kind === 'ckt') { d.ck = CKT.deserialize(data); d.sel = null; d.ms = null; d.tool = null; d.wireFrom = null; applyMode(); renderWorkspace(); renderProps(); refreshToolUI(); updateHint(); return; }
    d.world = Phys.deserialize(data); d.sel = null; d.ms = null; d.snap = null; d.trails = {}; d.tool = null; d.cx = []; d.custom = [];
    applyMode(); renderWorkspace(); renderProps(); refreshToolUI(); updateHint();
  }
  function undoRedo(d, k) {
    if (d.mode !== 'design') return; checkpoint(d);
    const h = histOf(d), t = h.i + k; if (t < 0 || t >= h.s.length) { flash(d, k < 0 ? 'Nothing to undo.' : 'Nothing to redo.'); return; }
    h.i = t; loadWorld(d, JSON.parse(h.s[t])); persist();
  }
  const designState = d => { const h = histOf(d); return d.mode === 'design' || !h.s.length ? serDoc(d) : JSON.parse(h.s[h.i]); };
  function persist() {
    clearTimeout(persist.t);
    persist.t = setTimeout(() => {
      try {
        const keep = docs.filter(x => x.kind === 'mech' || (x.kind === 'em' && x.em) || (x.kind === 'ckt' && x.ck));
        localStorage.setItem(SESSION_KEY, JSON.stringify({ v: 1, cur: Math.max(0, keep.indexOf(cur)), untitled, docs: keep.map(x => ({ title: x.title, kind: x.kind, data: designState(x) })) }));
      } catch (e) { /* storage unavailable: the Save button still works */ }
    }, 500);
  }
  $('#undoBtn').addEventListener('click', () => undoRedo(cur, -1));
  $('#redoBtn').addEventListener('click', () => undoRedo(cur, 1));
  ['pointerup', 'change', 'keyup', 'click'].forEach(ev => document.addEventListener(ev, () => setTimeout(checkpoint, 0)));
  $('#saveBtn').addEventListener('click', async () => {
    const d = cur; if (!isDoc(d)) return;
    const name = (d.title.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-') || 'design') + '.pholver.json';
    try {
      const text = JSON.stringify({ app: 'pholver', v: 1, kind: d.kind, title: d.title, data: designState(d) }, null, 1);
      const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null;   // the artifact viewer saves files through this
      if (dl) await dl.save({ filename: name, data: text });
      else {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), a = document.createElement('a');
        a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 3000);
      }
      flash(d, 'Saved ' + name);
    } catch (e) { flash(d, e && e.code === 'declined' ? 'Save cancelled.' : 'Could not save a file from here.'); }
  });
  $('#openBtn').addEventListener('click', () => $('#openFile').click());
  $('#openFile').addEventListener('change', e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (j.app === 'pholver' && j.kind === 'ckt' && j.data && Array.isArray(j.data.items) && window.CKT) {
          const d = mkDoc(j.title || f.name.replace(/\.pholver\.json$|\.json$/, ''), 'ckt', false); d.ck = CKT.deserialize(j.data); switchDoc(d); checkpoint(d); persist(); return;
        }
        if (j.app === 'pholver' && j.kind === 'em' && j.data && Array.isArray(j.data.items) && window.EM) {
          const d = mkDoc(j.title || f.name.replace(/\.pholver\.json$|\.json$/, ''), 'em', false); d.em = EM.deserialize(j.data); switchDoc(d); checkpoint(d); persist(); return;
        }
        if (j.app !== 'pholver' || !j.data || !Array.isArray(j.data.bodies)) throw new Error('not a Pholver file');
        const d = mkDoc(j.title || f.name.replace(/\.pholver\.json$|\.json$/, ''), 'mech', false); d.world = Phys.deserialize(j.data); recount(d); switchDoc(d); checkpoint(d); persist();
      } catch (err) { flash(cur, 'That file is not a Pholver design.'); }
    };
    r.readAsText(f);
  });

  // ---------- area select, copy and paste ----------
  const bodyBox = b => {
    if (!b.verts) return { x0: b.x - b.r, y0: b.y - b.r, x1: b.x + b.r, y1: b.y + b.r };
    Phys.refresh(b); let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    b._wv.forEach(p => { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); });
    return { x0, y0, x1, y1 };
  };
  // Bodies inside the rectangle (dragged left to right: whole body inside; right to left: any overlap), plus every connector whose ends are all selected.
  function boxSelect(d, ax, ay, bx, by, crossing) {
    const W = d.world, x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by), ids = [], set = new Set();
    for (const b of visBodies(d)) {
      if (b === W.groundBody) continue;
      const q = bodyBox(b), hit = crossing ? !(q.x1 < x0 || q.x0 > x1 || q.y1 < y0 || q.y0 > y1) : (q.x0 >= x0 && q.x1 <= x1 && q.y0 >= y0 && q.y1 <= y1);
      if (hit) { ids.push(b.id); set.add(b); }
    }
    const inside = (b, l) => b ? set.has(b) : (l.x >= x0 && l.x <= x1 && l.y >= y0 && l.y <= y1);
    for (const j of W.joints) {
      if (j.owner != null) continue;
      const ends = [[j.a === W.anchor ? null : j.a, j.la], [j.b === W.anchor ? null : j.b, j.lb]].concat((j.wh || []).map(q => [q, null]));
      if (ends.some(e => e[0]) && ends.every(e => inside(e[0], e[1]))) ids.push(j.id);
    }
    for (const c of W.chains) if ((c.a.b || c.b.b) && inside(c.a.b, c.a.l) && inside(c.b.b, c.b.l)) ids.push(c.id);
    for (const c of W.links) if (c.nodes.every(n => inside(n.b, n.b ? n.l : Phys.linkNodePos(n)))) ids.push(c.id);
    return ids;
  }
  const BODY_SKIP = new Set(['id', 'parts', 'hulled', 'verts', 'area', 'ipm', 'br', 'cornerLocal', '_wv', '_wn', '_hv', '_hi', '_ct', '_gx', '_gy', '_ga', 'nc', 'im', 'iI']);
  function copySel(d) {
    const ids = new Set(selIds(d)); if (!ids.size || d.mode !== 'design') return false;
    const W = d.world, bodies = visBodies(d).filter(b => ids.has(b.id) && b !== W.groundBody), bset = new Set(bodies);
    if (!bodies.length && !Array.from(ids).some(id => conns(d).some(c => c.id === id))) return false;
    const clip = { n: 0, bodies: [], joints: [], chains: [], links: [] }, ref = b => b === W.anchor || b === null ? null : b.id;
    bodies.forEach(b => { const o = {}; for (const k in b) if (!BODY_SKIP.has(k)) o[k] = b[k]; clip.bodies.push({ id: b.id, kind: b.kind, o }); });
    const ok = (b) => b === W.anchor || b === null || bset.has(b);
    for (const j of W.joints) {
      if (j.owner != null) continue;
      if (j.pad) {   // a stopper is copied as the spring the user drew: mount end plus the tip as a point in space
        const m = j.a, tip = Phys.stopperTip(j);
        if (!(m === W.anchor || bset.has(m)) || !(m !== W.anchor ? bset.has(m) : ids.has(j.id))) continue;
        const keys = Object.keys(Phys.J.defaults('spring')).concat(['name', 'oc', 'L']), o = {};
        keys.forEach(k => { if (j[k] !== undefined && k !== 'pad' && k !== 'rail') o[k] = j[k]; });
        o.mode = 'stopper';
        clip.joints.push({ type: 'spring', a: ref(m), b: null, la: Object.assign({}, j.la), lb: { x: tip.x, y: tip.y }, o, wh: [], sg: [] }); continue;
      }
      const ends = [j.a, j.b].concat(j.wh || []), real = ends.filter(e => e !== W.anchor);
      if (!ends.every(ok) || !(real.some(e => bset.has(e)) || ids.has(j.id))) continue;
      const keys = Object.keys(Phys.J.defaults(j.type)).concat(['name', 'cc', 'oc', 'L']), o = {};
      keys.forEach(k => { if (j[k] !== undefined && !['wh', 'sg', 'act', 'phi', 'seq'].includes(k)) o[k] = j[k]; });
      clip.joints.push({ type: j.type, a: ref(j.a), b: ref(j.b), la: Object.assign({}, j.la), lb: Object.assign({}, j.lb), o, wh: (j.wh || []).map(q => q.id), sg: (j.sg || []).slice() });
    }
    for (const c of W.chains) {
      if (!ok(c.a.b) || !ok(c.b.b) || !((c.a.b && bset.has(c.a.b)) || (c.b.b && bset.has(c.b.b)) || ids.has(c.id))) continue;
      clip.chains.push({ a: { b: c.a.b ? c.a.b.id : null, l: Object.assign({}, c.a.l) }, b: { b: c.b.b ? c.b.b.id : null, l: Object.assign({}, c.b.l) }, o: { name: c.name, n: c.n, mass: c.mass, r: c.r, L: c.L, damp: c.damp, massless: c.massless } });
    }
    for (const c of W.links) {
      const att = c.nodes.filter(n => n.b); if (!att.every(n => bset.has(n.b)) || !(att.some(n => bset.has(n.b)) || ids.has(c.id))) continue;
      clip.links.push({ nodes: c.nodes.map(Phys.nodeSpec), edges: c.edges.map(e => e.slice()), o: { massless: c.massless, mass: c.mass, damp: c.damp, oc: c.oc } });
    }
    if (!clip.bodies.length && !clip.joints.length && !clip.chains.length && !clip.links.length) return false;
    S.clip = clip; flash(d, 'Copied ' + (clip.bodies.length + clip.joints.length + clip.chains.length + clip.links.length) + ' items. Ctrl+V to paste.'); return true;
  }
  function pasteClip(d) {
    const cl = S.clip; if (!cl || d.mode !== 'design' || d.kind !== 'mech') return false;
    const W = d.world, k = ++cl.n, dx = 0.5 * k, dy = -0.5 * k, map = new Map(), out = [];
    for (const r of cl.bodies) {
      const o = Object.assign({}, r.o, { x: r.o.x + dx, y: r.o.y + dy, name: nextName(d, r.kind) });
      if (o.pts) o.pts = o.pts.map(p => ({ x: p.x, y: p.y }));
      const nb = Phys.createBody(r.kind, o); W.bodies.push(nb); map.set(r.id, nb); out.push(nb.id);
    }
    const end = (id, l) => id == null ? { b: null, l: { x: l.x + dx, y: l.y + dy } } : { b: map.get(id), l: { x: l.x, y: l.y } };
    for (const r of cl.joints) {
      const A = end(r.a, r.la), B = end(r.b, r.lb); let j;
      if (r.type === 'wrap') {
        j = Phys.createWrap(W, A, B, r.wh.map(id => map.get(id)), { name: nextName(d, 'wrap') }); j.oc = r.o.oc; j.L = Math.max(r.o.L || 0, j.L);
      } else {
        const o = Object.assign({}, r.o, { name: nextName(d, r.type) });
        j = Phys.createJoint(W, r.type, A.b, B.b, A.l, B.l, o);
        if (r.type === 'spring') Phys.applyStopper(W, j);
      }
      out.push(j.id);
    }
    for (const r of cl.chains) {
      const c = Phys.createChain(W, end(r.a.b, r.a.l), end(r.b.b, r.b.l), Object.assign({}, r.o, { name: nextName(d, 'chain') })); out.push(c.id);
    }
    for (const r of (cl.links || [])) { const c = Phys.createLink(W, { nodes: r.nodes.map(n => Phys.nodeFrom(n, map, dx, dy)), edges: r.edges }, Object.assign({}, r.o, { name: nextName(d, 'linkage') })); out.push(c.id); }
    W.linkDirty = true; selectMany(d, out); return true;
  }
  function selectAll(d) { selectMany(d, visBodies(d).filter(b => b !== d.world.groundBody).map(b => b.id).concat(conns(d).map(c => c.id))); }

  // ---------- workspace list ----------
  function renderWorkspace() {
    const d = cur, el = $('#wsList'); el.innerHTML = ''; if (!isDoc(d)) return;
    const items = d.kind !== 'mech' ? (KU(d) ? KU(d).listItems(d) : []) : visBodies(d).map(b => ({ id: b.id, name: b.name, ic: b.kind })).concat(conns(d).map(c => ({ id: c.id, name: c.name, ic: c.type === 'wrap' ? 'rope' : c.type })));
    $('#wsCount').textContent = items.length;
    items.forEach(it => {
      const li = document.createElement('div'); li.className = 'item' + (isSel(d, it.id) ? ' sel' : '');
      li.innerHTML = '<span class="ic">' + ic(it.ic) + '</span><span class="nm"></span><button class="x" aria-label="Delete">' + ic('close') + '</button>';
      li.querySelector('.nm').textContent = it.name;
      li.addEventListener('click', e => { if (e.target.closest('.x')) { d.sel = it.id; deleteSel(); } else if (e.shiftKey || e.ctrlKey || e.metaKey) toggleSel(d, it.id); else select(it.id); });
      el.appendChild(li);
    });
    if (!items.length) { const p = document.createElement('p'); p.className = 'empty'; p.textContent = d.kind !== 'mech' ? 'Nothing here yet. Use Add in Design mode.' : 'No objects yet. Use Objects or Inclined Plane in Design mode.'; el.appendChild(p); }
  }

  // ---------- properties ----------
  let fields = [];
  const fmt = v => { if (!isFinite(v)) return ''; const r = Math.abs(v) < 1e-9 ? 0 : v; return String(+r.toFixed(4)); };
  const deg = r => { let a = r * 180 / Math.PI; a = ((a + 180) % 360 + 360) % 360 - 180; return a; };
  function mkHelpers(box, ro, getAfter) {
    const H = { ro };
    const rowOf = (label, unit, id, tip) => {
      const row = document.createElement('div'); row.className = 'row';
      if (tip) { row.dataset.tip = tip; row.tabIndex = 0; }
      const lb = document.createElement('label'); lb.htmlFor = id; lb.textContent = label;
      if (unit) { const u = document.createElement('span'); u.className = 'u'; u.textContent = unit; lb.appendChild(u); }
      row.appendChild(lb); return row;
    };
    H.sect = t => { const e = document.createElement('div'); e.className = 'sect'; e.textContent = t; box.appendChild(e); };
    H.note = t => { const e = document.createElement('p'); e.className = 'note'; e.textContent = t; box.appendChild(e); };
    H.num = (label, unit, get, set, o) => {
      o = o || {}; const id = 'f' + Math.random().toString(36).slice(2, 8), row = rowOf(label, unit, id, o.tip);
      const inp = document.createElement('input'); inp.id = id; inp.type = 'number'; inp.step = o.step || 0.1; row.appendChild(inp);
      if (o.min != null) inp.min = o.min; if (o.max != null) inp.max = o.max;
      inp.readOnly = (ro && !o.live) || !!o.ro; inp.value = fmt(get());
      inp.addEventListener('change', () => {
        let v = parseFloat(inp.value); if (!isFinite(v)) { inp.value = fmt(get()); return; }
        if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v);
        set(v); (o.after || getAfter)(); refreshFields(true);
      });
      box.appendChild(row); fields.push({ el: inp, get }); return inp;
    };
    H.read = (label, unit, get) => {
      const id = 'r' + Math.random().toString(36).slice(2, 8), row = rowOf(label, unit, id);
      const inp = document.createElement('input'); inp.id = id; inp.type = 'number'; inp.readOnly = true; row.appendChild(inp);
      inp.value = fmt(get()); box.appendChild(row); fields.push({ el: inp, get });
    };
    H.check = (label, get, set, o) => {
      o = o || {}; const id = 'c' + Math.random().toString(36).slice(2, 8), row = rowOf(label, '', id, o.tip); row.className = 'row check';
      const inp = document.createElement('input'); inp.id = id; inp.type = 'checkbox'; row.appendChild(inp);
      inp.checked = !!get(); inp.disabled = ro && !o.live;
      inp.addEventListener('change', () => { set(inp.checked); (o.after || getAfter)(); renderProps(); });
      box.appendChild(row);
    };
    H.select = (label, opts, get, set, o) => {
      o = o || {}; const id = 's' + Math.random().toString(36).slice(2, 8), row = rowOf(label, '', id, o.tip);
      const sel = document.createElement('select'); sel.id = id;
      opts.forEach(op => { const e = document.createElement('option'); e.value = op[0]; e.textContent = op[1]; sel.appendChild(e); });
      sel.value = get(); sel.disabled = ro && !o.live; row.appendChild(sel);
      sel.addEventListener('change', () => { set(sel.value); (o.after || getAfter)(); renderProps(); });
      box.appendChild(row);
    };
    H.button = (label, fn) => { const r = document.createElement('div'); r.className = 'row'; const bt = document.createElement('button'); bt.className = 'btn2'; bt.textContent = label; bt.addEventListener('click', fn); r.appendChild(bt); box.appendChild(r); };
    H.name = (obj, title) => {
      const row = document.createElement('div'); row.className = 'row'; row.innerHTML = '<label for="nmIn">Name</label><input id="nmIn" type="text">';
      const ni = row.lastChild; ni.value = obj.name; ni.readOnly = ro;
      ni.addEventListener('change', () => { obj.name = ni.value.trim() || obj.name; title.textContent = 'Properties: ' + obj.name; renderWorkspace(); }); box.appendChild(row);
    };
    return H;
  }
  const rad = v => v * Math.PI / 180;
  const nameOf = (w, b) => b === w.anchor ? 'World' : b.name;

  function linkProps(d, c, H) {
    const w = d.world, ro = H.ro, none = () => {}, reb = () => { Phys.rebuildLink(w, c); };
    H.note(c.nodes.length + ' joints and ' + c.edges.length + ' rods. Rod lengths come from how it is drawn, so reshape it in Design mode by dragging a free joint.');
    H.check('Massless joints', () => c.massless, v => { c.massless = v; }, { after: reb });
    if (!c.massless) H.num('Joint mass', 'kg', () => c.mass, v => { c.mass = v; }, { min: 0.001, step: 0.05, after: reb });
    H.check('Collide with objects', () => c.oc !== false, v => { c.oc = v; w.joints.forEach(j => { if (j.owner === c.id) j.oc = v; }); }, { live: true, after: none });
    const i = d.lnode, n = i != null ? c.nodes[i] : null;
    if (n) {
      H.sect('Joint ' + (i + 1));
      H.check(n.b || n.on || n.body.fixed ? 'Lock rods to ' + (n.b ? n.b.name : n.on ? 'the rod' : 'the world') : 'Lock angles between rods', () => !!n.lock, v => { n.lock = v; }, { after: reb });
      if (n.lock) H.note(n.b || n.on || n.body.fixed ? 'Every rod at this joint keeps its angle against it.' : 'The rods that meet here keep the angles between them, so the joint is rigid instead of a hinge.');
      if (n.on) {
        H.note('Attached partway along a rod, which stays whole and rigid.');
        H.num('Position along rod', '%', () => n.t * 100, v => { n.t = Math.max(2, Math.min(98, v)) / 100; Phys.syncLink(w, c); }, { min: 2, max: 98, step: 5 });
      } else if (n.b) H.note('Fixed to ' + n.b.name + ' at this point. Move the object to move the joint.');
      else {
        H.num('x', 'm', () => n.body.x, v => { n.body.x = v; Phys.syncLink(w, c); }, { step: 0.1 });
        H.num('y', 'm', () => n.body.y, v => { n.body.y = v; Phys.syncLink(w, c); }, { step: 0.1 });
        H.check('Pinned to the world', () => !!n.body.fixed, v => { n.body.fixed = v; n.fixed = v; }, { after: reb });
      }
      if (!ro) H.button('Remove this joint', () => { const kept = Phys.removeLinkNode(w, c, i); d.lnode = null; if (!kept) { d.sel = null; } renderWorkspace(); renderProps(); });
    } else H.note('Click a joint (a white dot) to edit it. Joints in empty space can be dragged in Design mode.');
  }
  function connProps(d, c, H, title) {
    const w = d.world, ro = H.ro, T = c.type, JR = () => Phys.J.read(c), none = () => {};
    title.textContent = 'Properties: ' + c.name; H.name(c, title);
    H.sect(LABEL[T]);
    const live = (label, unit, key) => H.read(label, unit, () => { const r = JR(); return r[key] === undefined ? NaN : (typeof r[key] === 'boolean' ? +r[key] : r[key]); });
    if (T === 'linkage') { linkProps(d, c, H); return; }
    if (T === 'chain') {
      H.note('Attached: ' + nameOf(w, c.a.b || w.anchor) + ' to ' + nameOf(w, c.b.b || w.anchor));
      const reb = () => { Phys.rebuildChain(w, c); };
      H.num('Length', 'm', () => c.L, v => { c.L = v; }, { min: 0.1, step: 0.1, after: reb });
      H.num('Links', '', () => c.n, v => { c.n = Math.round(v); }, { min: 4, max: 60, step: 1, after: reb });
      H.num('Total mass', 'kg', () => c.mass, v => { c.mass = v; }, { min: 0.01, step: 0.1, after: reb });
      H.num('Link radius', 'm', () => c.r, v => { c.r = v; }, { min: 0.01, max: 0.5, step: 0.01, after: reb });
      H.check('Massless links', () => c.massless, v => { c.massless = v; }, { after: reb });
      H.num('Damping', '1/s', () => c.damp, v => { c.damp = v; c.nodes.forEach(n => { n.ld = v; }); }, { min: 0, step: 0.1, live: true, after: none });
      H.note('A slack rope is a string of rigid links joined by hinges, so it sags, drapes over objects and cannot stretch. Use a plain Rope when it should stay taut.');
      if (ro) { H.sect('Live'); H.read('Arc length', 'm', () => Phys.chainLength(c)); H.read('Chord', 'm', () => { const a = c.nodes[0], b = c.nodes[c.nodes.length - 1]; return Math.hypot(b.x - a.x, b.y - a.y); }); }
      return;
    }
    H.note('Between ' + nameOf(w, c.a) + ' and ' + nameOf(w, c.b));
    const cc = () => { if (['rod', 'pulley', 'pin', 'weld', 'slider'].includes(T)) { H.check('Collide connected bodies', () => c.cc, v => { c.cc = v; w.linkDirty = true; }, { live: true, after: none }); } };
    if (T === 'spring' || T === 'rod' || T === 'rope') H.check('Collide with objects', () => c.oc !== false, v => { c.oc = v; }, { live: true, after: none });
    if (T === 'spring') {
      const freeEnd = c.pad || c.a === w.anchor || c.b === w.anchor;
      H.select('Free end', [['auto', 'Auto'], ['stopper', 'Stopper'], ['rigid', 'Pinned (rigid)']], () => c.mode || 'auto', v => { c.mode = v; Phys.applyStopper(w, c); Phys.layoutStoppers(w); }, { after: none });
      H.note(c.pad ? 'Stopper: the end in empty space carries a small pad on a rail along the spring. A body that hits the pad compresses the spring against the fixed end and is pushed back.'
        : (freeEnd ? 'The end in empty space is pinned to the world. Choose Stopper to turn it into a free pad (a bumper mounted on this object). Auto does that only when both ends are in empty space.'
          : 'Both ends are on objects, so there is no free end to act as a stopper.'));
      H.num('Rest length', 'm', () => c.L, v => { c.L = v; }, { min: 0.01, step: 0.05, live: true, after: none });
      if (!c.pad) {
        H.check('Lock angle at ' + nameOf(w, c.a), () => !!c.lkA, v => { Phys.J.setLock(c, 'a', v); }, { live: true, after: none });
        H.check('Lock angle at ' + nameOf(w, c.b), () => !!c.lkB, v => { Phys.J.setLock(c, 'b', v); }, { live: true, after: none });
        if (c.lkA || c.lkB) H.note('A locked end is rigid: the spring stays at the angle it had on that object, which cannot pivot about it. Fixed ends below is the flexible version.');
      }
      H.check('Fixed ends (no pivoting)', () => c.fix, v => { Phys.J.setFixedAxis(c, v); }, { live: true, after: none });
      if (c.fix) {
        H.num('Bending stiffness', 'N·m/rad', () => c.kb > 0 ? c.kb : Phys.J.bendStiff(c), v => { c.kb = Math.max(v, 0); }, { min: 0, step: 10, live: true, after: none });
        if (!ro) H.button('Fixed ends: use current angles as rest', () => { Phys.J.setFixedAxis(c, true); });
      }
      H.note(c.fix ? 'Each end is built into its object, so the object cannot pivot about the spring. It holds the angle between the object and the spring line, like a bending spring. Spheres and wheels still turn freely. Set Bending stiffness to 0 to use the default (k × length²).' : 'Off: each end is a free hinge, so the object can pivot about the point where the spring attaches.');
      H.num('Stiffness k', 'N/m', () => c.k, v => { c.k = v; }, { min: 0, step: 10, live: true, after: none });
      H.num('Damping c', 'N·s/m', () => c.c, v => { c.c = v; }, { min: 0, step: 0.5, live: true, after: none });
      if (ro) { H.sect('Live'); live('Length', 'm', 'len'); live('Extension', 'm', 'ext'); live('Force', 'N', 'force'); live('Elastic energy', 'J', 'pe'); }
    } else if (T === 'rod') {
      H.num('Length', 'm', () => c.L, v => { Phys.setDistance(w, c, v); }, { min: 0.05, step: 0.05, after: none });
      H.note('Rigid and massless: it holds the two ends exactly this far apart, pushing or pulling.');
      H.note('Each end is a free hinge unless you lock it (the rod then cannot turn on that object) or add a torsion spring.');
      [['a', 'ksA', 'csA', 'rA', c.a, 'lkA'], ['b', 'ksB', 'csB', 'rB', c.b, 'lkB']].forEach(([e, ks, cs, rr, bd, lk]) => {
        const lab = nameOf(w, bd);
        H.check('Lock angle at ' + lab, () => !!c[lk], v => { Phys.J.setLock(c, e, v); }, { live: true, after: none });
        H.check('Torsion spring at ' + lab, () => c[ks] > 0, v => { Phys.J.setRodEnd(c, e, v); }, { live: true });
        if (c[ks] > 0) {
          H.num('Stiffness at ' + lab, 'N·m/rad', () => c[ks], v => { c[ks] = Math.max(v, 0.0001); }, { min: 0.0001, step: 1, live: true, after: none });
          H.num('Damping at ' + lab, 'N·m·s/rad', () => c[cs], v => { c[cs] = v; }, { min: 0, step: 0.1, live: true, after: none });
          if (!ro) H.button('Rest angle = current pose (' + lab + ')', () => { Phys.J.setRodEnd(c, e, true); });
        }
      });
      if (c.ksA > 0 || c.ksB > 0) H.note('A rod end spring pulls the rod back to a fixed angle against the object it is mounted on, measured from the pose when it was switched on. Hinged to the world, the rod acts as a sprung arm.');
      if (ro) { H.sect('Live'); live('Length', 'm', 'len'); live('Force (+ tension)', 'N', 'tension'); }
    } else if (T === 'rope') {
      H.select('Type', [['rigid', 'Inextensible'], ['ext', 'Extensible']], () => c.ext ? 'ext' : 'rigid', v => { Phys.setRopeType(w, c, v === 'ext'); }, { after: none });
      H.num('Length', 'm', () => c.L, v => { Phys.setDistance(w, c, v); }, { min: 0.05, step: 0.05, after: none });
      if (c.ext) {
        H.num('Stiffness k', 'N/m', () => c.k, v => { c.k = v; }, { min: 1, step: 100, live: true, after: none });
        H.num('Damping c', 'N·s/m', () => c.c, v => { c.c = v; }, { min: 0, step: 1, live: true, after: none });
        H.note('Acts like a spring that only pulls. It goes slack when shorter than its length.');
      } else H.note('Cannot stretch. It goes slack when the ends are closer than its length and pulls only, never pushes.');
      if (ro) { H.sect('Live'); live('Distance', 'm', 'len'); live('Tension', 'N', 'tension'); live('Taut (1 = yes)', '', 'taut'); }
    } else if (T === 'wrap') {
      H.select('Type', [['rigid', 'Inextensible'], ['ext', 'Extensible']], () => c.ext ? 'ext' : 'rigid', v => { Phys.setRopeType(w, c, v === 'ext'); }, { after: none });
      if (c.ext) {
        H.num('Stiffness k', 'N/m', () => c.k, v => { c.k = v; }, { min: 1, step: 100, live: true, after: none });
        H.num('Damping c', 'N·s/m', () => c.c, v => { c.c = v; }, { min: 0, step: 1, live: true, after: none });
      }
      H.check('Collide with objects', () => c.oc !== false, v => { c.oc = v; Phys.J.wrapReset(c); }, { live: true, after: none });
      H.note(c.wh.length ? 'Runs over ' + c.wh.length + (c.wh.length === 1 ? ' pulley' : ' pulleys') + ': ' + c.wh.map(q => q.name).join(', ') + '. Grips a pulley without slipping.' : 'Inextensible and never pushes.');
      H.note('When taut it bends round any ball or corner in its way, and slides over them without friction. It lifts off again when it straightens.');
      H.num('Length', 'm', () => c.L, v => { c.L = c.ext ? Math.max(v, 0.05) : Math.max(v, Phys.J.wrapSync(c)); }, { min: 0.05, step: 0.05, after: none });
      H.note(c.ext ? 'Shorter than the path stretches it like a spring that only pulls. A pulley with mass still turns without slipping, so the tension can differ either side of it.' : 'Longer than the path gives slack. It cannot be shorter than the straight path.');
      H.note('A pulley with mass makes the tension differ on either side of it. A massless pulley keeps it equal.');
      if (ro) { H.sect('Live'); live('Length used', 'm', 'len'); live('Taut (1 = yes)', '', 'taut'); const n = (c.gimp || [0]).length; for (let i = 0; i < n; i++) H.read(n > 1 ? 'Tension, part ' + (i + 1) : 'Tension', 'N', () => (JR().tensions || [])[i] || 0); }
    } else if (T === 'pin') {
      H.check('Motor', () => c.motor, v => { c.motor = v; }, { live: true, after: none });
      if (c.motor) {
        H.num('Motor speed', 'rad/s', () => c.ms, v => { c.ms = v; }, { step: 0.5, live: true, after: none });
        H.num('Max torque', 'N·m', () => c.mt, v => { c.mt = Math.abs(v); }, { min: 0, step: 5, live: true, after: none });
      }
      H.check('Lock angle (no rotation)', () => !!c.lock, v => { c.lock = v; }, { live: true, after: none });
      if (c.lock) H.note('The two objects keep the angle between them, so the hinge only holds a point. Motor, limits and torsion spring are ignored while locked.');
      H.check('Angle limits', () => c.lim, v => { c.lim = v; }, { live: true, after: none });
      if (c.lim) {
        H.num('Lower', '°', () => c.lo * 180 / Math.PI, v => { c.lo = rad(Math.min(v, c.hi * 180 / Math.PI)); }, { step: 5, live: true, after: none });
        H.num('Upper', '°', () => c.hi * 180 / Math.PI, v => { c.hi = rad(Math.max(v, c.lo * 180 / Math.PI)); }, { step: 5, live: true, after: none });
        H.note('Limits are measured from the starting pose.');
      }
      H.sect('Torsion spring');
      H.num('Stiffness', 'N·m/rad', () => c.ks, v => { c.ks = v; }, { min: 0, step: 1, live: true, after: none });
      H.num('Damping', 'N·m·s/rad', () => c.cs, v => { c.cs = v; }, { min: 0, step: 0.1, live: true, after: none });
      if (c.ks > 0) {
        H.num('Rest angle', '°', () => c.ka * 180 / Math.PI, v => { c.ka = rad(v); }, { step: 5, live: true, after: none });
        if (!ro) H.button('Rest angle = current pose', () => { c.ka = c.b.a - c.a.a - c.ref; });
        H.note('The spring pulls the joint back to its rest angle, measured from the pose it was placed in. Stiffness is torque per radian, and 1 rad is about 57°.');
      }
      if (ro) { H.sect('Live'); H.read('Angle', '°', () => JR().angle * 180 / Math.PI); H.read('Rate', 'rad/s', () => JR().rate); H.read('Torque', 'N·m', () => JR().torque); H.read('Reaction force', 'N', () => JR().reaction); }
    } else if (T === 'weld') {
      H.note('Locks both bodies together with no relative motion, at the angle they had at the start.');
      if (ro) { H.sect('Live'); live('Reaction force', 'N', 'reaction'); }
    } else if (T === 'slider') {
      H.num('Rail angle', '°', () => c.ax * 180 / Math.PI, v => { c.ax = rad(v); }, { step: 5, after: none });
      H.check('Travel limits', () => c.lim, v => { c.lim = v; }, { live: true, after: none });
      if (c.lim) {
        H.num('Lower', 'm', () => c.lo, v => { c.lo = Math.min(v, c.hi); }, { step: 0.1, live: true, after: none });
        H.num('Upper', 'm', () => c.hi, v => { c.hi = Math.max(v, c.lo); }, { step: 0.1, live: true, after: none });
      }
      H.check('Motor', () => c.motor, v => { c.motor = v; }, { live: true, after: none });
      if (c.motor) {
        H.num('Motor speed', 'm/s', () => c.ms, v => { c.ms = v; }, { step: 0.1, live: true, after: none });
        H.num('Max force', 'N', () => c.mf, v => { c.mf = Math.abs(v); }, { min: 0, step: 10, live: true, after: none });
      }
      H.note('The rail angle is measured on the first body (the world when only one object is joined).');
      if (ro) { H.sect('Live'); live('Position', 'm', 'pos'); live('Speed', 'm/s', 'speed'); live('Drive force', 'N', 'force'); live('Reaction', 'N', 'reaction'); }
    } else if (T === 'pulley') {
      H.num('Ratio', '', () => c.ratio, v => { c.ratio = v; }, { min: 0.1, max: 10, step: 0.5, after: none });
      H.num('Wheel 1 x', 'm', () => c.ga.x, v => { c.ga.x = v; }, { after: none }); H.num('Wheel 1 y', 'm', () => c.ga.y, v => { c.ga.y = v; }, { after: none });
      H.num('Wheel 2 x', 'm', () => c.gb.x, v => { c.gb.x = v; }, { after: none }); H.num('Wheel 2 y', 'm', () => c.gb.y, v => { c.gb.y = v; }, { after: none });
      H.note('One rope over two fixed wheels: length A + ratio x length B stays constant. Ratio 2 models a 2:1 mechanical advantage.');
      if (ro) { H.sect('Live'); live('Side A', 'm', 'lenA'); live('Side B', 'm', 'lenB'); live('Tension', 'N', 'tension'); }
    }
    if (c.cc !== undefined || ['pin', 'weld', 'slider'].includes(T)) { H.sect('Collision'); cc(); }
  }

  function renderProps() {
    const d = cur, box = $('#propsBody'), title = $('#propsTitle'); box.innerHTML = ''; fields = [];
    if (d && d.kind !== 'mech') { if (KU(d)) KU(d).renderProps(d, box, title); return; }
    if (!d || d.kind !== 'mech') return;
    if (d.ms && d.ms.size > 1) {
      $('#props').classList.add('sel'); title.textContent = 'Properties: ' + d.ms.size + ' selected';
      const H = mkHelpers(box, d.mode !== 'design', () => {});
      H.note('Drag any selected object to move them all together. Ctrl+C copies the selection with the connectors between them, Ctrl+V pastes it, Delete removes it. Shift-click adds or removes one item; Shift-drag on empty space selects an area.');
      if (d.mode === 'design') { H.button('Copy (Ctrl+C)', () => copySel(d)); H.button('Duplicate (Ctrl+D)', () => $('#dupBtn').click()); H.button('Delete (Del)', deleteSel); }
      return;
    }
    const b = getSel(d), c = getConn(d); $('#props').classList.toggle('sel', !!(b || c));
    if (!b && !c) { title.textContent = 'Properties'; box.innerHTML = '<p class="empty">Select an object or connector to see its parameters.</p>'; return; }
    const ro = d.mode !== 'design';
    if (c) { connProps(d, c, mkHelpers(box, ro, () => {}), title); return; }
    title.textContent = 'Properties: ' + b.name;
    const H = mkHelpers(box, ro, () => Phys.rebuild(b)), { sect, num, check } = H;
    H.name(b, title);

    sect('Position');
    num('x', 'm', () => b.x, v => { b.x = v; }); num('y', 'm', () => b.y, v => { b.y = v; });
    num('Angle', '°', () => deg(b.a), v => { b.a = v * Math.PI / 180; }, { step: 1 });
    sect('Shape');
    if (b.kind === 'sphere') num('Radius', 'm', () => b.r, v => { b.r = v; }, { min: 0.05, step: 0.05 });
    if (b.kind === 'rect') { num('Width', 'm', () => b.W, v => { b.W = v; }, { min: 0.05 }); num('Height', 'm', () => b.H, v => { b.H = v; }, { min: 0.05 }); }
    if (b.kind === 'poly') { num('Sides', '', () => b.n, v => { b.n = Math.round(v); }, { min: 3, max: 12, step: 1 }); num('Radius', 'm', () => b.R, v => { b.R = v; }, { min: 0.05, step: 0.05 }); }
    if (b.kind === 'incline') {
      num('Base', 'm', () => b.base, v => { b.base = v; }, { min: 0.5 }); num('Height', 'm', () => b.height, v => { b.height = v; }, { min: 0.1 });
      num('Slope angle', '°', () => Math.atan2(b.height, b.base) * 180 / Math.PI, v => { b.height = b.base * Math.tan(Math.min(80, Math.max(1, v)) * Math.PI / 180); }, { min: 1, max: 80, step: 0.5 });
      if (!ro) H.button('Mirror slope', () => { b.flip = !b.flip; Phys.rebuild(b); });
    }
    if (b.kind === 'wheel') {
      num('Radius', 'm', () => b.r, v => { b.r = v; }, { min: 0.05, step: 0.05 });
      check('Fixed axle (spins freely)', () => b.axle, v => { Phys.setAxle(d.world, b, v); }, { after: () => {} });
      H.note('With a fixed axle the pulley stays at its centre and only turns. Untick it for a movable pulley that hangs from its rope.');
      if (b.axle) {
        check('Motor (drives the pulley)', () => !!b.motor, v => { b.motor = v; if (v && !(b.mt > 0)) { b.mt = 20; if (b.ms == null) b.ms = 2; } }, { live: true });
        if (b.motor) {
          num('Motor speed', 'rad/s', () => b.ms || 0, v => { b.ms = v; }, { step: 0.5, live: true });
          num('Max torque', 'N·m', () => b.mt, v => { b.mt = Math.abs(v); }, { min: 0, step: 5, live: true });
        }
        num('Axle friction', '1/s', () => b.ld || 0, v => { b.ld = Math.max(v, 0) || undefined; }, { min: 0, step: 0.1, live: true });
        H.note('To hang weights over a pulley (an Atwood machine), use the Rope connector: click one object, then the pulley, then the other object. The pulley turns as the rope moves. A motor turns it by itself and drags the rope along; friction slows it.');
      }
    }
    if (b.kind === 'custom') H.note('Curved outlines are sampled into a polygon. Dents and hollows are kept: the outline is split into convex pieces for collisions' + (b.parts ? ' (' + b.parts.length + ' here).' : '.') + (b.hulled ? ' This outline crossed itself, so it was filled in.' : ''));
    sect('Mass');
    num('Mass', 'kg', () => b.m, v => { b.m = v; }, { min: 0.001, step: 0.1 });
    num('Moment of inertia', 'kg·m²', () => b.I, v => { b.I = v; b.autoI = false; }, { min: 0.0001, step: 0.01, ro: b.autoI });
    check('Massless (no weight, no inertia)', () => b.massless, v => { b.massless = v; }, { live: true });
    check('Ignore gravity (still has inertia)', () => b.nog, v => { b.nog = v || undefined; }, { live: true });
    check('Calculate inertia from shape', () => b.autoI, v => { b.autoI = v; });
    sect('Surface');
    num('mu_k', '', () => b.muk, v => { b.muk = v; }, { min: 0, step: 0.05 }); num('mu_s', '', () => b.mus, v => { b.mus = v; }, { min: 0, step: 0.05 });
    num('Restitution', '', () => b.e, v => { b.e = v; }, { min: 0, max: 1, step: 0.05 });
    sect('Applied loads');
    const nr = () => {};
    num('Force x', 'N', () => b.fx, v => { b.fx = v; }, { step: 1, live: true, after: nr }); num('Force y', 'N', () => b.fy, v => { b.fy = v; }, { step: 1, live: true, after: nr });
    num('Torque', 'N·m', () => b.tq, v => { b.tq = v; }, { step: 1, live: true, after: nr });
    num('Linear drag', '1/s', () => b.ld, v => { b.ld = v; }, { min: 0, step: 0.1, live: true, after: nr });
    sect(ro ? 'Velocity (live)' : 'Initial velocity');
    num('vx', 'm/s', () => b.vx, v => { b.vx = v; }); num('vy', 'm/s', () => b.vy, v => { b.vy = v; }); num('ω', 'rad/s', () => b.w, v => { b.w = v; });
    check('Fixed in place', () => b.fixed, v => { b.fixed = v; if (v) { b.vx = b.vy = b.w = 0; } }, { live: true });
    if (ro) {
      const live = document.createElement('div'); live.className = 'live'; box.appendChild(live);
      const H2 = mkHelpers(live, true, () => {});
      H2.read('Speed', 'm/s', () => Math.hypot(b.vx, b.vy)); H2.read('Kinetic energy', 'J', () => 0.5 * b.m * (b.vx * b.vx + b.vy * b.vy) + 0.5 * b.I * b.w * b.w);
      H2.read('Potential energy', 'J', () => b.m * d.world.g * b.y);
    }
  }
  function refreshFields(force) { fields.forEach(f => { if (force || document.activeElement !== f.el) f.el.value = f.fm ? f.fm(f.get()) : fmt(f.get()); }); }
  const regField = (el, get, fm) => { fields.push({ el, get, fm }); };

  // ---------- view ----------
  let cw = 800, ch = 500, dpr = 1;
  function resize() {
    dpr = window.devicePixelRatio || 1; cw = stage.clientWidth; ch = stage.clientHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    cvEm.width = cv.width; cvEm.height = cv.height;
    if (window.EM3DGL) EM3DGL.resize(cw, ch, dpr);
  }
  new ResizeObserver(resize).observe(stage); resize();
  function fit(d) {
    if (d && d.kind !== 'mech') { if (KU(d)) KU(d).fit(d); return; }
    if (!d || d.kind !== 'mech') return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const addP = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    d.world.joints.forEach(j => { if (j.owner != null) return; const a = Phys.J.pt(j.a, j.la), b = Phys.J.pt(j.b, j.lb); addP(a.x, a.y); addP(b.x, b.y); if (j.type === 'pulley') { addP(j.ga.x, j.ga.y); addP(j.gb.x, j.gb.y); } });
    d.world.chains.forEach(c => c.nodes.forEach(n => addP(n.x, n.y)));
    d.world.links.forEach(c => c.nodes.forEach(n => { const q = Phys.linkNodePos(n); addP(q.x, q.y); }));
    visBodies(d).forEach(b => {
      if (!b.verts) { x0 = Math.min(x0, b.x - b.r); x1 = Math.max(x1, b.x + b.r); y0 = Math.min(y0, b.y - b.r); y1 = Math.max(y1, b.y + b.r); return; }
      Phys.refresh(b); b._wv.forEach(p => { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); });
    });
    if (!isFinite(x0)) { x0 = -6; x1 = 6; y0 = 0; y1 = 6; }
    if (d.world.ground) y0 = Math.min(y0, 0);
    const wide = cw > 760, L = wide && !$('#ws').classList.contains('collapsed') ? 250 : 20, R = wide && !$('#props').classList.contains('collapsed') ? 300 : 20;
    const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
    const s = Math.max(8, Math.min(300, Math.min((cw - L - R - 40) / w, (ch - 140) / h)));
    d.view = { s, ox: L + (cw - L - R) / 2 - (x0 + x1) / 2 * s, oy: ch - 70 + (y0) * s - 0 + 0 };
    d.view.oy = ch / 2 + (y0 + y1) / 2 * s + 20;
  }
  const toW = (px, py) => ({ x: (px - cur.view.ox) / cur.view.s, y: (cur.view.oy - py) / cur.view.s });
  const snapPt = w => S.snap ? { x: Math.round(w.x / S.grid) * S.grid, y: Math.round(w.y / S.grid) * S.grid } : { x: w.x, y: w.y };

  // ---------- pointer interaction ----------
  let drag = null, mouse = { px: 0, py: 0, x: 0, y: 0, in: false }, spaceDown = false;
  // stage (not cv) because cv is display:none for 'em' docs, and a hidden element's bounding rect is all zeros
  const posOf = e => { const r = stage.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const flash = (d, m) => { d.msg = m; updateHint(); clearTimeout(flash.t); flash.t = setTimeout(() => { d.msg = ''; updateHint(); }, 2600); };
  const P2 = (d, q) => ({ x: sx(d.view, q.x), y: sy(d.view, q.y) });
  function segDist(px, py, x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy; let t = l2 > 0 ? ((px - x0) * dx + (py - y0) * dy) / l2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
  }
  const POINTY = { pin: 1, weld: 1, slider: 1 };
  function connPoint(c) { const w = cur.world, bM = c.b === w.anchor || c.b.fixed; return bM ? Phys.J.pt(c.b, c.lb) : Phys.J.pt(c.a, c.la); }
  // The connector under the pointer (screen position p), or null.
  function hitConn(d, p) {
    let best = null, bd = 1e9;
    for (const c of conns(d)) {
      let dist = 1e9;
      if (c.type === 'linkage') {
        const ps = c.nodes.map(n => P2(d, Phys.linkNodePos(n)));
        ps.forEach(q => { const h = Math.hypot(p.x - q.x, p.y - q.y); if (h < 10) dist = Math.min(dist, h - 4); });
        c.edges.forEach(e => { const a = ps[e[0]], b = ps[e[1]]; if (a && b) dist = Math.min(dist, segDist(p.x, p.y, a.x, a.y, b.x, b.y)); });
      } else if (c.type === 'chain' || c.type === 'wrap') {
        const pts = (c.type === 'chain' ? c.nodes : Phys.J.wrapPoly(c)).map(n => P2(d, n)), e0 = pts[0], e1 = pts[pts.length - 1];
        if (Math.hypot(p.x - e0.x, p.y - e0.y) > 12 && Math.hypot(p.x - e1.x, p.y - e1.y) > 12) for (let i = 1; i < pts.length; i++) dist = Math.min(dist, segDist(p.x, p.y, pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y) - 1);
      } else if (POINTY[c.type]) {
        const q = P2(d, connPoint(c)), h = Math.hypot(p.x - q.x, p.y - q.y); if (h < 10) dist = h - 4;
      } else {
        const a = P2(d, Phys.J.pt(c.a, c.la)), b = P2(d, Phys.J.pt(c.b, c.lb));
        if (c.type === 'pulley') {
          const g1 = P2(d, c.ga), g2 = P2(d, c.gb);
          if (Math.hypot(p.x - g1.x, p.y - g1.y) < 11 || Math.hypot(p.x - g2.x, p.y - g2.y) < 11) dist = 2;
          else if (Math.hypot(p.x - a.x, p.y - a.y) > 12 && Math.hypot(p.x - b.x, p.y - b.y) > 12) dist = Math.min(segDist(p.x, p.y, a.x, a.y, g1.x, g1.y), segDist(p.x, p.y, g1.x, g1.y, g2.x, g2.y), segDist(p.x, p.y, g2.x, g2.y, b.x, b.y));
        } else if (Math.hypot(p.x - a.x, p.y - a.y) > 12 && Math.hypot(p.x - b.x, p.y - b.y) > 12) dist = segDist(p.x, p.y, a.x, a.y, b.x, b.y);
      }
      if (dist < (POINTY[c.type] ? 8 : 6) && dist < bd) { bd = dist; best = c; }
    }
    return best;
  }
  // a joint of any linkage within reach of the pointer (screen position p)
  function linkNodeAt(d, p) {
    let best = null, bd = 10;
    d.world.links.forEach(c => c.nodes.forEach((n, i) => { const q = P2(d, Phys.linkNodePos(n)), h = Math.hypot(p.x - q.x, p.y - q.y); if (h < bd) { bd = h; best = { c, i, n }; } }));
    return best;
  }
  // a point on a rod of any linkage near the pointer: the closest spot on the rod, in world units
  function linkEdgeAt(d, p) {
    let best = null, bd = 9; const v = d.view;
    d.world.links.forEach(c => c.edges.forEach(e => {
      const a = Phys.linkNodePos(c.nodes[e[0]]), b = Phys.linkNodePos(c.nodes[e[1]]), A = P2(d, a), B = P2(d, b);
      const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy; if (L2 < 1) return;
      const t = Math.max(0, Math.min(1, ((p.x - A.x) * dx + (p.y - A.y) * dy) / L2)), h = Math.hypot(p.x - (A.x + t * dx), p.y - (A.y + t * dy));
      if (h < bd && t > 0.02 && t < 0.98) { bd = h; best = { c, x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) }; }
    }));
    return best;
  }
  function chainNodeAt(d, p) {
    let best = null, bd = 12;
    d.world.chains.forEach(c => c.nodes.forEach(n => { const q = P2(d, n), h = Math.hypot(p.x - q.x, p.y - q.y); if (h < bd) { bd = h; best = n; } }));
    return best;
  }
  // ----- simulation interaction: grab (drag with the mouse) and push (apply a force) -----
  function startGrab(d, b, w) {
    const paused = !d.playing;
    d.world.pose = paused;
    Phys.startDrag(d.world, b, w.x, w.y, paused ? { hertz: 15, zeta: 1, maxF: 1e7 } : {});
    drag = { type: 'grab', b, d, pose: paused, t0: d.world.t };
  }
  function startPush(d, b, w) { drag = { type: 'push', b, d, l: Phys.localOf(b, w.x, w.y) }; }
  function endGrab() {
    if (!drag || (drag.type !== 'grab' && drag.type !== 'push')) return;
    const W = drag.d.world; Phys.endDrag(W); W.pose = false; W.pushes = []; drag = null;
  }
  function pushForce() { return parseFloat($('#pushF').value) || 0; }
  function updatePush() {
    if (!drag || drag.type !== 'push') return;
    const b = drag.b, W = drag.d.world, q = Phys.J.pt(b, drag.l), dx = mouse.x - q.x, dy = mouse.y - q.y, L = Math.hypot(dx, dy), F = pushForce();
    W.pushes = L > 0.03 && F ? [{ b, fx: F * dx / L, fy: F * dy / L, px: q.x, py: q.y }] : [];
  }

  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('pointerdown', e => {
    const d = cur; if (!d || d.kind !== 'mech') return; closeMenus();
    const p = posOf(e), w = toW(p.x, p.y); cv.setPointerCapture(e.pointerId);
    const pan = () => { drag = { type: 'pan', x: p.x, y: p.y, ox: d.view.ox, oy: d.view.oy }; cv.classList.add('panning'); };
    mouse = { px: p.x, py: p.y, x: w.x, y: w.y, in: true, shift: e.shiftKey };
    if (e.button === 1 || e.button === 2 || spaceDown) { pan(); return; }
    if (e.button !== 0) return;
    if (d.mode === 'design' && d.tool) { placeTool(d, w, e); return; }
    if (d.mode === 'design') {
      const sb = getSel(d), hh = sb && handleAt(d, sb, p);
      if (hh) { drag = { type: 'resize', b: sb, h: hh.id }; return; }
      const c = hitConn(d, p), hit0 = Phys.pick(d.world, w.x, w.y), additive = e.shiftKey || e.ctrlKey || e.metaKey;
      const ln = !additive && linkNodeAt(d, p);
      if (ln && !(d.ms && d.ms.has(ln.c.id))) { select(ln.c.id); d.lnode = ln.i; renderProps(); if (!ln.n.b && !ln.n.on) drag = { type: 'lnode', c: ln.c, n: ln.n }; return; }
      if (additive && !(e.ctrlKey || e.metaKey) && !c && !hit0) { drag = { type: 'box', x0: p.x, y0: p.y, x1: p.x, y1: p.y, w0: w, base: selIds(d) }; return; }
      if (additive && (c || hit0)) { toggleSel(d, (c || hit0).id); return; }
      if (c) { select(c.id); return; }
      const hit = hit0 && hit0 !== d.world.groundBody ? hit0 : null;
      if (hit && d.ms && d.ms.has(hit.id)) {
        drag = { type: 'move', items: visBodies(d).filter(b => d.ms.has(b.id)).map(b => ({ b, dx: b.x - w.x, dy: b.y - w.y })) }; return;
      }
      if (hit) { select(hit.id); drag = { type: 'move', b: hit, dx: hit.x - w.x, dy: hit.y - w.y }; }
      else { if (d.sel != null || d.ms) select(null); pan(); }
      return;
    }
    // simulate / render
    const node = chainNodeAt(d, p), tb = node || Phys.pick(d.world, w.x, w.y);
    if (tb) {
      select(node ? node.owner : tb.id);
      if (tb.fixed) { flash(d, 'That object is fixed in place. Untick "Fixed in place" in Design mode to move it.'); return; }
      if (d.stool === 'push') startPush(d, tb, w); else startGrab(d, tb, w);
      return;
    }
    const c = hitConn(d, p);
    if (c) { select(c.id); return; }
    if (d.sel != null) select(null); pan();
  });
  cv.addEventListener('pointermove', e => {
    const d = cur; if (!d || d.kind !== 'mech') return; const p = posOf(e), w = toW(p.x, p.y);
    mouse = { px: p.x, py: p.y, x: w.x, y: w.y, in: true, shift: e.shiftKey };
    if (!drag) { const sb = getSel(d); cv.style.cursor = d.mode === 'design' && !d.tool && sb && handleAt(d, sb, p) ? 'pointer' : ''; return; }
    if (drag.type === 'resize') { resizeTo(drag.b, drag.h, w); refreshFields(true); }
    else if (drag.type === 'pan') { d.view.ox = drag.ox + p.x - drag.x; d.view.oy = drag.oy + p.y - drag.y; }
    else if (drag.type === 'box') { drag.x1 = p.x; drag.y1 = p.y; }
    else if (drag.type === 'lnode') { const q = snapPt(w); drag.n.body.x = q.x; drag.n.body.y = q.y; Phys.syncLink(d.world, drag.c); refreshFields(true); }
    else if (drag.type === 'move' && drag.items) {
      const f = drag.items[0], q = snapPt({ x: w.x + f.dx, y: w.y + f.dy }), sx0 = q.x - (w.x + f.dx), sy0 = q.y - (w.y + f.dy);
      drag.items.forEach(it => { it.b.x = w.x + it.dx + sx0; it.b.y = w.y + it.dy + sy0; });
    }
    else if (drag.type === 'move') { const q = snapPt({ x: w.x + drag.dx, y: w.y + drag.dy }); drag.b.x = q.x; drag.b.y = q.y; refreshFields(); }
    else if (drag.type === 'grab') Phys.moveDrag(d.world, w.x, w.y);
  });
  const endDrag = () => {
    if (drag && drag.type === 'box') {
      const d = cur, w1 = toW(drag.x1, drag.y1);
      if (Math.hypot(drag.x1 - drag.x0, drag.y1 - drag.y0) > 4) selectMany(d, drag.base.concat(boxSelect(d, drag.w0.x, drag.w0.y, w1.x, w1.y, drag.x1 < drag.x0)));
    }
    if (drag && (drag.type === 'grab' || drag.type === 'push')) endGrab(); drag = null; cv.classList.remove('panning'); refreshFields(true); };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);
  cv.addEventListener('pointerleave', () => { mouse.in = false; });
  cv.addEventListener('dblclick', e => { if (cur.tool === 'custom') { if (cur.custom.length) cur.custom[0].s = e.shiftKey; finishCustom(cur); } });
  cv.addEventListener('wheel', e => {
    const d = cur; if (!d || d.kind !== 'mech') return; e.preventDefault();
    const p = posOf(e), w = toW(p.x, p.y), f = Math.exp(-e.deltaY * 0.0015), s = Math.max(6, Math.min(600, d.view.s * f));
    d.view.s = s; d.view.ox = p.x - w.x * s; d.view.oy = p.y + w.y * s;
  }, { passive: false });

  // Outline through the clicked points. A point with s = true is reached by a straight segment
  // (Shift held when it was placed); every other segment bends through a smooth Hermite curve.
  function curvePath(pts, closed) {
    const P = [];
    pts.forEach(p => { const l = P[P.length - 1]; if (!l || Math.hypot(p.x - l.x, p.y - l.y) > 1e-6) P.push(p); });
    if (closed && P.length > 1 && Math.hypot(P[0].x - P[P.length - 1].x, P[0].y - P[P.length - 1].y) < 1e-6) P.pop();
    const n = P.length, out = [];
    if (n < 3) return P.map(p => ({ x: p.x, y: p.y }));
    const per = Math.max(6, Math.min(16, Math.ceil(64 / n)));
    const dir = (u, v, len) => { const dx = v.x - u.x, dy = v.y - u.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l * len, y: dy / l * len }; };
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const a = P[i], b = P[(i + 1) % n];
      out.push({ x: a.x, y: a.y });
      if (b.s) continue;
      const p0 = closed ? P[(i - 1 + n) % n] : P[i - 1], p3 = closed ? P[(i + 2) % n] : P[i + 2];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const m0 = p0 && !a.s ? dir(p0, b, len) : dir(a, b, len);
      const m1 = p3 && !p3.s ? dir(a, p3, len) : dir(a, b, len);
      for (let k = 1; k < per; k++) {
        const t = k / per, t2 = t * t, t3 = t2 * t;
        const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
        out.push({ x: h00 * a.x + h10 * m0.x + h01 * b.x + h11 * m1.x, y: h00 * a.y + h10 * m0.y + h01 * b.y + h11 * m1.y });
      }
    }
    if (!closed) out.push({ x: P[n - 1].x, y: P[n - 1].y });
    return out;
  }

  // Drag handles for resizing the selected object (Design mode)
  function handlesOf(b) {
    const c = Math.cos(b.a), s = Math.sin(b.a), out = [];
    const L = (lx, ly, id) => out.push({ id, x: b.x + lx * c - ly * s, y: b.y + lx * s + ly * c });
    if (b.kind === 'sphere') L(b.r, 0, 'r');
    else if (b.kind === 'rect') { L(b.W / 2, 0, 'w+'); L(-b.W / 2, 0, 'w-'); L(0, b.H / 2, 'h+'); L(0, -b.H / 2, 'h-'); L(b.W / 2, b.H / 2, 'wh'); }
    else if (b.kind === 'poly') L(0, b.R, 'R');
    else if (b.kind === 'incline') { L(b.verts[1].x, b.verts[1].y, 'base'); L(b.verts[2].x, b.verts[2].y, 'height'); }
    return out;
  }
  function handleAt(d, b, p) { return handlesOf(b).find(h => Math.hypot(sx(d.view, h.x) - p.x, sy(d.view, h.y) - p.y) < 10) || null; }
  function resizeTo(b, id, w) {
    const c = Math.cos(b.a), s = Math.sin(b.a), dx = w.x - b.x, dy = w.y - b.y;
    const lx = dx * c + dy * s, ly = -dx * s + dy * c;
    const q = v => S.snap ? Math.round(v / S.grid) * S.grid : v;
    const shift = (ox, oy) => { b.x += ox * c - oy * s; b.y += ox * s + oy * c; };
    if (id === 'r') b.r = Math.max(0.05, q(Math.hypot(lx, ly)));
    else if (id === 'R') b.R = Math.max(0.05, q(Math.hypot(lx, ly)));
    else if (b.kind === 'rect') {
      if (id === 'w+' || id === 'wh') { const n = Math.max(0.1, q(lx + b.W / 2)); shift((n - b.W) / 2, 0); b.W = n; }
      if (id === 'w-') { const n = Math.max(0.1, q(b.W / 2 - lx)); shift(-(n - b.W) / 2, 0); b.W = n; }
      if (id === 'h+' || id === 'wh') { const n = Math.max(0.1, q(ly + b.H / 2)); shift(0, (n - b.H) / 2); b.H = n; }
      if (id === 'h-') { const n = Math.max(0.1, q(b.H / 2 - ly)); shift(0, -(n - b.H) / 2); b.H = n; }
    } else if (b.kind === 'incline') {
      const cl = b.cornerLocal;
      if (id === 'base') b.base = Math.max(0.5, q(lx - cl.x));
      if (id === 'height') b.height = Math.max(0.1, q(ly - cl.y));
    }
    Phys.rebuild(b);
  }

  // The attachment under a click: the body there (with a point local to it) or a fixed point in the world.
  function attPoint(d, w) {
    const b = Phys.pick(d.world, w.x, w.y); let q = snapPt(w);
    if (b) {
      if (Math.hypot(w.x - b.x, w.y - b.y) * d.view.s < 10) q = { x: b.x, y: b.y };
      else if (!Phys.pointInBody(b, q.x, q.y)) q = { x: w.x, y: w.y };
      return { b, l: Phys.localOf(b, q.x, q.y), x: q.x, y: q.y };
    }
    return { b: null, l: { x: q.x, y: q.y }, x: q.x, y: q.y };
  }
  // Turn the clicked joints into rods. Joints that belong to existing linkages are shared, so linkages touched by the new chain become one.
  function finishLink(d, keep) {
    const W = d.world, pts = d.cx; d.cx = [];
    if (pts.length < 2) { updateHint(); return; }
    const sync = c => c.nodes.forEach(n => { if (!n.b && !n.on && n.body) { n.x = n.body.x; n.y = n.body.y; n.fixed = !!n.body.fixed; } });
    const olds = []; pts.forEach(a => { const o = a.node ? a.node.c : a.edge; if (o && !olds.includes(o)) olds.push(o); });
    let c = olds[0] || null; const idx = new Map();
    if (c) {
      sync(c);
      for (const o of olds.slice(1)) {
        sync(o); const off = c.nodes.length;
        o.nodes.forEach(n => c.nodes.push(Object.assign({}, n, n.on ? { on: [n.on[0] + off, n.on[1] + off] } : {})));
        o.edges.forEach(e2 => c.edges.push([e2[0] + off, e2[1] + off]));
        idx.set(o, off); Phys.removeLink(W, o);
      }
    }
    const tol = 0.12 / Math.max(0.3, d.view.s / 100);
    const ids = pts.map(a => {
      if (a.edge) { // a click on a rod: a tap on it (the rod stays whole), or with Alt a joint that splits it in two
        let k = -1, bd = 1e9, bt = 0;
        c.edges.forEach((e2, m) => { const p0 = Phys.linkNodePos(c.nodes[e2[0]]), p1 = Phys.linkNodePos(c.nodes[e2[1]]), dx = p1.x - p0.x, dy = p1.y - p0.y, L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((a.x - p0.x) * dx + (a.y - p0.y) * dy) / L2)), h = Math.hypot(a.x - p0.x - t * dx, a.y - p0.y - t * dy); if (h < bd) { bd = h; k = m; bt = t; } });
        if (k < 0 || bd > tol) { c.nodes.push({ b: null, x: a.x, y: a.y, fixed: false }); return c.nodes.length - 1; }
        const e2 = c.edges[k];
        if (!a.split) { c.nodes.push({ on: [e2[0], e2[1]], t: bt, x: a.x, y: a.y }); return c.nodes.length - 1; }
        c.nodes.push({ b: null, x: a.x, y: a.y, fixed: false }); const nn = c.nodes.length - 1;
        c.edges.splice(k, 1, [e2[0], nn], [nn, e2[1]]); return nn;
      }
      if (a.node) return a.node.i + (a.node.c === c ? 0 : idx.get(a.node.c));
      const n = a.b ? { b: a.b, l: { x: a.l.x, y: a.l.y } } : { b: null, x: a.x, y: a.y, fixed: false };
      if (!c) { c = { _new: true, nodes: [], edges: [] }; }
      c.nodes.push(n); return c.nodes.length - 1;
    });
    for (let k = 1; k < ids.length; k++) {
      const i = ids[k - 1], j = ids[k]; if (i === j || c.edges.some(e2 => (e2[0] === i && e2[1] === j) || (e2[0] === j && e2[1] === i))) continue;
      c.edges.push([i, j]);
    }
    if (c._new) c = Phys.createLink(W, { nodes: c.nodes, edges: c.edges }, { name: nextName(d, 'linkage') });
    else Phys.rebuildLink(W, c);
    if (!keep) d.tool = null;
    refreshToolUI(); select(c.id); updateHint();
  }
  function placeConn(d, w, e) {
    const t = d.tool, W = d.world; d.msg = '';
    const done = j => { d.cx = []; if (!e.shiftKey) d.tool = null; refreshToolUI(); select(j.id); updateHint(); };
    if (t === 'pulley') {
      if (d.cx.length < 2) {
        const a = attPoint(d, w);
        if (!a.b) { flash(d, 'Click on an object that will hang from the rope.'); return; }
        if (d.cx.length === 1 && a.b === d.cx[0].b) { flash(d, 'Pick a different object for the second side.'); return; }
        d.cx.push(a);
      } else { const q = snapPt(w); d.cx.push({ x: q.x, y: q.y }); }
      if (d.cx.length < 4) { updateHint(); return; }
      const [a, b, g1, g2] = d.cx, pa = Phys.attachPos(a), pb = Phys.attachPos(b);
      const j = Phys.createJoint(W, 'pulley', a.b, b.b, a.l, b.l, { ga: { x: g1.x, y: g1.y }, gb: { x: g2.x, y: g2.y }, ratio: 1, L: Math.hypot(pa.x - g1.x, pa.y - g1.y) + Math.hypot(pb.x - g2.x, pb.y - g2.y), name: nextName(d, t) });
      done(j); return;
    }
    if (t === 'linkage') {
      const ln = linkNodeAt(d, P2(d, w)), last = d.cx[d.cx.length - 1];
      let a;
      if (ln) { const q = Phys.linkNodePos(ln.n); a = { b: null, x: q.x, y: q.y, node: { c: ln.c, i: ln.i } }; }
      else if (linkEdgeAt(d, P2(d, w))) { const h = linkEdgeAt(d, P2(d, w)); a = { b: null, x: h.x, y: h.y, edge: h.c, split: e.altKey }; }
      else { a = attPoint(d, w); if (a.b && a.b.hidden) a.b = null; }
      if (last && Math.hypot(a.x - last.x, a.y - last.y) * d.view.s < 8) { finishLink(d, e.shiftKey); return; }
      d.cx.push(a); updateHint(); return;
    }
    if (CONN[t] === 2) {
      if (t === 'rope' && d.cx.length) { // a click on a pulley wheel routes the rope over it
        const hb = Phys.pick(W, w.x, w.y), prev = d.cx[d.cx.length - 1];
        if (hb && hb.kind === 'wheel' && !(prev.wheel === hb)) { d.cx.push({ wheel: hb }); updateHint(); return; }
      }
      const a = attPoint(d, w);
      if (!d.cx.length) { d.cx.push(a); updateHint(); return; }
      const a0 = d.cx[0], wheels = d.cx.slice(1).map(e => e.wheel);
      if (t === 'rope') {
        const q0 = Phys.attachPos(a0), q1 = Phys.attachPos(a);
        if (Math.hypot(q1.x - q0.x, q1.y - q0.y) < 0.05) { flash(d, 'Click the far end of the rope.'); return; }
        if (!wheels.length) {   // over a pulley the ends may be on the same object (or both on the world); a plain rope needs two different anchors
          if (!a0.b && !a.b) { flash(d, 'At least one end must be on an object.'); return; }
          if (a0.b && a.b === a0.b) { flash(d, 'Pick the other end on a different object, or in empty space. (Click a pulley first to loop the rope back to the same object.)'); return; }
        }
        done(Phys.createWrap(W, a0, a, wheels, { name: nextName(d, 'wrap') })); return;
      }
      if (t !== 'chain' && t !== 'spring' && !a0.b && !a.b) { flash(d, 'At least one end must be on an object.'); return; }
      if (a0.b && a.b === a0.b) { flash(d, 'Pick the other end on a different object, or in empty space.'); return; }
      const p0 = Phys.attachPos(a0), p1 = Phys.attachPos(a), L = Math.hypot(p1.x - p0.x, p1.y - p0.y);
      if (L < 0.05) { flash(d, 'The two ends are too close together.'); return; }
      let j;
      if (t === 'chain') j = Phys.createChain(W, { b: a0.b, l: a0.l }, { b: a.b, l: a.l }, { name: nextName(d, t) });
      else j = Phys.createJoint(W, t, a0.b, a.b, a0.l, a.l, { L, name: nextName(d, t) });
      if (t === 'spring') { Phys.applyStopper(W, j); if (!j.pad && (Phys.J.clampsEnd(j, 0) || Phys.J.clampsEnd(j, 1))) Phys.J.setFixedAxis(j, true); }
      done(j); return;
    }
    // one-point joints: pin, weld, slider
    if (t === 'tspring') { // merge with a connector already under the click: its hinge, or the end of a rod
      const p = P2(d, w), pin = conns(d).find(c => c.type === 'pin' && Math.hypot(p.x - P2(d, connPoint(c)).x, p.y - P2(d, connPoint(c)).y) < 12);
      if (pin) { if (!(pin.ks > 0)) { pin.ks = 20; if (!(pin.cs > 0)) pin.cs = 0.3; } flash(d, 'Added a torsion spring to ' + pin.name + '.'); done(pin); return; }
      for (const c of conns(d)) {
        if (c.type !== 'rod') continue;
        for (const e of ['a', 'b']) {
          const q2 = P2(d, Phys.J.pt(c[e], c[e === 'a' ? 'la' : 'lb']));
          if (Math.hypot(p.x - q2.x, p.y - q2.y) < 12) { Phys.J.setRodEnd(c, e, true); flash(d, 'Added a torsion spring to the end of ' + c.name + ' on ' + nameOf(W, c[e]) + '.'); done(c); return; }
        }
      }
    }
    const at = attPoint(d, w), q = { x: at.x, y: at.y };
    const hits = W.bodies.filter(b => !b.hidden && Phys.pointInBody(b, q.x, q.y));
    if (!hits.length) { flash(d, 'Click on an object.'); return; }
    const B = hits[hits.length - 1], A = hits.length > 1 ? hits[hits.length - 2] : W.anchor;
    const ts = t === 'tspring', j = Phys.createJoint(W, ts ? 'pin' : t, A, B, Phys.localOf(A, q.x, q.y), Phys.localOf(B, q.x, q.y), Object.assign({ ref: B.a - A.a, name: nextName(d, t) }, ts ? { ks: 20, cs: 0.3 } : {}));
    done(j);
  }
  function placeTool(d, w, e) {
    if (CONN[d.tool]) { placeConn(d, w, e); return; }
    const t = d.tool, q = snapPt(w);
    if (t === 'custom') {
      const c = d.custom;
      if (c.length >= 3 && Math.hypot(q.x - c[0].x, q.y - c[0].y) * d.view.s < 12) { c[0].s = e.shiftKey; finishCustom(d); return; }
      const last = c[c.length - 1];
      if (last && Math.hypot(q.x - last.x, q.y - last.y) < 1e-6) return;
      c.push({ x: q.x, y: q.y, s: e.shiftKey }); updateHint(); return;
    }
    const b = Phys.createBody(t, { x: q.x, y: q.y }); b.name = nextName(d, t); d.world.bodies.push(b);
    if (!e.shiftKey) d.tool = null; refreshToolUI(); updateHint(); select(b.id);
  }
  function finishCustom(d) {
    const h = Phys.cleanPoly(curvePath(d.custom, true), 0.004); d.custom = [];
    if (h.length >= 3) {
      const b = Phys.createBody('custom', { pts: h }); b.x = -b.cornerLocal.x; b.y = -b.cornerLocal.y; b.name = nextName(d, 'custom'); d.world.bodies.push(b); d.tool = null; select(b.id);
      if (b.hulled) flash(d, 'The outline crosses itself, so it was filled in to a convex shape. Draw it without crossing to keep dents.');
    }
    refreshToolUI(); updateHint();
  }

  document.addEventListener('keydown', e => {
    if (e.target.matches('input, select, textarea')) return;
    const d = cur; if (!d || d.kind !== 'mech') return;
    if ((e.ctrlKey || e.metaKey) && d.mode === 'design') {
      const k = e.key.toLowerCase();
      if (k === 'z') { undoRedo(d, e.shiftKey ? 1 : -1); e.preventDefault(); return; }
      if (k === 'y') { undoRedo(d, 1); e.preventDefault(); return; }
    }
    if ((e.ctrlKey || e.metaKey) && d.mode === 'design' && !d.tool) {
      const k = e.key.toLowerCase();
      if (k === 'c') { copySel(d); e.preventDefault(); return; }
      if (k === 'x') { if (copySel(d)) deleteSel(); e.preventDefault(); return; }
      if (k === 'v') { pasteClip(d); e.preventDefault(); return; }
      if (k === 'a') { selectAll(d); e.preventDefault(); return; }
      if (k === 'd') { $('#dupBtn').click(); e.preventDefault(); return; }
    }
    if (e.key === ' ') { spaceDown = true; if (d.mode !== 'design') { d.playing = !d.playing; updatePlayBtn(); } e.preventDefault(); }
    else if (e.key === '1') setMode('design'); else if (e.key === '2') setMode('sim'); else if (e.key === '3') setMode('render');
    else if (e.key === 'r' || e.key === 'R') resetSim();
    else if (e.key === 'Escape') { d.tool = null; d.custom = []; d.cx = []; refreshToolUI(); updateHint(); closeMenus(); }
    else if (e.key === 'Enter' && d.tool === 'linkage') finishLink(d, e.shiftKey);
    else if (e.key === 'Enter' && d.tool === 'custom') { if (d.custom.length) d.custom[0].s = e.shiftKey; finishCustom(d); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { if (d.tool === 'custom' && d.custom.length) { d.custom.pop(); updateHint(); } else if (CONN[d.tool] && d.cx.length) { d.cx.pop(); updateHint(); } else deleteSel(); }
    else if ((e.key === '[' || e.key === ']') && d.mode === 'design') { const b = getSel(d); if (b) { b.a += (e.key === ']' ? -1 : 1) * Math.PI / 12; refreshFields(true); } }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Shift') mouse.shift = true; });
  document.addEventListener('keyup', e => { if (e.key === ' ') spaceDown = false; if (e.key === 'Shift') mouse.shift = false; });

  // ---------- drawing ----------
  const THEMES = {
    paper: { bg: '#d2d3d4', minor: 'rgba(40,60,75,.09)', major: 'rgba(40,60,75,.2)', axis: 'rgba(40,60,75,.5)', ground: '#bcc0c3', gline: '#2b3a45', ink: '#14191d', mark: '#9bb7c9', fixed: '#2a3238' },
    graphite: { bg: '#22282d', minor: 'rgba(255,255,255,.05)', major: 'rgba(255,255,255,.11)', axis: 'rgba(255,255,255,.38)', ground: '#191e22', gline: '#8fa3b0', ink: '#cfd8de', mark: '#22282d', fixed: '#41505b' },
    blueprint: { bg: '#1d3b63', minor: 'rgba(200,225,255,.1)', major: 'rgba(200,225,255,.22)', axis: 'rgba(200,225,255,.55)', ground: '#17304f', gline: '#bcd6f2', ink: '#e4f0ff', mark: '#1d3b63', fixed: '#3c6291' }
  };
  const RCOL = { wheel: '#b9a46a', sphere: '#e28b2c', rect: '#6b8da5', poly: '#6f9a86', custom: '#8d7fa8', incline: '#506e82' };
  // Reads an app theme CSS variable once and caches it, so Canvas2D draw calls stay in sync with the CSS palette.
  const themeColorCache = {};
  const themeColor = name => {
    if (themeColorCache[name]) return themeColorCache[name];
    const v = getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim();
    return (themeColorCache[name] = v || '#f29a1e');
  };
  const themeRGBA = (name, a) => {
    const hex = themeColor(name).replace('#', ''), n = parseInt(hex, 16);
    return 'rgba(' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',') + ',' + a + ')';
  };
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); const c = k => Math.max(0, Math.min(255, Math.round(((n >> k) & 255) * f))); return 'rgb(' + c(16) + ',' + c(8) + ',' + c(0) + ')'; }
  function niceStep(v) { const p = Math.pow(10, Math.floor(Math.log10(v))), m = v / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
  const sx = (v, x) => v.ox + x * v.s, sy = (v, y) => v.oy - y * v.s;

  function drawGrid(d, T) {
    const v = d.view, major = niceStep(70 / v.s), minor = major / 5;
    const x0 = (0 - v.ox) / v.s, x1 = (cw - v.ox) / v.s, y1 = (v.oy - 0) / v.s, y0 = (v.oy - ch) / v.s;
    const lines = (step, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const X = Math.round(sx(v, x)) + .5; ctx.moveTo(X, 0); ctx.lineTo(X, ch); }
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const Y = Math.round(sy(v, y)) + .5; ctx.moveTo(0, Y); ctx.lineTo(cw, Y); }
      ctx.stroke();
    };
    if (minor * v.s > 9) lines(minor, T.minor);
    lines(major, T.major);
    ctx.strokeStyle = T.axis; ctx.lineWidth = 1.5; ctx.beginPath();
    const X = Math.round(sx(v, 0)) + .5, Y = Math.round(sy(v, 0)) + .5; ctx.moveTo(X, 0); ctx.lineTo(X, ch); ctx.moveTo(0, Y); ctx.lineTo(cw, Y); ctx.stroke();
  }
  function bodyPath(b, v) {
    ctx.beginPath();
    if (!b.verts) { ctx.arc(0, 0, b.r * v.s, 0, Math.PI * 2); return; }
    b.verts.forEach((p, i) => { const X = p.x * v.s, Y = -p.y * v.s; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.closePath();
  }
  function drawBody(b, d, T, render, ghost) {
    const v = d.view; ctx.save(); ctx.translate(sx(v, b.x), sy(v, b.y)); ctx.rotate(-b.a);
    if (ghost) ctx.globalAlpha = .4;
    bodyPath(b, v);
    if (render && S.shading) {
      const base = RCOL[b.kind], r = b.br * v.s; let g;
      if (!b.verts) { g = ctx.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r * 1.05); g.addColorStop(0, shade(base, 1.35)); g.addColorStop(1, shade(base, .62)); }
      else { g = ctx.createLinearGradient(-r, -r, r, r); g.addColorStop(0, shade(base, 1.25)); g.addColorStop(1, shade(base, .7)); }
      ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6; ctx.fillStyle = g;
    } else ctx.fillStyle = render ? RCOL[b.kind] : (b.fixed ? T.fixed : T.ink);
    ctx.fill(); ctx.shadowColor = 'transparent';
    if (b.kind === 'wheel') {
      const R = b.r * v.s; ctx.strokeStyle = render ? 'rgba(0,0,0,.4)' : T.mark; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, R * .72, 0, 7); ctx.stroke();
      ctx.beginPath(); for (let k = 0; k < 3; k++) { const a = k * 2.0944; ctx.moveTo(0, 0); ctx.lineTo(R * .72 * Math.cos(a), R * .72 * Math.sin(a)); } ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, Math.max(3, R * .14), 0, 7); ctx.fillStyle = b.axle ? '#f1f6fa' : T.mark; ctx.fill(); ctx.strokeStyle = render ? '#333' : T.ink; ctx.lineWidth = 1.5; ctx.stroke();
    } else if (!b.verts) { ctx.strokeStyle = render ? 'rgba(0,0,0,.35)' : T.mark; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(b.r * v.s * .92, 0); ctx.stroke(); }
    if (!ghost && isSel(d, b.id)) { bodyPath(b, v); ctx.strokeStyle = themeColor('blue-700'); ctx.lineWidth = 3.5; ctx.stroke(); }
    ctx.restore();
  }
  function arrow(x0, y0, x1, y1, color) {
    const L = Math.hypot(x1 - x0, y1 - y0); if (L < 4) return; const a = Math.atan2(y1 - y0, x1 - x0);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - 9 * Math.cos(a - .4), y1 - 9 * Math.sin(a - .4)); ctx.lineTo(x1 - 9 * Math.cos(a + .4), y1 - 9 * Math.sin(a + .4)); ctx.closePath(); ctx.fill();
  }

  // ---------- connectors ----------
  function poly(pts, width, color, sel, dash) {
    if (pts.length < 2) return;
    const path = () => { ctx.beginPath(); pts.forEach((q, i) => { if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (sel) { ctx.save(); ctx.setLineDash([]); ctx.strokeStyle = themeRGBA('blue-700', .6); ctx.lineWidth = width + 7; path(); ctx.stroke(); ctx.restore(); }
    ctx.save(); if (dash) ctx.setLineDash(dash); ctx.strokeStyle = color; ctx.lineWidth = width; path(); ctx.stroke(); ctx.restore();
  }
  function dot(q, r, fill, stroke) { ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, 7); ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.8; ctx.stroke(); } }
  function springPts(a, b, coils) {
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy); if (len < 3) return [a, b];
    const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, end = Math.min(len * 0.15, 20), amp = Math.min(9, Math.max(3, len * 0.07)), pts = [a, { x: a.x + ux * end, y: a.y + uy * end }];
    const span = len - 2 * end, n = coils * 2;
    for (let i = 1; i < n; i++) { const t = i / n, sg = i % 2 ? 1 : -1; pts.push({ x: a.x + ux * (end + span * t) + nx * amp * sg, y: a.y + uy * (end + span * t) + ny * amp * sg }); }
    pts.push({ x: b.x - ux * end, y: b.y - uy * end }, b); return pts;
  }
  // Coiled torsion spring at q. Its size follows the zoom (world units), so it stays in proportion to the objects.
  // base is the world angle of the relaxed direction, th the twist. The coil shows more turns and a tint with the twist direction.
  function drawCoil(v, q, base, th) {
    const s = v.s, r0 = Math.max(3, 0.1 * s), r1 = Math.max(7, 0.24 * s), tw = Math.max(-1, Math.min(1, th / 1.5));
    ctx.save(); ctx.beginPath();
    for (let i = 0; i <= 60; i++) { const f = i / 60, ang = -(base + f * (2.2 * Math.PI + th)), r = r0 + (r1 - r0) * f, X = q.x + r * Math.cos(ang), Y = q.y + r * Math.sin(ang); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }
    ctx.strokeStyle = tw > 0.02 ? '#c2410c' : tw < -0.02 ? '#1b5fa8' : '#6b7a8a'; ctx.lineWidth = Math.max(1.2, Math.min(2.4, 0.03 * s)); ctx.stroke(); ctx.restore();
  }
  function drawConn(c, d, T, render) {
    const v = d.view, sel = isSel(d, c.id), W = d.world, ink = render ? T.ink : '#2b3a45', rope = render ? '#c8a36d' : '#7a5a35';
    const S2 = q => ({ x: sx(v, q.x), y: sy(v, q.y) });
    ctx.save();
    if (c.type === 'chain') {
      const pts = c.nodes.map(S2), link = Math.max(2, c.L / c.n * v.s), wd = Math.max(4, c.r * 2 * v.s);
      poly(pts, wd + 2, render ? '#1d2328' : '#2b3a45', sel);
      poly(pts, Math.max(1.5, wd - 2.5), render ? '#aeb9c0' : '#8fa3b0', false, [link * 0.78, link * 0.22]);
      dot(pts[0], 4, '#f1f6fa', ink); dot(pts[pts.length - 1], 4, '#f1f6fa', ink);
      ctx.restore(); return;
    }
    if (c.type === 'linkage') {
      const ps = c.nodes.map(n => S2(Phys.linkNodePos(n)));
      c.edges.forEach(e => { const a = ps[e[0]], b = ps[e[1]]; if (!a || !b) return; poly([a, b], 7, ink, sel); poly([a, b], 3, render ? '#9fb0ba' : '#9db3c0', false); });
      c.nodes.forEach((n, i) => {
        const q = ps[i]; if (sel && d.lnode === i) dot(q, 11.5, themeRGBA('blue-700', .6));
        if (n.on) dot(q, 5.5, '#f1f6fa', ink); else if (!n.b && n.body.fixed) { dot(q, 8.5, ink); dot(q, 3.5, '#f1f6fa'); } else { dot(q, 7.5, '#f1f6fa', ink); dot(q, 2.2, ink, ink); }
      });
      ctx.restore(); return;
    }
    const A = S2(Phys.J.pt(c.a, c.la)), B = S2(Phys.J.pt(c.b, c.lb));
    if (c.type === 'spring') {
      poly(springPts(A, B, Math.max(5, Math.min(26, Math.round(c.L * 6)))), 2.2, render ? '#e6ecf0' : '#3c5a6b', sel);
      dot(A, 3.5, '#f1f6fa', ink);
      if (c.pad) { ctx.beginPath(); ctx.arc(B.x, B.y, Math.max(5, c.pad.r * v.s), 0, 7); ctx.fillStyle = render ? T.ink : '#2b3a45'; ctx.fill(); ctx.strokeStyle = '#f1f6fa'; ctx.lineWidth = 1.5; ctx.stroke(); dot(B, 2.2, '#f1f6fa', null); }
      else dot(B, 3.5, '#f1f6fa', ink);
    } else if (c.type === 'rod') {
      poly([A, B], 7, ink, sel); poly([A, B], 3, render ? '#9fb0ba' : '#9db3c0', false);
      [A, B].forEach(P => { dot(P, 7.5, '#f1f6fa', ink); dot(P, 2.2, ink, ink); });
      if (c.ksA > 0 || c.ksB > 0) { const rr = Phys.J.read(c); if (c.ksA > 0) drawCoil(v, A, c.a.a + c.rA, rr.thA || 0); if (c.ksB > 0) drawCoil(v, B, c.b.a + c.rB, rr.thB || 0); }
    } else if (c.type === 'rope') {
      const pa = Phys.J.pt(c.a, c.la), pb = Phys.J.pt(c.b, c.lb), dist = Math.hypot(pb.x - pa.x, pb.y - pa.y);
      let pts = [A, B];
      if (!c.ext && dist < c.L * 0.998 && c.L > 0.05) pts = Phys.catenaryLayout(pa, pb, c.L, 28).map(S2);
      else if (c.ext && dist > c.L) { /* stretched: straight */ }
      poly(pts, 3.2, rope, sel, c.ext ? [9, 3] : null);
      dot(A, 3.5, '#f1f6fa', ink); dot(B, 3.5, '#f1f6fa', ink);
    } else if (c.type === 'wrap') {
      const pts = Phys.J.wrapPoly(c).map(S2);
      poly(pts, 3.2, rope, sel);
      dot(A, 3.5, '#f1f6fa', ink); dot(B, 3.5, '#f1f6fa', ink);
    } else if (c.type === 'pulley') {
      const g1 = S2(c.ga), g2 = S2(c.gb);
      poly([A, g1, g2, B], 3, rope, sel);
      [g1, g2].forEach(g => { dot(g, 10, '#f1f6fa', ink); dot(g, 2.5, ink); });
      dot(A, 3.5, '#f1f6fa', ink); dot(B, 3.5, '#f1f6fa', ink);
    } else {
      const q = S2(connPoint(c));
      if (c.type === 'pin') {
        if (c.lim) { const base = c.a.a + c.ref; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.arc(q.x, q.y, 20, -(base + c.hi), -(base + c.lo)); ctx.closePath(); ctx.fillStyle = themeRGBA('attention', .25); ctx.fill(); ctx.strokeStyle = themeRGBA('attention', .9); ctx.lineWidth = 1.5; ctx.stroke(); }
        if (c.ks > 0) drawCoil(v, q, c.a.a + c.ref + c.ka, c.b.a - c.a.a - c.ref - c.ka);
        if (c.motor) { ctx.beginPath(); ctx.arc(q.x, q.y, 13, .4, 4.9); ctx.strokeStyle = themeColor('attention'); ctx.lineWidth = 2.2; ctx.stroke(); }
        if (sel) dot(q, 11, themeRGBA('blue-700', .6));
        dot(q, 6.5, '#f1f6fa', ink); dot(q, 2, ink);
      } else if (c.type === 'weld') {
        if (sel) dot(q, 12, themeRGBA('blue-700', .6));
        ctx.fillStyle = '#f1f6fa'; ctx.strokeStyle = ink; ctx.lineWidth = 1.8; ctx.fillRect(q.x - 6, q.y - 6, 12, 12); ctx.strokeRect(q.x - 6, q.y - 6, 12, 12);
        ctx.beginPath(); ctx.moveTo(q.x - 4, q.y - 4); ctx.lineTo(q.x + 4, q.y + 4); ctx.moveTo(q.x + 4, q.y - 4); ctx.lineTo(q.x - 4, q.y + 4); ctx.stroke();
      } else if (c.type === 'slider') {
        const pa = Phys.J.pt(c.a, c.la), ang = c.a.a + c.ax, ux = Math.cos(ang), uy = Math.sin(ang);
        const lo = c.lim ? c.lo : -1.2, hi = c.lim ? c.hi : 1.2;
        const r0 = S2({ x: pa.x + ux * lo, y: pa.y + uy * lo }), r1 = S2({ x: pa.x + ux * hi, y: pa.y + uy * hi });
        poly([r0, r1], 5, ink, sel); poly([r0, r1], 2, '#f1f6fa', false);
        if (c.lim) [r0, r1].forEach(e => { dot(e, 4, themeColor('attention'), ink); });
        dot(q, 5.5, '#f1f6fa', ink);
      }
    }
    ctx.restore();
  }
  function forceArrow(d, x, y, fx, fy, color) {
    const v = d.view, F = Math.hypot(fx, fy); if (F < 1e-9) return;
    const len = Math.min(110, 18 + 9 * Math.sqrt(F)), X = sx(v, x), Y = sy(v, y);
    arrow(X, Y, X + fx / F * len, Y - fy / F * len, color);
  }
  function draw(d) {
    const render = d.mode === 'render', T = THEMES[render ? S.bg : 'paper'], v = d.view;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = T.bg; ctx.fillRect(0, 0, cw, ch);
    if (d.mode === 'design' || S.showGrid) drawGrid(d, T);
    if (d.world.ground) { const Y = sy(v, 0); ctx.fillStyle = T.ground; ctx.fillRect(0, Y, cw, ch - Y); ctx.strokeStyle = T.gline; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, Y); ctx.lineTo(cw, Y); ctx.stroke(); }
    if (S.trails && d.mode !== 'design') {
      ctx.lineWidth = 2; ctx.lineJoin = 'round';
      d.world.bodies.forEach(b => { const t = d.trails[b.id]; if (b.hidden || !t || t.length < 2) return; ctx.strokeStyle = render ? 'rgba(255,255,255,.55)' : 'rgba(27,95,168,.55)'; ctx.beginPath(); t.forEach((p, i) => { const X = sx(v, p.x), Y = sy(v, p.y); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke(); });
    }
    d.world.bodies.forEach(b => { if (!b.hidden) drawBody(b, d, T, render, false); });
    conns(d).forEach(c => drawConn(c, d, T, render));
    if (S.vectors && d.mode !== 'design') d.world.bodies.forEach(b => { if (!b.fixed && !b.hidden) arrow(sx(v, b.x), sy(v, b.y), sx(v, b.x + b.vx * 0.4), sy(v, b.y + b.vy * 0.4), render ? '#ffffff' : '#1b5fa8'); });
    visBodies(d).forEach(b => { if (b.fx || b.fy) forceArrow(d, b.x, b.y, b.fx, b.fy, '#c2410c'); });
    if (drag && drag.type === 'push' && drag.d === d) { const q = Phys.J.pt(drag.b, drag.l), F = pushForce(); if (F) { const dx = mouse.x - q.x, dy = mouse.y - q.y, L = Math.hypot(dx, dy); if (L > 0.03) forceArrow(d, q.x, q.y, F * dx / L, F * dy / L, '#c2410c'); } }
    if (d.mode === 'design' && CONN[d.tool]) {
      ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = themeColor('purple-600'); ctx.fillStyle = themeColor('purple-600'); ctx.setLineDash([6, 5]);
      const pts = d.cx.map(a => P2(d, a.wheel ? { x: a.wheel.x, y: a.wheel.y } : a.b ? Phys.attachPos(a) : { x: a.x, y: a.y }));
      if (mouse.in) { const m = attPoint(d, mouse); pts.push(P2(d, { x: m.x, y: m.y })); }
      if (CONN[d.tool] > 1 && pts.length > 1) { ctx.beginPath(); pts.forEach((q, i) => { if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.stroke(); }
      ctx.setLineDash([]); pts.forEach((q, i) => { ctx.beginPath(); ctx.arc(q.x, q.y, i < d.cx.length ? 5 : 4, 0, 7); if (i < d.cx.length) ctx.fill(); else ctx.stroke(); });
      ctx.restore();
    }
    if (drag && drag.type === 'box') {
      const x = Math.min(drag.x0, drag.x1), y = Math.min(drag.y0, drag.y1), w2 = Math.abs(drag.x1 - drag.x0), h2 = Math.abs(drag.y1 - drag.y0), cross = drag.x1 < drag.x0;
      ctx.save(); ctx.fillStyle = themeRGBA('purple-600', .12); ctx.strokeStyle = themeColor('purple-600'); ctx.lineWidth = 1.5; ctx.setLineDash(cross ? [6, 4] : []);
      ctx.fillRect(x, y, w2, h2); ctx.strokeRect(x, y, w2, h2); ctx.restore();
    }
    if (d.mode === 'design' && !d.tool) {
      const sb = getSel(d);
      if (sb) handlesOf(sb).forEach(h => { const X = sx(v, h.x), Y = sy(v, h.y); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = themeColor('blue-700'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, 6, 0, 7); ctx.fill(); ctx.stroke(); });
    }
    if (d.mode === 'design' && d.tool && d.tool !== 'custom' && !CONN[d.tool] && mouse.in) { const q = snapPt(mouse), g = Phys.createBody(d.tool, { x: q.x, y: q.y }); drawBody(g, d, T, false, true); }
    if (d.mode === 'design' && d.tool === 'custom') {
      const c = d.custom.slice(); if (mouse.in) { const q = snapPt(mouse); c.push({ x: q.x, y: q.y, s: !!mouse.shift }); }
      ctx.strokeStyle = themeColor('purple-600'); ctx.fillStyle = themeColor('purple-600'); ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (c.length > 1) {
        const path = curvePath(c, false);
        ctx.beginPath(); path.forEach((p, i) => { const X = sx(v, p.x), Y = sy(v, p.y); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); }); ctx.stroke();
        if (c.length > 2) { ctx.save(); ctx.setLineDash([4, 5]); ctx.globalAlpha = .6; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(sx(v, c[c.length - 1].x), sy(v, c[c.length - 1].y)); ctx.lineTo(sx(v, c[0].x), sy(v, c[0].y)); ctx.stroke(); ctx.restore(); }
      }
      d.custom.forEach((p, i) => { const X = sx(v, p.x), Y = sy(v, p.y), near = i === 0 && d.custom.length >= 3 && mouse.in && Math.hypot(mouse.px - X, mouse.py - Y) < 12; ctx.beginPath(); ctx.arc(X, Y, near ? 7 : 4.5, 0, 7); ctx.fill(); });
    }
  }

  // ---------- overlays ----------
  function fmtLen(L) { return L >= 1 ? +L.toPrecision(3) + ' m' : L >= 0.01 ? +(L * 100).toPrecision(3) + ' cm' : +(L * 1000).toPrecision(3) + ' mm'; }
  function updateOverlays(d) {
    const v = d.view, L = niceStep(110 / v.s); $('#sbBar').style.width = Math.round(L * v.s) + 'px'; $('#sbLabel').textContent = fmtLen(L);
    $('#coords').textContent = mouse.in ? 'x ' + mouse.x.toFixed(2) + '  y ' + mouse.y.toFixed(2) + ' m' : '';
    $('#zoomTxt').textContent = '1 m = ' + v.s.toFixed(0) + ' px';
    const n = visBodies(d).length, nc = conns(d).length;
    if (d.mode === 'design') $('#status').textContent = 'Design · ' + n + (n === 1 ? ' object' : ' objects') + (nc ? ' · ' + nc + (nc === 1 ? ' connector' : ' connectors') : '') + ' · snap ' + (S.snap ? S.grid + ' m' : 'off');
    else { const E = Phys.energy(d.world); $('#status').textContent = (d.playing ? 'Running' : 'Paused') + ' · t ' + d.world.t.toFixed(2) + ' s · KE ' + E.ke.toFixed(2) + ' J · PE ' + E.pe.toFixed(2) + ' J · E ' + E.total.toFixed(2) + ' J'; }
  }
  function sampleTrails(d, force) {
    d.world.bodies.forEach(b => {
      if (b.fixed || b.hidden) return; const t = d.trails[b.id] || (d.trails[b.id] = []), l = t[t.length - 1];
      if (!l || Math.hypot(b.x - l.x, b.y - l.y) > 0.03 || force) { t.push({ x: b.x, y: b.y }); if (t.length > 600) t.shift(); }
    });
  }

  // ---------- main loop ----------
  let last = performance.now(), acc = 0, stepCount = 0;
  function frame(t) {
    // A per-tab draw error must not kill this shared rAF loop for every other tab —
    // reschedule unconditionally, let the error still surface to the console.
    try {
      const dt = Math.min(0.05, (t - last) / 1000); last = t; const d = cur;
      if (d && d.kind !== 'mech') { if (KU(d)) KU(d).frame(d, dt); }
      else if (d && d.kind === 'mech') {
        if (!d.view) fit(d);
        Phys.J._w = d.world;
        if (d.mode === 'design') { d.world.chains.forEach(c => Phys.layoutChain(d.world, c)); d.world.links.forEach(c => Phys.syncLink(d.world, c)); Phys.layoutStoppers(d.world); d.world.joints.forEach(j => { if (j.type === 'wrap') { Phys.J._h.common(j); Phys.J.wrapSync(j); } }); }
        updatePush();
        if (drag && drag.type === 'grab' && drag.pose && drag.d === d) { for (let i = 0; i < 4; i++) Phys.step(d.world, Phys.DT); d.world.t = drag.t0; }
        if (d.playing && d.mode !== 'design') {
          acc += dt * S.speed; let n = 0;
          while (acc >= Phys.DT && n < 40) { Phys.step(d.world, Phys.DT); acc -= Phys.DT; n++; if (++stepCount % 6 === 0) sampleTrails(d); }
          if (n >= 40) acc = 0;
          if (d.mode !== 'design') refreshFields();
        }
        draw(d); updateOverlays(d);
      }
    } finally {
      requestAnimationFrame(frame);
    }
  }

  // ---------- boot ----------
  let first = null, restored = false;
  try {   // pick up the previous session, if the browser kept one
    const sess = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    if (sess && sess.v === 1 && Array.isArray(sess.docs) && sess.docs.length) {
      sess.docs.forEach(r => {
        if (r.kind === 'ckt') { if (window.CKT) { const d = mkDoc(r.title, 'ckt', false); d.ck = CKT.deserialize(r.data); } return; }
        if (r.kind === 'em') { if (window.EM) { const d = mkDoc(r.title, 'em', false); d.em = EM.deserialize(r.data); } return; }
        const d = mkDoc(r.title, 'mech', false); d.world = Phys.deserialize(r.data); recount(d);
      });
      untitled = sess.untitled || untitled; first = docs[Math.min(sess.cur || 0, docs.length - 1)]; restored = true;
    }
  } catch (e) { docs.length = 0; first = null; try { localStorage.removeItem(SESSION_KEY); } catch (_) { } }
  if (!first) first = mkDoc('Mechanics: Ball on Slope', 'mech', true);
  if (window.EM && !docs.some(x => x.kind === 'em')) mkDoc('E&M: Mass Spectrometer', 'em', true);
  if (!restored && first.world.bodies[1]) first.sel = first.world.bodies[1].id;
  cur = first; checkpoint(first); applyMode(); renderTabs(); renderWorkspace(); renderProps(); refreshToolUI();
  requestAnimationFrame(frame);
  window.__pholver = {
    docs, get cur() { return cur; }, setMode, S, hitConn, connPoint,
    // used by the E&M module
    docs, regField, mkDoc, switchDoc, renderTabs, applyMode, renderWorkspace, renderProps, refreshFields, refreshToolUI, updateHint, updatePlayBtn, checkpoint, undoRedo, persist, select, selectMany, toggleSel, isSel, selIds, flash,
    ic, ICON, THEMES, mkHelpers, fmt, niceStep, closeMenus, placeMenu, cv, ctx, posOf, get size() { return { cw, ch, dpr }; }, loadWorld, themeColor
  };
})();
