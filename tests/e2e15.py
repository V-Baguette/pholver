import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':900}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(800)
        tabs = await pg.evaluate('[...document.querySelectorAll("#tabs .tab .tt")].map(e=>e.textContent)'); print('tabs', tabs)
        await pg.click('#tabs .tab:has-text("Circuit")'); await pg.wait_for_timeout(600)
        print('kind', await pg.evaluate('window.__pholver.cur.kind'), 'items', await pg.evaluate('window.__pholver.cur.ck.items.length'))
        await pg.screenshot(path='shot_ck_design.png')
        # simulate
        await pg.keyboard.press('2'); await pg.wait_for_timeout(300)
        await pg.evaluate('(()=>{const d=window.__pholver.cur;d.ck.items.find(i=>i.type=="sw").closed=true;})()')
        await pg.wait_for_timeout(2500)
        print('cap v', await pg.evaluate('(()=>{const d=window.__pholver.cur;const c=d.ck.items.find(i=>i.type=="cap");return [d.ck.t,c._v,c._i, d.ck.err]})()'))
        await pg.screenshot(path='shot_ck_sim.png')
        print('errors', errs)
        await b.close()
asyncio.run(main())
