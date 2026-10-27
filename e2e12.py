import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':860}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        r={}
        r['tabs']=await pg.eval_on_selector_all('#tabs .tt','e=>e.map(x=>x.textContent)')
        await pg.click('#tabs .tab:nth-child(2)'); await pg.wait_for_timeout(500)
        await pg.screenshot(path='shot_em_design.png')
        r['visible_buttons']=await pg.evaluate('[...document.querySelectorAll("#toolbar > *")].filter(e=>!e.hidden && e.offsetParent).map(e=>e.id||e.className).join(",")')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(5000)
        await pg.screenshot(path='shot_em_sim.png')
        r['particles']=await pg.evaluate('window.__pholver.cur.em.beam.length')
        r['status']=await pg.inner_text('#status')
        r['errs']=errs
        print(json.dumps(r,indent=1))
        await b.close()
asyncio.run(main())
