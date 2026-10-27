import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.click('#newTabCkt'); await pg.wait_for_timeout(500)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur;d.mode==='design'||window.__pholver.setMode('design');d.ck=CKT.createScene();CKT.demoScene(d.ck);d.ck.items.forEach(i=>{if(i.type!=='wire'&&!i.name)i.name=i.type});d.sel=null;d.view=null;window.__pholver.renderWorkspace();})()''')
        await pg.wait_for_timeout(300)
        box=await pg.locator('#cv').bounding_box()
        async def W(x,y):
            v=await pg.evaluate('(()=>{const v=window.__pholver.cur.view;return [v.ox,v.oy,v.s]})()'); return box['x']+v[0]+x*v[2], box['y']+v[1]-y*v[2]
        st=lambda: pg.evaluate('(()=>{const d=window.__pholver.cur;return {n:d.ck.items.length,parts:d.ck.items.filter(i=>i.type!="wire").length,ms:d.ms?[...d.ms].length:0,sel:d.sel}})()')
        r={}; r['start']=await st()
        bounds=await pg.evaluate('(()=>{const b=CKT.bounds(window.__pholver.cur.ck);return b})()'); r['bounds']=bounds
        # box select everything: right-to-left crossing from beyond bottom-right
        x0,y0=await W(bounds[2]+1,bounds[1]-1); x1,y1=await W(bounds[0]+4,bounds[3]+1)
        await pg.keyboard.down('Shift'); await pg.mouse.move(x0,y0); await pg.mouse.down(); await pg.mouse.move(x1,y1,steps=6); await pg.mouse.up(); await pg.keyboard.up('Shift')
        r['boxed']=await st()
        pos0=await pg.evaluate('(()=>{const d=window.__pholver.cur;return d.ck.items.filter(i=>i.type!="wire").map(i=>[i.x,i.y,i.rot])})()')
        # drag one selected part to move group by (+2,-1)
                # use terminal midpoint
        tm=await pg.evaluate('(()=>{const d=window.__pholver.cur;const i=d.ck.items.find(i=>i.type=="cap");const t=CKT.terminals(i);return [(t[0].x+t[1].x)/2,(t[0].y+t[1].y)/2]})()')
        X,Y=await W(*tm); tx,ty=await W(tm[0]+2,tm[1]-1)
        await pg.mouse.move(X,Y); await pg.mouse.down(); await pg.mouse.move(tx,ty,steps=6); await pg.mouse.up()
        pos1=await pg.evaluate('(()=>{const d=window.__pholver.cur;return d.ck.items.filter(i=>i.type!="wire").map(i=>[i.x,i.y,i.rot])})()')
        r['groupDelta']=[ [a[0]-b_[0],a[1]-b_[1]] for a,b_ in zip(pos1,pos0)][:3]
        # connectivity preserved: compile and check no error
        r['err']=await pg.evaluate('(()=>{const d=window.__pholver.cur;CKT.init(d.ck);return d.ck.err||""})()')
        # rotate group, then undo count; flip
        await pg.keyboard.press('r'); pos2=await pg.evaluate('(()=>{const d=window.__pholver.cur;return d.ck.items.filter(i=>i.type!="wire").map(i=>[i.x,i.y,i.rot])})()'); r['rotRots']=[p_[2] for p_ in pos2][:5]
        r['errAfterRot']=await pg.evaluate('(()=>{const d=window.__pholver.cur;CKT.init(d.ck);return d.ck.err||""})()')
        await pg.keyboard.press('f'); r['errAfterFlip']=await pg.evaluate('(()=>{const d=window.__pholver.cur;CKT.init(d.ck);return d.ck.err||""})()')
        await pg.screenshot(path='shot_ck_multi.png')
        # copy/paste whole circuit
        await pg.keyboard.press('Control+c'); await pg.keyboard.press('Control+v'); r['afterPaste']=await st()
        # nudge
        await pg.keyboard.press('ArrowRight'); 
        # delete pasted
        await pg.keyboard.press('Delete'); r['afterDel']=await st()
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200); r['afterUndo']=await st()
        # wire handle drag: select a wire
        await pg.keyboard.press('Escape')
        w=await pg.evaluate('(()=>{const d=window.__pholver.cur;const w=d.ck.items.find(i=>i.type=="wire"&&i.y1===i.y2&&i.x1!==i.x2);return [w.id,w.x1,w.y1,w.x2,w.y2]})()')
        mx,my=await W((w[1]+w[3])/2,w[2]); await pg.mouse.click(mx,my); r['wireSel']=(await st())['sel']==w[0]
        hx,hy=await W(w[3],w[4]); tx,ty=await W(w[3]+1,w[4]+1); await pg.mouse.move(hx,hy); await pg.mouse.down(); await pg.mouse.move(tx,ty,steps=5); await pg.mouse.up()
        r['wireEnd']=await pg.evaluate('(id=>{const w=window.__pholver.cur.ck.items.find(i=>i.id===id);return [w.x1,w.y1,w.x2,w.y2]})(%d)'%w[0]); r['wireBefore']=w[1:]
        # double click run
        nx_,ny_=await W(11.5,10.5); await pg.mouse.dblclick(nx_,ny_); r['run']=(await st())['ms']
        print(json.dumps(r)); print(errs); await b.close()
asyncio.run(main())
