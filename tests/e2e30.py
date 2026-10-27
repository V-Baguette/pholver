import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,w=d.world;w.bodies.length=0;w.joints.length=0;w.links.length=0;d.view=null;
          const A=Phys.createBody('rect',{x:0,y:2,base:1,height:0.3,fixed:true,name:'ceil'}),B=Phys.createBody('rect',{x:2,y:1,base:.6,height:.3,m:1,name:'blk'});w.bodies.push(A,B);
          window.__r=Phys.createJoint(w,'rod',A,B,{x:0,y:0},{x:-.3,y:0},{L:2,name:'Rod 1'});
          window.__s=Phys.createJoint(w,'spring',A,B,{x:.5,y:0},{x:.3,y:0},{L:1,name:'Spring 1'});
          window.__p=Phys.createJoint(w,'pin',A,B,{x:-.5,y:0},{x:0,y:0},{name:'Pin 1'});
          window.__l=Phys.createLink(w,{nodes:[{b:null,x:3,y:2,fixed:true},{b:null,x:4,y:1}, {b:null,x:5,y:2}],edges:[[0,1],[1,2]]},{});})()''')
        await pg.wait_for_timeout(300)
        out={}
        for k in ['__r','__s','__p']:
            await pg.evaluate('(id=>window.__pholver.select(id))(window.%s.id)'%k); await pg.wait_for_timeout(150)
            out[k]=await pg.evaluate('[...document.querySelectorAll("#props label, #props .row, #props")].map(e=>e.innerText).join("|")')
            out[k]=[t for t in ['Lock angle','Lock angle (no rotation)'] if t in out[k]]
        await pg.evaluate('(()=>{window.__pholver.select(window.__l.id);window.__pholver.cur.lnode=1;})()'); await pg.evaluate('window.__pholver.renderProps&&window.__pholver.renderProps()')
        await pg.wait_for_timeout(200)
        out['link']=await pg.evaluate('document.querySelector("#props").innerText.includes("Lock angles between rods")')
        # toggle the pin lock via the UI and run
        await pg.evaluate('window.__pholver.select(window.__p.id)'); await pg.wait_for_timeout(150)
        await pg.locator('#props >> text=Lock angle (no rotation)').first.click(); await pg.wait_for_timeout(100)
        out['pinlock']=await pg.evaluate('window.__p.lock')
        print(json.dumps(out),errs); await b.close()
asyncio.run(main())
