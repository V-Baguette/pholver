import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width':1440,'height':900})).new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(800)
        await pg.click('#newTabCkt'); await pg.wait_for_timeout(400)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur; d.ck=CKT.createScene(); CKT.PRESETS[0].build(d.ck); CKT.init(d.ck); CKT.autoScale(d.ck);})()''')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(300)
        sw = 'window.__pholver.cur.ck.items.find(i=>i.type=="sw")'
        await pg.evaluate(sw+'.closed=true')
        await pg.wait_for_timeout(1500)
        live = await pg.evaluate('Math.max(...window.__pholver.cur.cs.flow.edges.map(e=>e.r))')
        await pg.wait_for_timeout(5000)
        # cut the battery off: charged capacitor, nothing connected -> nothing should flow
        await pg.evaluate(sw+'.closed=false')
        await pg.wait_for_timeout(15000)
        idle = await pg.evaluate('Math.max(...window.__pholver.cur.cs.flow.edges.map(e=>e.r))')
        v = await pg.evaluate('window.__pholver.cur.ck.items.find(i=>i.type=="cap")._v')
        print('while charging max r', live, ' idle max r', idle, ' cap V', v, 'tscale', await pg.evaluate('window.__pholver.cur.ck.tscale'), errs)
        assert live > 0.05 and idle < 2e-3 and v > 4.5 and not errs
        print('OK'); await b.close()
asyncio.run(main())
