import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,W=d.world;W.bodies.length=0;W.joints.length=0;W.ground=false;W.g=0;
         const A=Phys.createBody('rect',{x:-1.5,y:0,W:1,H:1,m:3,mus:0,muk:0,fixed:true});A.name='A';const B=Phys.createBody('rect',{x:1.5,y:0,W:1,H:1,m:1,mus:0,muk:0});B.name='B';W.bodies.push(A,B);W.linkDirty=true;window.__pholver.renderWorkspace();d.view=null;})()''')
        box=await pg.locator('#cv').bounding_box()
        async def Wp(x,y):
            v=await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()'); return box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2]
        await pg.evaluate('window.__pholver.cur.tool="spring"')
        X,Y=await Wp(-1.0,0.2); await pg.mouse.click(X,Y); X,Y=await Wp(1.0,0.2); await pg.mouse.click(X,Y); await pg.wait_for_timeout(200)
        r=await pg.evaluate('(()=>{const j=window.__pholver.cur.world.joints.find(j=>j.type=="spring");return j?{fix:j.fix,rA:j.rA}:null})()')
        print(r)
        # run and kick block B rotating
        await pg.evaluate('window.__pholver.cur.world.bodies.find(b=>b.name=="B").w=3')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(2500)
        print(await pg.evaluate('(()=>{const b=window.__pholver.cur.world.bodies.find(b=>b.name=="B");return b.a})()'),errs); await pg.screenshot(path='shot_clamp.png'); await b.close()
asyncio.run(main())
