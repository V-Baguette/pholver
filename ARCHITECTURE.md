# Pholver architecture

## Build
`build.sh` concatenates scripts into one HTML file, each in its own `<script>` tag, in this order:
`joints.js engine.js scene.js em3d_math.js em.js ckt.js ui.js ui_em3d.js ui_em.js ui_ckt.js` after `part1.html` (CSS and markup).
Engine files also work under Node (`module.exports`), which is how the tests load them. `ckt.js` and the UI files attach to `window`.
`window.__pholver` (set in `ui.js`) is the test hook: `cur` (active document), `setMode('design'|'simulate'|'render')`, `select`, `renderProps`, `renderWorkspace`, `refreshFields`.

## Mechanics (`engine.js`, `src/j*.js`, `scene.js`)
- Fixed step `Phys.DT`, sequential-impulse solver (`ITER` iterations), warm-started contacts, convex polygon + circle shapes, concave shapes decomposed.
- **Joints** (`src/j1.js` taps/slaves, `src/j3.js`, `src/j2.js` solver and locks): pin, rod, spring, rope (inextensible and extensible), chain, wrap (rope round wheels), slider, weld, angle locks, torsional springs/rods, stoppers, linkage.
- **Linkages**: a master rod with *taps* (slave bars `b.sl`) positioned by weighted-point Jacobian terms. Taps are constraints, not bodies with mass; a ghost-node inertia floor keeps free nodes stable under heavy loads. `J.solveP` runs extra iterations only for `j.lk` rods.
- **Bookkeeping fields on bodies**: `wc` weld cluster, `nc` no-collide set, `lks` bodies a linkage is built on, `wl` massless body that keeps real inertia (axle wheels).
- **Line contacts** (`lineContacts`): spring/rod/rope segments collide with bodies except those they are attached to (the `held` set).
- Scene save/load: `scene.js` (`Phys.snapshot/restore`, `SKIP_BODY` lists fields that are derived and not saved).

## E&M (`em3d_math.js`, `em.js`, `ui_em3d.js`)
Full 3D engine: positions/fields are vec3, orientation is a quaternion (property panel exposes Euler-degree fields that convert to/from it). Fixed step `EM.DT = 1/240`, 3D Boris-pusher integration (`pushBoris`), 3D finite-wire Biot-Savart (`segB`). Sources: point charges (now also generating B when moving), E/B regions, wires, coils, permanent magnets/dipoles, plus non-source object types (detector screens, absorbing walls, field probes). Presets in `EM.PRESETS`. `em3d_math.js` is a small hand-rolled vec3/mat4/quat module (no 3D library — raw WebGL2, same philosophy as the zero-dependency build). `ui_em3d.js` is the WebGL2 renderer (instanced draws, orbit camera, selection highlight, a placement ghost, species-by-q/m colouring) on its own `<canvas id="cvEm">`, separate from the shared 2D `<canvas id="cv">` Mechanics/Circuit still use (a canvas can only ever get one of `'2d'`/`'webgl2'` context, so EM needs its own canvas element). `ui_em.js` drives it: ray-cast placement/picking/box-select/drag, all onto a user-selectable work plane (`ui_em.js`'s `planeOf`, toolbar "Plane" dropdown: XY/XZ/YZ/camera-facing, each with its own depth offset nudged by PageUp/PageDown while placing or by a selected object's own depth while selected) rather than fixed at z=0 — objects can sit and be dragged anywhere in 3D, not just on one plane; the ground grid (`ui_em3d.js`'s `drawInfiniteGrid`) is a shader-computed procedural quad re-centered under the camera's orbit target every frame, so it stays visible at any zoom level rather than running out of a fixed line-vertex budget, and follows whichever plane is active. Rotation is edited via Euler-degree property-panel fields rather than a draggable gizmo. Emitters/charges/B-field regions draw small direction/polarity glyphs (`writeDirArrow`/`writeChargeCross`/`writeChargeRing` — a 4-barb arrow along the item's rotated local axis, a world-aligned "+" for positive charges, a flat ring for negative) so orientation reads at a glance instead of only through color; a toolbar toggle (`#emFieldVis`, `st(d).opts.regions`) hides/shows field-region wireframes and the B-field arrow together (screens/walls stay visible regardless — they're collision geometry, not fields). E field lines (`EM.fieldLines`, real 3D traced curves) retrace on a throttled ~200ms cadence rather than every frame — tracing is `O(seeds × steps × items)`, too expensive to redo at 60fps alongside the sim step itself.

## Circuits (`ckt.js`)
- Modified nodal analysis, dense LU (`lu`, `luSolve`), cached per `(mode|h)`.
- Companion models: trapezoidal (linear circuits), backward Euler (first step after any change and after a regime flip), TR-BDF2 (nonlinear circuits).
- Nonlinear devices (diode, LED, Zener, NPN/PNP, N/P-MOSFET, op-amp): Newton iteration with SPICE-style junction limiting (`pnjlim`) and damping. Each device returns terminal currents `I`, slopes `J` against control voltages, and maps `C`/`off`. Three-terminal parts use `LOC` for terminal positions.
- `regionOf(it)` and `charac(it)` feed the field panel (operating region, characteristic curves with the operating point).
- `across`/`singMsg` detect a wire running across a part (the usual cause of "no unique solution").
- Parts keep results in `_v _i _p` (and `_ti _ib _ic _vbe _vgs` for transistors) after each step. Presets in `CKT.PRESETS`.

## UI (`ui.js`, `ui_em.js`, `ui_ckt.js`)
Each tab is a *document* with its own canvas drawing, tool state, property panel and field panel. Shared helpers: `P.mkHelpers` (`sect/num/select/check/note/button`), `P.flash`, `P.select`, `P.checkpoint` (undo). Circuit UI: `PARTS` tray, `ICON`, `drawPart` (local frame, y down), `siRow`/`liveRow` property rows, `drawFields`, `flowGraph/updateFlow/drawFlow` (current dots), scope history.

## Tests
- `tests/test*.js`: engine invariants and analytic checks (rolling disc, cyclotron, RC/RLC, diode/BJT/MOSFET/op-amp operating points...).
- `tests/cert.js`: presets, save/load round trips, random resistor networks (KCL and power balance), determinism, mechanics fuzz.
- `tests/e2e*.py`: Playwright UI flows against `pholver.html`. `tests/e2e5.py` is the broad smoke test.
- `./run_all.sh` runs everything.

## Porting to the Rust app
1. Port the data model and the solvers first (engine, joints, ckt, em); keep function names so the JS tests can be translated one-to-one. Use the JS as the oracle: dump trajectories from Node and compare in Rust tests within tolerance.
2. Keep determinism: fixed steps, no random, stable iteration order.
3. The UI is a prototype; the Rust UI should reuse the *behaviour* (tools, property panels, field panels) not the code.
4. `IDEAS.md` lists the features deliberately left for Rust (equation-of-motion solver, Falstad-style circuit extras, AC/Bode and DC-sweep analysis, teaching tools, the Circuit field panel's 2.5D viewer). The E&M 3D engine and most of the E&M/Circuit editing backlog are being built directly into the web prototype instead — see `IDEAS.md`'s "E&M: now a full 3D engine" and "Editing and analysis ideas" sections.
