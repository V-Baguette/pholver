import asyncio, json
from playwright.async_api import async_playwright
# Regression test for phase A4/A2: the four E&M types that only exist in the 3D engine (magnet, screen,
# wall, probe) - placement via the Add tray, their property panels, the magnet's dipole field formula,
# and the screen/wall plane-crossing behaviour (detect-and-record vs. remove) added to EM.step in A2.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.click('#newTabEm'); await pg.wait_for_timeout(400)
        r={}
        # 1 place all four via the Add tray/tool (exercises TOOLS/make()/the tray UI, not just EM.create)
        await pg.evaluate("(()=>{window.__pholver.cur.em.items.length=0})()")
        async def place(tool, x, y):
            await pg.click('#emAdd'); await pg.click('#emTray [data-t=%s]'%tool); await pg.wait_for_timeout(100)
            await pg.evaluate('''(a)=>{const d=window.__pholver.cur,w=a[0],wy=a[1];const q=window.EM3DGL.worldToScreen(d.cam,{x:w,y:wy,z:0});
              const el=document.querySelector("#cvEm"),r=el.getBoundingClientRect();window.__lastClickXY=[r.x+q.x,r.y+q.y];}''', [x,y])
            xy = await pg.evaluate("window.__lastClickXY")
            await pg.mouse.click(xy[0], xy[1]); await pg.wait_for_timeout(100)
        await place('magnet', -4, 3); await place('screen', -2, 3); await place('wall', 0, 3); await place('probeobj', 2, 3)
        types = await pg.evaluate("window.__pholver.cur.em.items.map(i=>i.type)")
        r['placed_types'] = types
        assert sorted(types) == ['magnet','probe','screen','wall'], r
        # 2 property panels: each type's distinctive section/field text
        async def panel_has(name, *snippets):
            await pg.click('#wsList .item:has-text("%s")'%name); await pg.wait_for_timeout(100)
            txt = await pg.eval_on_selector('#propsBody', 'el => el.textContent')
            for s in snippets: assert s in txt, (name, s, txt)
        await panel_has('magnet', 'Dipole', 'Moment m')
        await panel_has('screen', 'Detector', 'Hits recorded')
        await panel_has('wall', 'Absorber', 'Width')
        await panel_has('probe', 'Field probe', '|E| here', '|B| here')
        await pg.screenshot(path='shot_em_newtypes_panels.png')
        # 3 magnet dipole field formula: B = km*m*(3(m.r)r - m)/r^3; perpendicular to the moment (local +z)
        # this reduces to |B| = km*m/r^3 pointing along -z
        out = await pg.evaluate('''(()=>{const d=window.__pholver.cur,sc=d.em;sc.items.length=0;
          sc.items.push(EM.create('magnet',{x:0,y:0,z:0,m:1}));
          return EM.sample(sc,{x:2,y:0,z:0});})()''')
        r['magnet_B'] = [out['Bx'], out['By'], out['Bz']]
        expected_bz = -1/8  # km=1, m=1, r=2 -> km*m/r^3
        assert abs(out['Bx']) < 1e-3 and abs(out['By']) < 1e-3 and abs(out['Bz'] - expected_bz) < 1e-3, r
        # 4 screen: a particle crossing it stops, freezes and is recorded in _hits (not removed from the beam)
        hit_out = await pg.evaluate('''(()=>{const d=window.__pholver.cur,sc=d.em;sc.items.length=0;sc.beam.length=0;
          const sc2=EM.create('screen',{x:0,y:0,z:0,w:2,h:2}); sc2.rot=EM3D.Quat.fromEuler(EM3D.Quat.create(),0,90,0); sc.items.push(sc2);
          sc.beam.push({x:-1,y:0,z:0,vx:5,vy:0,vz:0,q:1,m:1,age:0,beam:true,act:true});
          for(let i=0;i<100;i++) EM.step(sc, EM.DT);
          return {hits: sc2._hits, beamLen: sc.beam.length, held: sc.beam[0] && sc.beam[0]._held};})()''')
        r['screen'] = hit_out
        assert hit_out['beamLen'] == 1 and hit_out['held'] is True and len(hit_out['hits']) == 1 and abs(hit_out['hits'][0]['x']) < 1e-2, r
        # 5 wall: a particle crossing it is removed from the beam entirely
        wall_out = await pg.evaluate('''(()=>{const d=window.__pholver.cur,sc=d.em;sc.items.length=0;sc.beam.length=0;
          const w=EM.create('wall',{x:0,y:0,z:0,w:2,h:2}); w.rot=EM3D.Quat.fromEuler(EM3D.Quat.create(),0,90,0); sc.items.push(w);
          sc.beam.push({x:-1,y:0,z:0,vx:5,vy:0,vz:0,q:1,m:1,age:0,beam:true,act:true});
          for(let i=0;i<2000;i++) EM.step(sc, EM.DT);
          return {beamLen: sc.beam.length};})()''')
        r['wall'] = wall_out
        assert wall_out['beamLen'] == 0, r
        r['errs']=errs
        print(json.dumps(r,indent=1))
        assert not errs, errs
        await b.close()
asyncio.run(main())
