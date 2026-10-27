// Small hand-rolled 3D math module for the E&M engine/renderer: vec3, quaternion, 4x4 matrix (column-major,
// WebGL convention), plus a few EM-specific helpers (ray/plane picking, an orbit-camera builder).
// No external library (zero-dependency philosophy) - same spirit as a raw-OpenGL project, just for WebGL2.
// Every function takes an `out` as its first argument and also returns it, so call sites can chain or ignore.
(function (root) {
  'use strict';
  const EM3D = {};

  // ---------- vec3 ----------
  const V3 = {};
  V3.create = (x, y, z) => ({ x: x || 0, y: y || 0, z: z || 0 });
  V3.set = (out, x, y, z) => { out.x = x; out.y = y; out.z = z; return out; };
  V3.copy = (out, a) => { out.x = a.x; out.y = a.y; out.z = a.z; return out; };
  V3.clone = a => ({ x: a.x, y: a.y, z: a.z });
  V3.add = (out, a, b) => { out.x = a.x + b.x; out.y = a.y + b.y; out.z = a.z + b.z; return out; };
  V3.sub = (out, a, b) => { out.x = a.x - b.x; out.y = a.y - b.y; out.z = a.z - b.z; return out; };
  V3.scale = (out, a, s) => { out.x = a.x * s; out.y = a.y * s; out.z = a.z * s; return out; };
  V3.addScaled = (out, a, b, s) => { out.x = a.x + b.x * s; out.y = a.y + b.y * s; out.z = a.z + b.z * s; return out; };
  V3.negate = (out, a) => { out.x = -a.x; out.y = -a.y; out.z = -a.z; return out; };
  V3.dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  V3.cross = (out, a, b) => {
    const x = a.y * b.z - a.z * b.y, y = a.z * b.x - a.x * b.z, z = a.x * b.y - a.y * b.x;
    out.x = x; out.y = y; out.z = z; return out;
  };
  V3.lengthSq = a => a.x * a.x + a.y * a.y + a.z * a.z;
  V3.length = a => Math.sqrt(V3.lengthSq(a));
  V3.distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  V3.normalize = (out, a) => {
    const len = V3.length(a);
    if (len < 1e-12) { out.x = 0; out.y = 0; out.z = 0; return out; }
    return V3.scale(out, a, 1 / len);
  };
  V3.lerp = (out, a, b, t) => { out.x = a.x + (b.x - a.x) * t; out.y = a.y + (b.y - a.y) * t; out.z = a.z + (b.z - a.z) * t; return out; };
  V3.equals = (a, b, eps) => { eps = eps == null ? 1e-9 : eps; return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps && Math.abs(a.z - b.z) <= eps; };
  EM3D.V3 = V3;

  // ---------- quaternion [x,y,z,w] ----------
  const Quat = {};
  Quat.create = (x, y, z, w) => ({ x: x || 0, y: y || 0, z: z || 0, w: w == null ? 1 : w });
  Quat.identity = out => { out.x = 0; out.y = 0; out.z = 0; out.w = 1; return out; };
  Quat.clone = q => ({ x: q.x, y: q.y, z: q.z, w: q.w });
  Quat.copy = (out, a) => { out.x = a.x; out.y = a.y; out.z = a.z; out.w = a.w; return out; };
  Quat.fromAxisAngle = (out, axis, rad) => {
    const n = V3.normalize(V3.create(), axis), h = rad / 2, s = Math.sin(h);
    out.x = n.x * s; out.y = n.y * s; out.z = n.z * s; out.w = Math.cos(h);
    return out;
  };
  Quat.multiply = (out, a, b) => {
    const ax = a.x, ay = a.y, az = a.z, aw = a.w, bx = b.x, by = b.y, bz = b.z, bw = b.w;
    out.x = aw * bx + ax * bw + ay * bz - az * by;
    out.y = aw * by - ax * bz + ay * bw + az * bx;
    out.z = aw * bz + ax * by - ay * bx + az * bw;
    out.w = aw * bw - ax * bx - ay * by - az * bz;
    return out;
  };
  Quat.length = q => Math.sqrt(q.x * q.x + q.y * q.y + q.z * q.z + q.w * q.w);
  Quat.normalize = (out, a) => {
    const len = Quat.length(a);
    if (len < 1e-12) return Quat.identity(out);
    const inv = 1 / len;
    out.x = a.x * inv; out.y = a.y * inv; out.z = a.z * inv; out.w = a.w * inv;
    return out;
  };
  Quat.conjugate = (out, a) => { out.x = -a.x; out.y = -a.y; out.z = -a.z; out.w = a.w; return out; };
  // Rotate vector v by quaternion q: v' = v + 2*w*(qxyz x v) + 2*(qxyz x (qxyz x v))
  Quat.rotateVec3 = (out, q, v) => {
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const tx = 2 * (qy * v.z - qz * v.y), ty = 2 * (qz * v.x - qx * v.z), tz = 2 * (qx * v.y - qy * v.x);
    out.x = v.x + qw * tx + (qy * tz - qz * ty);
    out.y = v.y + qw * ty + (qz * tx - qx * tz);
    out.z = v.z + qw * tz + (qx * ty - qy * tx);
    return out;
  };
  // Composes q = Rz(ez) * Ry(ey) * Rx(ex): rotate about X, then Y, then Z (each about the ORIGINAL world axes).
  // toEuler() below is the exact algebraic inverse of this same composition (derived, not guessed).
  Quat.fromEuler = (out, exDeg, eyDeg, ezDeg) => {
    const rad = d => d * Math.PI / 180;
    const qx = Quat.fromAxisAngle(Quat.create(), { x: 1, y: 0, z: 0 }, rad(exDeg));
    const qy = Quat.fromAxisAngle(Quat.create(), { x: 0, y: 1, z: 0 }, rad(eyDeg));
    const qz = Quat.fromAxisAngle(Quat.create(), { x: 0, y: 0, z: 1 }, rad(ezDeg));
    return Quat.multiply(out, Quat.multiply(Quat.create(), qz, qy), qx);
  };
  // Inverse of fromEuler's Rz*Ry*Rx composition; returns degrees. Falls back gracefully at the pitch-90 gimbal lock.
  Quat.toEuler = q => {
    const m = Mat4FromQuat(q);
    const deg = r => r * 180 / Math.PI;
    const m20 = m[2]; // -sin(ey)
    let ex, ey, ez;
    ey = Math.asin(Math.max(-1, Math.min(1, -m20)));
    if (Math.abs(m20) < 0.999999) {
      ex = Math.atan2(m[6], m[10]);
      ez = Math.atan2(m[1], m[0]);
    } else {
      ez = 0;
      ex = Math.atan2(-m[9], m[5]);
    }
    return { x: deg(ex), y: deg(ey), z: deg(ez) };
  };
  function Mat4FromQuat(q) {
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
    return [
      1 - 2 * (yy + zz), 2 * (xy + wz), 2 * (xz - wy), 0,
      2 * (xy - wz), 1 - 2 * (xx + zz), 2 * (yz + wx), 0,
      2 * (xz + wy), 2 * (yz - wx), 1 - 2 * (xx + yy), 0,
      0, 0, 0, 1
    ];
  }
  Quat.toMat4 = (out, q) => { const m = Mat4FromQuat(q); for (let i = 0; i < 16; i++) out[i] = m[i]; return out; };
  EM3D.Quat = Quat;

  // ---------- mat4 (column-major, flat length-16 array) ----------
  const Mat4 = {};
  Mat4.create = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  Mat4.identity = out => { for (let i = 0; i < 16; i++) out[i] = (i % 5 === 0) ? 1 : 0; return out; };
  Mat4.clone = a => a.slice();
  Mat4.multiply = (out, a, b) => {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    for (let i = 0; i < 4; i++) {
      const b0 = b[i * 4], b1 = b[i * 4 + 1], b2 = b[i * 4 + 2], b3 = b[i * 4 + 3];
      out[i * 4] = a00 * b0 + a10 * b1 + a20 * b2 + a30 * b3;
      out[i * 4 + 1] = a01 * b0 + a11 * b1 + a21 * b2 + a31 * b3;
      out[i * 4 + 2] = a02 * b0 + a12 * b1 + a22 * b2 + a32 * b3;
      out[i * 4 + 3] = a03 * b0 + a13 * b1 + a23 * b2 + a33 * b3;
    }
    return out;
  };
  Mat4.fromQuat = Quat.toMat4;
  Mat4.compose = (out, pos, q, scale) => {
    Mat4.fromQuat(out, q);
    const sx = scale ? scale.x : 1, sy = scale ? scale.y : 1, sz = scale ? scale.z : 1;
    out[0] *= sx; out[1] *= sx; out[2] *= sx;
    out[4] *= sy; out[5] *= sy; out[6] *= sy;
    out[8] *= sz; out[9] *= sz; out[10] *= sz;
    out[12] = pos.x; out[13] = pos.y; out[14] = pos.z; out[15] = 1;
    return out;
  };
  Mat4.perspective = (out, fovy, aspect, near, far) => {
    const f = 1 / Math.tan(fovy / 2);
    out[0] = f / aspect; out[1] = 0; out[2] = 0; out[3] = 0;
    out[4] = 0; out[5] = f; out[6] = 0; out[7] = 0;
    out[8] = 0; out[9] = 0; out[11] = -1;
    out[12] = 0; out[13] = 0; out[15] = 0;
    if (far != null && isFinite(far)) {
      const nf = 1 / (near - far);
      out[10] = (far + near) * nf; out[14] = 2 * far * near * nf;
    } else {
      out[10] = -1; out[14] = -2 * near;
    }
    return out;
  };
  Mat4.lookAt = (out, eye, center, up) => {
    const ex = eye.x, ey = eye.y, ez = eye.z;
    let z0 = ex - center.x, z1 = ey - center.y, z2 = ez - center.z;
    let len = Math.hypot(z0, z1, z2);
    if (len > 1e-9) { z0 /= len; z1 /= len; z2 /= len; }
    let x0 = up.y * z2 - up.z * z1, x1 = up.z * z0 - up.x * z2, x2 = up.x * z1 - up.y * z0;
    len = Math.hypot(x0, x1, x2);
    if (len > 1e-9) { x0 /= len; x1 /= len; x2 /= len; } else { x0 = 0; x1 = 0; x2 = 0; }
    const y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    out[0] = x0; out[1] = y0; out[2] = z0; out[3] = 0;
    out[4] = x1; out[5] = y1; out[6] = z1; out[7] = 0;
    out[8] = x2; out[9] = y2; out[10] = z2; out[11] = 0;
    out[12] = -(x0 * ex + x1 * ey + x2 * ez);
    out[13] = -(y0 * ex + y1 * ey + y2 * ez);
    out[14] = -(z0 * ex + z1 * ey + z2 * ez);
    out[15] = 1;
    return out;
  };
  Mat4.invert = (out, a) => {
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3], a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7],
      a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11], a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10,
      b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12,
      b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30,
      b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    if (!det) return null;
    det = 1 / det;
    out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
    out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
    out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
    out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
    out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
    out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
    out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
    out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
    out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
    out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
    out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
    out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
    out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
    out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
    out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
    out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
    return out;
  };
  Mat4.transformPoint = (out, m, p) => {
    const x = p.x, y = p.y, z = p.z;
    let w = m[3] * x + m[7] * y + m[11] * z + m[15];
    w = w || 1;
    out.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
    out.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
    out.z = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
    return out;
  };
  Mat4.transformDirection = (out, m, v) => {
    const x = v.x, y = v.y, z = v.z;
    out.x = m[0] * x + m[4] * y + m[8] * z;
    out.y = m[1] * x + m[5] * y + m[9] * z;
    out.z = m[2] * x + m[6] * y + m[10] * z;
    return out;
  };
  EM3D.Mat4 = Mat4;

  // ---------- picking / placement helpers ----------
  // Unprojects an NDC screen point (x,y in [-1,1]) through an inverse view-projection matrix into a world ray.
  EM3D.rayFromScreen = (invViewProj, ndcX, ndcY) => {
    const near = Mat4.transformPoint(V3.create(), invViewProj, { x: ndcX, y: ndcY, z: -1 });
    const far = Mat4.transformPoint(V3.create(), invViewProj, { x: ndcX, y: ndcY, z: 1 });
    return { origin: near, dir: V3.normalize(V3.create(), V3.sub(V3.create(), far, near)) };
  };
  // Returns the world point where a ray meets a plane (point+normal), or null if parallel / behind the origin.
  EM3D.intersectRayPlane = (rayOrigin, rayDir, planePoint, planeNormal) => {
    const denom = V3.dot(planeNormal, rayDir);
    if (Math.abs(denom) < 1e-9) return null;
    const diff = V3.sub(V3.create(), planePoint, rayOrigin);
    const t = V3.dot(diff, planeNormal) / denom;
    if (t < 0) return null;
    return V3.addScaled(V3.create(), rayOrigin, rayDir, t);
  };
  EM3D.closestPointOnSegment = (p, a, b) => {
    const ab = V3.sub(V3.create(), b, a);
    const len2 = V3.dot(ab, ab);
    let t = len2 > 1e-12 ? V3.dot(V3.sub(V3.create(), p, a), ab) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    return V3.addScaled(V3.create(), a, ab, t);
  };

  // ---------- orbit camera ----------
  // state = { target:{x,y,z}, yaw, pitch, dist } (radians, world units). Returns eye/view/proj/viewProj/invViewProj.
  EM3D.orbitCamera = (state, aspect, opts) => {
    opts = opts || {};
    const fovy = opts.fovy || Math.PI / 4, near = opts.near || 0.05, far = opts.far || 2000;
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    const cy = Math.cos(state.yaw), sy = Math.sin(state.yaw);
    const eye = {
      x: state.target.x + state.dist * cp * sy,
      y: state.target.y + state.dist * sp,
      z: state.target.z + state.dist * cp * cy
    };
    const view = Mat4.lookAt(Mat4.create(), eye, state.target, { x: 0, y: 1, z: 0 });
    const proj = Mat4.perspective(Mat4.create(), fovy, aspect, near, far);
    const viewProj = Mat4.multiply(Mat4.create(), proj, view);
    const invViewProj = Mat4.invert(Mat4.create(), viewProj) || Mat4.identity(Mat4.create());
    return { eye, view, proj, viewProj, invViewProj };
  };

  root.EM3D = EM3D;
  if (typeof module !== 'undefined' && module.exports) module.exports = EM3D;
})(typeof window !== 'undefined' ? window : globalThis);
