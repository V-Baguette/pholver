import asyncio, json
from playwright.async_api import async_playwright
# Regression test for phase A6: the E&M work plane is now user-selectable (XY/XZ/YZ/Camera-facing) instead
# of fixed at z=0, so objects can be placed and dragged freely in 3D. Covers: placing on each axis-aligned
# plane lands at the expected 3D point, PageUp/PageDown adjust the plane's depth while placing (no selection)
# and a selected object's depth while selected, dragging an object that sits off the active plane keeps its
# own depth (doesn't snap back to the plane), the camera-facing plane doesn't crash, and the toolbar's Plane
# dropdown stays in sync with each document's own work-plane state across tab switches.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width': 1440, 'height': 860})).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://' + __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__))) + '/pholver.html')
        await pg.wait_for_timeout(700)
        r = {}

        await pg.click('#newTabEm'); await pg.wait_for_timeout(400)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur;d.em.items.length=0;
          d.cam={target:{x:0,y:0,z:0},yaw:-0.6,pitch:0.4,dist:10};})()''')
        await pg.wait_for_timeout(200)
        box = await pg.locator('#cvEm').bounding_box()

        async def W(x, y, z):
            p0 = await pg.evaluate('(a)=>{const d=window.__pholver.cur;return window.EM3DGL.worldToScreen(d.cam,{x:a[0],y:a[1],z:a[2]})}', [x, y, z])
            return box['x'] + p0['x'], box['y'] + p0['y']

        async def place_at(tool, x, y, z):
            await pg.click('#emAdd'); await pg.click('#emTray [data-t=%s]' % tool); await pg.wait_for_timeout(80)
            xy = await W(x, y, z); await pg.mouse.click(*xy); await pg.wait_for_timeout(80)

        async def last_pos():
            return await pg.evaluate("(()=>{const it=window.__pholver.cur.em.items.slice(-1)[0];return [it.x,it.y,it.z]})()")

        # 1 placing on each axis-aligned plane lands at the right 3D point (not always z=0)
        await pg.select_option('#emPlane', 'xy'); await place_at('cpos', 1, 0.5, 0)
        r['xy_pos'] = await last_pos()
        assert abs(r['xy_pos'][2]) < 1e-6, r  # still lands on z=0, same as the old fixed-plane behaviour

        await pg.select_option('#emPlane', 'xz'); await place_at('cpos', 1, 0, 1.5)
        r['xz_pos'] = await last_pos()
        assert abs(r['xz_pos'][1]) < 1e-6 and abs(r['xz_pos'][2] - 1.5) < 0.05, r

        await pg.select_option('#emPlane', 'yz'); await place_at('cpos', 0, 1, -1)
        r['yz_pos'] = await last_pos()
        assert abs(r['yz_pos'][0]) < 1e-6 and abs(r['yz_pos'][1] - 1) < 0.05 and abs(r['yz_pos'][2] - (-1)) < 0.05, r

        # 2 PageUp/PageDown nudge the plane's depth while placing (tool armed, nothing selected)
        await pg.select_option('#emPlane', 'xy')
        await pg.click('#emAdd'); await pg.click('#emTray [data-t=cpos]'); await pg.wait_for_timeout(80)
        await pg.keyboard.press('PageUp'); await pg.keyboard.press('PageUp'); await pg.wait_for_timeout(80)
        xy = await W(2, 2, 0); await pg.mouse.click(*xy); await pg.wait_for_timeout(80)
        r['depth_while_placing'] = await last_pos()
        assert abs(r['depth_while_placing'][2] - 0.5) < 1e-6, r  # 2 presses * grid 0.25

        # 3 PageDown nudges the selected object's depth (same key, different meaning once something is selected)
        await pg.evaluate("window.__pholver.select(window.__pholver.cur.em.items.slice(-1)[0].id)")
        await pg.wait_for_timeout(80)
        await pg.keyboard.press('PageDown'); await pg.wait_for_timeout(80)
        r['depth_while_selected'] = await last_pos()
        assert abs(r['depth_while_selected'][2] - 0.25) < 1e-6, r

        # 4 dragging on the active plane keeps an off-plane object's own depth instead of snapping it back
        # (clear the scene first so the click below can only pick this one object, not an earlier test's)
        await pg.evaluate("window.__pholver.cur.em.items.length=0; window.__pholver.select(null)")
        await pg.select_option('#emPlane', 'xz'); await place_at('cpos', 1, 0, 1)
        after_place = await last_pos()
        assert abs(after_place[1]) < 1e-6 and abs(after_place[2] - 1) < 0.05, after_place
        await pg.select_option('#emPlane', 'xy')  # now drag it across XY - its y/depth should stay at z=1
        await pg.click('#selBtn'); await pg.wait_for_timeout(80)
        a = await W(1, 0, 1); c = await W(3, 2, 1)
        await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*c, steps=6); await pg.mouse.up()
        await pg.wait_for_timeout(100)
        r['dragged_pos'] = await last_pos()
        assert abs(r['dragged_pos'][0] - 3) < 0.05 and abs(r['dragged_pos'][1] - 2) < 0.05 and abs(r['dragged_pos'][2] - 1) < 0.05, r

        # 5 camera-facing plane doesn't crash and places a finite point
        await pg.select_option('#emPlane', 'cam')
        before_n = await pg.evaluate("window.__pholver.cur.em.items.length")
        await place_at('cpos', 0, 0, 0)
        after_n = await pg.evaluate("window.__pholver.cur.em.items.length")
        r['cam_placed'] = await last_pos()
        assert after_n == before_n + 1, r
        assert all(abs(v) < 1e3 for v in r['cam_placed']), r

        # 6 the Plane dropdown stays in sync with each document's own work-plane state across tab switches
        await pg.select_option('#emPlane', 'yz')
        first_id = await pg.evaluate("window.__pholver.cur.id")
        await pg.click('#newTabEm'); await pg.wait_for_timeout(300)
        r['new_tab_plane'] = await pg.input_value('#emPlane')
        assert r['new_tab_plane'] == 'xy', r  # a fresh doc defaults to xy, independent of the other tab
        await pg.evaluate("(a)=>{const d=window.__pholver.docs.find(x=>x.id===a);window.__pholver.switchDoc(d)}", first_id)
        await pg.wait_for_timeout(150)
        r['switched_back_plane'] = await pg.input_value('#emPlane')
        assert r['switched_back_plane'] == 'yz', r

        await pg.screenshot(path='shot_em_workplane.png')
        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
