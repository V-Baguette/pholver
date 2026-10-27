// Pholver E&M 3D renderer core (phase A3): raw WebGL2, no library. Loaded after ui.js, before ui_em.js.
// GL init, shader programs, procedural meshes, instanced draws, an auto-framing camera, resize; ui_em.js (A4)
// drives orbit-camera interaction and picking, and (A6) the work-plane editor - the grid this module draws
// follows whichever plane ui_em.js hands in via opts.workPlane. This module only exposes render()/resize()
// and a couple of read-only helpers ui_em.js and tests can call.
(function () {
  'use strict';
  const EM3D = window.EM3D, EMeng = window.EM; if (!EM3D || !EMeng) return;
  const { V3, Quat, Mat4 } = EM3D;
  const TAU = Math.PI * 2;

  const CAP_INST = 2048;      // max instanced spheres / cylinders drawn per frame
  const CAP_LINE_V = 16384;   // max line vertices (axes + region wireframes + coil loops + E field lines; the ground grid is drawn separately by drawInfiniteGrid, not from this budget)

  // ---------- shaders ----------
  const LIT_VS = `#version 300 es
    layout(location=0) in vec3 aPos;
    layout(location=1) in vec3 aNormal;
    layout(location=2) in vec4 aModel0;
    layout(location=3) in vec4 aModel1;
    layout(location=4) in vec4 aModel2;
    layout(location=5) in vec4 aModel3;
    layout(location=6) in vec4 aColor;
    uniform mat4 uViewProj;
    out vec3 vNormal; out vec4 vColor;
    void main() {
      mat4 model = mat4(aModel0, aModel1, aModel2, aModel3);
      vec4 world = model * vec4(aPos, 1.0);
      gl_Position = uViewProj * world;
      vNormal = mat3(model) * aNormal;
      vColor = aColor;
    }`;
  const LIT_FS = `#version 300 es
    precision mediump float;
    in vec3 vNormal; in vec4 vColor;
    uniform vec3 uLightDir;
    out vec4 outColor;
    void main() {
      vec3 n = normalize(vNormal);
      float diff = max(dot(n, normalize(-uLightDir)), 0.0);
      vec3 col = vColor.rgb * (0.4 + diff * 0.75);
      outColor = vec4(col, vColor.a);
    }`;
  const LINE_VS = `#version 300 es
    layout(location=0) in vec3 aPos;
    layout(location=1) in vec4 aColor;
    uniform mat4 uViewProj;
    out vec4 vColor;
    void main() { gl_Position = uViewProj * vec4(aPos, 1.0); vColor = aColor; }`;
  const LINE_FS = `#version 300 es
    precision mediump float;
    in vec4 vColor; out vec4 outColor;
    void main() { outColor = vColor; }`;
  // Compiled for architectural completeness (textured work-plane heatmap) but not yet invoked - the field
  // sampling that would feed its texture is UI-layer work that lands with the interaction rewrite (A4/A5).
  const HEATMAP_VS = `#version 300 es
    layout(location=0) in vec2 aPos;
    uniform mat4 uViewProj; uniform mat4 uModel;
    out vec2 vUV;
    void main() { vUV = aPos * 0.5 + 0.5; gl_Position = uViewProj * uModel * vec4(aPos, 0.0, 1.0); }`;
  const HEATMAP_FS = `#version 300 es
    precision mediump float;
    in vec2 vUV; uniform sampler2D uTex; out vec4 outColor;
    void main() { outColor = texture(uTex, vUV); }`;
  // A Blender/Fusion-360-style "infinite" ground plane: one large static quad, re-centered under the camera
  // every frame (uCenter), with the actual grid lines computed procedurally in the fragment shader from the
  // world position rather than drawn as a fixed number of line segments - so it never runs out of extent the
  // way a finite line-vertex budget does (writeGrid/CAP_LINE_V), no matter how far the camera zooms out.
  const GRID_VS = `#version 300 es
    layout(location=0) in vec2 aPos;
    uniform vec3 uRight, uUp, uCenter;
    uniform mat4 uViewProj;
    out vec2 vUV;
    void main() {
      vUV = aPos;
      vec3 world = uCenter + uRight * aPos.x + uUp * aPos.y;
      gl_Position = uViewProj * vec4(world, 1.0);
    }`;
  const GRID_FS = `#version 300 es
    precision highp float;
    in vec2 vUV;
    uniform vec3 uEye, uCenter, uRight, uUp;
    uniform float uFadeDist;
    out vec4 outColor;
    float gridFactor(vec2 coord) {
      vec2 g = abs(fract(coord - 0.5) - 0.5) / max(fwidth(coord), 1e-6);
      return 1.0 - min(min(g.x, g.y), 1.0);
    }
    void main() {
      vec3 world = uCenter + uRight * vUV.x + uUp * vUV.y;
      float dist = length(world - uEye);
      float fade = clamp(1.0 - dist / uFadeDist, 0.0, 1.0);
      float minorA = gridFactor(vUV) * 0.12;
      float majorA = gridFactor(vUV * 0.2) * 0.22;
      float a = max(minorA, majorA) * fade;
      if (a < 0.004) discard;
      outColor = vec4(1.0, 1.0, 1.0, a);
    }`;

  function compileShader(gl, type, src) {
    const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error('shader compile failed: ' + log); }
    return sh;
  }
  function compileProgram(gl, vsSrc, fsSrc) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc), fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { const log = gl.getProgramInfoLog(prog); gl.deleteProgram(prog); throw new Error('program link failed: ' + log); }
    gl.deleteShader(vs); gl.deleteShader(fs);
    return prog;
  }

  // ---------- procedural meshes ----------
  function buildSphere(lonSeg, latSeg) {
    const pos = [], nrm = [], idx = [];
    for (let la = 0; la <= latSeg; la++) {
      const theta = la * Math.PI / latSeg, sinT = Math.sin(theta), cosT = Math.cos(theta);
      for (let lo = 0; lo <= lonSeg; lo++) {
        const phi = lo * TAU / lonSeg, x = sinT * Math.cos(phi), y = cosT, z = sinT * Math.sin(phi);
        pos.push(x, y, z); nrm.push(x, y, z);
      }
    }
    for (let la = 0; la < latSeg; la++) for (let lo = 0; lo < lonSeg; lo++) {
      const a = la * (lonSeg + 1) + lo, b = a + lonSeg + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }
  // Open tube (no end caps - wires/coils are thin enough that caps are never visibly missed), unit length
  // along local Z from -0.5 to 0.5, unit radius in local XY. writeCylinderInstance() below scales/orients it.
  function buildCylinder(seg) {
    const pos = [], nrm = [], idx = [];
    for (let i = 0; i <= seg; i++) {
      const a = i * TAU / seg, cx = Math.cos(a), cy = Math.sin(a);
      pos.push(cx, cy, -0.5); nrm.push(cx, cy, 0);
      pos.push(cx, cy, 0.5); nrm.push(cx, cy, 0);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2, b = a + 2; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    return { pos: new Float32Array(pos), nrm: new Float32Array(nrm), idx: new Uint16Array(idx) };
  }

  // ---------- GL state ----------
  const G = { ready: false, gl: null, canvas: null, cw: 800, ch: 500, dpr: 1 };

  function makeMeshVAO(gl, mesh, instBuf) {
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    const posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    const nrmBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nrmBuf); gl.bufferData(gl.ARRAY_BUFFER, mesh.nrm, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    const idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
    // per-instance: mat4 model (locations 2-5) + vec4 color (location 6), stride 20 floats
    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf);
    const stride = 20 * 4;
    for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(2 + i); gl.vertexAttribPointer(2 + i, 4, gl.FLOAT, false, stride, i * 16); gl.vertexAttribDivisor(2 + i, 1); }
    gl.enableVertexAttribArray(6); gl.vertexAttribPointer(6, 4, gl.FLOAT, false, stride, 16 * 4); gl.vertexAttribDivisor(6, 1);
    gl.bindVertexArray(null);
    return { vao, idxCount: mesh.idx.length };
  }

  function init(canvas) {
    if (G.ready && G.canvas === canvas) return true;
    // preserveDrawingBuffer: without it the browser may clear the buffer right after compositing a frame,
    // so a readback (debugging, e2e tests) done outside the render() call itself can see stale/cleared data.
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, preserveDrawingBuffer: true });
    if (!gl) return false;
    G.gl = gl; G.canvas = canvas;
    G.litProg = compileProgram(gl, LIT_VS, LIT_FS);
    G.lineProg = compileProgram(gl, LINE_VS, LINE_FS);
    G.heatmapProg = compileProgram(gl, HEATMAP_VS, HEATMAP_FS); // compiled, unused until A4/A5 wire up field sampling
    G.gridProg = compileProgram(gl, GRID_VS, GRID_FS);
    G.litU = { viewProj: gl.getUniformLocation(G.litProg, 'uViewProj'), lightDir: gl.getUniformLocation(G.litProg, 'uLightDir') };
    G.lineU = { viewProj: gl.getUniformLocation(G.lineProg, 'uViewProj') };
    G.gridU = {
      viewProj: gl.getUniformLocation(G.gridProg, 'uViewProj'), right: gl.getUniformLocation(G.gridProg, 'uRight'),
      up: gl.getUniformLocation(G.gridProg, 'uUp'), center: gl.getUniformLocation(G.gridProg, 'uCenter'),
      eye: gl.getUniformLocation(G.gridProg, 'uEye'), fadeDist: gl.getUniformLocation(G.gridProg, 'uFadeDist')
    };
    const GRID_HALF = 4000; // world units - just needs to cover the visible frustum once re-centered under the camera each frame
    G.gridVAO = gl.createVertexArray(); gl.bindVertexArray(G.gridVAO);
    const gridBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, gridBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -GRID_HALF, -GRID_HALF, GRID_HALF, -GRID_HALF, GRID_HALF, GRID_HALF,
      -GRID_HALF, -GRID_HALF, GRID_HALF, GRID_HALF, -GRID_HALF, GRID_HALF
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    G.sphereInstBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.sphereInstBuf); gl.bufferData(gl.ARRAY_BUFFER, CAP_INST * 20 * 4, gl.DYNAMIC_DRAW);
    G.cylInstBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.cylInstBuf); gl.bufferData(gl.ARRAY_BUFFER, CAP_INST * 20 * 4, gl.DYNAMIC_DRAW);
    const sphereMesh = makeMeshVAO(gl, buildSphere(16, 10), G.sphereInstBuf); G.sphereVAO = sphereMesh.vao; G.sphereIdxCount = sphereMesh.idxCount;
    const cylMesh = makeMeshVAO(gl, buildCylinder(14), G.cylInstBuf); G.cylVAO = cylMesh.vao; G.cylIdxCount = cylMesh.idxCount;

    G.lineGpuBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, G.lineGpuBuf); gl.bufferData(gl.ARRAY_BUFFER, CAP_LINE_V * 7 * 4, gl.DYNAMIC_DRAW);
    G.lineVAO = gl.createVertexArray(); gl.bindVertexArray(G.lineVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, G.lineGpuBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 7 * 4, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 7 * 4, 3 * 4);
    gl.bindVertexArray(null);

    G.sphereCpu = new Float32Array(CAP_INST * 20);
    G.cylCpu = new Float32Array(CAP_INST * 20);
    G.lineCpu = new Float32Array(CAP_LINE_V * 7);
    G.vpArr = new Float32Array(16);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    G.ready = true;
    return true;
  }

  function resize(cw, ch, dpr) {
    G.cw = cw; G.ch = ch; G.dpr = dpr;
    if (G.gl && G.canvas) G.gl.viewport(0, 0, G.canvas.width, G.canvas.height);
  }

  // ---------- CPU-side instance / line writers ----------
  function writeSphereInstance(buf, i, pos, radius, color) {
    const o = i * 20;
    buf[o] = radius; buf[o + 1] = 0; buf[o + 2] = 0; buf[o + 3] = 0;
    buf[o + 4] = 0; buf[o + 5] = radius; buf[o + 6] = 0; buf[o + 7] = 0;
    buf[o + 8] = 0; buf[o + 9] = 0; buf[o + 10] = radius; buf[o + 11] = 0;
    buf[o + 12] = pos.x; buf[o + 13] = pos.y; buf[o + 14] = pos.z; buf[o + 15] = 1;
    buf[o + 16] = color[0]; buf[o + 17] = color[1]; buf[o + 18] = color[2]; buf[o + 19] = color[3];
  }
  function basisFromDir(dir) {
    const upGuess = Math.abs(dir.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    const right = V3.normalize(V3.create(), V3.cross(V3.create(), upGuess, dir));
    const up = V3.cross(V3.create(), dir, right);
    return { right, up };
  }
  function writeCylinderInstance(buf, i, a, b, radius, color) {
    const o = i * 20, d = V3.sub(V3.create(), b, a), len = Math.max(V3.length(d), 1e-6);
    const dir = V3.scale(V3.create(), d, 1 / len), { right, up } = basisFromDir(dir), mid = V3.lerp(V3.create(), a, b, 0.5);
    buf[o] = right.x * radius; buf[o + 1] = right.y * radius; buf[o + 2] = right.z * radius; buf[o + 3] = 0;
    buf[o + 4] = up.x * radius; buf[o + 5] = up.y * radius; buf[o + 6] = up.z * radius; buf[o + 7] = 0;
    buf[o + 8] = dir.x * len; buf[o + 9] = dir.y * len; buf[o + 10] = dir.z * len; buf[o + 11] = 0;
    buf[o + 12] = mid.x; buf[o + 13] = mid.y; buf[o + 14] = mid.z; buf[o + 15] = 1;
    buf[o + 16] = color[0]; buf[o + 17] = color[1]; buf[o + 18] = color[2]; buf[o + 19] = color[3];
  }
  function pushLineVertex(buf, n, p, color) {
    if (n >= CAP_LINE_V) return n;
    const o = n * 7; buf[o] = p.x; buf[o + 1] = p.y; buf[o + 2] = p.z; buf[o + 3] = color[0]; buf[o + 4] = color[1]; buf[o + 5] = color[2]; buf[o + 6] = color[3];
    return n + 1;
  }
  const DEFAULT_PLANE = { point: { x: 0, y: 0, z: 0 }, normal: { x: 0, y: 0, z: 1 } };
  function writeAxes(buf, n, radius) {
    const len = Math.max(1, radius * 0.25), o = { x: 0, y: 0, z: 0 };
    n = pushLineVertex(buf, n, o, [0.9, 0.3, 0.25, 1]); n = pushLineVertex(buf, n, { x: len, y: 0, z: 0 }, [0.9, 0.3, 0.25, 1]);
    n = pushLineVertex(buf, n, o, [0.25, 0.8, 0.4, 1]); n = pushLineVertex(buf, n, { x: 0, y: len, z: 0 }, [0.25, 0.8, 0.4, 1]);
    n = pushLineVertex(buf, n, o, [0.3, 0.5, 0.95, 1]); n = pushLineVertex(buf, n, { x: 0, y: 0, z: len }, [0.3, 0.5, 0.95, 1]);
    return n;
  }
  function writeLoop(buf, n, pts, color) { for (let i = 0; i < pts.length - 1; i++) { n = pushLineVertex(buf, n, pts[i], color); n = pushLineVertex(buf, n, pts[i + 1], color); } return n; }
  const BOX_EDGES = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [2, 6], [1, 5], [3, 7]];
  function boxCorners(it) {
    const hx = it.w / 2, hy = (it.type === 'capacitor' ? it.gap : it.h) / 2, hz = it.d / 2, out = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      const local = { x: sx * hx, y: sy * hy, z: sz * hz };
      out.push(V3.add(V3.create(), it, Quat.rotateVec3(V3.create(), it.rot, local)));
    }
    return out;
  }
  function writeBoxWire(buf, n, it, color) { const c = boxCorners(it); for (const [a, b] of BOX_EDGES) { n = pushLineVertex(buf, n, c[a], color); n = pushLineVertex(buf, n, c[b], color); } return n; }
  function writeMagnetAxis(buf, n, it) {
    const dir = Quat.rotateVec3(V3.create(), it.rot, { x: 0, y: 0, z: 1 }), tip = V3.addScaled(V3.create(), it, dir, 0.4), color = [0.9, 0.9, 0.95, 1];
    return pushLineVertex(buf, pushLineVertex(buf, n, it, color), tip, color);
  }
  // A direction glyph (shaft + a 4-barb arrowhead so it reads from any orbit angle) along an item's rotated
  // local axis - unlike writeMagnetAxis's bare line, firing/field direction isn't symmetric so the arrowhead
  // disambiguates which end is "forward".
  function writeDirArrow(buf, n, it, localAxis, len, color) {
    const dir = Quat.rotateVec3(V3.create(), it.rot, localAxis);
    const tip = V3.addScaled(V3.create(), it, dir, len), { right, up } = basisFromDir(dir);
    const barbBack = V3.addScaled(V3.create(), tip, dir, -len * 0.3);
    n = pushLineVertex(buf, pushLineVertex(buf, n, it, color), tip, color);
    for (const side of [right, up]) {
      const b1 = V3.addScaled(V3.create(), barbBack, side, len * 0.16), b2 = V3.addScaled(V3.create(), barbBack, side, -len * 0.16);
      n = pushLineVertex(buf, pushLineVertex(buf, n, tip, color), b1, color);
      n = pushLineVertex(buf, pushLineVertex(buf, n, tip, color), b2, color);
    }
    return n;
  }
  // Positive-charge glyph: a world-aligned 3-axis "+" through the center, so it reads as a plus from any
  // camera angle (unlike a flat glyph, which would look like a line from some angles).
  function writeChargeCross(buf, n, it, r, color) {
    const ax = [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
    for (const a of ax) {
      n = pushLineVertex(buf, n, V3.addScaled(V3.create(), it, a, -r), color);
      n = pushLineVertex(buf, n, V3.addScaled(V3.create(), it, a, r), color);
    }
    return n;
  }
  // Negative-charge glyph: a flat equatorial ring (world XY, like coilRing but unrotated - a point charge has
  // no meaningful orientation), echoing the classic "minus" look without needing a 2D minus-sign glyph in 3D.
  function writeChargeRing(buf, n, it, r, color) {
    const pts = [];
    for (let i = 0; i <= 20; i++) { const a = TAU * i / 20; pts.push({ x: it.x + r * Math.cos(a), y: it.y + r * Math.sin(a), z: it.z }); }
    return writeLoop(buf, n, pts, color);
  }
  function coilRing(it, n) {
    const pts = [];
    for (let i = 0; i <= n; i++) { const a = TAU * i / n, local = { x: it.R * Math.cos(a), y: it.R * Math.sin(a), z: 0 }; pts.push(V3.add(V3.create(), it, Quat.rotateVec3(V3.create(), it.rot, local))); }
    return pts;
  }
  function colorForCharge(q) { return q > 0 ? [0.85, 0.21, 0.17, 1] : q < 0 ? [0.16, 0.41, 0.84, 1] : [0.6, 0.6, 0.6, 1]; }
  const SPECIES_PAL = [[0.85, 0.21, 0.17, 1], [0.16, 0.41, 0.84, 1], [0.18, 0.68, 0.38, 1], [0.86, 0.63, 0.14, 1], [0.6, 0.32, 0.85, 1], [0.18, 0.72, 0.72, 1], [0.88, 0.42, 0.62, 1], [0.55, 0.55, 0.55, 1]];
  // Groups charges/beam particles by q/m (a "species": same charge-to-mass ratio moves the same way in a
  // field, which is the physically meaningful grouping - not just charge sign) and hands back a colour-lookup
  // for emitItem/the beam loop to use instead of colorForCharge when the "By species" toggle is on.
  function speciesColorer(scene) {
    const seen = new Map(), key = p => p.m ? (p.q / p.m).toFixed(4) : 'x';
    const take = p => { const k = key(p); if (!seen.has(k)) seen.set(k, SPECIES_PAL[seen.size % SPECIES_PAL.length]); };
    for (const it of scene.items) if (it.type === 'charge') take(it);
    for (const p of scene.beam) take(p);
    return p => seen.get(key(p)) || colorForCharge(p.q);
  }
  function hexToRgba(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255, 1] : [0.89, 0.55, 0.17, 1];
  }

  function sceneBounds(scene) {
    let mn = { x: 1e18, y: 1e18, z: 1e18 }, mx = { x: -1e18, y: -1e18, z: -1e18 }, any = false;
    const grow = p => { any = true; mn.x = Math.min(mn.x, p.x); mn.y = Math.min(mn.y, p.y); mn.z = Math.min(mn.z, p.z); mx.x = Math.max(mx.x, p.x); mx.y = Math.max(mx.y, p.y); mx.z = Math.max(mx.z, p.z); };
    for (const it of scene.items) { const b = EMeng.bounds3(it); grow(b.min); grow(b.max); }
    for (const p of scene.beam) grow(p);
    if (!any) { mn = { x: -3, y: -3, z: -3 }; mx = { x: 3, y: 3, z: 3 }; }
    return { center: { x: (mn.x + mx.x) / 2, y: (mn.y + mx.y) / 2, z: (mn.z + mx.z) / 2 }, radius: Math.max(1.5, Math.hypot(mx.x - mn.x, mx.y - mn.y, mx.z - mn.z) / 2) };
  }

  // Falls back to auto-framing the scene from a fixed pleasant angle when no persisted camera state is given.
  function autoCamera(scene, aspect) {
    const { center, radius } = sceneBounds(scene);
    const dist = Math.max(radius * 2.3, 3);
    const cam = EM3D.orbitCamera({ target: center, yaw: -0.7, pitch: 0.5, dist }, aspect);
    cam.target = center; cam.dist = dist; return cam;
  }
  const HI = [0.95, 0.65, 0.15]; // selection-highlight tint (blended toward this)
  function tint(c, alphaMul, hi) {
    const a = c[3] * (alphaMul == null ? 1 : alphaMul);
    return hi ? [c[0] * 0.4 + HI[0] * 0.6, c[1] * 0.4 + HI[1] * 0.6, c[2] * 0.4 + HI[2] * 0.6, a] : (alphaMul == null ? c : [c[0], c[1], c[2], a]);
  }
  // Emits one item's geometry into the CPU-side buffers. `counts` is a mutable {nSphere,nCyl,nLine} accumulator
  // so this single function serves the main scene pass, the selection-highlight pass and the placement ghost.
  function emitItem(it, bufs, counts, alphaMul, hi, colorFn, showRegions) {
    switch (it.type) {
      case 'charge': {
        if (counts.nSphere < CAP_INST) writeSphereInstance(bufs.s, counts.nSphere++, it, 0.18, tint(colorFn ? colorFn(it) : colorForCharge(it.q), alphaMul, hi));
        const glyphColor = tint([0.95, 0.96, 0.98, 1], alphaMul, hi);
        if (it.q > 0) counts.nLine = writeChargeCross(bufs.l, counts.nLine, it, 0.26, glyphColor);
        else if (it.q < 0) counts.nLine = writeChargeRing(bufs.l, counts.nLine, it, 0.24, glyphColor);
        break;
      }
      case 'emitter':
        if (counts.nSphere < CAP_INST) writeSphereInstance(bufs.s, counts.nSphere++, it, 0.15, tint(hexToRgba(it.col), alphaMul, hi));
        counts.nLine = writeDirArrow(bufs.l, counts.nLine, it, { x: 1, y: 0, z: 0 }, 0.4, tint([0.95, 0.95, 0.95, 1], alphaMul, hi));
        break;
      case 'probe': if (counts.nSphere < CAP_INST) writeSphereInstance(bufs.s, counts.nSphere++, it, 0.12, tint([0.6, 0.65, 0.7, 1], alphaMul, hi)); break;
      case 'magnet':
        if (counts.nSphere < CAP_INST) writeSphereInstance(bufs.s, counts.nSphere++, it, 0.22, tint([0.63, 0.32, 0.85, 1], alphaMul, hi));
        counts.nLine = writeMagnetAxis(bufs.l, counts.nLine, it); break;
      case 'wire': { const w = EMeng.wireEnds(it), r = Math.min(0.12, 0.05 + Math.abs(it.I) * 0.004); if (counts.nCyl < CAP_INST) writeCylinderInstance(bufs.c, counts.nCyl++, w.a, w.b, r, tint([0.55, 0.6, 0.65, 1], alphaMul, hi)); break; }
      case 'coil': counts.nLine = writeLoop(bufs.l, counts.nLine, coilRing(it, Math.max(24, Math.min(72, Math.round(it.R * 24)))), tint([0.55, 0.6, 0.65, 1], alphaMul, hi)); break;
      case 'efield': if (showRegions !== false) counts.nLine = writeBoxWire(bufs.l, counts.nLine, it, tint([0.85, 0.3, 0.25, 0.65], alphaMul, hi)); break;
      case 'bfield':
        if (showRegions === false) break;
        counts.nLine = writeBoxWire(bufs.l, counts.nLine, it, tint([0.25, 0.45, 0.9, 0.65], alphaMul, hi));
        counts.nLine = writeDirArrow(bufs.l, counts.nLine, it, { x: 0, y: 0, z: 1 }, Math.min(1.2, Math.max(it.w, it.h, it.d) * 0.4), tint([0.7, 0.8, 1, 1], alphaMul, hi));
        break;
      case 'capacitor': if (showRegions !== false) counts.nLine = writeBoxWire(bufs.l, counts.nLine, it, tint([0.15, 0.6, 0.4, 0.65], alphaMul, hi)); break;
      case 'screen': counts.nLine = writeBoxWire(bufs.l, counts.nLine, it, tint([0.1, 0.55, 0.45, 0.8], alphaMul, hi)); break;
      case 'wall': counts.nLine = writeBoxWire(bufs.l, counts.nLine, it, tint([0.6, 0.2, 0.2, 0.8], alphaMul, hi)); break;
    }
  }

  function drawInstanced(vao, instGpuBuf, cpu, n, idxCount) {
    if (!n) return; const gl = G.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, instGpuBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, cpu, 0, n * 20);
    gl.bindVertexArray(vao); gl.useProgram(G.litProg);
    gl.uniformMatrix4fv(G.litU.viewProj, false, G.vpArr); gl.uniform3f(G.litU.lightDir, 0.4, -0.8, 0.3);
    gl.drawElementsInstanced(gl.TRIANGLES, idxCount, gl.UNSIGNED_SHORT, 0, n);
    gl.bindVertexArray(null);
  }
  function drawLines(nVerts) {
    if (!nVerts) return; const gl = G.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, G.lineGpuBuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, G.lineCpu, 0, nVerts * 7);
    gl.bindVertexArray(G.lineVAO); gl.useProgram(G.lineProg);
    gl.uniformMatrix4fv(G.lineU.viewProj, false, G.vpArr);
    gl.drawArrays(gl.LINES, 0, nVerts);
    gl.bindVertexArray(null);
  }
  // The "infinite" ground plane (A7b): a huge static quad, re-centered every frame under wherever the camera
  // is looking (its orbit target's projection onto the plane - not the eye, which for a wide-orbit low-angle
  // shot can sit far from the visible area the camera is actually pointed at) so it always covers the visible
  // frustum regardless of zoom, with the actual grid lines computed in the fragment shader from world position
  // - genuinely zoom-independent, unlike a fixed line-vertex budget. depthMask is off so it never occludes
  // translucent lines drawn after it (field lines, region wireframes), while depth TEST stays on so opaque
  // objects still occlude the grid.
  function drawInfiniteGrid(plane, eye, lookAt, fadeDist) {
    const gl = G.gl, { right: u, up: v } = basisFromDir(plane.normal), p0 = plane.point;
    const rel = V3.sub(V3.create(), lookAt, p0), du = V3.dot(rel, u), dv = V3.dot(rel, v);
    const center = V3.addScaled(V3.create(), V3.addScaled(V3.create(), p0, u, du), v, dv);
    gl.useProgram(G.gridProg); gl.bindVertexArray(G.gridVAO);
    gl.uniformMatrix4fv(G.gridU.viewProj, false, G.vpArr);
    gl.uniform3f(G.gridU.right, u.x, u.y, u.z); gl.uniform3f(G.gridU.up, v.x, v.y, v.z);
    gl.uniform3f(G.gridU.center, center.x, center.y, center.z);
    gl.uniform3f(G.gridU.eye, eye.x, eye.y, eye.z);
    gl.uniform1f(G.gridU.fadeDist, fadeDist);
    gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  // opts (all optional): camState {target,yaw,pitch,dist} - a persisted orbit-camera state (ui_em.js owns this
  // per doc); falls back to auto-framing when absent. selectedIds - a Set of item ids to highlight. extraLines -
  // [{a:{x,y,z}, b:{x,y,z}, color:[r,g,b,a]}] for overlays like the ruler and E field lines (ui_em.js traces
  // those via EM.fieldLines and hands them in through this same list). ghost - a synthetic item (same shape
  // as a scene item) drawn at reduced alpha, for a placement preview. colorBySpecies - colour charges/beam
  // particles by charge-to-mass ratio (speciesColorer) instead of by charge sign (colorForCharge). workPlane -
  // {point, normal} of the active work plane (A6), used to orient the drawn grid; defaults to XY at the origin.
  // showRegions - false hides efield/bfield/capacitor wireframes (and the bfield direction arrow); screen/wall
  // stay visible since they are collision geometry, not field regions. Defaults to true.
  function render(scene, opts) {
    if (!G.ready) return false;
    opts = opts || {};
    const gl = G.gl, aspect = G.cw / Math.max(1, G.ch);
    const cam = opts.camState ? EM3D.orbitCamera(opts.camState, aspect) : autoCamera(scene, aspect);
    if (opts.camState) { cam.target = opts.camState.target; cam.dist = opts.camState.dist; }
    for (let i = 0; i < 16; i++) G.vpArr[i] = cam.viewProj[i];
    gl.viewport(0, 0, G.canvas.width, G.canvas.height);
    gl.clearColor(0.11, 0.13, 0.16, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const workPlane = opts.workPlane || DEFAULT_PLANE;
    const bufs = { s: G.sphereCpu, c: G.cylCpu, l: G.lineCpu }, counts = { nSphere: 0, nCyl: 0, nLine: 0 };
    counts.nLine = writeAxes(bufs.l, counts.nLine, cam.dist || 6);
    const selectedIds = opts.selectedIds, colorFn = opts.colorBySpecies ? speciesColorer(scene) : null, showRegions = opts.showRegions !== false;
    for (const it of scene.items) emitItem(it, bufs, counts, null, selectedIds && selectedIds.has(it.id), colorFn, showRegions);
    for (const p of scene.beam) if (counts.nSphere < CAP_INST) writeSphereInstance(bufs.s, counts.nSphere++, p, 0.08, colorFn ? colorFn(p) : colorForCharge(p.q));
    if (opts.ghost) emitItem(opts.ghost, bufs, counts, 0.55, false, null, showRegions);
    for (const ln of opts.extraLines || []) { counts.nLine = pushLineVertex(bufs.l, counts.nLine, ln.a, ln.color); counts.nLine = pushLineVertex(bufs.l, counts.nLine, ln.b, ln.color); }

    drawInfiniteGrid(workPlane, cam.eye, cam.target || { x: 0, y: 0, z: 0 }, Math.max(30, (cam.dist || 6) * 4));
    drawInstanced(G.sphereVAO, G.sphereInstBuf, bufs.s, counts.nSphere, G.sphereIdxCount);
    drawInstanced(G.cylVAO, G.cylInstBuf, bufs.c, counts.nCyl, G.cylIdxCount);
    drawLines(counts.nLine);
    return true;
  }
  // World-point -> CSS-pixel screen point, for picking/box-select math done outside this module (ui_em.js).
  function worldToScreen(camState, p) {
    const aspect = G.cw / Math.max(1, G.ch), cam = EM3D.orbitCamera(camState, aspect);
    const c = Mat4.transformPoint(V3.create(), cam.viewProj, p);
    return { x: (c.x * 0.5 + 0.5) * G.cw, y: (1 - (c.y * 0.5 + 0.5)) * G.ch };
  }

  // x,y are top-left-origin framebuffer pixels (matching worldToScreen's convention and normal screen/CSS
  // coordinates) - flipped here because GL's readPixels is bottom-left-origin.
  function samplePixel(x, y) {
    if (!G.ready) return null;
    const gl = G.gl, buf = new Uint8Array(4);
    gl.readPixels(x, gl.drawingBufferHeight - 1 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return [buf[0], buf[1], buf[2], buf[3]];
  }

  window.EM3DGL = { init, resize, render, samplePixel, sceneBounds, worldToScreen };
})();
