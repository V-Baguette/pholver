#!/bin/sh
# Full certification: syntax, build freshness, every Node test, cert.js, every Playwright e2e.
# Usage: ./run_all.sh [quick]     (quick = skip the browser e2e)
cd "$(dirname "$0")"; fail=0; pass=0
say() { printf '%-34s %s\n' "$1" "$2"; }
for f in engine.js scene.js em3d_math.js em.js ckt.js ui.js ui_em3d.js ui_em.js ui_ckt.js src/j1.js src/j2.js src/j3.js; do node --check $f || { say "syntax $f" FAIL; fail=$((fail+1)); }; done
./build.sh >/dev/null || { say build FAIL; fail=$((fail+1)); }
for t in tests/test*.js tests/cert.js; do
  out=$(node $t 2>&1); rc=$?
  if [ $rc -ne 0 ] || echo "$out" | grep -q '^FAIL'; then say "$t" FAIL; echo "$out" | grep -m5 FAIL; fail=$((fail+1)); else say "$t" ok; pass=$((pass+1)); fi
done
if [ "$1" != "quick" ]; then
  for t in tests/e2e.py $(ls tests/e2e[0-9]*.py | sort -V); do
    out=$(python3 $t 2>&1); rc=$?
    # network errors for web fonts are expected offline
    if [ $rc -ne 0 ] || echo "$out" | grep -q 'PAGEERROR\|Traceback'; then say "$t" FAIL; echo "$out" | tail -4; fail=$((fail+1)); else say "$t" ok; pass=$((pass+1)); fi
  done
fi
echo "---- $pass passed, $fail failed"; [ $fail -eq 0 ]
