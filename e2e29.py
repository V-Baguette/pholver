import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,w=d.world;w.bodies.length=0;w.joints.length=0;w.links.length=0;d.view=null;
          w.bodies.push(Phys.createBody('rect',{x:0,y:3,base:1,height:0.4,fixed:true,name:'ceiling'}));
          w.bodies.push(Phys.createBody('sphere',{x:2.6,y:0.4,r:0.25,m:1,name:'ball'}));})()''')
        await pg.wait_for_timeout(300)
        box=await pg.locator('#cv').bounding_box()
        v=await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()')
        W=lambda x,y:(box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2])
        async def click(x,y): await pg.mouse.click(*W(x,y)); await pg.wait_for_timeout(60)
        async def tool(): await pg.click('#cxBtn'); await pg.click('#cxTray [data-t=linkage]')
        await tool(); await click(0,3); await click(2.6,0.4); await pg.keyboard.press('Enter')
        # second linkage ends on the ball, started from the middle of the first rod
        await tool(); await click(1.3,1.7); await click(1.5,0.75); await pg.keyboard.press('Enter')
        st=lambda: pg.evaluate('(()=>{const w=window.__pholver.cur.world;return [w.links.length,w.links.map(c=>[c.nodes.length,c.edges.length])]})()')
        r={'midrod':await st()}
        # a separate linkage ending on a joint of the first, then continuing to the ball
        
        
        await pg.evaluate('window.__pholver.setMode("sim")'); await pg.wait_for_timeout(1500)
        r['tap']=await pg.evaluate('(()=>{const c=window.__pholver.cur.world.links[0];const P=Phys.linkNodePos;const a=P(c.nodes[0]),b=P(c.nodes[1]),t=c.nodes.find(n=>n.on);const q=P(t);const cr=((b.x-a.x)*(q.y-a.y)-(b.y-a.y)*(q.x-a.x))/Math.hypot(b.x-a.x,b.y-a.y);return {off:cr.toFixed(4),frac:(Math.hypot(q.x-a.x,q.y-a.y)/Math.hypot(b.x-a.x,b.y-a.y)).toFixed(3),t:t.t.toFixed(3),bars:Object.keys(c._bars).length}})()')
        r['pins']=await pg.evaluate('(()=>{const w=window.__pholver.cur.world;return w.joints.filter(j=>j.type==="pin"&&j.owner!=null).map(j=>{const a=Phys.J.pt(j.a,j.la),b=Phys.J.pt(j.b,j.lb);return Math.hypot(a.x-b.x,a.y-b.y).toFixed(4)})})()')
        r['moved']=await pg.evaluate('window.__pholver.cur.world.bodies.map(b=>b.name+":"+b.x.toFixed(2)+","+b.y.toFixed(2)).join(" | ")')
        await pg.screenshot(path='shot_tap_sim.png')
        r['len']=await pg.evaluate('window.__pholver.cur.world.joints.filter(j=>j.lk).map(j=>{const a=Phys.J.pt(j.a,j.la),b=Phys.J.pt(j.b,j.lb);return (Math.hypot(a.x-b.x,a.y-b.y)-j.L).toFixed(3)})')
        print(json.dumps(r),errs); await b.close()
asyncio.run(main())
