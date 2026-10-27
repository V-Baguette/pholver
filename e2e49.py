import asyncio, json
from playwright.async_api import async_playwright
# Regression test for the visual-redesign Track 3 step 10: the shader-based procedural infinite grid
# (drawInfiniteGrid) replaces the old finite-line-vertex writeGrid(). Two things distinguish a *genuinely*
# infinite grid from "a bigger finite patch": (1) it stays visible at extreme zoom-out, far beyond anything
# a reasonable fixed line budget could cover, and (2) it re-centers every frame under wherever the camera is
# actually looking (autoCamera/render set cam.target, which drawInfiniteGrid projects onto the work plane),
# so it still renders right under the camera even when the camera's orbit target sits far from the world
# origin - a quad anchored near the origin would go dark at that distance.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + __import__('os').path.dirname(__import__('os').path.abspath(__file__)) + '/pholver.html')
        await pg.wait_for_timeout(600)
        r = {}

        await pg.click('#newTabEm'); await pg.wait_for_timeout(400)

        def is_grid_pixel(px, bg):
            return abs(px[0] - bg[0]) + abs(px[1] - bg[1]) + abs(px[2] - bg[2]) > 10

        async def scan_hits(cam):
            await pg.evaluate('''(cam) => {
              const d = window.__pholver.cur, sc = d.em; sc.items.length = 0;
              d.cam = cam;
            }''', cam)
            await pg.wait_for_timeout(300)
            scan = await pg.evaluate('''() => {
              const { cw, ch, dpr } = window.__pholver.size, out = [];
              out.push(window.EM3DGL.samplePixel(Math.round(cw*0.04*dpr), Math.round(ch*0.08*dpr)));
              for (let fx = 0.1; fx <= 0.9; fx += 0.05) for (let fy = 0.15; fy <= 0.95; fy += 0.08) {
                out.push(window.EM3DGL.samplePixel(Math.round(cw*fx*dpr), Math.round(ch*fy*dpr)));
              }
              return out;
            }''')
            bg, pts = scan[0], scan[1:]
            return sum(1 for px in pts if is_grid_pixel(px, bg))

        # 1 extreme zoom-out: still renders densely, not just a few leftover lines
        r['hits_extreme_zoom'] = await scan_hits({'target': {'x': 0, 'y': 0, 'z': 0}, 'yaw': 0.6, 'pitch': 0.5, 'dist': 400})
        assert r['hits_extreme_zoom'] > 5, r
        await pg.screenshot(path='shot_em_grid_dist400.png')

        # 2 camera target far from the world origin: the grid still fills the view right under the camera,
        # proving it's re-centered per frame rather than a patch anchored near (0,0,0)
        r['hits_far_target'] = await scan_hits({'target': {'x': 2000, 'y': 0, 'z': 0}, 'yaw': 0.6, 'pitch': 0.5, 'dist': 10})
        assert r['hits_far_target'] > 5, r
        await pg.screenshot(path='shot_em_grid_far_target.png')

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
