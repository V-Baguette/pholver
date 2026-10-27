import asyncio, json
from playwright.async_api import async_playwright

# Regression test for phase A3: the E&M tab must swap in the WebGL #cvEm canvas (not the shared 2D #cv)
# and the static renderer (ui_em3d.js / window.EM3DGL) must actually draw the current scene, not just
# clear to the background color. Mechanics must keep using #cv as before.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1280, 'height': 800})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))) + '/pholver.html')
        await pg.wait_for_timeout(600)

        res = {}
        # mechanics (default tab): #cv visible, #cvEm hidden
        vis0 = await pg.evaluate("() => ({cv: document.querySelector('#cv').hidden, cvEm: document.querySelector('#cvEm').hidden})")
        res['mech_canvas_visibility'] = vis0

        # switch to the boot-time E&M doc
        await pg.evaluate("window.__pholver.switchDoc(window.__pholver.docs.find(x => x.kind === 'em'))")
        await pg.wait_for_timeout(400)
        vis1 = await pg.evaluate("() => ({cv: document.querySelector('#cv').hidden, cvEm: document.querySelector('#cvEm').hidden, fallback: document.querySelector('#emFallback').hidden})")
        res['em_canvas_visibility'] = vis1
        res['em3dgl_present'] = await pg.evaluate("typeof window.EM3DGL === 'object'")

        # sample a grid of pixels across the WebGL canvas; a static scene with a grid, axes and a couple of
        # items must not render as a single flat clear color everywhere
        samples = await pg.evaluate("""() => {
          const { cw, ch, dpr } = window.__pholver.size;
          const pts = [];
          for (let fx = 0.2; fx <= 0.8; fx += 0.15) for (let fy = 0.2; fy <= 0.8; fy += 0.15) {
            pts.push(window.EM3DGL.samplePixel(Math.floor(cw * dpr * fx), Math.floor(ch * dpr * (1 - fy))));
          }
          return pts;
        }""")
        distinct = {tuple(p) for p in samples if p}
        res['distinct_pixel_colors_sampled'] = len(distinct)
        res['errors'] = errs

        print(json.dumps(res, indent=1))
        ok = (vis0['cv'] is False and vis0['cvEm'] is True
              and vis1['cv'] is True and vis1['cvEm'] is False and vis1['fallback'] is True
              and res['em3dgl_present'] and len(distinct) > 1 and not errs)
        assert ok, res
        await b.close()

asyncio.run(main())
