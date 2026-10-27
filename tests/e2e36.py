import asyncio, json
from playwright.async_api import async_playwright

# Regression test for: a thrown error inside one tab's per-frame draw (KU(d).frame)
# must not kill the single shared requestAnimationFrame loop in ui.js for every other tab.
# We synthesize the failure in EMUI.frame rather than relying on E&M's current migration
# state, so this stays meaningful once the E&M 3D rewrite (and its own tests) land.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        caught = []
        pg.on('pageerror', lambda e: caught.append(str(e)))
        await pg.goto('file://' + __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))) + '/pholver.html')
        await pg.wait_for_timeout(600)

        res = {}
        # start the mechanics sim playing so we have a live, cheap "is the loop still ticking" signal
        await pg.click('#modeBtn'); await pg.click('#modeMenu [data-m=sim]')
        t_before_break = await pg.evaluate('window.__pholver.cur.world.t')
        await pg.wait_for_timeout(300)

        # synthesize a per-frame crash in the E&M tab's draw path
        # trailing `;0` matters: Playwright auto-invokes an evaluate() expression that
        # itself evaluates to a function, and a bare assignment's value is that function
        await pg.evaluate("window.EMUI.frame = () => { throw new Error('synthetic e2e36 test error'); };0")
        await pg.evaluate("window.__pholver.switchDoc(window.__pholver.docs.find(x => x.kind === 'em'))")
        await pg.wait_for_timeout(300)
        res['synthetic_error_seen'] = any('synthetic e2e36' in e for e in caught)

        # back to mechanics: the shared frame() loop must still be alive and ticking
        await pg.evaluate("window.__pholver.switchDoc(window.__pholver.docs.find(x => x.kind === 'mech'))")
        t_after_break = await pg.evaluate('window.__pholver.cur.world.t')
        await pg.wait_for_timeout(500)
        t_later = await pg.evaluate('window.__pholver.cur.world.t')
        res['mech_time_advanced_after_em_crash'] = t_later > t_after_break > t_before_break

        # circuit tab (the boot-time "Circuit: RC Charging" doc) must still actually be
        # simulating (not just holding stale "objects" text)
        await pg.evaluate("window.__pholver.switchDoc(window.__pholver.docs.find(x => x.kind === 'ckt'))")
        await pg.wait_for_timeout(200)
        await pg.evaluate("window.__pholver.setMode('sim')"); await pg.wait_for_timeout(200)
        ck_t0 = await pg.evaluate('window.__pholver.cur.ck.t')
        await pg.wait_for_timeout(500)
        ck_t1 = await pg.evaluate('window.__pholver.cur.ck.t')
        res['ckt_time_advanced_after_em_crash'] = ck_t1 > ck_t0

        print(json.dumps(res, indent=1))
        ok = res['synthetic_error_seen'] and res['mech_time_advanced_after_em_crash'] and res['ckt_time_advanced_after_em_crash']
        assert ok, res
        await b.close()

asyncio.run(main())
