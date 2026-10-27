import asyncio, json
from playwright.async_api import async_playwright
# Regression test for the visual-redesign Track 3 steps 8-9: a real pre-existing bug where gl.enable(BLEND)
# was never called (so every authored alpha value - grid lines, region wireframes - rendered fully opaque),
# and the ground grid's old writeGrid() extent was hard-clamped to 20 world units so it stopped growing past
# cam.dist~14.3 when zooming out. Checks the GL blend state directly, then confirms the grid still renders
# well past that old clamp (cam.dist 50 here, versus the old ~14.3 ceiling).
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

        # 1 blending is actually enabled on the GL context the renderer uses (re-fetching the same context via
        # the canvas, which getContext() hands back without re-creating it)
        r['blend_enabled'] = await pg.evaluate('''() => {
          const gl = document.getElementById('cvEm').getContext('webgl2');
          return gl ? gl.isEnabled(gl.BLEND) : null;
        }''')
        assert r['blend_enabled'] is True, r

        # 2 the grid still renders well past the old 20-unit/~dist-14.3 clamp
        await pg.evaluate('''() => {
          const d = window.__pholver.cur, sc = d.em; sc.items.length = 0;
          d.cam = { target: { x: 0, y: 0, z: 0 }, yaw: 0.6, pitch: 0.5, dist: 50 };
        }''')
        await pg.wait_for_timeout(300)

        def is_grid_pixel(px, bg):
            return abs(px[0] - bg[0]) + abs(px[1] - bg[1]) + abs(px[2] - bg[2]) > 10

        scan = await pg.evaluate('''() => {
          const { cw, ch, dpr } = window.__pholver.size, out = [];
          // top-left corner is empty sky, away from any drawn geometry or axis lines - a clean background sample
          out.push(window.EM3DGL.samplePixel(Math.round(cw*0.04*dpr), Math.round(ch*0.08*dpr)));
          for (let fx = 0.1; fx <= 0.9; fx += 0.05) for (let fy = 0.15; fy <= 0.95; fy += 0.08) {
            out.push(window.EM3DGL.samplePixel(Math.round(cw*fx*dpr), Math.round(ch*fy*dpr)));
          }
          return out;
        }''')
        bg, pts = scan[0], scan[1:]
        hits = sum(1 for px in pts if is_grid_pixel(px, bg))
        r['bg'] = bg
        r['grid_pixel_hits'] = hits
        r['sampled'] = len(pts)
        assert hits > 5, r  # plenty of grid lines should cross a scan this dense
        await pg.screenshot(path='shot_em_grid_dist50.png')

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
