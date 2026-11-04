// Simulate (never send) the free-group and public-group mint txs on mainnet for given wallets. sigVerify off, nothing signed by those wallets.
const { generateSigner, publicKey, some, transactionBuilder, createNoopSigner, signerIdentity } = require('@metaplex-foundation/umi');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const M = require('@metaplex-foundation/mpl-core-candy-machine'); const { mplCore } = require('@metaplex-foundation/mpl-core');
const { setComputeUnitLimit } = require('@metaplex-foundation/mpl-toolbox');
const { VersionedTransaction, Connection } = require('@solana/web3.js');
const cfg = { rpc: process.env.RPC || 'https://solana-rpc.publicnode.com', cm: 'DM8HhCKYCXESv1UHB5W31mSr9MF9WncL3gd6DMbAgwtJ', guard: '9oZ6UaRjaVmi75wQQVsVFmG1xkcR2nEN7v8iCsh8LH7x', col: 'NoKDyLnGYSHjfSSAwQkfxsBLzk94NXgNqEXoSg84Bvi', free: ['4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC'] };
async function sim(wallet, group) {
  const umi = createUmi(cfg.rpc, 'confirmed').use(mplCore()).use(M.mplCandyMachine()); umi.use(signerIdentity(createNoopSigner(publicKey(wallet))));
  const cmPk = publicKey(cfg.cm), col = publicKey(cfg.col), asset = generateSigner(umi);
  let tx = transactionBuilder().add(setComputeUnitLimit(umi, { units: 800000 }));
  if (group === 'free') { const merkleRoot = M.getMerkleRoot(cfg.free);
    const proof = await M.safeFetchAllowListProofFromSeeds(umi, { merkleRoot, user: publicKey(wallet), candyMachine: cmPk, candyGuard: publicKey(cfg.guard) });
    if (!proof) tx = tx.add(M.route(umi, { candyMachine: cmPk, guard: 'allowList', group: some('free'), routeArgs: { path: 'proof', merkleRoot, merkleProof: M.getMerkleProof(cfg.free, wallet) } }));
    tx = tx.add(M.mintV1(umi, { candyMachine: cmPk, asset, collection: col, group: some('free'), mintArgs: { allowList: some({ merkleRoot }), mintLimit: some({ id: 1 }) } }));
  } else tx = tx.add(M.mintV1(umi, { candyMachine: cmPk, asset, collection: col, group: some('public'), mintArgs: { solPayment: some({ destination: publicKey(cfg.free[0]) }) } }));
  const built = await tx.buildWithLatestBlockhash(umi);
  const raw = umi.transactions.serialize(built);
  const r = await new Connection(cfg.rpc).simulateTransaction(VersionedTransaction.deserialize(raw), { sigVerify: false, replaceRecentBlockhash: true });
  const logs = r.value.logs || [];
  return { wallet: wallet.slice(0, 6), group, ok: !r.value.err, err: r.value.err, units: r.value.unitsConsumed, size: raw.length, last: logs.filter(l => /Error|insufficient|success|failed/i.test(l)).slice(-2) };
}
(async () => { for (const [w, g] of JSON.parse(process.argv[2])) console.log(JSON.stringify(await sim(w, g))); })();
