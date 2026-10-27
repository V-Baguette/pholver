import asyncio, json
from playwright.async_api import async_playwright
# Regression test for the visual-redesign Track 2 step 5: emitters now draw a direction glyph (shaft + a
# 4-barb arrowhead) along their local +X (the documented emitter-forward axis, em.js:3), so it's visible
# which way a source will fire before pressing play. Confirms the arrow actually tracks the item's rotation
# (not a fixed on-screen decoration) by rotating 90 degrees about Z and checking the bright glyph pixels
# move from the +X side to the +Y side.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))) + '/pholver.html')
        await pg.wait_for_timeout(600)
        r = {}

        await pg.click('#newTabEm'); await pg.wait_for_timeout(400)
        await pg.evaluate('''() => {
          const d = window.__pholver.cur, sc = d.em; sc.items.length = 0;
          sc.items.push(EM.create('emitter', { x: 0, y: 0, z: 0, speed: 2, rate: 4 }));
          d.cam = { target: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, dist: 4 };
        }''')
        await pg.wait_for_timeout(300)

        async def bright_near(wx, wy, wz):
            return await pg.evaluate('''(a) => {
              const d = window.__pholver.cur, { dpr } = window.__pholver.size;
              const c = window.EM3DGL.worldToScreen(d.cam, { x: a[0], y: a[1], z: a[2] });
              for (let dx = -5; dx <= 5; dx++) for (let dy = -5; dy <= 5; dy++) {
                const px = window.EM3DGL.samplePixel(Math.round((c.x + dx) * dpr), Math.round((c.y + dy) * dpr));
                if (px[0] > 150 && px[1] > 150 && px[2] > 150) return true;
              }
              return false;
            }''', [wx, wy, wz])

        # 1 identity rotation: the arrow glyph shows up out along +X, not +Y
        r['identity_plusX'] = await bright_near(0.42, 0, 0)
        r['identity_plusY'] = await bright_near(0, 0.42, 0)
        assert r['identity_plusX'], r
        assert not r['identity_plusY'], r
        await pg.screenshot(path='shot_em_emitter_arrow_x.png')

        # 2 rotate 90 degrees about Z: local +X now points along world +Y, and the glyph moves with it
        await pg.evaluate('''() => {
          const d = window.__pholver.cur, it = d.em.items[0];
          it.rot = EM3D.Quat.fromAxisAngle(EM3D.Quat.create(), { x: 0, y: 0, z: 1 }, Math.PI / 2);
        }''')
        await pg.wait_for_timeout(200)
        r['rotated_plusX'] = await bright_near(0.42, 0, 0)
        r['rotated_plusY'] = await bright_near(0, 0.42, 0)
        assert r['rotated_plusY'], r
        assert not r['rotated_plusX'], r
        await pg.screenshot(path='shot_em_emitter_arrow_y.png')

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
