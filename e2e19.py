import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':900}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.click('#newTab'); await pg.wait_for_timeout(300)
        box = await pg.locator('#cv').bounding_box()
        await pg.evaluate('(()=>{const d=window.__pholver.cur;d.view={s:60,ox:500,oy:600}})()')
        W=lambda x,y:(box['x']+500+x*60, box['y']+600-y*60)
        await pg.click('#objBtn'); await pg.click('#tray button[data-t="custom"]')
        # a bowl: smooth-ish U drawn with corners
        pts=[(-2,3),(-2,0.5),(-1,0),(1,0),(2,0.5),(2,3),(1.5,3),(1.5,0.8),(0.9,0.5),(-0.9,0.5),(-1.5,0.8),(-1.5,3)]
        for x,y in pts: await pg.mouse.click(*W(x,y))
        await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
        info = await pg.evaluate('(()=>{const b=window.__pholver.cur.world.bodies.find(q=>q.kind=="custom");return [b.verts.length,b.parts&&b.parts.length,b.area]})()'); print('custom', info)
        await pg.evaluate('(()=>{const w=window.__pholver.cur.world;const c=w.bodies.find(q=>q.kind=="custom");c.fixed=true;Phys.rebuild(c)})()')
        await pg.evaluate('(()=>{const w=window.__pholver.cur.world;const b=Phys.createBody("sphere",{r:0.35,m:1,x:0,y:5});w.bodies.push(b);const r=Phys.createBody("rect",{W:0.5,H:0.5,m:1,x:0.2,y:7});w.bodies.push(r)})()')
        await pg.screenshot(path='shot_concave_design.png')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(3500); await pg.screenshot(path='shot_concave_sim.png')
        print(await pg.evaluate('window.__pholver.cur.world.bodies.filter(b=>b.kind!="custom").map(b=>[b.kind,+b.x.toFixed(2),+b.y.toFixed(2)])'))
        print('errs',errs); await b.close()
asyncio.run(main())
