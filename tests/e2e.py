import asyncio, json, sys
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html')
        await pg.wait_for_timeout(600)
        res = {}
        res['tabs'] = await pg.eval_on_selector_all('.tab .tt', 'els => els.map(e => e.textContent)')
        res['workspace'] = await pg.eval_on_selector_all('#wsList .nm', 'els => els.map(e => e.textContent)')
        res['props_title'] = await pg.text_content('#propsTitle')
        res['prop_labels'] = await pg.eval_on_selector_all('#propsBody .row label', 'els => els.map(e => e.textContent)')
        await pg.screenshot(path='/tmp/shot_design.png')

        # place a rectangle through the Objects tray
        await pg.click('#objBtn'); await pg.click('#tray [data-t=rect]')
        box = await pg.locator('#cv').bounding_box()
        await pg.mouse.click(box['x'] + 700, box['y'] + 120)
        res['after_place'] = await pg.eval_on_selector_all('#wsList .nm', 'els => els.map(e => e.textContent)')
        # edit mass of the selected object through its property field
        await pg.fill('#propsBody .row:has(label:has-text("Mass")) input', '7')
        await pg.press('#propsBody .row:has(label:has-text("Mass")) input', 'Tab')
        res['mass_now'] = await pg.evaluate('window.__pholver.cur.world.bodies.at(-1).m')
        # delete it again
        await pg.click('#delBtn')
        res['after_delete'] = await pg.eval_on_selector_all('#wsList .nm', 'els => els.map(e => e.textContent)')

        # simulate
        await pg.click('#modeBtn'); await pg.click('#modeMenu [data-m=sim]')
        res['mode'] = await pg.text_content('#modeLabel')
        ball = 'window.__pholver.cur.world.bodies[1]'
        x0 = await pg.evaluate(ball + '.x')
        await pg.wait_for_timeout(2000)
        res['ball_dx'] = round(await pg.evaluate(ball + '.x') - x0, 3)
        res['sim_t'] = await pg.evaluate('window.__pholver.cur.world.t')
        res['props_readonly'] = await pg.eval_on_selector_all('#propsBody input[type=number]', 'els => els.every(e => e.readOnly)')
        res['status'] = await pg.text_content('#status')
        res['scale'] = await pg.text_content('#sbLabel')
        await pg.screenshot(path='/tmp/shot_sim.png')

        # reset then back to design restores the designed start
        await pg.click('#resetBtn')
        res['reset_x'] = round(await pg.evaluate(ball + '.x') - x0, 6)
        await pg.click('#modeBtn'); await pg.click('#modeMenu [data-m=render]')
        await pg.click('#playBtn'); await pg.wait_for_timeout(800)
        await pg.screenshot(path='/tmp/shot_render.png')
        await pg.keyboard.press('1')
        res['back_design'] = await pg.text_content('#modeLabel')

        # E&M tab, new tab, close tab
        await pg.click('.tab:nth-child(2)')
        res['em_placeholder'] = await pg.is_visible('#emHolder')
        await pg.click('.tab:nth-child(2) .tx')
        await pg.click('#newTab')
        res['tabs_after'] = await pg.eval_on_selector_all('.tab .tt', 'els => els.map(e => e.textContent)')

        # phone width
        await pg.set_viewport_size({'width': 400, 'height': 800}); await pg.wait_for_timeout(300)
        res['hscroll_phone'] = await pg.evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth')
        res['errors'] = errs
        print(json.dumps(res, indent=1))
        await b.close()
asyncio.run(main())
