# Pholver ideas backlog

## Equation-of-motion solver (parked)

Idea: for a chosen system in the app (a few bodies plus connectors), derive and show the equations of motion, and optionally solve them and overlay the result on the live simulation.

Sketch:
- Pick a selection (reuse the area select) and treat it as the system.
- Choose generalized coordinates from the constraints: pins, rods, sliders, ropes over pulleys and welds each remove degrees of freedom. A pendulum gives theta, an Atwood machine gives one coordinate, a block on a spring gives x.
- Build T, V and the constraint relations, then form Lagrange's equations (d/dt dT/dq' - dT/dq = Q) and show them as text/LaTeX in the Properties panel.
- Solve numerically (RK4 or a stiff solver) from the Design-mode initial conditions, and plot q(t) against the engine's trajectory as an accuracy check. The engine is already tested against theory (Atwood, pendulums, spring-mass), so the two should agree.
- Stretch: small-angle linearisation with natural frequencies and normal modes, energy and phase plots.

Notes:
- The scene serializer (`Phys.serialize`) already gives a plain description of bodies and connectors to build on.
- Start with systems that have a closed form (single/double pendulum, Atwood, spring-mass, block on incline) before general constraints.
- Air drag, friction and contacts break the pure Lagrangian form, so the solver should say when a system is outside its scope.

## E&M: now a full 3D engine (web prototype)

No longer parked — built directly into the web app instead of waiting for the Rust port. Real vec3 fields and a true 3D camera (WebGL2, hand-rolled, no 3D library — same zero-dependency, raw-GL philosophy as `Documents\VSCode_Projects\Astronomical_Modelling`), not a 2.5D fake-depth trick. See `ARCHITECTURE.md`'s E&M section for the current shape and `em3d_math.js`/`ui_em3d.js` for the renderer. Circuit stays 2D; this applies to the E&M tab only.

Landed:
- 3D data model: positions/fields as vec3, orientation as quaternion (Euler-degree fields in the UI convert to/from it).
- `pushBoris`/`segB` generalized from their 2D-specialized forms to full 3D Boris rotation / 3D finite-wire Biot-Savart.
- New object types: permanent magnets/dipoles, detector screens, absorbing walls, a field probe.
- Moving point charges generate B (`B = km·q·v×r̂/r²`).
- Live equation readout for a selected particle: gyroradius `r = m|v⊥|/(|q||B|)`, drift speed `|E×B|/|B|²`, period `T = 2πm/(|q||B|)`.
- WebGL2 renderer (instanced spheres/cylinders for sources and particles, a line pass for wires/coils/the ruler/grid) and a full ray-cast interaction layer: orbit/pan/zoom camera, click/box-select, drag-to-move, numeric property-panel editing (replacing the old 2D screen-space resize/rotate drag handles, below).
- 3D field-line tracer (`EM.fieldLines`, generalized along with the rest of the engine): real curves followed through the vec3 field, not a 2D sketch, seeded on the full sphere around each charge (golden-angle/Fibonacci lattice, deterministic) rather than a ring confined to one plane — a charge pair's field is a surface of revolution about their axis even when both happen to sit in one plane, so a planar ring only ever drew one slice of it. The "E lines" toggle traces and draws them, throttled to a ~200ms cadence since a full retrace is too expensive to redo every animation frame; the trace step budget and the divergent-line cutoff radius both scale with the scene size and the camera's current distance, so lines reach roughly to the edge of the view instead of stopping at a fixed radius regardless of zoom.
- Per-species colouring: a "By species" toggle colours charges/beam particles by charge-to-mass ratio (grouping into a fixed palette, cycling for more species than palette entries) instead of by charge sign; the emitter's own colour field is unaffected and still the primary way to colour a beam.
- Perf tuning pass: verified against a ~40-50 object scene (mixed charges/wires/coils/regions/magnets plus an emitting beam) with field lines and species colouring both on and the sim running — no uncapped per-frame cost anywhere (the field-line retrace is both throttled and bounded by the line-buffer's existing hard cap).
- User-selectable work plane: a toolbar dropdown (XY/XZ/YZ/Camera-facing) picks which plane new objects land on and which plane dragging moves across; each has its own depth offset, nudged by PageUp/PageDown while placing (nothing selected) or along a selected object's own depth while selected. Objects aren't confined to one plane — an object placed on one plane keeps its own position/depth when the active plane later changes, and dragging it then moves it across whatever plane is now active while leaving its depth along that plane's normal untouched. The renderer's grid is drawn on the active plane for visual feedback.
- Out of scope so far: wire-to-wire mutual force (dropped per explicit decision — would need wires to become dynamic bodies with mass/collision, a bigger jump than asked for); a draggable 3-axis rotation gizmo (Rotate X/Y/Z degree fields in the property panel give full control instead); field arrows/a potential-map drawn across the whole view (the toolbar buttons are still there but inert — the per-item live readouts replace them for now); align/space-evenly still only operate on x/y (not plane-aware yet).

## Circuits, for the Rust app (the web version has R, C, L, sources, switch, lamp, scope and a field panel)

Web version: modified nodal analysis, trapezoidal companion models (backward Euler for the first step after any switch or topology change), schematic on a grid, scope, and a side panel with the E and B fields of one chosen part (capacitor gap, displacement-current B, solenoid B and induced E, resistor E, J, B and Poynting flow). The panel uses a simple physical model of each part and is not tied to the wire layout.

Parked for the application:
- **Fields from the real layout.** Take the wire geometry on the board, compute B from the currents (Biot–Savart, which `em.js` already has) and E from the potential along each wire and the charge on it, and show the true 2D field map around the whole circuit, not just one part. Reuse the E&M field-line and map code so a circuit can sit inside an E&M scene (a loop near a coil, a probe particle near a wire).
- **Mutual inductance and transformers.** Coupled coils with a coupling coefficient k, taken from their distance and orientation when the fields are real. Eddy currents in a conducting plate as a follow-on.
- **Nonlinear parts.** Diodes, LEDs, transistors, op-amps. Needs a Newton iteration inside each step (damped, with the previous solution as the first guess) and a step rejection rule for stiff switching.
- **AC analysis.** Phasor and frequency-sweep solves (complex MNA): Bode plots, impedance, resonance Q, phase relations, without having to wait for transients to die away. Also DC operating point on its own.
- **Transmission lines and waves.** Distributed R, L, C, G with reflections, and the Poynting vector for a travelling pulse. A natural bridge to the field solver.
- **Parasitics and real parts.** ESR and ESL of capacitors, winding resistance and saturation of inductors, battery internal resistance, finite wire resistance.
- **Meters and probes.** Place voltmeters and ammeters, differential probes, a multi-trace scope with triggering and cursors, an FFT view.
- **Netlist import and export.** SPICE text for a round trip with other tools; compare the engine against ngspice in the test suite.
- **Switching sequences.** Timed switches, PWM sources, step and square-wave generators, with the first step after each event handled as the web version does.
- **Energy ledger.** Track energy put in by sources, dissipated in resistors, and stored in each field, and show that the totals balance. The web version shows the instantaneous totals only.
- **Mechanics link.** A motor or solenoid tied to a body in the mechanics engine (force from B and I, back-emf from the speed), and a mechanical switch or relay.

## Notes from the latest round

- Concave custom shapes collide through a convex split (ear clipping plus merging). A rope that wraps round such a shape still wraps its convex hull; wrapping into hollows would need the rope solver to track the true outline.
- E&M workspace units: four scales (length, charge, mass, time) with the real constants. In the Rust app this can become the unit system for the whole scene, with the SI readout layer shared between E&M and circuits.

## Editing and analysis ideas (E&M and Circuit)

Done in the web prototype: box-select, shift-click, group move, copy/cut/paste/duplicate (also between tabs of the same kind), select all, arrow-key nudge, group rotate and flip (circuits), align and space evenly (E&M), run select, open-end rings, ruler. E&M's old 2D screen-space wire-end/coil-radius/capacitor-rotation drag handles were replaced, in the 3D rewrite, by numeric width/length/radius fields and Rotate X/Y/Z degree fields in the property panel (see above) — a draggable 3-axis rotation gizmo is still open below. A `probe` object type (position-only field sampler with a live readout) has also landed.

In progress, landing directly in the web prototype (not parked for Rust):
- E&M: lock objects, flip/mirror groups (B is a pseudovector — a mirror sign-flips the effective current/moment term on any field source derived from a current or charge velocity, so a mirrored loop correctly reverses its B), snap to other objects' edges, named groups, a graph of KE, speed and position for a chosen particle, a trajectory export, field-line seeds the user can place by hand, a draggable 3-axis rotation gizmo, and a time-series/pinned-readout UI for the probe type (the type itself and its instantaneous readout already ship). (Work planes other than XY have landed — see the "E&M: now a full 3D engine" section above.)
- Circuit: net labels so far-apart wires join without a drawn wire, junction dot control, an auto-router for wires, a draggable voltmeter and ammeter that stay in the schematic, a multi-trace scope that can show several parts at once, parts with a spreadsheet-style bulk edit, and a netlist export. (DC sweep and AC/Bode analysis stay parked for the Rust app — out of scope for this pass.)
- Both: a shared clipboard that survives reload, a snapping rule that ignores locked parts, and an "align to grid" repair for imported files. (Circuit does not get align/space-evenly in this pass — wasn't asked for, and the grid already covers most of that need for schematic parts.)

## Linkage connector (web prototype)
- Joints shared by several rods (branching, rod-to-rod); free joints are ghost bodies with no collision of their own. Rod lengths are taken from the drawn geometry.
- Ideas for the Rust app: motor/torsion on individual linkage joints, a "grounded" lock per joint, slider joints along a rod, and a linkage mobility (degrees of freedom) readout.

## Angle locks (web prototype)
- Hard locks are extra scalar rows in the sequential-impulse solver (one per locked rod/spring end, one per pair of rods at a locked linkage joint), warm-started, with a position pass. Angle is captured from the pose when the sim starts.
- Rust: express every lock as the same row type (angle of a line between two anchor points minus the angle of a body, or minus another line's angle), so rods, springs, linkages and pins share one code path.

## Air resistance removed (web prototype)
- Dropped the Air toggle, air density and per-object drag coefficient. Old saves that carry the settings load and ignore them. The per-object Linear drag (1/s) damping stays, since linkages and slack ropes use it for their own damping.

- Spring/rod/ext-rope line contacts now skip bodies welded, pinned, slid or rod-joined to either end body (they were fighting their own anchor). Unrelated bodies still collide.

## Linkage taps (rewritten for the Rust app)
- A tap is NOT a body. It is the point (1-t)·A + t·B on the line between the two ends of its rod. Every constraint that touches a tap (rods, angle locks, line contacts) is expanded to Jacobian terms on the real bodies behind it (nested taps recurse), so the load is shared out exactly and the tap can never come off its rod, whatever the mass ratio. Port this as a general "weighted point" constraint term (see J._sl in joints: addPt / addAng).
- The old ghost-bar-with-two-pins approach tore apart at ~50:1 mass ratio and could not be fixed with more iterations.
- Free joints of a massless linkage get inertia = 2% of the heaviest attached object (floor 0.05) to keep the solver conditioned.
- Linkage rods do not collide with the objects the linkage is built on (stops self-forces).
- Position iterations continue (up to 60) while a linkage rod is still more than 0.2 mm off.
- Known simplification: in a non-massless linkage a tap carries no mass of its own.

## Circuit engine vs Falstad (web prototype, for the Rust app)
- Added diode, LED (colour, glow), Zener, NPN/PNP, N/P-MOSFET, op-amp with rails. Same device models Falstad uses (Shockley, Ebers-Moll, square-law), but with SPICE-style junction limiting so Newton does not cycle.
- Integration: trapezoidal for linear circuits, backward Euler for the first step after any change and after a device regime flip (kills trapezoid ringing/overshoot), TR-BDF2 for nonlinear circuits. A trapezoid-only diode+capacitor circuit overshot (6.28 V from 5 V).
- A bug worth remembering: the dense `luSolve` had a pivot-order bug that made BJT Newton cycle; the cure was fixing the solve, not adding damping.
- Edge over Falstad still to build: auto time-constant annotations, Thevenin/Norton readout, energy bookkeeping, example library (rectifier, LED, Zener regulator, CE amp, CMOS inverter, op-amp circuits), toggleable 2.5D magnetic-field viewer.
- UI guard: a wire may not run across a part (it shorted the part invisibly). In Rust, make wires split at part terminals instead.
