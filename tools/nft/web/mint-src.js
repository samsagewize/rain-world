// Rain Cats mint + My Cats for Rain's World. Bundled with esbuild into site/raincats/mint.js.
import { Buffer } from 'buffer';
if (!globalThis.Buffer) globalThis.Buffer = Buffer;
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import { generateSigner, publicKey, some, transactionBuilder } from '@metaplex-foundation/umi';
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters';
import { mplCore, fetchAsset, fetchAssetsByOwner } from '@metaplex-foundation/mpl-core';
import { mplCandyMachine, mintV1, route, fetchCandyMachine, safeFetchAllowListProofFromSeeds, safeFetchMintCounterFromSeeds, getMerkleRoot, getMerkleProof } from '@metaplex-foundation/mpl-core-candy-machine';
import { setComputeUnitLimit } from '@metaplex-foundation/mpl-toolbox';
import { Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';

const CFG = window.RAINCATS_CONFIG || {};
const W = () => window.rainWorld && window.rainWorld.world;
const $ = id => document.getElementById(id);
const short = a => a.slice(0, 4) + '\u2026' + a.slice(-4);
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const provider = () => (window.phantom && window.phantom.solana && window.phantom.solana.isPhantom ? window.phantom.solana : (window.solana && window.solana.isPhantom ? window.solana : null));
const ready = () => !!(CFG.candyMachine && CFG.collection);
const isMain = () => /^mainnet/.test(String(CFG.cluster || ''));
const FREE_LIMIT_ID = CFG.freeMintLimitId || 1, FREE_LIMIT = CFG.freeMintLimit || 1;
let freeUsed = null; // free mints already used by the connected allowlisted wallet (null = unknown)
let umi = null, wallet = null, tab = 'mint', busy = false, revealed = null, boxT = 0, boxTimer = null, mode = 'idle';

function makeUmi() {
  const u = createUmi(CFG.rpc, 'confirmed').use(mplCore()).use(mplCandyMachine());
  const p = provider();
  if (wallet && p) u.use(walletAdapterIdentity({ publicKey: p.publicKey, signTransaction: t => p.signTransaction(t), signAllTransactions: ts => p.signAllTransactions(ts), signMessage: async m => (await p.signMessage(m)).signature }));
  return u;
}
function status(msg, err) { const s = $('rcStatus'); s.textContent = msg || ''; s.classList.toggle('err', !!err); }
function explorer(kind, a) { return `https://explorer.solana.com/${kind}/${a}${isMain() ? '' : '?cluster=' + (CFG.explorerCluster || CFG.cluster)}`; }

// ---------- mystery box ----------
const bctx = () => { const c = $('rcBox').getContext('2d'); c.imageSmoothingEnabled = false; return c; };
function R(g, x, y, w, h, c) { g.fillStyle = c; g.fillRect(x, y, w, h); }
function drawBox() {
  const g = bctx(); boxT += 0.12;
  if (mode === 'reveal' && revealed) { W().renderPortrait(g, revealed.dna, W().time); return; }
  g.clearRect(0, 0, 32, 32); R(g, 0, 0, 32, 32, '#0d1020');
  [[3, 4], [27, 6], [6, 22], [24, 2], [29, 19], [14, 3]].forEach(([x, y], i) => R(g, x, y, 1, 1, (Math.floor(boxT * 2) + i) % 3 ? '#3a4470' : '#ffd66b'));
  const bob = mode === 'minting' ? 0 : Math.round(Math.sin(boxT) * 1);
  const y = 12 + bob;
  R(g, 7, y + 4, 18, 13, '#04050a'); R(g, 8, y + 5, 16, 11, '#b78bff'); R(g, 8, y + 5, 16, 2, '#cdb4ff');
  R(g, 6, y, 20, 5, '#04050a'); R(g, 7, y + 1, 18, 3, '#ff8fb1'); R(g, 7, y + 1, 18, 1, '#ffb3c9');
  R(g, 15, y, 2, 17, '#ffd66b'); R(g, 7, y + 9, 18, 2, '#ffd66b');
  R(g, 12, y - 3, 3, 3, '#ffd66b'); R(g, 17, y - 3, 3, 3, '#ffd66b'); R(g, 13, y - 2, 1, 1, '#04050a'); R(g, 18, y - 2, 1, 1, '#04050a');
  // ? mark
  const q = [[1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [4, 2], [3, 3], [2, 4], [2, 6]];
  const qc = Math.floor(boxT * 3) % 2 ? '#ffffff' : '#0d1020';
  q.forEach(([dx, dy]) => R(g, 9 + dx, y + 6 + dy - 1, 1, 1, qc));
  q.forEach(([dx, dy]) => R(g, 19 + dx, y + 6 + dy - 1, 1, 1, qc));
  R(g, 9, y + 19 - bob, 14, 1, 'rgba(0,0,0,0.4)');
  if (mode === 'minting') for (let i = 0; i < 6; i++) { const a = boxT * 2 + i; R(g, Math.round(16 + Math.cos(a) * 13), Math.round(18 + Math.sin(a) * 13), 1, 1, i % 2 ? '#7fe8c4' : '#ff8fb1'); }
}

// ---------- wallet ----------
async function connect() {
  const p = provider();
  if (!p) {
    if (isMobile) { location.href = `https://phantom.app/ul/browse/${encodeURIComponent(location.href.split('#')[0])}?ref=${encodeURIComponent(location.origin)}`; return; }
    window.open('https://phantom.com/download', '_blank', 'noopener'); status('Install the Phantom extension, then reload this page.'); return;
  }
  try { const r = await p.connect(); wallet = (r && r.publicKey ? r.publicKey : p.publicKey).toString(); umi = makeUmi(); render(); refresh(); await checkFree(); if (tab === 'mine') loadMine(); }
  catch (e) { status('Wallet connection was cancelled.', true); }
}
async function disconnect() { const p = provider(); try { p && await p.disconnect(); } catch (e) { /* ignore */ } wallet = null; freeUsed = null; umi = makeUmi(); render(); }
const onFreeList = () => !!wallet && (CFG.freeWallets || []).includes(wallet);
const isFree = () => onFreeList() && freeUsed !== null && freeUsed < FREE_LIMIT;
async function checkFree() { // reads the mintLimit counter PDA for the free group; falls back to paid after the free mint is used
  freeUsed = null; if (!onFreeList() || !ready()) return;
  const w = wallet;
  try { const mc = await safeFetchMintCounterFromSeeds(umi || makeUmi(), { id: FREE_LIMIT_ID, user: publicKey(w), candyMachine: publicKey(CFG.candyMachine), candyGuard: publicKey(CFG.candyGuard) });
    if (w === wallet) { freeUsed = mc ? Number(mc.count) : 0; render(); } }
  catch (e) { if (w === wallet) { freeUsed = 0; render(); } }
}

// ---------- count ----------
async function refresh() {
  if (!ready()) { $('rcCount').textContent = 'Mint opens soon'; return; }
  try { const cm = await fetchCandyMachine(umi || makeUmi(), publicKey(CFG.candyMachine)); const n = Number(cm.itemsRedeemed), t = Number(cm.data.itemsAvailable);
    $('rcCount').textContent = `${n.toLocaleString('en-US')} / ${t.toLocaleString('en-US')} minted`; $('rcBarFill').style.width = (100 * n / t).toFixed(2) + '%';
    if (n >= t) { $('rcMint').disabled = true; $('rcMint').textContent = 'SOLD OUT'; }
  } catch (e) { $('rcCount').textContent = 'Could not reach Solana right now'; }
}

// ---------- metadata -> DNA ----------
async function metaFor(uri) { const r = await fetch(uri); if (!r.ok) throw new Error('metadata ' + r.status); return r.json(); }
function dnaFromMeta(j) {
  const at = {}; (j.attributes || []).forEach(a => at[a.trait_type] = a.value);
  if (at.DNA && window.rainWorld.nft.dnaInfo(at.DNA)) return at.DNA;
  // fallback: rebuild from labeled traits
  const N = window.rainWorld.nft, CM = N.CM, map = { fur: 'Fur', belly: 'Belly', eyes: 'Eyes', collar: 'Collar', pattern: 'Pattern', ears: 'Ear Tips', acc: 'On Top', face: 'Face', bg: 'Backdrop' };
  const v = { title: 0, first: 0, last: 0 }; for (const [k, t] of Object.entries(map)) { const i = CM[k].findIndex(o => o.n === at[t]); if (i < 0) return null; v[k] = i; }
  return N.cmCode(v);
}

// ---------- mint ----------
async function mint() {
  if (busy) return;
  if (!ready()) return status('The mint is not live yet.', true);
  if (!wallet) return connect();
  busy = true; mode = 'minting'; revealed = null; $('rcReveal').classList.add('hidden'); $('rcStage').classList.add('shake'); $('rcMint').disabled = true;
  try {
    umi = makeUmi();
    if (onFreeList()) await checkFree();
    const free = isFree();
    if (!free) { const bal = Number((await umi.rpc.getBalance(publicKey(wallet))).basisPoints) / 1e9; if (bal < CFG.price + 0.005) throw new Error(`You need about ${(CFG.price + 0.005).toFixed(3)} SOL in this wallet (you have ${bal.toFixed(4)}).`); }
    status('Approve the transaction in Phantom\u2026');
    const asset = generateSigner(umi), cmPk = publicKey(CFG.candyMachine), col = publicKey(CFG.collection);
    let tx = transactionBuilder().add(setComputeUnitLimit(umi, { units: 800000 }));
    if (free) {
      const list = CFG.freeWallets, merkleRoot = getMerkleRoot(list);
      const proof = await safeFetchAllowListProofFromSeeds(umi, { merkleRoot, user: publicKey(wallet), candyMachine: cmPk, candyGuard: publicKey(CFG.candyGuard) });
      if (!proof) tx = tx.add(route(umi, { candyMachine: cmPk, guard: 'allowList', group: some('free'), routeArgs: { path: 'proof', merkleRoot, merkleProof: getMerkleProof(list, wallet) } }));
      tx = tx.add(mintV1(umi, { candyMachine: cmPk, asset, collection: col, group: some('free'), mintArgs: { allowList: some({ merkleRoot }), mintLimit: some({ id: FREE_LIMIT_ID }) } }));
    } else {
      tx = tx.add(mintV1(umi, { candyMachine: cmPk, asset, collection: col, group: some('public'), mintArgs: { solPayment: some({ destination: publicKey(CFG.treasury) }) } }));
    }
    const res = await tx.sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
    status('Paid! Opening your mystery box\u2026');
    let a = null; for (let i = 0; i < 10 && !a; i++) { try { a = await fetchAsset(umi, asset.publicKey); } catch (e) { await new Promise(r => setTimeout(r, 800)); } }
    remember(asset.publicKey.toString());
    if (!a) throw new Error('Minted, but the NFT is still syncing. Check My Rain Cats in a moment.');
    const j = await metaFor(a.uri); const dna = dnaFromMeta(j);
    revealed = { asset: a.publicKey.toString(), name: a.name, meta: j, dna }; remember(revealed.asset);
    if (free) freeUsed = (freeUsed || 0) + 1;
    reveal(revealed); refresh();
    window.dispatchEvent(new CustomEvent('raincats:minted', { detail: { asset: revealed.asset, name: a.name, dna } }));
  } catch (e) {
    mode = 'idle'; if (onFreeList()) checkFree();
    const m = String(e && e.message || e);
    status(/rejected|cancel/i.test(m) ? 'Transaction cancelled. No SOL was spent.' : /allowed list/i.test(m) ? 'This wallet is not on the free mint list.' : /maximum number of allowed mints|MintLimit/i.test(m) ? 'This wallet already used its free mint. Mint again for ' + CFG.price + ' SOL.' : m.split('\n')[0].slice(0, 180), true);
  } finally { busy = false; $('rcStage').classList.remove('shake'); $('rcMint').disabled = false; render(); }
}
function reveal(r) {
  mode = 'reveal';
  const at = {}; (r.meta.attributes || []).forEach(x => at[x.trait_type] = x.value);
  $('rcRName').textContent = `${r.name} \u00b7 ${at.Name || ''}`;
  const rt = $('rcRRarity'); rt.textContent = (at.Rarity || '').toUpperCase(); rt.className = 'rar-' + String(at.Rarity || '').toLowerCase().replace(/\s+/g, '-');
  $('rcRTraits').innerHTML = '';
  ['Fur', 'Belly', 'Eyes', 'Collar', 'Pattern', 'Ear Tips', 'On Top', 'Face', 'Backdrop', 'One of One'].filter(k => at[k]).forEach(k => { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = k; d.appendChild(b); d.appendChild(document.createTextNode(at[k])); $('rcRTraits').appendChild(d); });
  const L = $('rcRLinks'); L.innerHTML = '';
  const link = (t, h) => { const a = document.createElement('a'); a.href = h; a.target = '_blank'; a.rel = 'noopener'; a.textContent = t; L.appendChild(a); };
  link('Solana Explorer', explorer('address', r.asset));
  if (isMain()) link('Tensor', `https://www.tensor.trade/item/${r.asset}`);
  $('rcReveal').classList.remove('hidden'); $('rcMint').classList.add('hidden');
  status('Welcome home, ' + (at.Name || r.name) + '!'); W().blip && W().blip(880);
}

// ---------- My Rain Cats ----------
async function ownedCats() {
  if (CFG.das) { // Helius-style DAS (recommended on mainnet)
    const r = await fetch(CFG.das, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 'rc', method: 'searchAssets', params: { ownerAddress: wallet, grouping: ['collection', CFG.collection], page: 1, limit: 100 } }) });
    const j = await r.json(); return (j.result && j.result.items || []).map(it => ({ asset: it.id, name: it.content && it.content.metadata && it.content.metadata.name, uri: it.content && it.content.json_uri }));
  }
  const mine = a => a.updateAuthority && a.updateAuthority.type === 'Collection' && String(a.updateAuthority.address) === CFG.collection && String(a.owner) === wallet;
  let list;
  try { list = await fetchAssetsByOwner(umi, publicKey(wallet), { skipDerivePlugins: true }); }
  catch (e) { // most free mainnet RPCs block getProgramAccounts: fall back to the cats minted from this device
    const got = []; for (const id of remembered()) { try { const a = await fetchAsset(umi, publicKey(id), { skipDerivePlugins: true }); if (mine(a)) got.push(a); } catch (x) { /* burned or moved */ } }
    list = got;
  }
  return list.filter(a => a.updateAuthority && a.updateAuthority.type === 'Collection' && String(a.updateAuthority.address) === CFG.collection).map(a => ({ asset: a.publicKey.toString(), name: a.name, uri: a.uri }));
}
const memKey = () => `raincats.mine.${CFG.cluster}.${CFG.collection}.${wallet}`;
function remembered() { try { return JSON.parse(localStorage.getItem(memKey()) || '[]'); } catch (e) { return []; } }
function remember(id) { try { const l = remembered(); if (!l.includes(id)) l.push(id); localStorage.setItem(memKey(), JSON.stringify(l.slice(-200))); } catch (e) { /* private mode */ } }
async function loadMine() {
  const box = $('rcMineList'); box.innerHTML = '';
  if (!wallet) { $('rcMineNote').textContent = 'Connect Phantom to see the Rain Cats in your wallet.'; return; }
  if (!ready()) { $('rcMineNote').textContent = 'The collection is not live yet.'; return; }
  $('rcMineNote').textContent = 'Looking for your Rain Cats\u2026';
  try {
    const cats = await ownedCats();
    if (!cats.length) { $('rcMineNote').textContent = 'No Rain Cats in this wallet yet. Mint a mystery cat first!'; return; }
    $('rcMineNote').textContent = `You own ${cats.length} Rain Cat${cats.length > 1 ? 's' : ''}. Pick one to play as it or let it roam the village.`;
    for (const c of cats.slice(0, 60)) {
      const card = document.createElement('div'); card.className = 'rcCard';
      const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; card.appendChild(cv);
      const nm = document.createElement('div'); nm.textContent = c.name || 'Rain Cat'; card.appendChild(nm);
      box.appendChild(card);
      metaFor(c.uri).then(j => {
        const dna = dnaFromMeta(j); if (!dna) throw new Error('no dna');
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; W().renderPortrait(g, dna, 0.3);
        const nick = (j.attributes || []).find(a => a.trait_type === 'Name'); if (nick) nm.textContent = `${c.name} \u00b7 ${nick.value}`;
        const acts = document.createElement('div'); acts.className = 'rcActs';
        const b1 = document.createElement('button'); b1.textContent = 'Play as'; b1.addEventListener('click', () => playAs(dna, nick ? nick.value : c.name));
        const b2 = document.createElement('button'); b2.className = 'alt'; b2.textContent = 'Let it roam'; b2.addEventListener('click', () => roam(dna, nick ? nick.value : c.name));
        acts.appendChild(b1); acts.appendChild(b2); card.appendChild(acts); card.dataset.dna = dna;
      }).catch(() => { nm.textContent += ' (art loading failed)'; });
    }
  } catch (e) { $('rcMineNote').textContent = 'Could not load your cats: ' + String(e.message || e).slice(0, 120); }
}
function playAs(dna, label) { close(); W().setMe(dna); W().showToast(`You are playing as ${label}. Tap RAIN at the top to turn back into Rain.`, 4000); }
function roam(dna, label) { close(); W().releaseDNA(dna, label); }

// ---------- panel ----------
function render() {
  $('rcNet').textContent = isMain() ? 'MAINNET' : String(CFG.cluster || 'devnet').toUpperCase(); $('rcNet').classList.toggle('main', isMain());
  $('rcAddr').textContent = wallet ? 'Connected: ' + short(wallet) : (provider() || !isMobile ? 'Wallet not connected' : 'On iPhone, open this page in the Phantom app');
  $('rcConnect').textContent = wallet ? 'Disconnect' : (provider() || !isMobile ? 'Connect Phantom' : 'Open in Phantom');
  const m = $('rcMint');
  if (mode !== 'reveal') { m.classList.remove('hidden'); m.classList.toggle('free', !!isFree());
    m.innerHTML = !wallet ? `&#127873; CONNECT TO MINT &middot; ${CFG.price} SOL` : isFree() ? '&#127873; FREE MINT &middot; 1 LEFT' : onFreeList() && freeUsed === null ? '&#127873; CHECKING FREE MINT\u2026' : `&#127873; MINT A MYSTERY CAT &middot; ${CFG.price} SOL`; }
  $('rcTabMint').classList.toggle('on', tab === 'mint'); $('rcTabMine').classList.toggle('on', tab === 'mine');
  $('rcMintView').classList.toggle('hidden', tab !== 'mint'); $('rcMineView').classList.toggle('hidden', tab !== 'mine');
}
function open(which) {
  const w = W(); if (w) { w.closeDialog(false); w.closePlaces(); w.keys.clear(); w.padDirs.clear(); }
  if (window.rainWorld.catMaker) window.rainWorld.catMaker.close();
  tab = which === 'mine' ? 'mine' : 'mint';
  $('rcPanel').classList.remove('hidden'); document.body.classList.add('rc');
  if (!umi) umi = makeUmi();
  const p = provider(); if (p && !wallet) p.connect({ onlyIfTrusted: true }).then(r => { wallet = (r.publicKey || p.publicKey).toString(); umi = makeUmi(); render(); checkFree(); if (tab === 'mine') loadMine(); }).catch(() => {});
  render(); refresh(); if (tab === 'mine') loadMine();
  clearInterval(boxTimer); boxTimer = setInterval(drawBox, 90); drawBox();
}
function close() { $('rcPanel').classList.add('hidden'); document.body.classList.remove('rc'); clearInterval(boxTimer); }

$('rcClose').addEventListener('click', close);
$('rcConnect').addEventListener('click', () => wallet ? disconnect() : connect());
$('rcMint').addEventListener('click', () => wallet ? mint() : connect());
$('rcTabMint').addEventListener('click', () => { tab = 'mint'; render(); });
$('rcTabMine').addEventListener('click', () => { tab = 'mine'; render(); loadMine(); });
$('rcPlay').addEventListener('click', () => revealed && playAs(revealed.dna, (revealed.meta.attributes.find(a => a.trait_type === 'Name') || {}).value || revealed.name));
$('rcRoam').addEventListener('click', () => revealed && roam(revealed.dna, (revealed.meta.attributes.find(a => a.trait_type === 'Name') || {}).value || revealed.name));
$('rcAgain').addEventListener('click', () => { mode = 'idle'; revealed = null; $('rcReveal').classList.add('hidden'); status(''); render(); });
window.RainCats = { open, close, connect, mint, refresh, loadMine, config: CFG, get wallet() { return wallet; }, get revealed() { return revealed; }, _test: { Keypair, VersionedTransaction, PublicKey } };
