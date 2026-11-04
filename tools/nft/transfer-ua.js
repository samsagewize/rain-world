// Transfer Rain Cats collection update authority Ejy3n... -> 4Gaue... (mpl-core updateCollectionV1 newUpdateAuthority).
// Default: preflight only (simulations, nothing sent). --send: send once (refuses if UA already changed). No secrets printed.
const { generateSigner, publicKey, some, transactionBuilder, createNoopSigner, signerIdentity } = require('@metaplex-foundation/umi');
const { base58 } = require('@metaplex-foundation/umi/serializers');
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const C = require('@metaplex-foundation/mpl-core'); const M = require('@metaplex-foundation/mpl-core-candy-machine');
const { setComputeUnitLimit } = require('@metaplex-foundation/mpl-toolbox');
const { VersionedTransaction, Connection } = require('@solana/web3.js');
const { umiFor } = require('./umi');
const RPC = process.env.RPC || 'https://solana-rpc.publicnode.com';
const COL = publicKey('NoKDyLnGYSHjfSSAwQkfxsBLzk94NXgNqEXoSg84Bvi'), CM = publicKey('DM8HhCKYCXESv1UHB5W31mSr9MF9WncL3gd6DMbAgwtJ');
const OLD = 'Ejy3n9xw9U6R1kZCV8GAkgV3A9W6R8v5j9eZ57HdjFxA', NEW = '4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC', PDA = 'FnqZ1FwKAZgESEzT9h9UVW9ogfpQwrnMWJYHwovnq45R';
const conn = new Connection(RPC, 'confirmed');
// Simulated minter: any funded system wallet (sigVerify off, never signed/sent). Default: a large public wallet, since 4Gaue holds < 0.04 SOL.
const MINTER = process.env.SIM_MINTER || '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
async function simulate(umi, tx) {
  const built = await tx.buildWithLatestBlockhash(umi); const raw = umi.transactions.serialize(built);
  const r = await conn.simulateTransaction(VersionedTransaction.deserialize(raw), { sigVerify: false, replaceRecentBlockhash: true });
  const logs = r.value.logs || [];
  return { ok: !r.value.err, err: r.value.err, units: r.value.unitsConsumed, size: raw.length, last: logs.filter(l => /Error|insufficient|success|failed/i.test(l)).slice(-3) };
}
function mintIx(umi, minter) { return M.mintV1(umi, { candyMachine: CM, asset: generateSigner(umi), collection: COL, group: some('public'), mintArgs: { solPayment: some({ destination: publicKey(NEW) }) } }); }
async function state(umi) {
  const c = await C.fetchCollectionV1(umi, COL, { commitment: 'confirmed' });
  return { updateAuthority: c.updateAuthority.toString(), updateDelegate: c.updateDelegate && { authority: c.updateDelegate.authority.type, additionalDelegates: c.updateDelegate.additionalDelegates.map(String) },
    royalties: c.royalties && { bps: c.royalties.basisPoints, creators: c.royalties.creators.map(x => `${x.address}:${x.percentage}`), ruleSet: c.royalties.ruleSet.__kind }, numMinted: c.numMinted, currentSize: c.currentSize };
}
(async () => {
  const ro = createUmi(RPC, 'confirmed').use(C.mplCore()).use(M.mplCandyMachine());
  const before = await state(ro); console.log('state', JSON.stringify(before));
  if (process.argv.includes('--verify')) {
    const u = createUmi(RPC, 'confirmed').use(C.mplCore()).use(M.mplCandyMachine()); u.use(signerIdentity(createNoopSigner(publicKey(MINTER))));
    console.log('sim public mint (funded sim wallet, after):', JSON.stringify(await simulate(u, transactionBuilder().add(setComputeUnitLimit(u, { units: 800000 })).add(mintIx(u)))));
    return;
  }
  if (before.updateAuthority !== OLD) { console.log('updateAuthority is not', OLD, '- nothing to do, NOT sending'); return; }
  // Preflight A: combined [updateCollection -> public mint] in one tx, payer/minter 4Gaue, old UA as noop signer (sigVerify off).
  const u = createUmi(RPC, 'confirmed').use(C.mplCore()).use(M.mplCandyMachine()); u.use(signerIdentity(createNoopSigner(publicKey(MINTER))));
  const upd = s => C.updateCollection(s, { collection: COL, authority: createNoopSigner(publicKey(OLD)), payer: createNoopSigner(publicKey(OLD)), newUpdateAuthority: publicKey(NEW) });
  console.log('sim updateCollection + public mint in same tx:', JSON.stringify(await simulate(u, transactionBuilder().add(setComputeUnitLimit(u, { units: 800000 })).add(upd(u)).add(mintIx(u)))));
  const a = umiFor('authority', RPC);
  if (a.identity.publicKey.toString() !== OLD) throw new Error('authority key mismatch');
  const realTx = C.updateCollection(a, { collection: COL, authority: a.identity, newUpdateAuthority: publicKey(NEW) });
  console.log('sim updateCollection alone (real signer):', JSON.stringify(await simulate(a, realTx)));
  console.log('authority balance', Number((await a.rpc.getBalance(a.identity.publicKey)).basisPoints) / 1e9);
  if (!process.argv.includes('--send')) { console.log('preflight only; pass --send'); return; }
  const bh = await a.rpc.getLatestBlockhash({ commitment: 'confirmed' });
  const built = realTx.setBlockhash(bh).build(a); const signed = await a.identity.signTransaction(built);
  const sigBytes = signed.signatures[0]; const sig = base58.deserialize(sigBytes)[0]; console.log('SIG', sig);
  require('fs').writeFileSync('/workspace/rainworld/nft/transfer-ua.sig', sig + '\n');
  await a.rpc.sendTransaction(signed);
  try { const r = await a.rpc.confirmTransaction(sigBytes, { strategy: { type: 'blockhash', ...bh }, commitment: 'confirmed' }); console.log('confirm', JSON.stringify(r.value)); }
  catch (e) { console.log('confirm error (re-fetch before any retry):', e.message); }
  console.log('after', JSON.stringify(await state(ro)));
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
