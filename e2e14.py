import asyncio, json
from playwright.async_api import async_playwright
# Regression test for phase A4: one of every E&M region/source type together, selection, property-panel
# edits (replacing the pre-A4 draggable resize/rotate handles - A4 scope note drops those in favour of
# numeric fields, see mutable-discovering-kahn.md Part A.4), the Rotate-Z ']'/'[' shortcut, duplicate/
# copy-paste, sim with trails, and delete. Field names/shapes match the 3D em.js DEF table (dirAz/dirEl,
# shape 'box'/'sphere', rot quaternion) rather than the old 2D dir/angle/rot-degrees/shape-'circle' ones.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={'width':1440,'height':860}); pg = await ctx.new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_TUNNEL' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.abspath(__file__))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.click('#newTabEm'); await pg.wait_for_timeout(400)
        r={}
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,sc=d.em;const rotz=deg=>EM3D.Quat.fromAxisAngle(EM3D.Quat.create(),{x:0,y:0,z:1},deg*Math.PI/180);
          const add=(t,o)=>{const i=EM.create(t,o);i.name=t+' '+i.id;sc.items.push(i);return i};
          add('capacitor',{x:-4,y:2,w:3,gap:1.5,V:6,rot:rotz(20)});add('efield',{x:2,y:2,w:3,h:2,E:3,dirAz:30});add('bfield',{x:-1,y:-2.5,w:3,shape:'sphere',B:-2});
          add('wire',{x:4,y:-2,len:4,I:6,rot:rotz(35)});add('coil',{x:-5,y:-2.5,R:1.1,I:-4,turns:2});add('emitter',{x:-6,y:0,speed:3,rate:5,col:'#8a5cd0'});
          add('magnet',{x:6,y:2,m:2});add('screen',{x:6,y:-2,w:2,h:2});add('wall',{x:0,y:3.5,w:2,h:1});
          add('charge',{x:0.5,y:0.5,q:3,fixed:true});add('charge',{x:1.5,y:-0.5,q:-2,fixed:true});add('charge',{x:-2,y:0.2,q:1,m:1,vx:1,vy:0.5,fixed:false});
          d.cam=null;window.__pholver.renderWorkspace();})()''')
        await pg.wait_for_timeout(500)
        await pg.screenshot(path='shot_em_all_design.png')
        r['item_count']=await pg.evaluate('window.__pholver.cur.em.items.length')
        assert r['item_count'] == 12, r
        # coil radius via the property panel
        await pg.click('#wsList .item:has-text("coil")'); await pg.wait_for_timeout(150)
        radiusField = pg.locator('#propsBody .row:has(label:text-is("Radius")) input')
        await radiusField.fill('1.6'); await radiusField.press('Tab'); await pg.wait_for_timeout(100)
        r['coilR']=await pg.evaluate('window.__pholver.cur.em.items.find(i=>i.type=="coil").R')
        assert abs(r['coilR']-1.6) < 1e-6, r
        # wire length via the property panel
        await pg.click('#wsList .item:has-text("wire")'); await pg.wait_for_timeout(150)
        lenField = pg.locator('#propsBody .row:has(label:text-is("Length")) input')
        await lenField.fill('6'); await lenField.press('Tab'); await pg.wait_for_timeout(100)
        r['wireLen']=await pg.evaluate('window.__pholver.cur.em.items.find(i=>i.type=="wire").len')
        assert abs(r['wireLen']-6) < 1e-6, r
        # capacitor Rotate-Z field
        await pg.click('#wsList .item:has-text("capacitor")'); await pg.wait_for_timeout(150)
        rotField = pg.locator('#propsBody .row:has(label:text-is("Rotate Z")) input')
        await rotField.fill('70'); await rotField.press('Tab'); await pg.wait_for_timeout(100)
        r['cap_rotz']=await pg.evaluate('(()=>{const c=window.__pholver.cur.em.items.find(i=>i.type=="capacitor");return EM3D.Quat.toEuler(c.rot).z})()')
        assert abs(r['cap_rotz']-70) < 1e-3, r
        # rotate via ] key (turn() rotates the z-euler of the selected item's quaternion)
        await pg.click('#wsList .item:has-text("efield")'); await pg.wait_for_timeout(150)
        z0=await pg.evaluate('(()=>{const e=window.__pholver.cur.em.items.find(i=>i.type=="efield");return EM3D.Quat.toEuler(e.rot).z})()')
        await pg.keyboard.press(']'); await pg.wait_for_timeout(100)
        z1=await pg.evaluate('(()=>{const e=window.__pholver.cur.em.items.find(i=>i.type=="efield");return EM3D.Quat.toEuler(e.rot).z})()')
        r['efield_rotz']=[z0,z1]
        assert abs((z1-z0)+15) < 1e-3 or abs((z1-z0)-345) < 1e-3, r
        await pg.screenshot(path='shot_em_all_selected.png')
        # duplicate & copy paste
        n=await pg.evaluate('window.__pholver.cur.em.items.length'); await pg.click('#dupBtn'); await pg.wait_for_timeout(200)
        r['dup']=(await pg.evaluate('window.__pholver.cur.em.items.length'))-n
        assert r['dup'] == 1, r
        await pg.keyboard.press('Control+c'); await pg.keyboard.press('Control+v'); await pg.wait_for_timeout(200)
        r['paste']=(await pg.evaluate('window.__pholver.cur.em.items.length'))-n
        assert r['paste'] == 2, r
        # simulate
        await pg.keyboard.press('2'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path='shot_em_all_sim.png')
        r['sim_status']=await pg.inner_text('#status')
        assert 'Running' in r['sim_status'] or 'Paused' in r['sim_status'], r
        # delete via key in design
        await pg.keyboard.press('1'); await pg.wait_for_timeout(300)
        await pg.click('#wsList .item:has-text("coil")'); await pg.keyboard.press('Delete')
        r['after_delete']=(await pg.evaluate('window.__pholver.cur.em.items.length'))
        r['errs']=errs
        print(json.dumps(r,indent=1))
        assert not errs, errs
        await b.close()
asyncio.run(main())
