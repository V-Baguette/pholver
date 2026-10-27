import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':900}, accept_downloads=True); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(800)
        await pg.click('#tabs .tab:has-text("Circuit")'); await pg.wait_for_timeout(300)
        # click switch in sim to close it, check charging
        await pg.keyboard.press('2'); await pg.wait_for_timeout(500)
        sw = await pg.evaluate('(()=>{const d=window.__pholver.cur,v=d.view,s=d.ck.items.find(i=>i.type=="sw");return [v.ox+(s.x+1.5)*v.s,v.oy-s.y*v.s]})()')
        box = await pg.locator('#cv').bounding_box()
        await pg.mouse.click(box['x']+sw[0], box['y']+sw[1]); await pg.wait_for_timeout(1800)
        print('switch closed', await pg.evaluate('window.__pholver.cur.ck.items.find(i=>i.type=="sw").closed'), 'cap v', await pg.evaluate('window.__pholver.cur.ck.items.find(i=>i.type=="cap")._v'))
        # reset restores the open switch
        await pg.keyboard.press('r'); await pg.wait_for_timeout(200)
        print('after reset', await pg.evaluate('(()=>{const d=window.__pholver.cur;return [d.ck.items.find(i=>i.type=="sw").closed,d.ck.t]})()'))
        # render mode dark
        await pg.evaluate('(()=>{const d=window.__pholver.cur;d.ck.items.find(i=>i.type=="sw").closed=true})()')
        await pg.keyboard.press('3'); await pg.select_option('#bgSel','blueprint'); await pg.keyboard.press('Space'); await pg.wait_for_timeout(1800)
        await pg.screenshot(path='shot_ck_render.png')
        # save
        await pg.keyboard.press('1')
        async with pg.expect_download() as dl: await pg.click('#saveBtn')
        d = await dl.value; path = '/tmp/ck_saved.json'; await d.save_as(path); print('saved', d.suggested_filename)
        j = json.load(open(path)); print(j['kind'], len(j['data']['items']))
        await pg.set_input_files('#openFile', path); await pg.wait_for_timeout(500)
        print('opened', await pg.evaluate('[window.__pholver.cur.kind, window.__pholver.cur.ck.items.length, window.__pholver.cur.title]'))
        # mobile
        await pg.set_viewport_size({'width':420,'height':820}); await pg.wait_for_timeout(500)
        await pg.keyboard.press('2'); await pg.wait_for_timeout(1200); await pg.screenshot(path='shot_ck_mobile.png')
        print('errors', errs); await b.close()
asyncio.run(main())
