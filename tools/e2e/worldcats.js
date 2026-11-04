// Read-only e2e: two buildings, wallet -> cat picker -> walk as your cat. Phantom is a watch-only mock that refuses to sign.
const pw = require('playwright');
const BASE = process.env.BASE || 'http://localhost:8765';
const LIVE = !!process.env.LIVE; // LIVE=1: use the real Rooms API instead of the fixture
const CH = '4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC', EMPTY = '11111111111111111111111111111112';
const fx = require('./fixture-owned-christian.json');
const OUT = process.env.OUT || '/workspace/rainworld/';
const mock = pk => { const key = { toString: () => pk, toBase58: () => pk }; window.__signs = 0;
  window.phantom = { solana: { isPhantom: true, publicKey: null, _l: {},
    on(ev, f) { this._l[ev] = f; },
    async connect(o) { if (o && o.onlyIfTrusted && !localStorage.getItem('trusted')) throw new Error('User rejected'); localStorage.setItem('trusted', 1); this.publicKey = key; return { publicKey: key }; },
    async disconnect() { this.publicKey = null; localStorage.removeItem('trusted'); },
    async signTransaction() { window.__signs++; throw new Error('User rejected the request.'); },
    async signAllTransactions() { window.__signs++; throw new Error('User rejected the request.'); },
    async signMessage() { window.__signs++; throw new Error('User rejected the request.'); },
    async signAndSendTransaction() { window.__signs++; throw new Error('User rejected the request.'); } } }; };
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function ctxFor(b, opts, pk, owned) {
  const ctx = await b.newContext(opts); if (pk) await ctx.addInitScript(mock, pk);
  await ctx.route('**/api/raincats/owned**', r => { const w = new URL(r.request().url()).searchParams.get('wallet');
    const o = w === CH && owned ? owned() : null;
    if (LIVE && !o) return r.continue(); // live: real Rooms API unless a test overrides the answer
    const body = o || (w === CH ? fx : { wallet: w, verified: false, cats: [] });
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) }); });
  await ctx.route('https://phantom.app/**', r => r.fulfill({ status: 200, body: 'phantom' }));
  return ctx;
}
async function page(ctx, url) { const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(e.stack)); p.on('console', m => { if (m.type() === 'error') p.errs.push(m.text()); });
  await p.goto(BASE + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(600); return p; }
const hideToast = p => p.evaluate(() => { const t = document.getElementById('toast'); if (t) t.classList.add('hidden'); });
(async () => {
  const chromium = await pw.chromium.launch(); let webkit = chromium; try { webkit = await pw.webkit.launch(); } catch (e) { console.log('NOTE WebKit unavailable on this box (missing system libs); iPhone runs use Chromium with iPhone 13 emulation'); }
  const desk = { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 };
  const { defaultBrowserType: _d, ...iphone } = pw.devices['iPhone 13'];
  const phantomUA = { ...iphone, userAgent: iphone.userAgent + ' Phantom/ios' };
  // 1. Only two buildings (desktop, no wallet)
  { const ctx = await ctxFor(chromium, desk); const p = await page(ctx, '/');
    const ids = await p.evaluate(() => rainWorld.targets.map(t => t.id));
    ok(JSON.stringify(ids) === '["rooms","mint"]', 'only Rooms + Mint targets: ' + ids);
    ok(!(await p.$('#catmaker')) && !(await p.$('#btnMe')), 'Cat Maker gone');
    ok(/CONNECT WALLET/.test(await p.textContent('#btnWallet')), 'HUD connect button');
    await hideToast(p); await p.evaluate(() => { rainWorld.player.y = 22 * 16 + 4; rainWorld.player.dir = 'up'; }); await p.waitForTimeout(500); await p.screenshot({ path: OUT + 'world-two-buildings.png' });
    await p.evaluate(() => { rainWorld.player.y = 26 * 16 + 4; });
    // Mint building dialog
    await p.evaluate(() => rainWorld.open('mint')); await p.keyboard.press('e'); await p.waitForTimeout(300);
    const links = await p.$$eval('#dlgLinks a, #dlgLinks button', a => a.map(x => x.textContent));
    ok(links.some(l => /Mint a mystery cat/.test(l)) && links.some(l => /Walk as my cat/.test(l)) && links.some(l => /Verified/.test(l)), 'Mint dialog links: ' + links.join(' | '));
    await p.evaluate(() => rainWorld.open('rooms')); await p.keyboard.press('Escape'); await p.keyboard.press('e'); await p.waitForTimeout(300);
    const rl = await p.$$eval('#dlgLinks a', a => a.map(x => x.href));
    ok(rl.some(h => /intherooms\.xyz/.test(h)), 'Rooms HQ links to intherooms.xyz');
    ok(!p.errs.length, 'no console errors (desktop world) ' + p.errs.join(';')); await ctx.close(); }
  // 2. Desktop: connect -> picker -> walk as #0373, persist, re-verify, fallback
  { let owned = null; const ctx = await ctxFor(chromium, desk, CH, () => owned); const p = await page(ctx, '/');
    await p.click('#btnWallet'); await p.waitForSelector('.pkCard', { timeout: 30000 });
    const card = await p.$eval('.pkCard', c => c.innerText.replace(/\n/g, ' '));
    ok(/#0373/.test(card) && /RARE/.test(card), 'picker shows ' + card);
    await p.waitForFunction(() => [...document.querySelectorAll('.pkCard img')].every(i => i.complete), null, { timeout: 15000 }).catch(() => {});
    await p.waitForTimeout(400); await p.screenshot({ path: OUT + 'cat-picker.png' });
    await p.click('.pkCard button'); await p.waitForTimeout(300);
    const st = await p.evaluate(w => ({ cat: rainWorld.world.cat && rainWorld.world.cat.asset, look: !!rainWorld.world.look, saved: localStorage.getItem('rainworld.cat.' + w), btn: document.getElementById('btnWallet').textContent }), CH);
    ok(st.cat === fx.cats[0].asset && st.look && st.saved && st.saved.includes(fx.cats[0].asset), 'walking as chosen cat, saved per wallet');
    ok(/#0373/.test(st.btn), 'HUD shows ' + st.btn);
    await hideToast(p); const x0 = await p.evaluate(() => { rainWorld.player.x = 28 * 16; rainWorld.player.y = 22 * 16 + 4; return rainWorld.player.x; });
    await p.keyboard.down('ArrowRight'); await p.waitForTimeout(900);
    await p.screenshot({ path: OUT + 'my-cat-walking.png' }); await p.keyboard.up('ArrowRight');
    ok((await p.evaluate(() => rainWorld.player.x)) > x0, 'cat walks');
    // reload: trusted reconnect + ownership re-verified
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    ok(await p.evaluate(() => !!(rainWorld.world.cat && rainWorld.world.look)), 'reload restores cat after re-verifying');
    // ownership gone -> Rain
    owned = { wallet: CH, verified: false, cats: [] };
    await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
    const g = await p.evaluate(w => ({ cat: rainWorld.world.cat, look: rainWorld.world.look, saved: localStorage.getItem('rainworld.cat.' + w), toast: document.getElementById('toast').textContent }), CH);
    ok(!g.cat && !g.look && !g.saved && /no longer/.test(g.toast), 'not owned anymore -> back to Rain');
    // no cats -> Mint button
    await p.click('#btnWallet'); await p.waitForSelector('#pkActs button.go', { timeout: 15000 });
    ok(/No Rain Cats|no Rain Cats/i.test(await p.textContent('#picker')), 'empty wallet message');
    await p.click('#pkActs button.go'); await p.waitForTimeout(400);
    ok(await p.evaluate(() => { const t = rainWorld.targets.find(t => t.id === 'mint'); return Math.hypot(rainWorld.player.x - t.x, rainWorld.player.y - t.y) < 40 && document.getElementById('picker').classList.contains('hidden'); }), 'Go to the Mint building works');
    owned = { ...fx, verified: true };
    await p.evaluate(() => rainWorld.world.roomsInfo && 0); await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(800);
    await p.click('#btnWallet'); await p.waitForSelector('.pkCard'); ok(!!(await p.$('#pkActs a.verified')), 'verified member gets claim link in picker');
    ok((await p.evaluate(() => window.__signs)) === 0, 'nothing signed');
    ok(!p.errs.length, 'no console errors (desktop wallet) ' + p.errs.join(';')); await ctx.close(); }
  // 3. ?mint deep link (+ verified claim button in mint panel), ?cat= legacy link
  { const ctx = await ctxFor(chromium, desk, CH, () => LIVE ? null : ({ ...fx, verified: true })); const p = await page(ctx, '/?mint');
    await p.waitForSelector('#rcPanel:not(.hidden)', { timeout: 20000 });
    ok(true, '?mint opens the mint panel'); await p.click('#rcConnect').catch(() => {});
    await p.waitForSelector('#rcVerified:not(.hidden)', { timeout: 20000 }).then(() => ok(true, 'mint panel shows Verified claim link'), () => ok(false, 'mint panel verified link'));
    ok((await p.evaluate(() => window.__signs)) === 0, 'nothing signed (mint panel)');
    ok(!p.errs.length, 'no console errors (?mint) ' + p.errs.join(';'));
    const code = fx.cats[0].dna; const q = await page(ctx, '/?cat=' + code);
    ok(await q.evaluate(() => !!rainWorld.world.look && !document.getElementById('catmaker')), '?cat= link: visit as that cat for the session');
    ok(!q.errs.length, 'no console errors (?cat=) ' + q.errs.join(';')); await ctx.close(); }
  // 4. iPhone Safari (WebKit, no Phantom) -> Open in Phantom deep link
  { const ctx = await ctxFor(webkit, iphone); const p = await page(ctx, '/');
    ok(/OPEN IN PHANTOM/.test(await p.textContent('#btnWallet')), 'iPhone Safari: OPEN IN PHANTOM');
    const fit = await p.evaluate(() => { const r = document.getElementById('buttons').getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0; });
    ok(fit, 'HUD fits on iPhone');
    await p.click('#btnWallet'); await p.waitForTimeout(300);
    if (await p.isVisible('#picker')) await p.click('#pkConnect');
    await p.waitForURL(/phantom\.app\/ul\/browse/, { timeout: 8000 }).then(() => ok(true, 'deep link ' + p.url().slice(0, 80)), () => ok(false, 'deep link not opened ' + p.url()));
    ok(!p.errs.length, 'no console errors (iPhone Safari) ' + p.errs.join(';')); await ctx.close(); }
  // 5. Phantom in-app browser (WebKit + injected provider)
  { const ctx = await ctxFor(webkit, phantomUA, CH); const p = await page(ctx, '/');
    await p.tap('#btnWallet'); await p.waitForSelector('.pkCard', { timeout: 30000 });
    await p.tap('.pkCard button'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => !!rainWorld.world.look), 'Phantom in-app: walking as cat');
    const t = await p.evaluate(() => rainWorld.targets.map(t => ({ id: t.id, d: Math.round(Math.hypot(t.x - rainWorld.player.x, t.y - rainWorld.player.y)) })));
    ok(t.every(x => x.d < 260), 'both doors close to spawn ' + JSON.stringify(t));
    await p.screenshot({ path: OUT + 'my-cat-walking-iphone.png' });
    ok((await p.evaluate(() => window.__signs)) === 0, 'nothing signed (in-app)');
    ok(!p.errs.length, 'no console errors (Phantom in-app) ' + p.errs.join(';')); await ctx.close(); }
  if (webkit !== chromium) await webkit.close(); await chromium.close();
  console.log(fails ? fails + ' FAILED' : 'ALL PASSED'); process.exit(fails ? 1 : 0);
})();
