# Pholver tutorial

A walkthrough of every tool in the app, tab by tab. Open `pholver.html` in a browser — there is nothing to install. For a feature-only build without the E&M/Circuit tabs, use `pholver-mechanics.html`.

## The basics

**Tabs and documents.** The row at the top (`Open files`) holds your open designs, one per tab, each its own independent scene. The mode button at the left of the toolbar (bottom of the screen) switches between:

- **Design** — place and arrange objects. Nothing moves.
- **Simulate** — run the physics. Grab and push objects, watch values live, step frame by frame.
- **Render** — a cleaner playback view (shading, backgrounds) for watching a design run without the editing clutter.

Switching tabs at the top picks Mechanics, E&M or Circuit for a *new* document (via the "+" affordance in the tab bar); each existing tab keeps the kind it was created with.

**Shared toolbar controls** (same across all three kinds, shown only in the relevant mode):

| Control | What it does |
|---|---|
| **Select** | Default tool. Left-drag to move or box-select; Shift-click adds one to the selection, Shift-drag selects an area. `Ctrl+C/X/V/D/A` copy, cut, paste, duplicate, select all. `[`/`]` rotate the selection 15°. |
| **Undo / Redo** | `Ctrl+Z` / `Ctrl+Y` (or `Ctrl+Shift+Z`). |
| **Duplicate** | `Ctrl+D`. |
| **Delete** | `Del`. |
| **Snap + Grid size** | Toggles snapping and sets how far objects jump when placed or dragged (0.1–1 m). |
| **Save / Open** | Save the current design to a `.json` file; Open loads one into a new tab. |
| **Fit view** | Frames every object in the scene. |
| **Play / Step / Reset** | Start or pause the simulation (`Space`), advance exactly 1/60 s, or snap back to the Design-mode starting state (`R`). |
| **Speed** | Simulation speed multiplier (0.25×–2×). |
| **Grid / Velocity / Trails** | Toggle the background grid, per-body velocity arrows, and motion trails during Simulate/Render. |
| **Shading / Background** | Render-mode-only cosmetic options (shaded surfaces; paper/graphite/blueprint backdrop). |

The **Properties** panel (right side) shows and edits the selected object's fields; with nothing selected it shows scene-wide settings (gravity, workspace units, or a list of example presets you can load, depending on the tab). The **Workspace** panel (also right side) lists every object in the scene by name — click a row to select it.

## Mechanics tab

Rigid bodies, joints and linkages, under 2D gravity.

**Objects** (toolbar "Objects" menu): **Sphere**, **Rectangle**, **Polygon** (fixed regular shape), **Custom** (draw a free-form shape — click to add each point, Shift for a straight edge, click your first point again or press Enter to close, Backspace undoes the last point, Esc cancels), **Pulley**. The **Inclined Plane** button places a ramp directly.

**Connectors** (toolbar "Connectors" menu) join two points or two objects:

| Connector | Behaviour | Placing it |
|---|---|---|
| **Spring** | Hooke's law, with damping. | Click the first end (empty space pins it to the world), then the other end. Two ends in empty space makes a stopper — a pad other bodies can hit. |
| **Rod** | Rigid length, hinged at both ends. | Click each end; length is fixed at the distance between them. |
| **Rope** | Inextensible or extensible (set in Properties); bends around pulleys. | Click the start, then either a pulley to wrap over (object → pulley → object makes an Atwood machine) or the end point. |
| **Slack rope (chain)** | Many-link rope that drapes and collides with what it hangs over. | Click the start, then the end. |
| **Linkage** | A master rod with other rods (taps) hinged to shared joints. | Click a first joint (on an object, an existing linkage joint, or empty space for a free joint), then each next joint; click the last joint again, double-click, or press Enter to finish. Click along an existing rod to branch from it (Alt-click to split it with a hinge instead). |
| **Pin Joint** | Hinge, can carry a motor and angle limits. | Click a point on one object to hinge it to the world, or where two objects overlap to join them. |
| **Torsion Spring** | A hinge that springs back to the pose it was placed in. | Click an existing hinge/rod end, or where two objects overlap. |
| **Weld** | Rigidly locks two bodies (or one body to the world). | Click the overlap, or a single object to fix it in place. |
| **Slider** | Prismatic rail; set the rail angle in Properties. | Click an object (or an overlap). |

**Simulating.** Switch to Simulate mode, set **Gravity** (m/s², default 9.81) and whether the **Ground** (a floor at y = 0) is active, then **Play**. **Grab** drags objects with the mouse (free bodies move freely, constrained ones follow their joints); **Push** presses and drags to apply a force in that direction, with magnitude set by the **Push force (N)** field.

## E&M tab

A full 3D electromagnetism sandbox: point charges, field regions, wires, coils, magnets, and detectors, all in a free-orbiting 3D camera.

**Camera.** Left-drag selects/moves (or box-selects empty space); **right-drag orbits**; the **scroll wheel zooms**. Arrow keys nudge a selection within the current work plane; `PageUp`/`PageDown` nudge it along the plane's normal.

**Work plane.** New objects are placed on, and dragging moves across, the toolbar's **Plane** selector: XY, XZ, YZ, or Camera-facing. While placing an object (or with one selected), `PageUp`/`PageDown` move the plane itself in and out, so you can build at any depth, not just on one flat sheet.

**Add menu** — every object type you can drop into the scene:

| Object | What it is |
|---|---|
| **Positive / Negative charge** | A fixed point source of E (and B, if it moves). |
| **Free particle** | A charge that moves under the fields instead of staying put. |
| **Emitter** | Continuously fires a stream of particles; its facing direction is shown by a small arrow glyph. |
| **Uniform E field** | A region of constant electric field. |
| **Capacitor** | Two plates held at a set voltage. |
| **Uniform B field** | A region of constant magnetic field (direction shown by an arrow glyph; rotate the object to steer it). |
| **Wire** | A straight current-carrying segment. |
| **Coil** | A circular current loop. |
| **Magnet** | A permanent dipole. |
| **Screen** | Detects and stops particles that hit it. |
| **Wall** | Absorbs particles. |
| **Field probe** | A fixed point that reads and reports the local field, without being a source itself. |

Positive charges draw a small "+" glyph; negative charges draw a ring; both read at a glance without relying on color alone.

**Toolbar toggles:**
- **E lines** — traces field lines from + charges to − charges.
- **By species** — colors moving charges by charge-to-mass ratio (so e.g. protons and electrons read as different colors) instead of by sign.
- **Field regions** — shows or hides E/B/capacitor region wireframes and the B-field direction arrow (screens and walls, being collision geometry rather than fields, stay visible regardless).
- **Ruler** — drag between two points to measure the distance between them; `Esc` clears it.

**In Simulate/Render**, drag the **Probe** tool to drop a test particle (set its charge and mass in the **Probe q** / **Probe m** fields first); drag before releasing to launch it with an initial velocity.

**Workspace units.** With nothing selected, the Properties panel's "Workspace units" setting rescales the whole scene to a real-world unit system without changing any object's actual size or speed — e.g. switch between plain SI, a lab scale (cm, nC, mg), or scales tuned for real protons or electrons.

**Example presets** (Properties panel, nothing selected): Mass spectrometer, Circular motion in B, Electric dipole, Parallel wires, E × B drift, Coulomb orbits, and more — each loads a ready-made scene with a short note explaining what it demonstrates.

## Circuit tab

A full SPICE-like circuit simulator (modified nodal analysis) on a schematic grid.

**Parts** (toolbar "Add" menu):

| Part | Behaviour |
|---|---|
| **Battery** | Fixed voltage source. |
| **AC source** | Sine-wave voltage source. |
| **Current source** | Fixed current. |
| **Resistor** | Ohm's law. |
| **Lamp** | A resistor that glows with the power it dissipates. |
| **Capacitor** | Stores an E field. |
| **Inductor** | Stores a B field. |
| **Switch** | Click to open/close. |
| **Ground** | The 0 V reference node. |
| **Diode** | One-way current valve. |
| **LED** | Glows when conducting forward. |
| **Zener diode** | Holds a fixed reverse voltage. |
| **NPN / PNP transistor** | Current amplifier. |
| **N-MOSFET / P-MOSFET** | Voltage-controlled switch. |
| **Op-amp** | High-gain amplifier. |

**Wiring.** The **Wire** tool draws wires: click to start, click again for each corner, `Esc` or double-click to finish. Terminals meeting at one grid point share an electrical node; an axis-aligned wire automatically joins any terminal that lies on it. A wire can't run across a part's body (that would short it — the app flags this with a "no unique solution" message if you try). **Rotate** (`R`) spins the selected part, or the part you're about to place.

**Simulating.** In Simulate/Render, **Current** animates moving dots to show conventional current flow in the wires; **Voltage** colors wires by their potential (red = high, blue = low). **Time scale** sets how many simulated seconds pass per real second; **Auto** picks a sensible value for the circuit you built. A dock at the bottom holds a **scope** (voltage/current history over time) and a **field panel** (operating-point detail — region, characteristic curve — for the selected part).

**Example presets** (Properties panel, nothing selected): RC charging, RL current ramp, LC oscillator, Series RLC with AC drive, Voltage divider and lamp, RC low-pass filter — each with a short explanation of what to watch.

## Saving and loading

**Save** writes the current design (including which tab kind it is) to a `.json` file; **Open** loads one into a new tab. Designs are also auto-kept in the browser's local storage between sessions, so reopening the page restores your open tabs.
