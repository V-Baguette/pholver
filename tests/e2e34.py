import asyncio, json
from playwright.async_api import async_playwright
JS='''(()=>{const d=window.__pholver.cur;d.mode==='design'||window.__pholver.setMode('design');const K=CKT,sc=K.createScene();d.ck=sc;const P=(t,x,y,rot,o)=>{const it=K.create(t,Object.assign({x,y,rot},o||{}));sc.items.push(it);return it};
const wr=(a,b)=>sc.items.push(K.wire(a[0],a[1],b[0],b[1]));
// battery(+ at b) at x=0, vertical rot1: a at (0,0) b at (0,3)
const v=P('vsrc',0,0,1); const r=P('res',0,3,0,{R:330}); const l=P('led',3,3,0,{col:'green'}); const g=P('gnd',0,-3,0);
const T=t=>K.terminals(t).map(q=>[q.x,q.y]);
const tv=T(v),tr=T(r),tl=T(l),tg=T(g);
wr(tv[1],tr[0]); wr(tr[1],tl[0]); wr(tl[1],[tl[1][0],tv[0][1]-3]); wr(tv[0],[tv[0][0],tv[0][1]-3]); wr(tg[0],[tv[0][0],tv[0][1]-3]); wr([tv[0][0],tv[0][1]-3],[tl[1][0],tv[0][1]-3]);
d.sel=null;d.view=null;window.__pholver.renderWorkspace();return {tv,tr,tl,tg}})()'''
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await (await b.new_context(viewport={'width':1440,'height':860})).new_page()
        errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'ERR_' not in m.text and 'fonts.g' not in m.text else None)
        await pg.goto('file://'+__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))+'/pholver.html'); await pg.wait_for_timeout(700)
        await pg.click('#newTabCkt'); await pg.wait_for_timeout(500)
        print(await pg.evaluate(JS)); await pg.wait_for_timeout(300)
        await pg.evaluate("window.__pholver.setMode('simulate')"); await pg.evaluate("(()=>{const d=window.__pholver.cur;CKT.init(d.ck);for(let k=0;k<30;k++)window.__pholver.stepCkt?window.__pholver.stepCkt(d):CKT.advance(d.ck,1e-3);})()"); await pg.wait_for_timeout(500)
        r=await pg.evaluate('''(()=>{const d=window.__pholver.cur;const o={};d.ck.items.filter(i=>i.type!=='wire'&&i.type!=='gnd').forEach(i=>{o[i.type]={v:i._v,i:i._i}});o.err=d.ck.err;return o})()''')
        print(r)
        # select every part type + props panel + field panel
        for t in ['led','diode','zener','npn','pnp','nmos','pmos','opamp']:
            ok=await pg.evaluate('''(t)=>{const d=window.__pholver.cur;const it=CKT.create(t,{x:12,y:12});d.ck.items.push(it);d.sel=it.id;d.ms=new Set([it.id]);window.__pholver.renderProps();window.__pholver.refreshFields(true);window.__pholver.renderWorkspace();return document.querySelector('#props').innerText.length}''',t)
            print(t,ok)
        await pg.wait_for_timeout(500)
        await pg.screenshot(path='/tmp/e2e34.png')
        print('ERR',errs)
        assert r['led']['i']>0.005 and r['led']['i']<0.012, r['led']
        assert not errs
        await b.close()
asyncio.run(main())
