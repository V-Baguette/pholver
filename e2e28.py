import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,w=d.world;w.bodies.length=0;w.joints.length=0;w.links.length=0;d.view=null;
          w.bodies.push(Phys.createBody('rect',{x:0,y:3,base:1,height:0.4,fixed:true,name:'ceiling'}));
          w.bodies.push(Phys.createBody('sphere',{x:2.6,y:0.4,r:0.25,m:1,name:'ball'}));})()''')
        await pg.wait_for_timeout(300)
        box=await pg.locator('#cv').bounding_box()
        v=await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()')
        W=lambda x,y:(box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2])
        async def click(x,y,dbl=False):
            await pg.mouse.click(*W(x,y)); await pg.wait_for_timeout(60)
        await pg.click('#cxBtn'); await pg.click('#cxTray [data-t=linkage]')
        # chain 1: ceiling -> free joint -> ball(attached)
        await click(0,3); await click(1.2,1.8); await click(2.6,0.4); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        r={'after1':await pg.evaluate('(()=>{const w=window.__pholver.cur.world;return [w.links.length,w.links[0].nodes.length,w.links[0].edges.length,w.joints.filter(j=>j.lk).length]})()')}
        print(await pg.evaluate('JSON.stringify(window.__pholver.cur.world.links[0].nodes.map(n=>n.b?["b",n.b.name]:[n.body.x,n.body.y]))'))
        # chain 2: from the free joint, branch to a new free joint, then to another link
        await pg.click('#cxBtn'); await pg.click('#cxTray [data-t=linkage]')
        await click(1.25,1.75); await click(1.25,0.5); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(150)
        r['after2']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world;return [w.links.length,w.links[0].nodes.length,w.links[0].edges.length]})()')
        await pg.screenshot(path='shot_link_design.png')
        # drag the free joint
        await pg.keyboard.press('Escape')
        await pg.mouse.move(*W(1.25,0.5)); await pg.mouse.down(); await pg.mouse.move(*W(1.6,0.9),steps=5); await pg.mouse.up(); await pg.wait_for_timeout(100)
        print(json.dumps(r)); r['drag']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world,c=w.links[0];return [c.nodes[3].body.x.toFixed(2),c.nodes[3].body.y.toFixed(2),w.joints.filter(j=>j.lk).map(j=>j.L.toFixed(2))]})()')
        r['props']=await pg.evaluate('document.querySelector("#props")?.innerText.slice(0,200)')
        # run
        await pg.evaluate('window.__pholver.setMode("sim")'); await pg.wait_for_timeout(1500)
        r['sim']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world;const c=w.links[0];return [w.joints.filter(j=>j.lk).map(j=>{const a=Phys.J.pt(j.a,j.la),b=Phys.J.pt(j.b,j.lb);return [Math.hypot(a.x-b.x,a.y-b.y).toFixed(2),j.L.toFixed(2)]}), w.bodies.map(b=>b.name+":"+b.y.toFixed(2)).join()]})()')
        await pg.screenshot(path='shot_link_sim.png')
        await pg.evaluate('window.__pholver.setMode("design")'); await pg.wait_for_timeout(200)
        # copy / paste via select all
        await pg.keyboard.press('Control+a'); await pg.keyboard.press('Control+c'); await pg.keyboard.press('Control+v'); await pg.wait_for_timeout(200)
        r['paste']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world;return [w.links.length,w.bodies.filter(b=>!b.hidden).length]})()')
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(150)
        r['undo']=await pg.evaluate('window.__pholver.cur.world.links.length')
        print(json.dumps(r),errs); await b.close()
asyncio.run(main())
