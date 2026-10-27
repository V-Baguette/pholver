import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,W=d.world;W.bodies.length=0;W.joints.length=0;W.ground=false;W.g=9.81;
         const B=Phys.createBody('rect',{x:1.4,y:0.5,W:0.7,H:0.7,m:2,mus:0,muk:0});B.name='M';W.bodies.push(B);
         const j=Phys.createJoint(W,'rod',null,B,{x:0,y:2.5},{x:0,y:1.0},{L:1.5});j.name='arm';W.linkDirty=true;
         const C=Phys.createBody('rect',{x:-1.5,y:0.5,W:0.7,H:0.7,m:2,mus:0,muk:0});C.name='C';W.bodies.push(C);
         const A2=Phys.createBody('rect',{x:-1.5,y:1.9,W:0.2,H:1.6,m:.2,mus:0,muk:0});A2.name='bar';W.bodies.push(A2);
         const pj=Phys.createJoint(W,'pin',A2,C,{x:0,y:-.8},{x:0,y:.35},{ref:C.a-A2.a});pj.name='hinge';
         window.__pholver.renderWorkspace();})()''')
        box=await pg.locator('#cv').bounding_box()
        async def W(x,y):
            v=await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()'); return box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2]
        await pg.evaluate('window.__pholver.cur.tool="tspring"')
        X,Y=await W(0,2.5); await pg.mouse.click(X,Y); await pg.wait_for_timeout(200)
        r={}
        r['rod']=await pg.evaluate('(()=>{const j=window.__pholver.cur.world.joints.find(j=>j.type=="rod");return [j.ksA,j.ksB,j.rA]})()')
        await pg.evaluate('window.__pholver.cur.tool="tspring"')
        X,Y=await W(-1.5,1.1); await pg.mouse.click(X,Y); await pg.wait_for_timeout(200)
        r['pin']=await pg.evaluate('(()=>{const j=window.__pholver.cur.world.joints.find(j=>j.name=="hinge");return [j.ks,j.cs, window.__pholver.cur.world.joints.length]})()')
        r['panel']=await pg.evaluate('document.body.innerText.includes("Rest angle")')
        await pg.screenshot(path='shot_tors2_a.png')
        # zoom out/in with wheel
        for dy in (600,-1800):
            await pg.mouse.move(box['x']+600,box['y']+300); await pg.mouse.wheel(0,dy); await pg.wait_for_timeout(250)
            await pg.screenshot(path='shot_tors2_z%d.png'%(1 if dy>0 else 2))
        print(json.dumps(r),errs); await b.close()
asyncio.run(main())
