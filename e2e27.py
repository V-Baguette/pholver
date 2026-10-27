import asyncio, json
from playwright.async_api import async_playwright
# Regression test for phase A4: the E&M ruler tool, now measuring on the z=0 work plane via ray-casts
# through the orbit camera (ui_em.js's rayPlane) instead of the old 2D toW() screen transform; and the
# circuit open-ends smoke test (unaffected by the E&M rewrite, kept as-is).
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        # EM ruler
        await pg.click('#newTabEm'); await pg.wait_for_timeout(400)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur;d.em.items.length=0;d.cam=null;})()''')
        await pg.wait_for_timeout(300)
        box=await pg.locator('#cvEm').bounding_box()
        async def W(x,y,z=0):
            p0 = await pg.evaluate('(a)=>{const d=window.__pholver.cur;return window.EM3DGL.worldToScreen(d.cam,{x:a[0],y:a[1],z:a[2]})}', [x,y,z])
            return box['x']+p0['x'], box['y']+p0['y']
        await pg.click('#emRuler'); a=await W(0,0); c=await W(3,4)
        await pg.mouse.move(*a); await pg.mouse.down(); await pg.mouse.move(*c,steps=5); await pg.mouse.up()
        ruler=await pg.evaluate('(()=>{const r=window.__pholver.cur.es.ruler;return r&&[r.x0,r.y0,r.x1,r.y1]})()')
        r={'ruler':ruler}
        assert ruler is not None and abs(ruler[2]-ruler[0]-3) < 0.05 and abs(ruler[3]-ruler[1]-4) < 0.05, r
        await pg.wait_for_timeout(150); await pg.screenshot(path='shot_em_ruler.png')
        await pg.keyboard.press('Escape'); r['cleared']=await pg.evaluate('window.__pholver.cur.es.ruler')
        assert r['cleared'] is None, r
        # circuit open ends
        await pg.click('#newTabCkt'); await pg.wait_for_timeout(400)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur;d.ck=CKT.createScene();CKT.demoScene(d.ck);const i=d.ck.items.findIndex(i=>i.type=="wire");d.ck.items.splice(i,1);d.sel=null;d.view=null;if(d.mode!=="design")window.__pholver.setMode("design");})()''')
        await pg.wait_for_timeout(400); await pg.screenshot(path='shot_ck_open.png')
        print(json.dumps(r),errs); assert not errs, errs
        await b.close()
asyncio.run(main())
