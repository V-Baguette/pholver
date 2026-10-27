#!/bin/sh
# Assembles the full app (mechanics + E&M) and the mechanics-only build.
cd "$(dirname "$0")"
cat src/j1.js src/j3.js src/j2.js > joints.js
sed "s|^  if (window.EM \&\& !docs.some(x => x.kind === 'em')) mkDoc.*|  // (no E\&M tab in the mechanics-only build)|" ui.js > ui_mech.js
{ cat part1.html; for f in joints.js engine.js scene.js em3d_math.js em.js ckt.js ui.js ui_em3d.js ui_em.js ui_ckt.js; do echo '<script>'; cat $f; echo '</script>'; done; } > pholver.html
{ cat part1.html | sed '1s/.*/<title>Pholver Mechanics<\/title>/'; for f in joints.js engine.js scene.js ui_mech.js; do echo '<script>'; cat $f; echo '</script>'; done; } > pholver-mechanics.html
ls -l pholver.html pholver-mechanics.html
