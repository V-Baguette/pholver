import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':860}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(700)
        r={}
        r['trayHas']=await pg.evaluate('''(()=>{document.querySelector('#cxBtn').click();return !!document.querySelector('#cxTray [data-t="tspring"]')})()''')
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,W=d.world;W.g=9.81;W.ground=false;
          const mk=(x,y,w,h,m,name)=>{const b=Phys.createBody('rect',{x,y,W:w,H:h,m,mus:0,muk:0});b.name=name;W.bodies.push(b);return b};
          const ball=(x,y,m,name)=>{const b=Phys.createBody('sphere',{x,y,r:.12,m,mus:0,muk:0});b.name=name;W.bodies.push(b);return b};
          const pin=(A,B,wa,x,y,o)=>Phys.createJoint(W,'pin',A,B,A?Phys.localOf(A,x,y):{x,y},Phys.localOf(B,x,y),Object.assign({ref:B.a-(A?A.a:0)},o||{}));
          // ceiling arm with torsion spring, M below it
          const arm=mk(0,2.5,0.06,1,0.1,'arm'),M=mk(0,1.3,0.9,1.2,3,'M');
          pin(null,arm,0,0,3,{ks:15,cs:0.1}); pin(arm,M,0,0,2,{});
          const L=mk(-2.4,1.3,0.6,1.2,1,'mL'),R=mk(2.4,1.3,0.6,1.2,1,'mR');
          const sp=(a,b,xa,xb,y)=>Phys.createJoint(W,'spring',a,b,{x:xa,y:y},{x:xb,y:y},{L:1,k:40,c:0});
          const sps=[sp(M,L,0.45,-0.3,0.3),sp(M,L,0.45,-0.3,-0.3),sp(M,R,0.45,-0.3,0.3)];
          W.__chk=sps.length; d.view=null;window.__pholver.renderWorkspace&&window.__pholver.renderWorkspace();})()''')
        await pg.wait_for_timeout(300); await pg.screenshot(path='shot_tors_design.png')
        # tool: place via UI on a body
        await pg.evaluate('''(()=>{const d=window.__pholver.cur;d.tool='tspring';document.querySelector('#cxBtn');})()''')
        box=await pg.locator('#cv').bounding_box()
        v=await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()')
        X=box['x']+v[0]+(-2.4)*v[2]; Y=box['y']+v[1]-(1.0)*v[2]
        await pg.mouse.click(X,Y); await pg.wait_for_timeout(200)
        r['placed']=await pg.evaluate('(()=>{const j=window.__pholver.cur.world.joints.filter(j=>j.type=="pin");const l=j[j.length-1];return {n:j.length,ks:l.ks,cs:l.cs,name:l.name}})()')
        # panel shows rest angle
        r['panel']=await pg.evaluate('(()=>{const t=document.querySelector("#props")?.innerText||document.body.innerText;return /Rest angle/.test(t)&&/Stiffness/.test(t)})()')
        # gravity checkbox on body
        await pg.evaluate('(()=>{const d=window.__pholver.cur;d.tool=null;})()')
        r['gravChk']=await pg.evaluate('''(()=>{const d=window.__pholver.cur;const b=d.world.bodies.find(b=>b.name=="mR");window.__pholver.select&&window.__pholver.select(b.id);return document.body.innerText.includes("Ignore gravity")})()''')
        await pg.keyboard.press('2'); await pg.wait_for_timeout(3000); await pg.screenshot(path='shot_tors_sim.png')
        r['arm']=await pg.evaluate('(()=>{const b=window.__pholver.cur.world.bodies.find(b=>b.name=="arm");return [b.x,b.y,b.a]})()')
        print(json.dumps(r,indent=1)); print('ERRS',errs)
        await b.close()
asyncio.run(main())
