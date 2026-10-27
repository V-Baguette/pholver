import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width':1440,'height':860})
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(400)
        await pg.click('#newTab'); await pg.wait_for_timeout(200)
        box = await pg.locator('#cv').bounding_box()
        async def scr(x,y):
            v = await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()'); return box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2]
        async def click(x,y):
            X,Y = await scr(x,y); await pg.mouse.click(X,Y)
        r={}
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,w=d.world;w.g=0;
          const b=Phys.createBody('sphere',{x:3,y:2,r:0.25,m:1,mus:0,muk:0,e:0,name:'Ball'});w.bodies.push(b);d.view=null;})()''')
        await pg.wait_for_timeout(2500)
        await pg.click('#cxBtn'); await pg.click('#cxTray [data-t=spring]')
        r['hint']=await pg.text_content('#hint')
        await click(0.6,2); r['cx1']=await pg.evaluate('JSON.stringify(window.__pholver.cur.cx)'); r['view']=await pg.evaluate('JSON.stringify(window.__pholver.cur.view)'); r['hint2']=await pg.text_content('#hint'); await pg.evaluate('window.__dbg=[]'); await click(1.8,2); r['cx2']=await pg.evaluate('JSON.stringify(window.__pholver.cur.cx)'); r['hint3']=await pg.evaluate('JSON.stringify([window.__pholver.cur.cx.length, window.__pholver.cur.msg, window.__pholver.cur.world.joints.length])')
        r['hint2']=await pg.text_content('#hint'); r['joint']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world;const j=w.joints.find(j=>j.type=="spring");return j?[j.mode,!!j.pad,w.bodies.length,w.joints.length]:[w.joints.length,d_tool=window.__pholver.cur.tool,window.__pholver.cur.cx.length]})()')
        await pg.screenshot(path='/tmp/shot_dbg.png')
        r['props']=await pg.eval_on_selector_all('#propsBody .row label','e=>e.map(x=>x.textContent)')
        await pg.screenshot(path='/tmp/shot_stopper_design.png')
        await pg.evaluate('window.__pholver.cur.world.bodies.find(b=>b.name=="Ball").vx=-3')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(1500)
        r['ball']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world;const b=w.bodies.find(b=>b.name=="Ball");return [+b.x.toFixed(3),+b.vx.toFixed(3)]})()')
        await pg.screenshot(path='/tmp/shot_stopper_sim.png')
        await pg.keyboard.press('1')
        r['errs']=errs
        print(json.dumps(r)); await b.close()
asyncio.run(main())
