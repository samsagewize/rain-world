// E2E test of the Rain Cats mint UI with a mock Phantom provider backed by a throwaway test key.
// Usage: NET=localnet|devnet node mint-e2e.js [siteUrl]
const { chromium, devices } = require('playwright');
const fs = require('fs');
const NET = process.env.NET || 'localnet';
const URL = process.argv[2] || 'http://localhost:8765/';
const RC = '/workspace/rainworld/raincats', OUT = process.env.OUT || '/workspace/rainworld/';
const main = JSON.parse(fs.readFileSync(`${RC}/deploy-${NET}-main.json`)), test = JSON.parse(fs.readFileSync(`${RC}/deploy-${NET}-test.json`));
const sk = n => JSON.parse(fs.readFileSync(`/home/box/.raincats/${n}.json`, 'utf8'));
const RPC = NET === 'localnet' ? 'http://127.0.0.1:8899' : 'https://api.devnet.solana.com';
const cfg = (d, free) => `window.RAINCATS_CONFIG=${JSON.stringify({ version: Date.now(), cluster: NET === 'localnet' ? 'localnet' : 'devnet', explorerCluster: NET === 'localnet' ? 'custom&customUrl=http%3A%2F%2F127.0.0.1%3A8899' : 'devnet', rpc: RPC, das: null, candyMachine: d.candyMachine, candyGuard: d.candyGuard, collection: d.collection, treasury: '4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC', freeWallets: free, price: 0.03, supply: 3699 })};`;
const mock = secret => { window.phantom = { solana: { isPhantom: true, publicKey: null, _sk: secret,
  async connect(o) { if (o && o.onlyIfTrusted && !this._trusted) throw new Error('User rejected'); this._trusted = true; const T = window.RainCats._test; this._kp = this._kp || T.Keypair.fromSecretKey(Uint8Array.from(this._sk)); this.publicKey = this._kp.publicKey; return { publicKey: this.publicKey }; },
  async disconnect() { this.publicKey = null; }, async signTransaction(tx) { tx.sign([this._kp]); return tx; }, async signAllTransactions(txs) { txs.forEach(t => t.sign([this._kp])); return txs; } } }; };
async function ctxFor(browser, opts, d, free, who, useConfig = true) {
  const ctx = await browser.newContext(opts);
  if (useConfig) await ctx.route('**/raincats/config.js', r => r.fulfill({ contentType: 'application/javascript', body: cfg(d, free) }));
  if (who) await ctx.addInitScript(mock, sk(who));
  return ctx;
}
const errs = [];
const hook = (p, tag) => { p.on('console', m => { if (m.type() === 'error') errs.push(tag + ': ' + m.text()); }); p.on('pageerror', e => errs.push(tag + ' pageerror: ' + e.message)); };
const bal = async a => (await (await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [a, { commitment: 'confirmed' }] }) })).json()).result.value;
(async () => {
  const browser = await chromium.launch();
  // ---- desktop public mint with buyer1
  const c1 = await ctxFor(browser, { viewport: { width: 1280, height: 800 } }, main, ['4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC'], 'buyer1');
  const p = await c1.newPage(); hook(p, 'desktop');
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => { rainWorld.open('catmaker'); document.getElementById('toast').classList.add('hidden'); });
  await p.waitForTimeout(500);
  const btns = await p.$$eval('#dlgLinks button.act', b => b.map(x => x.textContent));
  console.log('dialog buttons', JSON.stringify(btns));
  await p.click('#dlgLinks button.act:nth-of-type(2)');
  await p.waitForSelector('#rcPanel:not(.hidden)'); await p.waitForTimeout(1500);
  console.log('count', await p.textContent('#rcCount'), '| button', await p.textContent('#rcMint'));
  await p.screenshot({ path: OUT + 'mint-panel.png' });
  await p.click('#rcConnect'); await p.waitForTimeout(500);
  console.log('wallet', await p.textContent('#rcAddr'), '| button', await p.textContent('#rcMint'));
  const tre0 = await bal('4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC');
  await p.click('#rcMint');
  await p.waitForTimeout(400); await p.screenshot({ path: OUT + 'mint-minting.png' });
  await p.waitForSelector('#rcReveal:not(.hidden)', { timeout: 90000 }).catch(async () => console.log('status', await p.textContent('#rcStatus')));
  const tre1 = await bal('4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC');
  const rev = await p.evaluate(() => RainCats.revealed && { asset: RainCats.revealed.asset, name: RainCats.revealed.name, dna: RainCats.revealed.dna });
  console.log('revealed', JSON.stringify(rev), 'rarity', await p.textContent('#rcRRarity'), '| treasury +SOL', (tre1 - tre0) / 1e9, '| status', await p.textContent('#rcStatus'));
  console.log('count after', await p.textContent('#rcCount'));
  await p.waitForTimeout(600); await p.screenshot({ path: OUT + 'mint-reveal.png' });
  await p.click('#rcPlay'); await p.waitForTimeout(400);
  console.log('playing as minted cat', await p.isVisible('#btnMe'), await p.evaluate(() => localStorage.getItem('rainworld.me')));
  await p.evaluate(() => { rainWorld.player.x = 800; rainWorld.player.y = 720; document.getElementById('toast').classList.add('hidden'); }); await p.waitForTimeout(800);
  await p.screenshot({ path: OUT + 'mint-walking.png' });
  // My Rain Cats
  await p.evaluate(() => rainWorld.world.rcOpen('mine'));
  await p.waitForFunction(() => document.querySelectorAll('#rcMineList .rcCard[data-dna]').length > 0, null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(800);
  console.log('my cats', await p.$$eval('#rcMineList .rcCard', c => c.length), '|', await p.textContent('#rcMineNote'));
  await p.screenshot({ path: OUT + 'mint-mycats.png' });
  await p.click('#rcMineList .rcCard[data-dna] .rcActs button.alt');
  await p.waitForTimeout(400);
  console.log('roaming', await p.evaluate(() => localStorage.getItem('rainworld.cats')));
  // not allow-listed: free group must be refused (button shows paid mint)
  // ---- free test mint: buyer2 on the allowlist test CM
  const c2 = await ctxFor(browser, { viewport: { width: 1280, height: 800 } }, test, [JSON.parse(fs.readFileSync(`${RC}/deploy-${NET}-test.json`)).allowList[0]], 'buyer2');
  const q = await c2.newPage(); hook(q, 'free');
  await q.goto(URL + '?mint', { waitUntil: 'networkidle' }); await q.waitForSelector('#rcPanel:not(.hidden)');
  await q.click('#rcConnect'); await q.waitForTimeout(400);
  console.log('free button', await q.textContent('#rcMint'));
  const t0 = await bal('4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC');
  await q.click('#rcMint');
  await q.waitForSelector('#rcReveal:not(.hidden)', { timeout: 90000 }).catch(async () => console.log('free status', await q.textContent('#rcStatus')));
  console.log('free revealed', await q.evaluate(() => RainCats.revealed && RainCats.revealed.name), '| treasury change', ((await bal('4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC')) - t0) / 1e9);
  await q.screenshot({ path: OUT + 'mint-free.png' });
  // ---- iPhone without Phantom: should offer "Open in Phantom"
  const c3 = await ctxFor(browser, { ...devices['iPhone 13'] }, main, [], null);
  const m = await c3.newPage(); hook(m, 'iphone');
  await m.goto(URL + '?mint', { waitUntil: 'networkidle' }); await m.waitForSelector('#rcPanel:not(.hidden)'); await m.waitForTimeout(1500);
  console.log('iphone no wallet:', await m.textContent('#rcConnect'), '|', await m.textContent('#rcAddr'));
  await m.screenshot({ path: OUT + 'mint-iphone.png' });
  // ---- iPhone inside Phantom's in-app browser (provider injected)
  const c4 = await ctxFor(browser, { ...devices['iPhone 13'] }, main, [], 'buyer1');
  const m2 = await c4.newPage(); hook(m2, 'iphone-phantom');
  await m2.goto(URL + '?mint', { waitUntil: 'networkidle' }); await m2.waitForSelector('#rcPanel:not(.hidden)');
  await m2.tap('#rcConnect'); await m2.waitForTimeout(400); await m2.tap('#rcMint');
  await m2.waitForSelector('#rcReveal:not(.hidden)', { timeout: 90000 }).catch(async () => console.log('iphone status', await m2.textContent('#rcStatus')));
  await m2.waitForTimeout(500);
  console.log('iphone revealed', await m2.evaluate(() => RainCats.revealed && RainCats.revealed.name));
  await m2.screenshot({ path: OUT + 'mint-iphone-reveal.png' });
  console.log('errors', JSON.stringify(errs));
  await browser.close();
})();
