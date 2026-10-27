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
          const a=mk('sphere',{x:-2,y:3,r:0.3,m:1,name:'A'}),b=mk('rect',{x:0,y:3,W:0.8,H:0.5,m:1,name:'B'}),c=mk('sphere',{x:3,y:6,r:0.3,m:1,name:'C'});
          Phys.createJoint(w,'rod',a,b,{x:0,y:0},{x:0,y:0},{L:2,name:'Rod 1'});
          Phys.createJoint(w,'spring',w.anchor,a,{x:-2,y:5},{x:0,y:0},{L:2,name:'Spring 1'});
          d.view=null;})()''')
        await pg.wait_for_timeout(200)
        # shift-drag a box around A and B (left to right, whole objects inside)
        x0,y0 = await scr(-3,4.5); x1,y1 = await scr(1,1.5)
        await pg.keyboard.down('Shift'); await pg.mouse.move(x0,y0); await pg.mouse.down(); await pg.mouse.move((x0+x1)/2,(y0+y1)/2); await pg.mouse.move(x1,y1); await pg.mouse.up(); await pg.keyboard.up('Shift')
        r['sel']=await pg.evaluate('(()=>{const d=window.__pholver.cur;return [d.ms?d.ms.size:null, d.world.bodies.filter(b=>d.ms&&d.ms.has(b.id)).map(b=>b.name)]})()')
        r['title']=await pg.text_content('#propsTitle')
        await pg.keyboard.press('Control+c'); await pg.keyboard.press('Control+v')
        r['after_paste']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world;return {bodies:w.bodies.filter(b=>!b.hidden).map(b=>[b.name,+b.x.toFixed(2),+b.y.toFixed(2)]),joints:w.joints.map(j=>[j.name,j.type,j.a.name,j.b.name,j.la,j.lb])}})()')
        r['sel2']=await pg.evaluate('(()=>{const d=window.__pholver.cur;return d.ms?d.ms.size:null})()')
        # drag one of the pasted objects, whole group should move
        before = await pg.evaluate('window.__pholver.cur.world.bodies.filter(b=>b.name.startsWith("Sphere")||b.name.startsWith("Rect")).map(b=>[b.x,b.y])')
        r['before']=before
        await pg.screenshot(path='/tmp/shot_multi.png')
        sx0,sy0=await scr(0.5,2.5); sx1,sy1=await scr(1.5,2.5)
        await pg.mouse.move(sx0,sy0); await pg.mouse.down(); await pg.mouse.move((sx0+sx1)/2,sy0); await pg.mouse.move(sx1,sy1); await pg.mouse.up()
        r['moved']=await pg.evaluate('window.__pholver.cur.world.bodies.filter(b=>b.name.startsWith("Sphere")||b.name.startsWith("Rect")).map(b=>[+b.x.toFixed(2),+b.y.toFixed(2)])')
        # delete the selection
        await pg.keyboard.press('Delete')
        r['after_delete']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world;return [w.bodies.filter(b=>!b.hidden).length,w.joints.length]})()')
        # air
        await pg.keyboard.press('2'); await pg.wait_for_timeout(200)
        r['no_air']=await pg.evaluate('[!document.querySelector("#airBtn"), !document.querySelector("#rhoField"), window.__pholver.cur.world.air===undefined]')
        await pg.keyboard.press('1')
        await click(-1,3)
        r['rod_note']=await pg.evaluate('[...document.querySelectorAll("#propsBody .note")].map(e=>e.textContent)')
        r['errs']=errs
        print(json.dumps(r,indent=1)); await b.close()
asyncio.run(main())
