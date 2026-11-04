// Upload Rain Cats art + metadata to Irys (Arweave). Usage: node upload.js devnet|mainnet [--price]
const fs = require('fs'), path = require('path');
const { Uploader } = require('@irys/upload'); const { Solana } = require('@irys/upload-solana');
const { loadOrCreate } = require('./lib');
const NET = process.argv[2] || 'devnet', PRICE_ONLY = process.argv.includes('--price');
const RC = '/workspace/rainworld/raincats', STATE = `${RC}/upload-${NET}.json`;
const LOCAL = NET === 'localnet';
const RPC = NET === 'mainnet' ? (process.env.RPC || 'https://api.mainnet-beta.solana.com') : 'https://api.devnet.solana.com';
const GW = NET === 'mainnet' ? 'https://gateway.irys.xyz' : LOCAL ? 'http://localhost:8765/rc-local' : 'https://devnet.irys.xyz';
const CREATOR = '4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC';
const SITE = 'https://rain-world-beta.vercel.app';
const dirSize = d => fs.readdirSync(d).reduce((a, f) => a + fs.statSync(path.join(d, f)).size, 0);
const st = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE)) : {};
const save = () => fs.writeFileSync(STATE, JSON.stringify(st, null, 2));
function writeMeta(imgBase) {
  const m = JSON.parse(fs.readFileSync(`${RC}/manifest.json`)); const dir = `${RC}/meta-${NET}`; fs.mkdirSync(dir, { recursive: true });
  for (const c of m) {
    const num = String(c.number).padStart(4, '0'), image = `${imgBase}/${c.index}.png`;
    const attributes = Object.entries(c.attrs).map(([trait_type, value]) => ({ trait_type, value }));
    attributes.push({ trait_type: 'Rarity', value: c.rarity }, { trait_type: 'Name', value: c.name });
    if (c.title) attributes.push({ trait_type: 'One of One', value: c.title });
    attributes.push({ trait_type: 'DNA', value: c.dna });
    fs.writeFileSync(`${dir}/${c.index}.json`, JSON.stringify({ name: `Rain Cat #${num}`, symbol: 'RCAT',
      description: `${c.name}, ${/^[AEIOU]/.test(c.rarity) ? 'an' : 'a'} ${c.rarity} Rain Cat. One of 1,000 pixel cats from Rain's World. Holders can play as their cat or let it roam the village at ${SITE}`,
      image, external_url: SITE, attributes, properties: { files: [{ uri: image, type: 'image/png' }], category: 'image' } }));
  }
  return dir;
}
(async () => {
  if (LOCAL) { // local validator test: serve files from the local dev server instead of Irys
    st.collectionImage = `${GW}/collection.png`; fs.writeFileSync(`${RC}/collection-localnet.json`, JSON.stringify({ name: 'Rain Cats', symbol: 'RCAT', image: st.collectionImage }));
    st.collectionJson = `${GW}/collection-localnet.json`; writeMeta(`${GW}/images`); st.prefixUri = `${GW}/meta-localnet/`; save(); console.log('local', JSON.stringify(st)); return;
  }
  const key = loadOrCreate('authority');
  const irys = await (NET === 'mainnet' ? Uploader(Solana).withWallet(key.secretKey).withRpc(RPC) : Uploader(Solana).withWallet(key.secretKey).withRpc(RPC).devnet());
  // Irys bills every data item separately with a per-item minimum, so price each item (upper bound by largest file).
  const imgs = fs.readdirSync(`${RC}/images`), maxImg = Math.max(...imgs.map(f => fs.statSync(`${RC}/images/${f}`).size));
  const P = async n => BigInt((await irys.getPrice(n)).toString());
  const parts = {
    collection: st.collectionImage ? 0n : await P(fs.statSync(`${RC}/collection.png`).size + 1500),
    collectionJson: st.collectionJson ? 0n : await P(1500),
    images: st.imagesManifest ? 0n : (await P(maxImg + 1200)) * BigInt(imgs.length) + await P(imgs.length * 120),
    metadata: st.metaManifest ? 0n : (await P(1600)) * BigInt(imgs.length) + await P(imgs.length * 120),
  };
  const price = Object.values(parts).reduce((a, b) => a + b, 0n);
  console.log(JSON.stringify({ net: NET, items: imgs.length * 2 + 4, priceSOL: Number(price) / 1e9, parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Number(v) / 1e9])) }));
  if (PRICE_ONLY) return;
  const bal = await irys.getBalance(); const need = price * 12n / 10n;
  console.log('irys balance', Number(bal) / 1e9, 'SOL');
  if (BigInt(bal.toString()) < need) { const r = await irys.fund((need - BigInt(bal.toString())).toString()); st.fundTx = st.fundTx || []; st.fundTx.push(r.id); save(); console.log('funded irys', Number(r.quantity) / 1e9, 'SOL', 'tx', r.id); }
  if (!st.collectionImage) { const r = await irys.uploadFile(`${RC}/collection.png`, { tags: [{ name: 'Content-Type', value: 'image/png' }] }); st.collectionImage = `${GW}/${r.id}`; save(); }
  if (!st.collectionJson) {
    const j = { name: 'Rain Cats', symbol: 'RCAT', description: "1,000 pixel cats from Rain's World, Rain's home on the web. Mint a mystery cat, then play as it or let it roam the village.", image: st.collectionImage, external_url: SITE, properties: { files: [{ uri: st.collectionImage, type: 'image/png' }], category: 'image' } };
    const r = await irys.upload(JSON.stringify(j), { tags: [{ name: 'Content-Type', value: 'application/json' }] }); st.collectionJson = `${GW}/${r.id}`; save();
  }
  const log = m => { if (!/^Checking|^Uploading|^Finished/.test(m)) return; process.stdout.write(m + '\n'); };
  if (!st.imagesManifest) { const r = await irys.uploadFolder(`${RC}/images`, { batchSize: 50, keepDeleted: false, logFunction: async m => log(m) }); st.imagesManifest = r.id; save(); }
  const metaDir = writeMeta(`${GW}/${st.imagesManifest}`);
  if (!st.metaManifest) { const r = await irys.uploadFolder(metaDir, { batchSize: 50, keepDeleted: false, logFunction: async m => log(m) }); st.metaManifest = r.id; save(); }
  st.prefixUri = `${GW}/${st.metaManifest}/`; save();
  console.log('done', JSON.stringify(st));
})().catch(e => { console.error('upload error:', e.message); process.exit(1); });
