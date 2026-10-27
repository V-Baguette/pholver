import asyncio, json
from playwright.async_api import async_playwright
# Regression test for phase A4: the E&M tab's full workflow (examples, probe launch, placement/undo,
# numeric velocity edit, presets, sim/render modes, save/reload, new tab, tab switching) against the
# 3D WebGL interaction layer (ui_em.js + ui_em3d.js), replacing this script's pre-A4 2D version which
# drove the old screen transform (d.view) and a velocity-handle drag that the A4 rewrite dropped in
# favour of numeric vx/vy/vz fields (see mutable-discovering-kahn.md, Part A.4/scope note).
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':860}, accept_downloads=True); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        r={}
        await pg.click('#tabs .tab:nth-child(2)'); await pg.wait_for_timeout(500)
        box = await pg.locator('#cvEm').bounding_box()
        async def W(x, y, z=0):
            p0 = await pg.evaluate('(a)=>{const d=window.__pholver.cur;return window.EM3DGL.worldToScreen(d.cam,{x:a[0],y:a[1],z:a[2]})}', [x,y,z])
            return box['x']+p0['x'], box['y']+p0['y']
        async def click(x,y,z=0):
            X,Y=await W(x,y,z); await pg.mouse.click(X,Y)
        items='window.__pholver.cur.em.items.length'
        async def preset(name):
            await pg.click('#propsBody button:has-text("%s")'%name); await pg.wait_for_timeout(400)
        # 1 dipole example
        await preset('Electric dipole')
        await pg.screenshot(path='shot_em_dipole.png')
        r['dipole_items']=await pg.evaluate(items)
        assert r['dipole_items'] > 0, r
        # 2 simulate, probe launch (drag on the z=0 work plane)
        await pg.keyboard.press('2'); await pg.wait_for_timeout(600)
        await pg.click('#emProbe')
        X0,Y0=await W(-0.2,-1.2); X1,Y1=await W(1.0,-1.2)
        await pg.mouse.move(X0,Y0); await pg.mouse.down(); await pg.mouse.move((X0+X1)/2,Y0,steps=4); await pg.mouse.move(X1,Y1,steps=4); await pg.mouse.up()
        await pg.wait_for_timeout(1800)
        r['beam_after_probe']=await pg.evaluate('window.__pholver.cur.em.beam.length')
        assert r['beam_after_probe'] > 0, r
        await pg.screenshot(path='shot_em_probe.png')
        await pg.click('#emProbe')  # off
        r['probe_state']=await pg.evaluate('window.__pholver.cur.probe')
        assert r['probe_state'] is False, r
        # 3 back to design, place a charge, check props, undo/redo
        await pg.keyboard.press('1'); await pg.wait_for_timeout(500)
        n0=await pg.evaluate(items)
        await pg.click('#emAdd'); await pg.click('#emTray [data-t=cneg]'); await click(0,-1.2); await pg.wait_for_timeout(300)
        r['placed']=(await pg.evaluate(items))-n0
        assert r['placed'] == 1, r
        r['sel_title']=await pg.inner_text('#propsTitle')
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(300); r['after_undo']=(await pg.evaluate(items))-n0
        assert r['after_undo'] == 0, r
        await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(300); r['after_redo']=(await pg.evaluate(items))-n0
        assert r['after_redo'] == 1, r
        # free particle: select it from the workspace list, edit its velocity numerically
        # (the A4 rewrite dropped the draggable velocity-handle gizmo in favour of these fields -
        # see Rotate/velocity fields in E.renderProps)
        await pg.click('#wsList .item:has-text("Test charge")'); await pg.wait_for_timeout(200)
        vxField = pg.locator('#propsBody .row:has(label:text-is("vx")) input')
        await vxField.fill('1.2'); await vxField.press('Tab'); await pg.wait_for_timeout(100)
        r['vel_after_edit']=await pg.evaluate('(()=>{const i=window.__pholver.cur.em.items.find(i=>i.name=="Test charge");return [i.vx,i.vy]})()')
        assert abs(r['vel_after_edit'][0]-1.2) < 1e-6, r
        await pg.screenshot(path='shot_em_vel.png')
        # 4 wires example
        await pg.evaluate("window.__pholver.select(null)"); await pg.wait_for_timeout(200)
        await preset('Parallel wires'); await pg.wait_for_timeout(300)
        await pg.screenshot(path='shot_em_wires.png')
        # 5 cyclotron in sim with trails, then render mode
        await preset('Circular motion in B')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(2600)
        await pg.screenshot(path='shot_em_cyclotron.png')
        r['cyc_status']=await pg.inner_text('#status')
        await pg.keyboard.press('3'); await pg.wait_for_timeout(600)
        await pg.screenshot(path='shot_em_render.png')
        # 6 save + reload session
        await pg.keyboard.press('1'); await pg.wait_for_timeout(600)
        async with pg.expect_download() as dl: await pg.click('#saveBtn')
        d=await dl.value; path='_saved_em.json'; await d.save_as(path); r['file']=d.suggested_filename
        sv=json.load(open(path)); r['saved_kind']=sv['kind']; r['saved_items']=len(sv['data']['items'])
        assert r['saved_kind'] == 'em' and r['saved_items'] > 0, r
        await pg.wait_for_timeout(900)
        await pg.reload(); await pg.wait_for_timeout(900)
        r['tabs_after_reload']=await pg.eval_on_selector_all('#tabs .tt','e=>e.map(x=>x.textContent)')
        r['cur_kind']=await pg.evaluate('window.__pholver.cur.kind')
        await pg.set_input_files('#openFile', path); await pg.wait_for_timeout(600)
        r['opened']=await pg.evaluate('[window.__pholver.cur.kind, window.__pholver.cur.em.items.length]')
        assert r['opened'][0] == 'em' and r['opened'][1] == r['saved_items'], r
        # new E&M tab
        await pg.click('#newTabEm'); await pg.wait_for_timeout(500)
        r['new_tab_items']=await pg.evaluate(items)
        # back to mechanics tab
        await pg.click('#tabs .tab:nth-child(1)'); await pg.wait_for_timeout(500)
        await pg.screenshot(path='shot_em_mech_back.png')
        r['mech_visible']=await pg.evaluate('[...document.querySelectorAll("#toolbar > *")].filter(e=>!e.hidden && e.offsetParent).map(e=>e.id).filter(Boolean).slice(0,6).join(",")')
        r['errs']=errs
        print(json.dumps(r,indent=1))
        assert not errs, errs
        await b.close()
asyncio.run(main())
