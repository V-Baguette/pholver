import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,w=d.world;w.bodies.length=0;w.joints.length=0;w.links.length=0;d.view=null;w.ground=false;
          const W=Phys.createWheel(w,0,3,{r:.4,m:1});window.__w=W;})()''')
        await pg.evaluate('window.__pholver.select(window.__w.id)'); await pg.wait_for_timeout(200)
        r={}
        await pg.locator('#props >> text=Motor (drives the pulley)').first.click(); await pg.wait_for_timeout(150)
        r['motor']=await pg.evaluate('[window.__w.motor,window.__w.ms,window.__w.mt]')
        r['fields']=await pg.evaluate('["Motor speed","Max torque","Axle friction"].map(t=>document.querySelector("#props").innerText.includes(t))')
        await pg.evaluate('window.__pholver.setMode("sim")'); await pg.wait_for_timeout(1200)
        r['spin']=await pg.evaluate('window.__w.w.toFixed(2)'); 
        print(json.dumps(r),errs); await b.close()
asyncio.run(main())
