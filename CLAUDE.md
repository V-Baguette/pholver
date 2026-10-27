# Pholver: instructions for Claude Code

Pholver is a 2D physics sandbox with three tabs: **Mechanics** (rigid bodies, joints, linkages), **E&M** (charges, fields) and **Circuit** (MNA circuit simulator with field panel).
This repo is the **web prototype** (plain JS, no dependencies, ships as one self-contained `pholver.html`). The long-term goal is a **native Rust app**; the web code is the executable spec. Read `ARCHITECTURE.md` before changing engine code and `IDEAS.md` for design notes and the Rust-port backlog.

## Commands
- `./build.sh` assembles `pholver.html` (full app) and `pholver-mechanics.html`. Run it after every edit.
- `./run_all.sh` full certification (syntax, build, all Node tests, `cert.js`, every Playwright e2e). `./run_all.sh quick` skips the browser tests. **Must end with `0 failed` before you call anything done.**
- `node test_xxx.js` / `python3 e2eNN.py` run a single test. Tests must be run from this directory.
- Playwright is already installed (Chromium). Do not run `playwright install`.

## Source of truth vs generated files (important)
Edit these: `engine.js scene.js em.js ckt.js ui.js ui_em.js ui_ckt.js src/j1.js src/j2.js src/j3.js part1.html build.sh`.
Never hand-edit generated files: `joints.js` (concatenation of `src/j1.js src/j3.js src/j2.js`), `ui_mech.js` (derived from `ui.js`), `pholver.html`, `pholver-mechanics.html`. `./build.sh` regenerates them.

## Working rules
- Every bug fix gets a regression test (Node test for engine behaviour, `e2eNN.py` for UI). Next e2e number: one above the highest existing.
- Engine tests use physical invariants (conservation, analytic solutions, no NaN), not recorded outputs.
- Mechanics solver changes can break far-away behaviour (chains, ropes, linkages). Always run the full suite, not only the nearby test.
- The sim is deterministic; keep it so (no `Math.random` in engine code, fixed steps). `cert.js` checks this.
- Circuit conventions: `Vab = V(a) - V(b)`, current positive from terminal a to b, battery + is terminal b, schematic coordinates are y-up grid cells. Terminals meeting at one grid point share a node; an axis-aligned wire joins any terminal lying on it; a wire may not run across a part (it would short it; `CKT.across` guards this).
- Do not send or commit the standalone HTML after every build; build it, test it, publish only when asked.
- UI text is plain and friendly, no jargon without explanation. Prefer SI units everywhere.
- New ideas that belong to the Rust app go in `IDEAS.md`, not in the web code.

## Layout
See `ARCHITECTURE.md`. Short version: `engine.js` (rigid-body solver) + `src/j*.js` (joints) + `scene.js` (scene model, save/load); `em.js`; `ckt.js` (circuit engine); `ui*.js` (canvas UI per tab); `test*.js`, `cert.js`, `e2e*.py` (tests); `.archive/` (old backups and screenshots, ignore).

## Git
Not a git repo yet. When it becomes one: commit only on request; end commit messages with the attribution lines your session instructions give.
