import asyncio, json
from playwright.async_api import async_playwright
# Regression test for phase A4: multi-select (box-select, group move, panel, copy/paste/nudge/delete/
# undo/select-all/cut/align/escape/shift-click-toggle) against the 3D interaction layer. Only the
# screen-coordinate helper (now window.EM3DGL.worldToScreen against the per-doc orbit camera, instead
# of the old 2D d.view transform) and the bfield shape name ('sphere', not the pre-A4 'circle') changed;
# the selection/clipboard/arrange logic itself is unchanged from the 2D version (see ui_em.js's boxSelect/
# selItems/arrange, which operate on item objects generically).
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.click('#newTabEm'); await pg.wait_for_timeout(400)
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,sc=d.em;sc.items.length=0;const add=(t,o)=>{const i=EM.create(t,o);i.name=t+' '+i.id;sc.items.push(i);return i};
          add('charge',{x:-3,y:1,q:2,m:1,fixed:true});add('charge',{x:-1,y:1.4,q:-2,m:1,fixed:true});add('charge',{x:1,y:0.6,q:1,m:1,fixed:true});add('bfield',{x:4,y:-2,w:3,shape:'sphere',B:-2});
          d.cam=null;window.__pholver.renderWorkspace();})()''')
        await pg.wait_for_timeout(300)
        box=await pg.locator('#cvEm').bounding_box()
        async def W(x,y,z=0):
            p0 = await pg.evaluate('(a)=>{const d=window.__pholver.cur;return window.EM3DGL.worldToScreen(d.cam,{x:a[0],y:a[1],z:a[2]})}', [x,y,z])
            return box['x']+p0['x'], box['y']+p0['y']
        st=lambda: pg.evaluate('(()=>{const d=window.__pholver.cur;return {n:d.em.items.length,ms:d.ms?[...d.ms].length:0,sel:d.sel,pos:d.em.items.map(i=>[+i.x.toFixed(2),+i.y.toFixed(2)])}})()')
        r={}
        # shift-drag a containment box around the 3 charges' own screen-projected bounds (not a hand-picked
        # world rectangle - with an oblique 3D camera a tiny object's screen AABB can be considerably larger
        # than its flat x/y footprint, since its z-depth also projects into screen space; deriving the box
        # from the real bounds keeps this robust to camera framing instead of guessing a margin that happens
        # to work for one particular yaw/pitch/dist)
        sb = await pg.evaluate('''(()=>{const d=window.__pholver.cur;
          const sbOf=it=>{const b=EM.bounds3(it),xs=[],ys=[];for(const cx of [b.min.x,b.max.x])for(const cy of [b.min.y,b.max.y])for(const cz of [b.min.z,b.max.z]){const s=window.EM3DGL.worldToScreen(d.cam,{x:cx,y:cy,z:cz});xs.push(s.x);ys.push(s.y);}return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];};
          const bs=d.em.items.slice(0,3).map(sbOf);
          return {minx:Math.min(...bs.map(b=>b[0]))-15, miny:Math.min(...bs.map(b=>b[1]))-15, maxx:Math.max(...bs.map(b=>b[2]))+15, maxy:Math.max(...bs.map(b=>b[3]))+15};
        })()''')
        x0,y0 = box['x']+sb['minx'], box['y']+sb['miny']; x1,y1 = box['x']+sb['maxx'], box['y']+sb['maxy']
        await pg.keyboard.down('Shift'); await pg.mouse.move(x0,y0); await pg.mouse.down(); await pg.mouse.move(x1,y1,steps=6); await pg.mouse.up(); await pg.keyboard.up('Shift')
        r['box']=(await st())['ms']
        assert r['box'] == 3, r
        # group move
        X,Y=await W(-1,1.4); tx,ty=await W(-1,2.4); await pg.mouse.move(X,Y); await pg.mouse.down(); await pg.mouse.move(tx,ty,steps=5); await pg.mouse.up()
        r['moved']=(await st())['pos']
        r['panelMulti']=await pg.evaluate('document.body.innerText.includes("3 selected")')
        assert r['panelMulti'], r
        # copy paste
        await pg.keyboard.press('Control+c'); await pg.keyboard.press('Control+v'); r['afterPaste']=await st()
        assert r['afterPaste']['n'] == 7, r
        await pg.keyboard.press('ArrowRight'); r['nudged']=(await st())['pos'][-1]
        await pg.screenshot(path='shot_multi_paste.png')
        # delete selection, undo
        await pg.keyboard.press('Delete'); r['afterDel']=(await st())['n']
        assert r['afterDel'] == 4, r
        await pg.keyboard.press('Control+z'); await pg.wait_for_timeout(200); r['afterUndo']=(await st())['n']
        assert r['afterUndo'] == 7, r
        # select all, cut, paste
        await pg.keyboard.press('Control+a'); r['all']=(await st())['ms']
        assert r['all'] == 7, r
        await pg.keyboard.press('Control+x'); r['afterCut']=(await st())['n']
        assert r['afterCut'] == 0, r
        await pg.keyboard.press('Control+v'); r['afterPasteAll']=(await st())['n']
        assert r['afterPasteAll'] == 7, r
        # align left via panel button
        await pg.click('#propsBody button:has-text("Left")'); r['alignedX']=sorted(set(round(p[0],2) for p in (await st())['pos']))[:3]
        await pg.keyboard.press('Escape'); r['esc']=(await st())['ms']
        assert r['esc'] == 0, r
        # shift-click toggle two items at their current positions (everything above has moved/aligned them
        # away from where they started, same as it did in the pre-A4 2D version of this test). Pick the
        # bfield (index 3, never touched by the left-align since its bounds offset differs from the
        # charges') and the first charge - the 6 charges all share one x after the align and sit close
        # together in y, which an oblique 3D camera can make genuinely ambiguous to pick between.
        pos=(await st())['pos']
        X,Y=await W(*pos[0]); await pg.keyboard.down('Shift'); await pg.mouse.click(X,Y); X,Y=await W(*pos[3]); await pg.mouse.click(X,Y); await pg.keyboard.up('Shift'); r['toggle']=(await st())['ms']
        assert r['toggle'] == 2, r
        r['errs']=errs
        print(json.dumps(r)); assert not errs, errs
        await b.close()
asyncio.run(main())
