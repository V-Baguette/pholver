import asyncio, json
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html')
        await pg.wait_for_timeout(500)
        await pg.click('#newTab'); await pg.wait_for_timeout(300)
        box = await pg.locator('#cv').bounding_box()
        async def scr(x, y):
            v = await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()')
            return box['x'] + v[0] + x * v[2], box['y'] + v[1] - y * v[2]
        async def click(x, y, shift=False):
            X, Y = await scr(x, y)
            if shift: await pg.keyboard.down('Shift')
            await pg.mouse.click(X, Y)
            if shift: await pg.keyboard.up('Shift')
        async def tool(menu, t):
            await pg.click(menu); await pg.click(f'{"#cxTray" if menu=="#cxBtn" else "#tray"} [data-t={t}]')
        # view for an empty world is -6..6 x 0..6; place things
        res = {}
        # 1 bar pendulum
        await tool('#objBtn', 'rect'); await click(1.5, 3)
        await tool('#cxBtn', 'pin'); await click(1.0, 3)
        # 2 sphere on spring from the world
        await tool('#objBtn', 'sphere'); await click(4, 2)
        await tool('#cxBtn', 'spring'); await click(4, 5); await click(4, 2)
        # 3 extensible rope + sphere
        await tool('#objBtn', 'sphere'); await click(-3, 2)
        await tool('#cxBtn', 'rope'); await click(-3, 5); await click(-3, 2)
        # 4 chain with ball
        await tool('#objBtn', 'sphere'); await click(-5, 1.5)
        await tool('#cxBtn', 'chain'); await click(-5, 5); await click(-5, 1.5)
        # 5 rod between bar end and a sphere
        await tool('#objBtn', 'sphere'); await click(2.5, 5)
        await tool('#cxBtn', 'rod'); await click(2.0, 3); await click(2.5, 5)
        res['ws'] = await pg.eval_on_selector_all('#wsList .nm', 'els => els.map(e => e.textContent)')
        res['joints'] = await pg.evaluate('window.__pholver.cur.world.joints.filter(j=>j.owner==null).map(j=>j.type+":"+j.L)')
        res['hint_after'] = await pg.evaluate("document.querySelector('#hint').hidden")
        # properties of the rope
        res['rope_props'] = None
        items = pg.locator('#wsList .item')
        n = await items.count()
        for i in range(n):
            t = await items.nth(i).locator('.nm').text_content()
            if t.startswith('Rope'):
                await items.nth(i).click()
                await pg.select_option('#propsBody select', 'ext')
                res['rope_props'] = await pg.eval_on_selector_all('#propsBody .row label', 'els => els.map(e => e.textContent)')
        await pg.screenshot(path='/tmp/shot_cx_design.png')
        # simulate
        await pg.keyboard.press('2'); await pg.wait_for_timeout(1500)
        res['status'] = await pg.text_content('#status')
        await pg.screenshot(path='/tmp/shot_cx_sim.png')
        # grab the sphere on the spring while playing and drag it
        sx_, sy_ = await scr(4, 2); st = await pg.evaluate('(()=>{const w=window.__pholver.cur.world;const b=w.bodies.filter(b=>!b.hidden&&b.kind=="sphere");return b.map(x=>[x.x.toFixed(2),x.y.toFixed(2)])})()')
        res['spheres'] = st
        # pause and pose-drag the first bar pendulum
        await pg.click('#playBtn'); await pg.wait_for_timeout(100)
        bar = await pg.evaluate('(()=>{const b=window.__pholver.cur.world.bodies.find(b=>b.kind=="rect");return [b.x,b.y]})()')
        bx, by = await scr(*bar)
        await pg.mouse.move(bx, by); await pg.mouse.down()
        tx, ty = await scr(1.0 + 3.0, 3 + 0.001)
        await pg.mouse.move(tx, ty, steps=12); await pg.wait_for_timeout(500)
        res['bar_dragged'] = await pg.evaluate('(()=>{const b=window.__pholver.cur.world.bodies.find(b=>b.kind=="rect");return [b.x.toFixed(3),b.y.toFixed(3),b.a.toFixed(3)]})()')
        await pg.mouse.up(); await pg.wait_for_timeout(100)
        res['bar_after_release_v'] = await pg.evaluate('(()=>{const b=window.__pholver.cur.world.bodies.find(b=>b.kind=="rect");return [b.vx,b.vy,b.w]})()')
        await pg.screenshot(path='/tmp/shot_cx_pose.png')
        # push tool while running
        await pg.click('#playBtn'); await pg.click('#pushBtn')
        await pg.fill('#pushF', '200')
        px, py = await scr(-3, 2)
        v0 = await pg.evaluate('(()=>{const b=window.__pholver.cur.world.bodies.filter(b=>!b.hidden&&b.kind=="sphere")[1];return [b.x,b.y]})()')
        pxx, pyy = await scr(*v0)
        await pg.mouse.move(pxx, pyy); await pg.mouse.down(); await pg.mouse.move(pxx + 120, pyy, steps=5); await pg.wait_for_timeout(600)
        v1 = await pg.evaluate('(()=>{const b=window.__pholver.cur.world.bodies.filter(b=>!b.hidden&&b.kind=="sphere")[1];return [b.x,b.y,b.vx]})()')
        await pg.mouse.up()
        res['push'] = [v0, v1]
        await pg.screenshot(path='/tmp/shot_cx_push.png')
        # reset and back to design, delete a connector
        await pg.keyboard.press('1'); await pg.wait_for_timeout(200)
        n0 = await pg.evaluate('window.__pholver.cur.world.joints.length')
        await items.nth(0).hover(); 
        res['errors'] = errs
        print(json.dumps(res, indent=1))
        await b.close()
asyncio.run(main())
