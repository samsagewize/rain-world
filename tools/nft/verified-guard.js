// Adds the `verify` group (labels max 6 bytes) to the Rain Cats Candy Guard: thirdPartySigner (Rooms co-signs only for wallets
// with the Rooms check mark) + mintLimit id 2, limit 1. Existing groups are copied byte-for-byte from chain.
// Usage: NET=mainnet node verified-guard.js            -> preflight only (cost estimate, nothing sent)
//        NET=mainnet node verified-guard.js --send     -> send the update (authority keypair, never printed)
const { publicKey, some } = require('@metaplex-foundation/umi');
const M = require('@metaplex-foundation/mpl-core-candy-machine');

const VERIFIED = { label: 'verify', mintLimitId: 2, limit: 1 };
const someGuards = g => Object.fromEntries(Object.entries(g).filter(([, v]) => v.__option === 'Some'));

async function plan(umi, guardAddress, signer) {
  const g = await M.fetchCandyGuard(umi, publicKey(guardAddress));
  const groups = g.groups.map(x => ({ label: x.label, guards: someGuards(x.guards) }));
  const already = groups.find(x => x.label === VERIFIED.label);
  const next = already ? groups : [...groups, { label: VERIFIED.label, guards: { thirdPartySigner: some({ signerKey: publicKey(signer) }), mintLimit: some({ id: VERIFIED.mintLimitId, limit: VERIFIED.limit }) } }];
  const acc = await umi.rpc.getAccount(g.publicKey);
  // New group = label [u8;6] + guard-set features u64 + thirdPartySigner (32) + mintLimit (u8 id + u16 limit).
  const newSize = acc.data.length + (already ? 0 : 6 + 8 + 32 + 3);
  const rentNow = Number(acc.lamports.basisPoints), rentNew = Number((await umi.rpc.getRent(newSize)).basisPoints);
  return { guard: g, groups, next, already: Boolean(already), size: acc.data.length, newSize, extraRent: Math.max(0, rentNew - rentNow) };
}

async function apply(umi, p) {
  if (p.already) return null;
  const r = await M.updateCandyGuard(umi, { candyGuard: p.guard.publicKey, guards: {}, groups: p.next }).sendAndConfirm(umi);
  return require('@metaplex-foundation/umi/serializers').base58.deserialize(r.signature)[0];
}
module.exports = { plan, apply, VERIFIED, someGuards };

if (require.main === module) (async () => {
  const NET = process.env.NET || 'mainnet', SEND = process.argv.includes('--send');
  const { umiFor } = require('./umi');
  const { loadOrCreate } = require('./lib');
  const fs = require('fs');
  const st = JSON.parse(fs.readFileSync(`/workspace/rainworld/raincats/deploy-${NET}-main.json`));
  const umi = umiFor('authority', NET === 'mainnet' ? (process.env.RPC || 'https://api.mainnet-beta.solana.com') : process.env.RPC);
  const signer = loadOrCreate('verified-signer').publicKey.toBase58();
  const p = await plan(umi, st.candyGuard, signer);
  const bal = Number((await umi.rpc.getBalance(umi.identity.publicKey)).basisPoints);
  const need = p.extraRent + 10_000; // realloc rent + fee margin
  const out = (o) => console.log(JSON.stringify(o, (k, v) => typeof v === 'bigint' ? v.toString() : v instanceof Uint8Array ? Buffer.from(v).toString('hex') : v));
  out({ net: NET, guard: st.candyGuard, authority: umi.identity.publicKey.toString(), signer, already: p.already, size: p.size, newSize: p.newSize, extraRentSOL: p.extraRent / 1e9, needSOL: need / 1e9, balanceSOL: bal / 1e9, groupsAfter: p.next });
  if (bal < need) { console.error(`insufficient SOL: short by ${(need - bal) / 1e9} SOL`); process.exit(2); }
  if (!SEND) return console.log('preflight only; pass --send to apply');
  const sig = await apply(umi, p);
  const after = await M.fetchCandyGuard(umi, publicKey(st.candyGuard));
  out({ sig, balanceAfterSOL: Number((await umi.rpc.getBalance(umi.identity.publicKey)).basisPoints) / 1e9, groups: after.groups.map(x => ({ label: x.label, guards: someGuards(x.guards) })) });
})().catch(e => { console.error('verified-guard error:', e.message, e.logs ? e.logs.slice(-6).join('\n') : ''); process.exit(1); });
