import asyncio, json, os
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':860}, accept_downloads=True); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(600)
        await pg.click('#newTab'); await pg.wait_for_timeout(300)
        box = await pg.locator('#cv').bounding_box()
        r={}
        cnt = 'window.__pholver.cur.world.bodies.filter(b=>!b.hidden).length'
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,w=d.world;const b=Phys.createBody('sphere',{x:2,y:2,r:0.3,m:1,name:'Sphere 1'});w.bodies.push(b);d.view=null;})()''')
        await pg.wait_for_timeout(2500)
        v = await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()')
        async def click(x,y): await pg.mouse.click(box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2])
        # place a rectangle with the object tool, then undo / redo
        await pg.click('#objBtn'); await pg.click('#tray [data-t=rect]'); await click(2.5,1); await pg.wait_for_timeout(200)
        r['after_place']=await pg.evaluate(cnt)
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200); r['after_undo']=await pg.evaluate(cnt)
        await pg.keyboard.press('Control+y'); await pg.wait_for_timeout(200); r['after_redo']=await pg.evaluate(cnt)
        await pg.keyboard.press('Delete'); await pg.wait_for_timeout(200); r['after_delete']=await pg.evaluate(cnt)
        await pg.click('#undoBtn'); await pg.wait_for_timeout(200); r['after_undo_btn']=await pg.evaluate(cnt)
        # save
        async with pg.expect_download() as dl: await pg.click('#saveBtn')
        d = await dl.value; path='_saved.json'; await d.save_as(path); r['file']=d.suggested_filename
        saved=json.load(open(path)); r['saved_bodies']=len(saved['data']['bodies'])
        # open as new tab
        await pg.set_input_files('#openFile', path); await pg.wait_for_timeout(500)
        r['tabs']=await pg.eval_on_selector_all('#tabs .tt','e=>e.map(x=>x.textContent)'); r['opened_bodies']=await pg.evaluate(cnt)
        # reload: session restored
        await pg.wait_for_timeout(900)
        await pg.reload(); await pg.wait_for_timeout(800)
        r['tabs_after_reload']=await pg.eval_on_selector_all('#tabs .tt','e=>e.map(x=>x.textContent)'); r['bodies_after_reload']=await pg.evaluate(cnt)
        r['errs']=errs; print(json.dumps(r)); await b.close()
asyncio.run(main())
