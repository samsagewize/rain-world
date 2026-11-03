// Create the Rain Cats Core collection + Core Candy Machine with guard groups.
// Usage: node deploy.js main      -> 3,699-item CM from upload-<net>.json   (NET env: devnet|mainnet)
//        node deploy.js test      -> 5-item allowlist test CM whose allowList contains the throwaway "buyer2" key
const fs = require('fs');
const { generateSigner, publicKey, some, none, sol, transactionBuilder } = require('@metaplex-foundation/umi');
const { createCollection, ruleSet } = require('@metaplex-foundation/mpl-core');
const { create, addConfigLines, getMerkleRoot, fetchCandyMachine } = require('@metaplex-foundation/mpl-core-candy-machine');
const { umiFor } = require('./umi');
const { loadOrCreate } = require('./lib');
const NET = process.env.NET || 'devnet', MODE = process.argv[2] || 'main';
const CREATOR = '4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC';
const RC = '/workspace/rainworld/raincats';
const up = JSON.parse(fs.readFileSync(`${RC}/upload-${NET}.json`));
const OUT = `${RC}/deploy-${NET}-${MODE}.json`;
const st = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT)) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(st, null, 2));
(async () => {
  const umi = umiFor('authority', NET === 'mainnet' ? process.env.RPC : undefined);
  const items = MODE === 'test' ? 5 : 3699;
  const allow = MODE === 'test' ? [loadOrCreate('buyer2').publicKey.toBase58()] : [CREATOR];
  if (!st.collection) {
    const col = generateSigner(umi);
    await createCollection(umi, { collection: col, name: MODE === 'test' ? 'Rain Cats (allowlist test)' : 'Rain Cats', uri: up.collectionJson,
      plugins: [{ type: 'Royalties', basisPoints: 500, creators: [{ address: publicKey(CREATOR), percentage: 100 }], ruleSet: ruleSet('None') }] }).sendAndConfirm(umi);
    st.collection = col.publicKey.toString(); save(); console.log('collection', st.collection);
  }
  if (!st.candyMachine) {
    const cm = generateSigner(umi);
    const tx = await create(umi, { candyMachine: cm, collection: publicKey(st.collection), collectionUpdateAuthority: umi.identity,
      itemsAvailable: items, isMutable: true,
      configLineSettings: some({ prefixName: 'Rain Cat #', nameLength: 4, prefixUri: up.prefixUri, uriLength: 9, isSequential: false }),
      hiddenSettings: none(),
      guards: {},
      groups: [
        { label: 'public', guards: { solPayment: some({ lamports: sol(0.03), destination: publicKey(CREATOR) }) } },
        { label: 'free', guards: { allowList: some({ merkleRoot: getMerkleRoot(allow) }) } },
      ] });
    await tx.sendAndConfirm(umi);
    st.candyMachine = cm.publicKey.toString(); save(); console.log('candyMachine', st.candyMachine);
  }
  const cmAcc = await fetchCandyMachine(umi, publicKey(st.candyMachine));
  st.candyGuard = cmAcc.mintAuthority.toString(); save();
  // config lines: name suffix = 4-digit number, uri suffix = <index>.json (index 0..3698 = Rain Cat #0001..#3699)
  const all = Array.from({ length: items }, (_, i) => ({ name: String(i + 1).padStart(4, '0'), uri: `${i}.json` }));
  const CH = 40; let done = cmAcc.itemsLoaded;
  for (let i = done; i < items; i += CH) {
    const lines = all.slice(i, i + CH);
    for (let a = 0; ; a++) {
      try { await addConfigLines(umi, { candyMachine: publicKey(st.candyMachine), index: i, configLines: lines }).sendAndConfirm(umi); break; }
      catch (e) { if (a > 4) throw e; await new Promise(r => setTimeout(r, 1500)); }
    }
    if ((i / CH) % 10 === 0) console.log('config lines', i + lines.length, '/', items);
  }
  const fin = await fetchCandyMachine(umi, publicKey(st.candyMachine));
  st.itemsLoaded = fin.itemsLoaded; st.itemsAvailable = Number(fin.data.itemsAvailable); st.allowList = allow; st.authority = umi.identity.publicKey.toString(); save();
  console.log('ready', JSON.stringify(st));
})().catch(e => { console.error('deploy error:', e.message, e.logs ? e.logs.slice(-6).join('\n') : ''); process.exit(1); });
