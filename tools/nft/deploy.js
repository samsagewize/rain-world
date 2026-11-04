// Create the Rain Cats Core collection + Core Candy Machine with guard groups.
// Usage: node deploy.js main      -> 1,000-item CM from upload-<net>.json   (NET env: devnet|mainnet)
//        node deploy.js test      -> 5-item allowlist test CM whose allowList contains the throwaway "buyer2" key
const fs = require('fs');
const { generateSigner, publicKey, some, none, sol, transactionBuilder } = require('@metaplex-foundation/umi');
const { createCollection, ruleSet } = require('@metaplex-foundation/mpl-core');
const { create, addConfigLines, getMerkleRoot, fetchCandyMachine } = require('@metaplex-foundation/mpl-core-candy-machine');
const { getCandyMachineSize } = require('@metaplex-foundation/mpl-core-candy-machine/dist/src/hooked');
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
  const MAIN = NET === 'mainnet';
  const umi = umiFor('authority', MAIN ? (process.env.RPC || 'https://api.mainnet-beta.solana.com') : process.env.RPC);
  const b58 = sig => require('@metaplex-foundation/umi/serializers').base58.deserialize(sig)[0];
  const exists = async a => !!(await umi.rpc.getAccount(publicKey(a))).exists;
  st.sigs = st.sigs || {};
  const items = MODE === 'test' ? 5 : 1000;
  const allow = MODE === 'test' ? [loadOrCreate('buyer2').publicKey.toBase58()] : [CREATOR];
  const lamports = Number((await umi.rpc.getBalance(umi.identity.publicKey)).basisPoints);
  if (!st.candyMachine && !st.pendingCandyMachine) {
    const rent = Number((await umi.rpc.getRent(getCandyMachineSize(items, some({ prefixName: 'Rain Cat #', nameLength: 4, prefixUri: up.prefixUri, uriLength: 9, isSequential: false })))).basisPoints);
    const need = rent + (st.collection ? 0 : 3_000_000) + 6_000_000 + 5_000_000; // CM rent + collection + guard/fees + margin
    console.log('preflight', JSON.stringify({ balanceSOL: lamports / 1e9, cmRentSOL: rent / 1e9, needSOL: need / 1e9 }));
    if (lamports < need) throw new Error(`insufficient SOL: short by ${(need - lamports) / 1e9} SOL`);
  }
  if (!st.collection && st.pendingCollection && await exists(st.pendingCollection)) { st.collection = st.pendingCollection; save(); }
  if (!st.collection) {
    const col = generateSigner(umi); st.pendingCollection = col.publicKey.toString(); save();
    await createCollection(umi, { collection: col, name: MODE === 'test' ? 'Rain Cats (allowlist test)' : 'Rain Cats', uri: up.collectionJson,
      plugins: [{ type: 'Royalties', basisPoints: 500, creators: [{ address: publicKey(CREATOR), percentage: 100 }], ruleSet: ruleSet('None') }] }).sendAndConfirm(umi).then(r => { st.sigs.collection = b58(r.signature); });
    st.collection = col.publicKey.toString(); save(); console.log('collection', st.collection);
  }
  if (!st.candyMachine && st.pendingCandyMachine) {
    for (let i = 0; i < 6 && !st.candyMachine; i++) { if (await exists(st.pendingCandyMachine)) { st.candyMachine = st.pendingCandyMachine; save(); } else await new Promise(r => setTimeout(r, 5000)); }
    if (!st.candyMachine) throw new Error('pending candy machine ' + st.pendingCandyMachine + ' not found on-chain; inspect before retrying (delete pendingCandyMachine to create a new one)');
  }
  if (!st.candyMachine) {
    const cm = generateSigner(umi); st.pendingCandyMachine = cm.publicKey.toString(); save();
    const tx = await create(umi, { candyMachine: cm, collection: publicKey(st.collection), collectionUpdateAuthority: umi.identity,
      itemsAvailable: items, isMutable: true,
      configLineSettings: some({ prefixName: 'Rain Cat #', nameLength: 4, prefixUri: up.prefixUri, uriLength: 9, isSequential: false }),
      hiddenSettings: none(),
      guards: {},
      groups: [
        { label: 'public', guards: { solPayment: some({ lamports: sol(0.04), destination: publicKey(CREATOR) }) } },
        { label: 'free', guards: { allowList: some({ merkleRoot: getMerkleRoot(allow) }), mintLimit: some({ id: 1, limit: 1 }) } }, // exactly one free mint per allowlisted wallet
      ] });
    st.sigs.candyMachine = b58((await tx.sendAndConfirm(umi)).signature);
    st.candyMachine = cm.publicKey.toString(); save(); console.log('candyMachine', st.candyMachine);
  }
  const cmAcc = await fetchCandyMachine(umi, publicKey(st.candyMachine));
  st.candyGuard = cmAcc.mintAuthority.toString(); save();
  // config lines: name suffix = 4-digit number, uri suffix = <index>.json (index 0..999 = Rain Cat #0001..#1000)
  const all = Array.from({ length: items }, (_, i) => ({ name: String(i + 1).padStart(4, '0'), uri: `${i}.json` }));
  const CH = 40; let done = cmAcc.itemsLoaded;
  for (let i = done; i < items; i += CH) {
    const lines = all.slice(i, i + CH);
    for (let a = 0; ; a++) {
      try { const r = await addConfigLines(umi, { candyMachine: publicKey(st.candyMachine), index: i, configLines: lines }).sendAndConfirm(umi); (st.sigs.configLines = st.sigs.configLines || []).push(b58(r.signature)); save(); break; }
      catch (e) { if (a > 6) throw e; await new Promise(r => setTimeout(r, 3000 * (a + 1)));
        const now = await fetchCandyMachine(umi, publicKey(st.candyMachine)); if (now.itemsLoaded >= i + lines.length) { console.log('lines', i, 'already landed'); break; } }
    }
    if (MAIN) await new Promise(r => setTimeout(r, 700)); // throttle public RPC
    if ((i / CH) % 10 === 0) console.log('config lines', i + lines.length, '/', items);
  }
  const fin = await fetchCandyMachine(umi, publicKey(st.candyMachine));
  st.itemsLoaded = fin.itemsLoaded; st.itemsAvailable = Number(fin.data.itemsAvailable); st.freeMintLimit = { id: 1, limit: 1 }; st.allowList = allow; st.authority = umi.identity.publicKey.toString(); save();
  console.log('ready', JSON.stringify(st));
})().catch(e => { console.error('deploy error:', e.message, e.logs ? e.logs.slice(-6).join('\n') : ''); process.exit(1); });
