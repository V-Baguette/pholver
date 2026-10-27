import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':900}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.click('#tabs .tab:has-text("E&M")'); await pg.wait_for_timeout(300)
        await pg.mouse.click(900,700); await pg.wait_for_timeout(100)
        await pg.evaluate('(()=>{const d=window.__pholver.cur;d.sel=null;window.__pholver.renderProps()})()')
        await pg.screenshot(path='shot_em_units_scene.png')
        await pg.click('#propsBody .btn2:has-text("Mass spectrometer (real units)")'); await pg.wait_for_timeout(400)
        await pg.screenshot(path='shot_em_real_design.png')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(3500)
        await pg.screenshot(path='shot_em_real_sim.png')
        units = await pg.evaluate('(()=>{const d=window.__pholver.cur;return [d.em.units, d.em.k, d.em.km, d.em.t]})()')
        print(units)
        assert units[0] is not None and units[3] > 0, units
        # edit B on the analyser with a prefixed value, found by its label (not a brittle input index -
        # the Position section now has an x/y/z field each, so a positional index would silently drift)
        await pg.keyboard.press('1'); await pg.wait_for_timeout(200)
        await pg.click('#wsList .item:has-text("Analyser B")'); await pg.wait_for_timeout(200)
        bfield = pg.locator('#propsBody .row:has(label:text-is("B")) input')
        n = await bfield.count(); print('B field matches', n, await bfield.input_value() if n == 1 else None)
        assert n == 1, n
        await bfield.fill('50 mT'); await bfield.press('Tab'); await pg.wait_for_timeout(100)
        b_internal = await pg.evaluate('window.__pholver.cur.em.items.find(i=>i.name=="Analyser B").B')
        expected = 0.05 / (1.67262192e-27 / (1.602176634e-19 * 1e-7))
        print('B internal', b_internal, 'expected', expected)
        assert abs(b_internal - expected) < abs(expected) * 1e-6, (b_internal, expected)
        print('errors', errs); assert not errs, errs
        await b.close()
asyncio.run(main())
