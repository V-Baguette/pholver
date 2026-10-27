import asyncio, json
from playwright.async_api import async_playwright
# Regression test for the visual-redesign Track 2 step 6: charges now draw a polarity glyph outside their
# sphere (a world-aligned 3-axis "+" for positive, a flat XY ring for negative, nothing extra for neutral)
# so polarity reads from the glyph, not just the red/blue sphere colour. The charge is placed off the world
# origin so its glyph doesn't sit exactly on top of the red/green/blue origin-axis lines (which would make a
# coincident line segment ambiguous to sample), and the pitched camera gives the Z-axis arm real screen
# extent instead of foreshortening it to a single point - that's what distinguishes the 3-axis cross (which
# has a Z arm) from the flat ring (which doesn't).
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
        await pg.click('#emLines')  # field lines off - they'd be drawn in similar hues and could mask the glyph
        await pg.evaluate('''() => {
          const d = window.__pholver.cur, sc = d.em; sc.items.length = 0;
          sc.items.push(EM.create('charge', { x: 1, y: 0.5, z: 0, q: 1 }));
          d.cam = { target: { x: 1, y: 0.5, z: 0 }, yaw: 0, pitch: 0.5, dist: 4 };
        }''')
        await pg.wait_for_timeout(300)

        async def bright_near(wx, wy, wz):
            return await pg.evaluate('''(a) => {
              const d = window.__pholver.cur, { dpr } = window.__pholver.size;
              const c = window.EM3DGL.worldToScreen(d.cam, { x: a[0], y: a[1], z: a[2] });
              for (let dx = -6; dx <= 6; dx++) for (let dy = -6; dy <= 6; dy++) {
                const px = window.EM3DGL.samplePixel(Math.round((c.x + dx) * dpr), Math.round((c.y + dy) * dpr));
                if (px[0] > 120 && px[1] > 120 && px[2] > 120) return true;
              }
              return false;
            }''', [wx, wy, wz])

        # 1 positive charge: a 3-axis cross, so both an in-plane arm (X) and the out-of-plane arm (Z) show up
        r['pos_plusX'] = await bright_near(1.26, 0.5, 0)
        r['pos_plusZ'] = await bright_near(1, 0.5, 0.26)
        assert r['pos_plusX'], r
        assert r['pos_plusZ'], r
        await pg.screenshot(path='shot_em_charge_cross.png')

        # 2 negative charge: a flat XY ring - the in-plane point still lights up, but the Z arm does not
        # (the ring itself passes near here at a different angle, so sample at a Z offset where nothing else is)
        await pg.evaluate("window.__pholver.cur.em.items[0].q = -1"); await pg.wait_for_timeout(200)
        r['neg_plusX_ring'] = await bright_near(1.24, 0.5, 0)
        r['neg_plusZ'] = await bright_near(1, 0.5, 0.24)
        assert r['neg_plusX_ring'], r
        assert not r['neg_plusZ'], r
        await pg.screenshot(path='shot_em_charge_ring.png')

        # 3 neutral charge: colour-only, no glyph at all
        await pg.evaluate("window.__pholver.cur.em.items[0].q = 0"); await pg.wait_for_timeout(200)
        r['neutral_plusX'] = await bright_near(1.26, 0.5, 0)
        r['neutral_plusZ'] = await bright_near(1, 0.5, 0.26)
        assert not r['neutral_plusX'], r
        assert not r['neutral_plusZ'], r

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
