import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(700)
        r=await pg.evaluate('''(()=>{const d=window.__pholver.cur,W=d.world;W.bodies.length=0;W.joints.length=0;
         const A=Phys.createBody('rect',{x:0,y:0,W:1,H:1,m:2});const B=Phys.createBody('rect',{x:2,y:0,W:1,H:1,m:2});W.bodies.push(A,B);
         const j=Phys.createJoint(W,'spring',A,B,{x:.5,y:0},{x:-.5,y:0},{L:1,k:40,c:1});W.linkDirty=true;
         window.__pholver.renderWorkspace&&window.__pholver.renderWorkspace();
         window.__pholver.select&&window.__pholver.select(j.id);
         const ok=document.body.innerText.includes('Fixed ends');
         Phys.J.setFixedAxis(j,true);const s=JSON.stringify(Phys.serialize(W));const w2=Phys.deserialize(JSON.parse(s));
         const d2=window.__pholver.cur;d2.tool='spring';return {ok,fix:w2.joints[0].fix,rA:w2.joints[0].rA}})()''')
        print(r,errs); await b.close()
asyncio.run(main())
