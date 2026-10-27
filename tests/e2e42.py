import asyncio, json
from playwright.async_api import async_playwright
# Regression test for the visual-redesign Track 1 step 2: the colour retheme. Blue is now the primary accent
# for persistent selection/focus (replacing amber's old overloaded role), purple is the secondary accent for
# ephemeral spatial tools (box-select marquee), and the renamed --attention var keeps the old orange only for
# genuinely transient status cases (the hint banner). Checks both the raw CSS tokens and that a selected
# object's on-canvas highlight (sampled as pixels, not just a CSS rule) actually uses the new blue.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))) + '/pholver.html')
        await pg.wait_for_timeout(600)
        r = {}

        # 1 the raw tokens exist with the expected values
        tokens = await pg.evaluate('''() => {
          const s = getComputedStyle(document.documentElement);
          return { blue700: s.getPropertyValue('--blue-700').trim(), purple600: s.getPropertyValue('--purple-600').trim(),
                    attention: s.getPropertyValue('--attention').trim(), amber: s.getPropertyValue('--amber').trim() };
        }''')
        r['tokens'] = tokens
        assert tokens['blue700'] == '#1f6fb2', r
        assert tokens['purple600'] == '#6457a6', r
        assert tokens['attention'] == '#f29a1e', r
        assert tokens['amber'] == '', r  # the old sole-accent var name is gone, not just aliased

        # 2 a selected mechanics body's outline renders in the new blue, not the old amber hex
        await pg.evaluate('''() => {
          const d = window.__pholver.cur, b = Phys.createBody('sphere', { x: 0, y: 0 });
          d.world.bodies.push(b); window.__pholver.select(b.id); d.view = { ox: 400, oy: 300, s: 80 };
        }''')
        await pg.wait_for_timeout(150)
        px = await pg.evaluate('''() => {
          const cv = window.__pholver.cv, ctx = window.__pholver.ctx, { dpr } = window.__pholver.size;
          // scan just outside the body's fill (radius ~0.5m * 80px/m = 40px) for the stroked selection ring
          const y = Math.round(300 * dpr);
          for (let r = 39; r <= 48; r++) {
            const x = Math.round((400 + r) * dpr);
            const d = ctx.getImageData(x, y, 1, 1).data;
            if (d[0] < 200 || d[1] < 200 || d[2] < 230) return [d[0], d[1], d[2]];
          }
          return [255, 255, 255];
        }''')
        r['selected_rim_px'] = px
        # must be closer to blue-700 (31,111,178) than to the old amber (242,154,30)
        def dist(a, b2): return sum((x - y) ** 2 for x, y in zip(a, b2)) ** 0.5
        d_blue, d_amber = dist(px, [31, 111, 178]), dist(px, [242, 154, 30])
        r['dist_blue'], r['dist_amber'] = d_blue, d_amber
        assert d_blue < d_amber, r

        # 3 the box-select marquee (DOM overlay) is purple, not the old amber
        box_col = await pg.evaluate('''() => {
          const s = getComputedStyle(document.getElementById('emBoxSel'));
          return s.borderColor;
        }''')
        r['box_select_border'] = box_col
        assert '100, 87, 166' in box_col or '#6457a6' in box_col.lower(), r

        # 4 the hint banner keeps the transient attention colour (not migrated to blue)
        hint_bg = await pg.evaluate("getComputedStyle(document.getElementById('hint')).backgroundColor")
        r['hint_bg'] = hint_bg
        assert '242, 154, 30' in hint_bg, r

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
