import asyncio, json
from playwright.async_api import async_playwright
# Regression test for the visual-redesign Track 1 step 4: dropdowns that previously gave no information
# beyond their label now carry real explanatory tooltip text via the data-tip plumbing added to rowOf/
# H.select (properties panel) and the toolbar's field() helper.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))) + '/pholver.html')
        await pg.wait_for_timeout(600)
        r = {}

        # 1 Grid size (shared mech/em toolbar dropdown, static markup in part1.html)
        grid_tip = await pg.eval_on_selector('#gridSel', 'el => el.closest(".tbfield").dataset.tip')
        r['grid_tip'] = grid_tip
        assert grid_tip and len(grid_tip) > 8, r

        await pg.click('#newTabEm'); await pg.wait_for_timeout(400)

        # 2 Plane (toolbar, EM-only)
        plane_tip = await pg.eval_on_selector('#emPlane', 'el => el.closest(".tbfield").dataset.tip')
        r['plane_tip'] = plane_tip
        assert plane_tip and 'plane' in plane_tip.lower(), r

        # 3 Workspace units (properties panel, EM-only) - select it via the scene (empty-selection) props view
        await pg.evaluate("window.__pholver.select(null)"); await pg.wait_for_timeout(150)
        units_tip = await pg.eval_on_selector(
            '#propsBody .row:has(label:text("Workspace units"))', 'el => el.dataset.tip')
        r['units_tip'] = units_tip
        assert units_tip and 'unit' in units_tip.lower(), r

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
