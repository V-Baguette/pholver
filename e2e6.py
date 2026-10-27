import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':860})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(400)
        await pg.click('#newTab'); await pg.wait_for_timeout(200)
        box = await pg.locator('#cv').bounding_box()
        async def scr(x,y):
            v = await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()'); return box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2]
        async def click(x,y):
            X,Y = await scr(x,y); await pg.mouse.click(X,Y)
        await pg.click('#objBtn'); await pg.click('#tray [data-t=sphere]'); await click(0,2)
        await pg.click('#cxBtn'); await pg.click('#cxTray [data-t=chain]'); await click(-3,4); await click(0,2)
        await pg.click('#cxBtn'); await pg.click('#cxTray [data-t=slider]'); await click(0,2)
        r={}
        r['ws']=await pg.eval_on_selector_all('#wsList .nm','e=>e.map(x=>x.textContent)')
        # select chain by clicking its middle (design)
        ch = await pg.evaluate('(()=>{const c=window.__pholver.cur.world.chains[0];const n=c.nodes[12];return [n.x,n.y]})()')
        await click(*ch); r['sel_chain']=await pg.text_content('#propsTitle')
        r['chain_labels']=await pg.eval_on_selector_all('#propsBody .row label','e=>e.map(x=>x.textContent)')
        # edit links
        await pg.fill('#propsBody .row:has(label:has-text("Links")) input','12'); await pg.press('#propsBody .row:has(label:has-text("Links")) input','Tab')
        r['nodes']=await pg.evaluate('window.__pholver.cur.world.chains[0].nodes.length')
        # slider: select it from list and set limit
        await pg.locator('#wsList .item', has_text='Slider').click()
        r['slider_labels']=await pg.eval_on_selector_all('#propsBody .row label','e=>e.map(x=>x.textContent)')
        # sim, grab chain node
        await pg.keyboard.press('2'); await pg.wait_for_timeout(800)
        n = await pg.evaluate('(()=>{const c=window.__pholver.cur.world.chains[0];const n=c.nodes[6];return [n.x,n.y]})()')
        X,Y = await scr(*n); await pg.mouse.move(X,Y); await pg.mouse.down(); T = await scr(n[0]-1, n[1]+1.5); await pg.mouse.move(*T, steps=10); await pg.wait_for_timeout(700)
        r['sel_after_grab']=await pg.text_content('#propsTitle')
        n2 = await pg.evaluate('(()=>{const c=window.__pholver.cur.world.chains[0];const n=c.nodes[6];return [n.x,n.y]})()'); r['node_moved']=[n,n2]
        await pg.mouse.up()
        r['chain_len']=await pg.evaluate('(()=>{const P=window.__pholver.cur.world.chains[0];return P.nodes.length})()')
        await pg.keyboard.press('1'); await pg.wait_for_timeout(200)
        # delete sphere -> chain + slider removed
        await pg.locator('#wsList .item', has_text='Sphere 1').click(); await pg.click('#delBtn')
        r['after_delete']=await pg.eval_on_selector_all('#wsList .nm','e=>e.map(x=>x.textContent)')
        r['bodies_left']=await pg.evaluate('window.__pholver.cur.world.bodies.length')
        r['errs']=errs; print(json.dumps(r,indent=1)); await b.close()
asyncio.run(main())
