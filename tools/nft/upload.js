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
  const imgBytes = dirSize(`${RC}/images`), metaBytes = 1000 * 1100, colBytes = fs.statSync(`${RC}/collection.png`).size + 1500;
  const total = imgBytes + metaBytes + colBytes + 1000 * 2 * 1200; // + per-item header/manifest overhead
  const price = await irys.getPrice(total);
  console.log(JSON.stringify({ net: NET, bytes: total, priceSOL: Number(price) / 1e9 }));
  if (PRICE_ONLY) return;
  const bal = await irys.getBalance(); const need = BigInt(price.toString()) * 12n / 10n;
  if (BigInt(bal.toString()) < need) { const r = await irys.fund((need - BigInt(bal.toString())).toString()); console.log('funded irys', Number(r.quantity) / 1e9, 'SOL'); }
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
