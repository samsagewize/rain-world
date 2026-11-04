// Local-validator test of the `verified` group end to end, using the real Rooms client + co-sign code.
// Programs are dumped from mainnet into /tmp/rcprog. Fresh throwaway keys only; no mainnet keys are loaded.
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults')
const { generateSigner, keypairIdentity, publicKey, some, none, sol } = require('@metaplex-foundation/umi')
const { createCollection } = require('@metaplex-foundation/mpl-core')
const M = require('@metaplex-foundation/mpl-core-candy-machine')
const { Keypair, Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js')
const { plan, apply, someGuards } = require('./verified-guard.js')
const ROOMS = '/workspace/rooms-rc/src/lib'
const RPC = 'http://127.0.0.1:8899'
globalThis.RAINCATS_RPC_OVERRIDE = [RPC]; globalThis.RAINCATS_RPC_ONLY = true
const chain = await import(`${ROOMS}/raincats-chain.ts`)
const core = await import(`${ROOMS}/raincats-verified-core.ts`)
const rpcLib = await import(`${ROOMS}/raincats-rpc.ts`)

const P = '/tmp/rcprog/'
const v = spawn('solana-test-validator', ['--reset', '--quiet', '--ledger', '/tmp/rc-verified-ledger', ...[
  'CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d', 'CMACYFENjoBMHzapRXyo1JZkVS6EtaDDzkjMrmQLvr4J', 'CMAGAKJ67e9hRZgfC5SFTbZH8MgEmtqazKXjmkaJjWTJ', 'noopb9bkMVfRPU8AsbpTUg8AQkHtKwMYZiFUjNRtMmV',
].flatMap(id => ['--bpf-program', id, P + id + '.so'])], { stdio: 'ignore' })
const conn = new Connection(RPC, 'confirmed')
try {
  for (let i = 0; i < 120; i++) { try { await conn.getLatestBlockhash(); break } catch { await new Promise(r => setTimeout(r, 500)) } }
  const kp = () => Keypair.generate()
  const auth = kp(), treasury = kp(), V = kp(), U = kp(), F = kp(), signer = kp()
  for (const k of [auth, V, U, F]) { const s = await conn.requestAirdrop(k.publicKey, 2 * LAMPORTS_PER_SOL); await conn.confirmTransaction(s, 'confirmed') }
  const umi = createUmi(RPC, 'confirmed').use(require('@metaplex-foundation/mpl-core').mplCore()).use(M.mplCandyMachine())
  umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(auth.secretKey)))
  const col = generateSigner(umi), cm = generateSigner(umi)
  await createCollection(umi, { collection: col, name: 'Rain Cats (local)', uri: 'https://example.com/c.json' }).sendAndConfirm(umi)
  await (await M.create(umi, { candyMachine: cm, collection: col.publicKey, collectionUpdateAuthority: umi.identity, itemsAvailable: 6, isMutable: true,
    configLineSettings: some({ prefixName: 'Rain Cat #', nameLength: 4, prefixUri: 'https://example.com/', uriLength: 9, isSequential: false }), hiddenSettings: none(), guards: {},
    groups: [
      { label: 'public', guards: { solPayment: some({ lamports: sol(0.04), destination: publicKey(treasury.publicKey.toBase58()) }) } },
      { label: 'free', guards: { allowList: some({ merkleRoot: M.getMerkleRoot([F.publicKey.toBase58()]) }), mintLimit: some({ id: 1, limit: 1 }) } },
    ] })).sendAndConfirm(umi)
  await M.addConfigLines(umi, { candyMachine: cm.publicKey, index: 0, configLines: Array.from({ length: 6 }, (_, i) => ({ name: String(i + 1).padStart(4, '0'), uri: `${i}.json` })) }).sendAndConfirm(umi)
  const guard = (await M.fetchCandyMachine(umi, cm.publicKey)).mintAuthority.toString()

  // Apply the same update the mainnet script sends.
  const before = await plan(umi, guard, signer.publicKey.toBase58())
  const sizeBefore = (await conn.getAccountInfo(new (require('@solana/web3.js').PublicKey)(guard))).data.length
  const sig = await apply(umi, before)
  const after = await M.fetchCandyGuard(umi, publicKey(guard))
  const sizeAfter = (await conn.getAccountInfo(new (require('@solana/web3.js').PublicKey)(guard))).data.length
  const ser = x => JSON.stringify(x, (k, val) => typeof val === 'bigint' ? val.toString() : val)
  assert.equal(ser(after.groups.slice(0, 2).map(x => ({ label: x.label, guards: someGuards(x.guards) }))), ser(before.groups), 'public and free groups unchanged')
  assert.equal(after.groups[2].label, 'verify')
  assert.equal(sizeAfter, before.newSize, 'size estimate matches realloc')
  console.log('PASS guard update', sig.slice(0, 12) + '…', `size ${sizeBefore} -> ${sizeAfter}`, 'public/free unchanged')

  const cfg = { rpcUrl: RPC, candyMachine: cm.publicKey.toString(), candyGuard: guard, collection: col.publicKey.toString(), treasury: treasury.publicKey.toBase58(),
    freeWallets: [F.publicKey.toBase58()], freeMintLimitId: 1, freeMintLimit: 1, priceSol: 0.04, verifiedSigner: signer.publicKey.toBase58(), verifiedMintLimitId: 2 }
  const verifiedSet = new Set([V.publicKey.toBase58()])
  const cosignCfg = { candyGuard: guard, candyMachine: cfg.candyMachine, guardProgram: 'CMAGAKJ67e9hRZgfC5SFTbZH8MgEmtqazKXjmkaJjWTJ', signer, isVerified: async w => verifiedSet.has(w) }
  const roomsCosigner = async tx => (await core.cosignVerifiedMint(tx, cosignCfg)).tx
  const wallet = k => ({ address: k.publicKey.toBase58(), signTransaction: async tx => { tx.sign([k]); return tx } })
  const fails = async (p, re, label) => { const e = await p.then(() => null, e => e); assert.ok(e, `${label} should fail`); assert.match(String(e.message) + (e.logs || []).join(' '), re, label); console.log('PASS', label, '->', (String(e.message).match(/signature verification failure|maximum number[^.]*|check mark|co-sign|MissingSignature|missing required signature/i)?.[0]) ?? String(e.message).split('\n')[0].slice(0, 90)) }

  const r1 = await chain.mintCat(cfg, wallet(V), 'verified', undefined, roomsCosigner)
  console.log('PASS verified wallet free mint', r1.asset.slice(0, 8) + '…')
  await fails(chain.mintCat(cfg, wallet(V), 'verified', undefined, roomsCosigner), /0x178d|AllowedMintLimitReached|maximum number of allowed mints/i, 'verified wallet second free mint refused on-chain')
  await fails(chain.mintCat(cfg, wallet(U), 'verified', undefined, roomsCosigner), /check mark/, 'unverified wallet refused by Rooms co-signer')
  await fails(chain.mintCat(cfg, wallet(U), 'verified', undefined, async tx => tx).catch(e => { console.log('  bypass detail:', String(e.message).replace(/\s+/g, ' ').slice(0, 300)); throw e }), /signature|Signature|missing/i, 'unverified wallet bypassing Rooms refused by the chain')
  // Co-signer must not sign a public (or any other) mint.
  {
    const u = chain.makeUmi(cfg, wallet(V)); const { builder } = await chain.buildMint(u, cfg, V.publicKey.toBase58(), 'public')
    const t = await (await builder.setLatestBlockhash(u)).buildAndSign(u)
    await fails(core.cosignVerifiedMint(Buffer.from(u.transactions.serialize(t)).toString('base64'), cosignCfg), /co-sign|verified/, 'co-signer refuses a non-verified-group tx')
  }
  const balT = await conn.getBalance(treasury.publicKey)
  const r2 = await chain.mintCat(cfg, wallet(U), 'public')
  assert.equal(await conn.getBalance(treasury.publicKey) - balT, 0.04 * LAMPORTS_PER_SOL)
  console.log('PASS public mint still works (0.04 SOL to treasury)', r2.asset.slice(0, 8) + '…')
  const r3 = await chain.mintCat(cfg, wallet(F), 'free')
  console.log('PASS owner free (allowList) mint still works', r3.asset.slice(0, 8) + '…')
  await fails(chain.mintCat(cfg, wallet(F), 'free'), /0x178d|AllowedMintLimitReached|maximum/i, 'owner second free mint refused')
  verifiedSet.add(F.publicKey.toBase58())
  const r4 = await chain.mintCat(cfg, wallet(F), 'verified', undefined, roomsCosigner)
  console.log('PASS owner who is also verified gets the verified free mint too', r4.asset.slice(0, 8) + '…')
  const cmAfter = await M.fetchCandyMachine(umi, cm.publicKey)
  assert.equal(Number(cmAfter.itemsRedeemed), 4)
  console.log('All local verified-group tests passed; itemsRedeemed', Number(cmAfter.itemsRedeemed))
} finally { v.kill() }
