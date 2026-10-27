import asyncio, json
from playwright.async_api import async_playwright
# Regression test for the visual-redesign Track 2 step 7: B field regions now draw a direction glyph (reusing
# writeDirArrow along local +Z, the documented B-field axis), and the new "Field regions" toolbar toggle
# (#emFieldVis, st(d).opts.regions) hides/shows E field, B field and capacitor wireframes together with the
# B-field arrow. Placed off the world origin so the box edges and arrow don't sit on the red/green/blue
# origin-axis lines.
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
        await pg.evaluate('''() => {
          const d = window.__pholver.cur, sc = d.em; sc.items.length = 0;
          sc.items.push(EM.create('bfield', { x: 1, y: 0.5, z: 0, B: 1 }));
          d.cam = { target: { x: 1, y: 0.5, z: 0 }, yaw: 0.3, pitch: 0.4, dist: 8 };
        }''')
        await pg.wait_for_timeout(300)

        async def any_blue_near(wx, wy, wz):
            return await pg.evaluate('''(a) => {
              const d = window.__pholver.cur, { dpr } = window.__pholver.size;
              const c = window.EM3DGL.worldToScreen(d.cam, { x: a[0], y: a[1], z: a[2] });
              for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) {
                const px = window.EM3DGL.samplePixel(Math.round((c.x + dx) * dpr), Math.round((c.y + dy) * dpr));
                if (px[2] > 100 && px[2] > px[0] + 25) return true;
              }
              return false;
            }''', [wx, wy, wz])

        # arrow len = min(1.2, max(w,h,d)*0.4) = min(1.2, 4*0.4) = 1.2, along local (= world, identity rot) +Z
        ARROW_TIP = [1, 0.5, 1.2]
        BOX_CORNER = [3, 2, 1.5]  # w/2=2, h/2=1.5, d/2=1.5 offset from center (1,0.5,0)

        # 1 by default (toggle starts pressed/on) both the arrow and the box wireframe are visible
        r['before_arrow'] = await any_blue_near(*ARROW_TIP)
        r['before_box'] = await any_blue_near(*BOX_CORNER)
        assert r['before_arrow'], r
        assert r['before_box'], r
        await pg.screenshot(path='shot_em_bfield_arrow_on.png')

        # 2 toggling "Field regions" off hides both the arrow and the box wireframe
        pressed_before = await pg.eval_on_selector('#emFieldVis', 'el => el.getAttribute("aria-pressed")')
        r['toggle_pressed_before'] = pressed_before
        assert pressed_before == 'true', r
        await pg.click('#emFieldVis'); await pg.wait_for_timeout(200)
        r['toggle_pressed_after'] = await pg.eval_on_selector('#emFieldVis', 'el => el.getAttribute("aria-pressed")')
        assert r['toggle_pressed_after'] == 'false', r
        r['after_off_arrow'] = await any_blue_near(*ARROW_TIP)
        r['after_off_box'] = await any_blue_near(*BOX_CORNER)
        assert not r['after_off_arrow'], r
        assert not r['after_off_box'], r
        await pg.screenshot(path='shot_em_bfield_arrow_off.png')

        # 3 toggling back on restores both
        await pg.click('#emFieldVis'); await pg.wait_for_timeout(200)
        r['after_on_arrow'] = await any_blue_near(*ARROW_TIP)
        r['after_on_box'] = await any_blue_near(*BOX_CORNER)
        assert r['after_on_arrow'], r
        assert r['after_on_box'], r

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
