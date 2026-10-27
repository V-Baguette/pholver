import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':900}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(800)
        await pg.click('#tabs .tab:has-text("Circuit")'); await pg.wait_for_timeout(400)
        for name,shot,wait in [('LC oscillator','lc',2200),('RL current ramp','rl',2600),('Series RLC, AC drive','rlc',2000),('Voltage divider and lamp','lamp',1500)]:
            await pg.keyboard.press('1'); await pg.wait_for_timeout(200)
            await pg.click('#propsBody .btn2:has-text("%s")'%name) if await pg.locator('#propsBody .btn2:has-text("%s")'%name).count() else None
            await pg.wait_for_timeout(300)
            if await pg.locator('#propsBody .btn2:has-text("%s")'%name).count()==0:
                # deselect first
                await pg.mouse.click(700,800); await pg.wait_for_timeout(200); await pg.click('#propsBody .btn2:has-text("%s")'%name)
            await pg.wait_for_timeout(300)
            await pg.keyboard.press('2')
            if name.startswith('RL'): await pg.evaluate('(()=>{window.__pholver.cur.ck.items.find(i=>i.type=="sw").closed=true})()')
            await pg.wait_for_timeout(wait)
            await pg.screenshot(path='shot_ck_%s.png'%shot)
            print(name, await pg.evaluate('(()=>{const d=window.__pholver.cur;return [d.title,d.ck.t,d.ck.err,d.ck.items.filter(i=>i.type!="wire").map(i=>i.name+":"+(i._v||0).toExponential(2)+"/"+(i._i||0).toExponential(2))]})()'))
        print('errors', errs)
        await b.close()
asyncio.run(main())
