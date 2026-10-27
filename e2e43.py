import asyncio, json
from playwright.async_api import async_playwright
# Regression test for the visual-redesign Track 1 step 3: the shape language pass replaces the old
# 999px-pill/50%-circle soup with a small rounded-square radius scale across 2D UI chrome. Charge/particle
# spheres in the 3D view are explicitly out of scope (confirmed with the user) and untouched.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + __import__('os').path.dirname(__import__('os').path.abspath(__file__)) + '/pholver.html')
        await pg.wait_for_timeout(600)
        r = {}

        # 1 the two literal-circle cases (.tab .tx, .item .x) are no longer 50%/circular
        await pg.evaluate('''() => {
          const d = window.__pholver.cur, b = Phys.createBody('sphere', { x: 0, y: 0 });
          d.world.bodies.push(b);
        }''')
        await pg.wait_for_timeout(150)
        tab_tx_radius = await pg.eval_on_selector('.tab .tx', 'el => getComputedStyle(el).borderRadius')
        item_x_radius = await pg.eval_on_selector('.item .x', 'el => getComputedStyle(el).borderRadius')
        r['tab_tx_radius'] = tab_tx_radius; r['item_x_radius'] = item_x_radius
        assert tab_tx_radius not in ('50%', '10px'), r  # 20x20 box, 50% would compute to 10px
        assert item_x_radius not in ('50%', '11px'), r  # 22x22 box, 50% would compute to 11px

        # 2 pill-shaped inputs/buttons now use the small radius scale, not 999px
        gridsel_radius = await pg.eval_on_selector('#gridSel', 'el => getComputedStyle(el).borderRadius')
        tb_radius = await pg.eval_on_selector('#selBtn', 'el => getComputedStyle(el).borderRadius')
        r['gridsel_radius'] = gridsel_radius; r['tb_radius'] = tb_radius
        assert gridsel_radius not in ('999px', '13px'), r  # min(width,height)/2 of a 999px pill clamps to half the box
        assert float(tb_radius.replace('px', '')) < 50, r

        # 3 the raw radius-scale tokens exist
        tokens = await pg.evaluate('''() => {
          const s = getComputedStyle(document.documentElement);
          return [s.getPropertyValue('--r-1').trim(), s.getPropertyValue('--r-2').trim(), s.getPropertyValue('--r-3').trim(), s.getPropertyValue('--r-4').trim()];
        }''')
        r['radius_tokens'] = tokens
        assert tokens == ['4px', '6px', '8px', '10px'], r

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
