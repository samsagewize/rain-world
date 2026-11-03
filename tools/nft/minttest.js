// Devnet mint tests. Usage: node minttest.js public <wallet> [n] | free <wallet> [main|test]
const fs = require('fs');
const { generateSigner, publicKey, some, transactionBuilder } = require('@metaplex-foundation/umi');
const { mintV1, route, getMerkleProof, fetchCandyMachine } = require('@metaplex-foundation/mpl-core-candy-machine');
const { fetchAsset } = require('@metaplex-foundation/mpl-core');
const { setComputeUnitLimit } = require('@metaplex-foundation/mpl-toolbox');
const { umiFor } = require('./umi');
const { conn } = require('./lib');
const { PublicKey } = require('@solana/web3.js');
const RC = '/workspace/rainworld/raincats';
const [mode, who, arg] = process.argv.slice(2);
const dep = JSON.parse(fs.readFileSync(`${RC}/deploy-${process.env.NET || 'devnet'}-${mode === 'free' ? (arg || 'main') : 'main'}.json`));
const CREATOR = '4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC';
(async () => {
  const umi = umiFor(who);
  const me = umi.identity.publicKey.toString();
  const cmPk = publicKey(dep.candyMachine), col = publicKey(dep.collection);
  const n = mode === 'public' ? Number(arg || 1) : 1;
  const results = [];
  for (let i = 0; i < n; i++) {
    const before = await conn.getBalance(new PublicKey(CREATOR));
    const asset = generateSigner(umi);
    let tx = transactionBuilder().add(setComputeUnitLimit(umi, { units: 800000 }));
    try {
      if (mode === 'free') {
        await route(umi, { candyMachine: cmPk, guard: 'allowList', group: some('free'), routeArgs: { path: 'proof', merkleRoot: (await import('@metaplex-foundation/mpl-core-candy-machine')).getMerkleRoot(dep.allowList), merkleProof: getMerkleProof(dep.allowList, me) } }).sendAndConfirm(umi);
        tx = tx.add(mintV1(umi, { candyMachine: cmPk, asset, collection: col, group: some('free'), mintArgs: { allowList: some({ merkleRoot: (await import('@metaplex-foundation/mpl-core-candy-machine')).getMerkleRoot(dep.allowList) }) } }));
      } else {
        tx = tx.add(mintV1(umi, { candyMachine: cmPk, asset, collection: col, group: some('public'), mintArgs: { solPayment: some({ destination: publicKey(CREATOR) }) } }));
      }
      const r = await tx.sendAndConfirm(umi, { confirm: { commitment: 'confirmed' } });
      const a = await fetchAsset(umi, asset.publicKey);
      const after = await conn.getBalance(new PublicKey(CREATOR));
      const meta = await (await fetch(a.uri)).json();
      const dna = meta.attributes.find(x => x.trait_type === 'DNA').value, rar = meta.attributes.find(x => x.trait_type === 'Rarity').value;
      results.push({ ok: true, asset: a.publicKey.toString(), owner: a.owner.toString() === me, name: a.name, rarity: rar, dna, creatorReceivedSOL: (after - before) / 1e9 });
    } catch (e) { results.push({ ok: false, error: (e.message || '').slice(0, 200), logs: e.logs ? e.logs.filter(l => /Error|error|failed/.test(l)).slice(-3) : undefined }); }
  }
  const cm = await fetchCandyMachine(umi, cmPk);
  console.log(JSON.stringify({ mode, who, minted: Number(cm.itemsRedeemed), of: Number(cm.data.itemsAvailable), results }, null, 1));
})();
