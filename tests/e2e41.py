import asyncio, json
from playwright.async_api import async_playwright
# Regression test for the visual-redesign Track 1 step 1: a CSS-only [data-tip] tooltip component (no new
# JS state) that shows explanatory text on hover (after a short delay) or on keyboard focus-within, and only
# for elements that actually carry a data-tip attribute.
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

        # 1 the Plane toolbar field has a real data-tip and its ::after content mirrors it
        tip_text = await pg.eval_on_selector('#emPlane', 'el => el.closest("[data-tip]").dataset.tip')
        r['plane_tip_attr'] = tip_text
        assert tip_text and 'work plane' in tip_text.lower(), r
        after_content = await pg.eval_on_selector('#emPlane', 'el => getComputedStyle(el.closest("[data-tip]"), "::after").content')
        r['plane_after_content'] = after_content
        assert tip_text in after_content, r

        # 2 hidden before hover, visible after a hover + the transition delay
        before_op = await pg.eval_on_selector('#emPlane', 'el => getComputedStyle(el.closest("[data-tip]"), "::after").opacity')
        r['before_hover_opacity'] = before_op
        assert float(before_op) == 0, r
        await pg.hover('#emPlane')
        await pg.wait_for_timeout(700)
        after_op = await pg.eval_on_selector('#emPlane', 'el => getComputedStyle(el.closest("[data-tip]"), "::after").opacity')
        r['after_hover_opacity'] = after_op
        assert float(after_op) == 1, r
        await pg.mouse.move(5, 5); await pg.wait_for_timeout(100)

        # 3 keyboard focus-within also reveals it (a11y path, no mouse)
        await pg.eval_on_selector('#emPlane', 'el => el.focus()')
        await pg.wait_for_timeout(700)
        focus_op = await pg.eval_on_selector('#emPlane', 'el => getComputedStyle(el.closest("[data-tip]"), "::after").opacity')
        r['focus_within_opacity'] = focus_op
        assert float(focus_op) == 1, r
        await pg.eval_on_selector('#emPlane', 'el => el.blur()')

        # 4 a field with no data-tip never grows an ::after at all
        no_tip_content = await pg.eval_on_selector('#emPq', 'el => getComputedStyle(el.closest(".tbfield"), "::after").content')
        r['no_tip_after_content'] = no_tip_content
        assert no_tip_content == 'none', r

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
