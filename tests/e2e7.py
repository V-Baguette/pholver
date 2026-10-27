import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':860})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(400)
        await pg.click('#newTab'); await pg.wait_for_timeout(200)
        box = await pg.locator('#cv').bounding_box()
        async def scr(x,y):
            v = await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()'); return box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2]
        async def click(x,y):
            X,Y = await scr(x,y); await pg.mouse.click(X,Y)
        r={}
        await pg.click('#objBtn'); await pg.click('#tray [data-t=wheel]'); await click(0,5)
        r['wheel_props']=await pg.eval_on_selector_all('#propsBody .row label','e=>e.map(x=>x.textContent)')
        await pg.click('#objBtn'); await pg.click('#tray [data-t=sphere]'); await click(-1,2)
        await pg.fill('#propsBody .row:has(label:has-text("Mass")) input','3'); await pg.press('#propsBody .row:has(label:has-text("Mass")) input','Tab')
        await pg.click('#objBtn'); await pg.click('#tray [data-t=sphere]'); await click(1,2)
        await pg.fill('#propsBody .row:has(label:has-text("Mass")) input','1'); await pg.press('#propsBody .row:has(label:has-text("Mass")) input','Tab')
        # rope: start on left sphere, click wheel, end on right sphere
        await pg.click('#cxBtn'); await pg.click('#cxTray [data-t=rope]')
        await click(-1,2); r['hint1']=await pg.text_content('#hint'); await click(0,5); await click(1,2)
        r['ws']=await pg.eval_on_selector_all('#wsList .nm','e=>e.map(x=>x.textContent)')
        r['rope_props']=await pg.eval_on_selector_all('#propsBody .row label','e=>e.map(x=>x.textContent)')
        r['joint']=await pg.evaluate('(()=>{const j=window.__pholver.cur.world.joints.find(j=>j.type=="wrap");return j?[j.type,j.L,j.sg]:null})()')
        await pg.screenshot(path='/tmp/shot_wrap_design.png')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(700)
        r['sim']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world;const s=w.bodies.filter(b=>b.kind=="sphere");return [s[0].y.toFixed(3),s[1].y.toFixed(3),w.t.toFixed(3)]})()')
        # expected drop 0.5*a*t^2 with a=(3-1)g/4
        r['rope_live']=await pg.eval_on_selector_all('#propsBody .row label','e=>e.map(x=>x.textContent)')
        await pg.screenshot(path='/tmp/shot_wrap_sim.png')
        # click the rope to select it, via hitConn
        r['errs']=errs; print(json.dumps(r,indent=1)); await b.close()
asyncio.run(main())
