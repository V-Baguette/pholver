const EM3D = require('./em3d_math.js');
const { V3, Quat, Mat4 } = EM3D;
let fails = 0; const ok = (n, c, i) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (i ? '   ' + i : '')); if (!c) fails++; };
const close = (a, b, eps) => Math.abs(a - b) < (eps == null ? 1e-6 : eps);
const v3close = (a, b, eps) => close(a.x, b.x, eps) && close(a.y, b.y, eps) && close(a.z, b.z, eps);

// ---------- vec3 ----------
{
  const a = V3.create(1, 2, 3), b = V3.create(4, -1, 2);
  ok('vec3 add', v3close(V3.add(V3.create(), a, b), { x: 5, y: 1, z: 5 }));
  ok('vec3 sub', v3close(V3.sub(V3.create(), a, b), { x: -3, y: 3, z: 1 }));
  ok('vec3 dot', close(V3.dot(a, b), 1 * 4 + 2 * -1 + 3 * 2));
  ok('vec3 cross of x,y is z', v3close(V3.cross(V3.create(), { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 1 }));
  ok('vec3 length', close(V3.length({ x: 3, y: 4, z: 0 }), 5));
  ok('vec3 normalize', close(V3.length(V3.normalize(V3.create(), { x: 7, y: 0, z: 0 })), 1));
  ok('vec3 lerp midpoint', v3close(V3.lerp(V3.create(), { x: 0, y: 0, z: 0 }, { x: 2, y: 4, z: 6 }, 0.5), { x: 1, y: 2, z: 3 }));
}

// ---------- quaternion ----------
{
  ok('identity quat leaves vector unchanged', v3close(Quat.rotateVec3(V3.create(), Quat.identity(Quat.create()), { x: 1, y: 2, z: 3 }), { x: 1, y: 2, z: 3 }));

  const qz90 = Quat.fromAxisAngle(Quat.create(), { x: 0, y: 0, z: 1 }, Math.PI / 2);
  ok('90deg about Z: +x -> +y', v3close(Quat.rotateVec3(V3.create(), qz90, { x: 1, y: 0, z: 0 }), { x: 0, y: 1, z: 0 }));

  const qx90 = Quat.fromAxisAngle(Quat.create(), { x: 1, y: 0, z: 0 }, Math.PI / 2);
  ok('90deg about X: +y -> +z', v3close(Quat.rotateVec3(V3.create(), qx90, { x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 1 }));

  const qy90 = Quat.fromAxisAngle(Quat.create(), { x: 0, y: 1, z: 0 }, Math.PI / 2);
  ok('90deg about Y: +z -> +x', v3close(Quat.rotateVec3(V3.create(), qy90, { x: 0, y: 0, z: 1 }), { x: 1, y: 0, z: 0 }));

  // multiply(a,b) then rotate == rotate by b then by a (apply-b-first convention)
  const v = { x: 1, y: 0, z: 0 };
  const viaCompose = Quat.rotateVec3(V3.create(), Quat.multiply(Quat.create(), qz90, qx90), v);
  const viaSequential = Quat.rotateVec3(V3.create(), qz90, Quat.rotateVec3(V3.create(), qx90, v));
  ok('quat multiply applies right operand first', v3close(viaCompose, viaSequential));

  // fromEuler/toEuler round-trip away from gimbal lock
  for (const [ex, ey, ez] of [[20, 35, 50], [-15, 10, 70], [5, -40, -25], [80, 5, 5]]) {
    const q = Quat.fromEuler(Quat.create(), ex, ey, ez);
    const back = Quat.toEuler(Quat.normalize(Quat.create(), q));
    ok(`euler round-trip (${ex},${ey},${ez})`, close(back.x, ex, 0.01) && close(back.y, ey, 0.01) && close(back.z, ez, 0.01),
      `got (${back.x.toFixed(3)},${back.y.toFixed(3)},${back.z.toFixed(3)})`);
  }

  // rotating a vector by q should match transforming it through Mat4.fromQuat(q)
  const qArb = Quat.normalize(Quat.create(), Quat.fromEuler(Quat.create(), 23, -41, 67));
  const viaQuat = Quat.rotateVec3(V3.create(), qArb, { x: 2, y: -3, z: 5 });
  const m = Mat4.fromQuat(Mat4.create(), qArb);
  const viaMat = Mat4.transformDirection(V3.create(), m, { x: 2, y: -3, z: 5 });
  ok('Mat4.fromQuat matches Quat.rotateVec3', v3close(viaQuat, viaMat, 1e-5), `${JSON.stringify(viaQuat)} vs ${JSON.stringify(viaMat)}`);
}

// ---------- mat4 ----------
{
  const id = Mat4.identity(Mat4.create());
  ok('identity * identity = identity', Mat4.multiply(Mat4.create(), id, id).every((v, i) => close(v, id[i])));

  const m = Mat4.compose(Mat4.create(), { x: 1, y: 2, z: 3 }, Quat.fromEuler(Quat.create(), 17, -33, 61), { x: 1, y: 1, z: 1 });
  const inv = Mat4.invert(Mat4.create(), m);
  const prod = Mat4.multiply(Mat4.create(), m, inv);
  ok('m * invert(m) = identity', prod.every((v, i) => close(v, id[i], 1e-5)), JSON.stringify(prod.map(v => +v.toFixed(3))));

  const p = Mat4.transformPoint(V3.create(), m, { x: 0, y: 0, z: 0 });
  ok('transformPoint of origin recovers the translation', v3close(p, { x: 1, y: 2, z: 3 }, 1e-5));

  // lookAt: eye looking at target along -Z of its own view space puts the target at a negative view-space z
  const eye = { x: 0, y: 0, z: 5 }, target = { x: 0, y: 0, z: 0 };
  const view = Mat4.lookAt(Mat4.create(), eye, target, { x: 0, y: 1, z: 0 });
  const targetInView = Mat4.transformPoint(V3.create(), view, target);
  ok('lookAt puts target in front of the camera (-z)', targetInView.z < 0, JSON.stringify(targetInView));
  const eyeInView = Mat4.transformPoint(V3.create(), view, eye);
  ok('lookAt puts the eye itself at the view-space origin', v3close(eyeInView, { x: 0, y: 0, z: 0 }, 1e-5));
}

// ---------- ray / plane picking ----------
{
  const hit = EM3D.intersectRayPlane({ x: 0, y: 5, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  ok('ray straight down hits the XZ plane at the origin', v3close(hit, { x: 0, y: 0, z: 0 }, 1e-9));

  const miss = EM3D.intersectRayPlane({ x: 0, y: 5, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  ok('ray parallel to the plane misses', miss === null);

  const behind = EM3D.intersectRayPlane({ x: 0, y: -5, z: 0 }, { x: 0, y: -1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
  ok('plane behind the ray origin misses', behind === null);

  const closest = EM3D.closestPointOnSegment({ x: 5, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
  ok('closest point on segment projects and clamps', v3close(closest, { x: 5, y: 0, z: 0 }, 1e-9));
  const clamped = EM3D.closestPointOnSegment({ x: -5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 });
  ok('closest point clamps to the segment start', v3close(clamped, { x: 0, y: 0, z: 0 }, 1e-9));
}

// ---------- orbit camera ----------
{
  const cam = EM3D.orbitCamera({ target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, dist: 10 }, 16 / 9);
  ok('orbit camera at yaw=0,pitch=0 sits on +Z at the given distance', v3close(cam.eye, { x: 0, y: 0, z: 10 }, 1e-6));

  // Unprojecting the center of the screen should give a ray passing through the target.
  const ray = EM3D.rayFromScreen(cam.invViewProj, 0, 0);
  const hit = EM3D.intersectRayPlane(ray.origin, ray.dir, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 });
  ok('screen-center ray through an orbit camera passes near the target', hit && V3.length(hit) < 1e-3, hit && JSON.stringify(hit));
}

console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
