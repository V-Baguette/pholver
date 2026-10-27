import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':900}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(800)
        await pg.click('#newTabCkt'); await pg.wait_for_timeout(400)
        box = await pg.locator('#cv').bounding_box()
        print('kind', await pg.evaluate('window.__pholver.cur.kind'), await pg.evaluate('window.__pholver.cur.title'))
        await pg.evaluate('(()=>{const d=window.__pholver.cur;d.view={s:40,ox:300,oy:500}})()')
        def W(x,y): return (box['x']+300+x*40, box['y']+500-y*40)
        async def tray(t):
            await pg.click('#ckAdd'); await pg.wait_for_timeout(100); await pg.click('#cktTray button[data-t="%s"]'%t)
        # place battery at (0,0) rot 1 (R rotates before placing), resistor on top, cap on right
        await tray('vsrc'); await pg.keyboard.press('r'); print('rotNew', await pg.evaluate('window.__pholver.cur.rotNew')); await pg.mouse.move(*W(0,0)); await pg.mouse.click(*W(0,0)); await pg.wait_for_timeout(100)
        await tray('res'); await pg.evaluate('window.__pholver.cur.rotNew=0'); await pg.mouse.click(*W(3,6)); await pg.wait_for_timeout(100)
        await tray('cap'); await pg.evaluate('window.__pholver.cur.rotNew=3'); await pg.mouse.click(*W(9,6)); await pg.wait_for_timeout(100)
        await tray('gnd'); await pg.evaluate('window.__pholver.cur.rotNew=3'); await pg.mouse.click(*W(0,0)); await pg.wait_for_timeout(100)
        items = await pg.evaluate('window.__pholver.cur.ck.items.map(i=>[i.type,i.x,i.y,i.rot])'); print(items)
        # wires: from battery + (0,3) up to (0,6) to (3,6)
        await pg.click('#ckWire')
        for pt in [(0,3),(0,6),(3,6)]: await pg.mouse.click(*W(*pt)); await pg.wait_for_timeout(60)
        await pg.keyboard.press('Escape')
        for pt in [(6,6),(9,6)]: pass
        await pg.mouse.click(*W(6,6)); await pg.mouse.click(*W(9,6)); await pg.keyboard.press('Escape')
        # cap rot3 at (9,6) -> terminals (9,6),(9,3); wire from (9,3) down to (9,0) then back to (0,0)
        await pg.mouse.click(*W(9,3)); await pg.mouse.click(*W(9,0)); await pg.mouse.click(*W(0,0)); await pg.keyboard.press('Escape')
        await pg.keyboard.press('Escape'); await pg.click('#selBtn')
        n = await pg.evaluate('window.__pholver.cur.ck.items.filter(i=>i.type=="wire").length'); print('wires', n)
        await pg.screenshot(path='shot_ck_built.png')
        # simulate; battery rot1 from (0,0) to (0,3): + is at b=(0,3)
        await pg.keyboard.press('2'); await pg.wait_for_timeout(2500)
        r = await pg.evaluate('(()=>{const d=window.__pholver.cur;return [d.ck.err,d.ck.items.filter(i=>i.type!="wire").map(i=>i.type+":"+(i._v||0).toFixed(3)+"/"+(i._i||0).toExponential(2))]})()'); print(r)
        await pg.keyboard.press('1'); await pg.wait_for_timeout(300); v=await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()')
        def W(x,y): return (box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2])
        # move the resistor and check wire follows
        before = await pg.evaluate('window.__pholver.cur.ck.items.filter(i=>i.type=="wire").map(i=>[i.x1,i.y1,i.x2,i.y2])')
        await pg.mouse.move(*W(4.5,6)); await pg.mouse.down(); await pg.mouse.move(*W(4.5,7.1),steps=5); await pg.mouse.up(); await pg.wait_for_timeout(100)
        after = await pg.evaluate('window.__pholver.cur.ck.items.map(i=>i.type=="wire"?[i.x1,i.y1,i.x2,i.y2]:[i.type,i.x,i.y])')
        print('after move', after)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200)
        print('undo', await pg.evaluate('window.__pholver.cur.ck.items.find(i=>i.type=="res").y'))
        # delete resistor
        await pg.mouse.click(*W(4.5,6)); await pg.keyboard.press('Delete'); print('parts', await pg.evaluate('window.__pholver.cur.ck.items.filter(i=>i.type!="wire").length'))
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(100)
        # edit values through props
        await pg.mouse.click(*W(4.5,6)); await pg.wait_for_timeout(100)
        inp = pg.locator('#propsBody input[type=text]').nth(1); await inp.fill('4.7k'); await inp.press('Tab')
        print('R', await pg.evaluate('window.__pholver.cur.ck.items.find(i=>i.type=="res").R'))
        # save / reopen roundtrip through serializer
        s = await pg.evaluate('JSON.stringify(CKT.serialize(window.__pholver.cur.ck)).length'); print('ser bytes', s)
        # reload page: session restore
        await pg.wait_for_timeout(800); await pg.reload(); await pg.wait_for_timeout(900)
        print('tabs after reload', await pg.evaluate('[...document.querySelectorAll("#tabs .tab .tt")].map(e=>e.textContent)'))
        print('errors', errs)
        await b.close()
asyncio.run(main())
