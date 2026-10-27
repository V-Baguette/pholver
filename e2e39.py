import asyncio, json, math
from playwright.async_api import async_playwright
# Regression test for phase A5: E field-line rendering + the "By species" colour toggle (both wired into
# ui_em3d.js's render() via ui_em.js in this phase), a live property-panel readout (gyroradius/period)
# checked against the closed-form cyclotron formulas test_em.js already checks at the engine level, and
# a perf/robustness sanity pass at a larger object budget with both new toggles and the sim running.
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 1440, 'height': 860})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        await pg.goto('file://' + __import__('os').path.dirname(__import__('os').path.abspath(__file__)) + '/pholver.html')
        await pg.wait_for_timeout(600)
        r = {}

        await pg.click('#newTabEm'); await pg.wait_for_timeout(400)

        # 1 E field lines: toggling "E lines" off/on changes what's actually drawn (not just the aria-pressed
        # state) - build a dipole (field lines have somewhere real to go) and diff rendered pixels
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,sc=d.em;sc.items.length=0;
          sc.items.push(EM.create('charge',{x:-1,y:0,z:0,q:2,fixed:true}),EM.create('charge',{x:1,y:0,z:0,q:-2,fixed:true}));
          d.cam={target:{x:0,y:0,z:0},yaw:0,pitch:0.6,dist:6};})()''')
        await pg.wait_for_timeout(300)
        async def sample():
            return await pg.evaluate('''() => {
              const { cw, ch, dpr } = window.__pholver.size; const pts = [];
              for (let fx = 0.1; fx <= 0.9; fx += 0.06) for (let fy = 0.1; fy <= 0.9; fy += 0.06)
                pts.push(window.EM3DGL.samplePixel(Math.floor(cw*dpr*fx), Math.floor(ch*dpr*(1-fy))));
              return pts;
            }''')
        lines_pressed_initially = await pg.get_attribute('#emLines', 'aria-pressed')
        r['lines_pressed_initially'] = lines_pressed_initially
        assert lines_pressed_initially == 'true', r
        with_lines = await sample()
        await pg.click('#emLines'); await pg.wait_for_timeout(250)
        r['lines_pressed_after_toggle'] = await pg.get_attribute('#emLines', 'aria-pressed')
        assert r['lines_pressed_after_toggle'] == 'false', r
        without_lines = await sample()
        diff = sum(1 for a, b2 in zip(with_lines, without_lines) if a != b2)
        r['pixels_changed_by_lines_toggle'] = diff
        assert diff > 0, r
        await pg.click('#emLines'); await pg.wait_for_timeout(100)  # back on, for the rest of the test
        await pg.screenshot(path='shot_em_fieldlines.png')

        # 2 species colouring: two different species (q/m = 1 and q/m = -3) should render as two distinct
        # colours when the toggle is on, not just red/blue-by-sign
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,sc=d.em;sc.items.length=0;
          sc.items.push(EM.create('charge',{x:-1.2,y:0,z:0,q:1,m:1,fixed:true}),EM.create('charge',{x:1.2,y:0,z:0,q:3,m:1,fixed:true}));
          d.cam={target:{x:0,y:0,z:0},yaw:0,pitch:0,dist:6};})()''')
        await pg.click('#emLines'); await pg.wait_for_timeout(100)  # off - isolate the species-colour check from field lines
        await pg.wait_for_timeout(200)
        async def px_at(wx):
            p0 = await pg.evaluate('(a)=>{const d=window.__pholver.cur;const s=window.EM3DGL.worldToScreen(d.cam,{x:a,y:0,z:0});const {dpr}=window.__pholver.size;return [Math.round(s.x*dpr),Math.round(s.y*dpr)]}', wx)
            return await pg.evaluate('(a)=>window.EM3DGL.samplePixel(a[0],a[1])', p0)
        before = [await px_at(-1.2), await px_at(1.2)]
        await pg.click('#emSpecies'); await pg.wait_for_timeout(150)
        after = [await px_at(-1.2), await px_at(1.2)]
        r['species_pixels'] = {'before': before, 'after': after}
        # same sign (both q>0) -> same colour before toggling; different species -> different colour after
        assert before[0][:3] == before[1][:3], r
        assert after[0][:3] != after[1][:3], r
        await pg.click('#emSpecies'); await pg.wait_for_timeout(100)  # back off
        await pg.screenshot(path='shot_em_species.png')

        # 3 live readout vs. closed form: gyroradius/period for a charge in a uniform B, same setup test_em.js
        # checks at the engine level (r = m v / qB, T = 2 pi m / qB), but read from the actual property panel
        await pg.evaluate('''(()=>{const d=window.__pholver.cur,sc=d.em;sc.items.length=0;
          sc.items.push(EM.create('bfield',{x:0,y:0,z:0,w:100,h:100,d:100,B:2}));
          const p=EM.create('charge',{x:0,y:0,z:0,q:1,m:1,vx:3,vy:0,vz:0,fixed:false}); p.name='Gyro test'; sc.items.push(p);
          d.cam=null;})()''')
        await pg.wait_for_timeout(300)
        await pg.keyboard.press('2'); await pg.wait_for_timeout(200)
        await pg.click('#wsList .item:has-text("Gyro test")'); await pg.wait_for_timeout(200)
        r_in = await pg.locator('#propsBody .row:has(label:text("Gyroradius")) input').input_value()
        t_in = await pg.locator('#propsBody .row:has(label:text("Gyro period")) input').input_value()
        r_val, t_val = float(r_in), float(t_in)
        r['live_readout'] = {'r': r_val, 't': t_val}
        expected_r, expected_t = 1 * 3 / (1 * 2), 2 * math.pi * 1 / (1 * 2)
        assert abs(r_val - expected_r) / expected_r < 0.02, r
        assert abs(t_val - expected_t) / expected_t < 0.02, r

        # 4 perf/robustness: a larger object budget (~50 items), both A5 toggles on, sim running
        await pg.keyboard.press('1'); await pg.wait_for_timeout(200)
        counts = await pg.evaluate('''(()=>{const d=window.__pholver.cur,sc=d.em;sc.items.length=0;sc.beam.length=0;
          for (let i=0;i<14;i++) sc.items.push(EM.create('charge',{x:(i%7-3)*1.3,y:Math.floor(i/7)*1.3-2,z:0,q:(i%2?1:-1),m:1,fixed:true}));
          for (let i=0;i<8;i++) sc.items.push(EM.create('wire',{x:-6+i*1.6,y:4,z:0,I:(i%2?4:-4),len:3}));
          for (let i=0;i<6;i++) sc.items.push(EM.create('coil',{x:-6+i*2.2,y:-4,z:0,R:0.8,I:3}));
          for (let i=0;i<4;i++) sc.items.push(EM.create('bfield',{x:6+i*0.1,y:0,z:4+i*2,w:2,h:2,d:2,B:1}));
          for (let i=0;i<4;i++) sc.items.push(EM.create('efield',{x:6+i*0.1,y:0,z:-4-i*2,w:2,h:2,d:2,E:2}));
          for (let i=0;i<3;i++) sc.items.push(EM.create('magnet',{x:0,y:6+i*1.5,z:0,m:2}));
          sc.items.push(EM.create('emitter',{x:-8,y:0,z:0,speed:4,rate:12,q:1,m:1}));
          sc.items.push(EM.create('screen',{x:8,y:0,z:0,w:3,h:3}));
          sc.items.push(EM.create('wall',{x:9,y:0,z:0,w:3,h:3}));
          sc.items.push(EM.create('probe',{x:0,y:0,z:0}));
          d.cam=null; return sc.items.length;})()''')
        r['budget_item_count'] = counts
        assert counts >= 40, r
        await pg.click('#emLines'); await pg.click('#emSpecies'); await pg.wait_for_timeout(50)
        t0 = asyncio.get_event_loop().time()
        await pg.keyboard.press('2')
        await pg.wait_for_timeout(2500)
        wall_elapsed = asyncio.get_event_loop().time() - t0
        sim_t = await pg.evaluate('window.__pholver.cur.em.t')
        r['budget_sim_t'] = sim_t; r['budget_wall_elapsed'] = wall_elapsed
        assert sim_t > 1.0, r  # sim time kept pace with roughly real time -> no catastrophic frame stalls
        await pg.screenshot(path='shot_em_budget.png')

        r['errs'] = errs
        print(json.dumps(r, indent=1))
        assert not errs, errs
        await b.close()

asyncio.run(main())
