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
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,w=d.world;
          const mk=(k,o)=>{const b=Phys.createBody(k,o);w.bodies.push(b);return b};
          mk('rect',{x:0,y:2,W:4,H:0.2,m:1,fixed:true,name:'Shelf'});
          mk('rect',{x:-1.2,y:2.3,W:1,H:0.4,m:2,mus:0,muk:0,name:'Block'});
          mk('sphere',{x:2,y:1.2,r:0.2,m:1,mus:0,muk:0,name:'Weight'});
          d.view=null;})()''')
        await pg.wait_for_timeout(200)
        await pg.click('#cxBtn'); await pg.click('#cxTray [data-t=rope]')
        await click(-0.85,2.25); await click(2,1.2)
        r['joints']=await pg.evaluate('window.__pholver.cur.world.joints.map(j=>[j.type,j.seq&&j.seq.length,j.L])')
        r['pts']=await pg.evaluate('Phys.J.wrapPoly(window.__pholver.cur.world.joints[0]).length')
        r['dbg']=await pg.evaluate('''(()=>{const w=window.__pholver.cur.world,j=w.joints[0];return {oc:j.oc,world:Phys.J._w===w,pa:[j.a.name,j.la,j.b.name,j.lb],bodies:w.bodies.map(b=>[b.name,b.kind,b.x,b.y,!!b.verts,b.owner])}})()''')
        r['dbg2']=await pg.evaluate('''(()=>{const w=window.__pholver.cur.world,j=w.joints[0];Phys.J._h.common(j);const L=Phys.J.wrapSync(j);return {L,seq:j.seq,pa:[j.a.x,j.a.y,j.la],bl:j.lb,pts:Phys.J.wrapPoly(j),act:j.act,wh:j.wh}})()''')
        await pg.screenshot(path='/tmp/shot_corner_design.png')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(900)
        await pg.screenshot(path='/tmp/shot_corner_sim.png')
        r['props']=await pg.eval_on_selector_all('#propsBody .row label','e=>e.map(x=>x.textContent)')
        # switch to extensible and back
        r['errs']=errs
        print(json.dumps(r,indent=1)); await b.close()
asyncio.run(main())
