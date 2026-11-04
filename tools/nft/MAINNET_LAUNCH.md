# Rain Cats: Solana mainnet launch record

Launched 2026-11-04 (America/Chicago). Metaplex Core collection + Core Candy Machine + Candy Guard. No secrets in this file.

## Addresses (mainnet-beta)
| What | Address |
|---|---|
| Collection (Core) | [NoKDyLnGYSHjfSSAwQkfxsBLzk94NXgNqEXoSg84Bvi](https://solscan.io/account/NoKDyLnGYSHjfSSAwQkfxsBLzk94NXgNqEXoSg84Bvi) |
| Candy Machine (Core) | [DM8HhCKYCXESv1UHB5W31mSr9MF9WncL3gd6DMbAgwtJ](https://solscan.io/account/DM8HhCKYCXESv1UHB5W31mSr9MF9WncL3gd6DMbAgwtJ) |
| Candy Guard (mint authority) | [9oZ6UaRjaVmi75wQQVsVFmG1xkcR2nEN7v8iCsh8LH7x](https://solscan.io/account/9oZ6UaRjaVmi75wQQVsVFmG1xkcR2nEN7v8iCsh8LH7x) |
| Collection update authority (since 2026-11-04 12:25 CST) | [4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC](https://solscan.io/account/4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC) |
| Candy Machine + Candy Guard authority (was also collection UA until the transfer) | [Ejy3n9xw9U6R1kZCV8GAkgV3A9W6R8v5j9eZ57HdjFxA](https://solscan.io/account/Ejy3n9xw9U6R1kZCV8GAkgV3A9W6R8v5j9eZ57HdjFxA) |
| Creator, treasury, royalties (5%) | [4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC](https://solscan.io/account/4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC) |

## Config (verified on-chain after deploy, `node verify.js`)
- itemsAvailable 1000, itemsLoaded 1000, itemsRedeemed 0, config lines `Rain Cat #0001..#1000` -> `<prefixUri><0..999>.json`, random order (not sequential).
- Collection royalties: 500 bps, creator 4Gaue... 100%, ruleSet None.
- Guard groups (no default guards):
  - `public`: solPayment 0.04 SOL -> 4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC
  - `free`: allowList (merkle root of [4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC]) + mintLimit id 1, limit 1 (exactly one free mint)
- Mainnet simulations (`node simfree.js`, never sent): 4Gaue free = success, 4Gaue public = success, other wallet free = AddressNotFoundInAllowedList, unfunded wallet public = NotEnoughSOL.
- Local validator (programs dumped from mainnet): free #1 ok, free #2 AllowedMintLimitReached, then public ok; UI falls back from "FREE MINT" to paid after the free mint.

## Storage (Irys / Arweave)
- Collection image: https://gateway.irys.xyz/BmEnMMprou71v2FgLZ22TBN1vrqsh6yUBqi7U3ZmunrL
- Collection JSON: https://gateway.irys.xyz/H3idNmqVKfRsTj22kNiQWUBrsEPrGzChU6kPr5TiLjPU
- Images manifest: HesQFSY77FfY43KhdvzMbWxWAZDUGopfLt77ibHbHXJF
- Metadata manifest / prefixUri: https://gateway.irys.xyz/8fdhU8b7nw4GhzBNp5LUFKXzvkre4YsJGhwh7voR6W7V/

## Transactions
- Irys fund (0.005755 SOL): 3TJEdMWSEq8MBZoSe23Dr3cF66YmutEpmq9A1oXZdNnPK7tRzAjUGExD4nndYBziTUBxiKNwtH8PAxPEpaqmguYV
- Create collection: 3VQUZhQ5R94fF2AAfg6CCk5mNnHx7QWxaE29Y4J7wTHi3jLshiifUjVvUGewNM1PFEhz8xmTgRpbqfqieFcbeGKL
- Create Candy Machine + Candy Guard + wrap: 2AiW58EMdHoQFxzw1h5r8HVwX4WZsVbXye2fuxiRW29HtnzytwuZhD7uMoSTiMCpeMPak1XTMpPqhYEFQd7tne2X
- Config lines: 25 txs, first 4RBQfKt24ZovcvnHeJvJZwjVvHLjWFS66CpquE4sGhfm7AU1akUmZto8qyD6igYhLpUftFbQJQ4nJwRUikW3bUeC, last 2h7vprMFQdFhh11PwUZB5Ye71LCNuaioW8a8VLj4M6GvfMXYuJLPHE8RJbEZ5FanUBxTxvNy1Rur8APJ9JCHjjwo

## Cost
- Authority balance 0.124299682 -> 0.023881334 SOL: spent 0.100418348 SOL (CM rent 0.091023, Irys funding 0.005755, collection + guard rent and fees for the rest).
- Most of it is rent that comes back if the Candy Machine is closed after sell-out (`deleteCandyMachine` / `deleteCandyGuard`). Unspent Irys balance can be withdrawn.

## Mint
- Rain's World: https://rain-world-beta.vercel.app/?mint (browser RPC: https://solana-rpc.publicnode.com, since api.mainnet-beta returns 403 to browsers)
- Rooms: https://www.intherooms.xyz/raincats
- iPhone: open the link inside the Phantom app browser (the panel's "Open in Phantom" button does this).
- "My Rain Cats": free RPCs block getProgramAccounts on mainnet, so without a DAS URL in `config.js` (`das:`) the tab lists cats minted from that device. Add a Helius DAS URL for full wallet lookups.

## Reproduce / resume
`node upload.js mainnet` (state in raincats/upload-mainnet.json, skips finished steps, funds Irys per-item price x1.2) then `NET=mainnet node deploy.js main` (records pending addresses before sending so a retry never pays CM rent twice; resumes config lines from itemsLoaded).

## Verified ✓ free mint (2026-11-04)
Every Rooms check-mark wallet (active Rooms Premium: founder or unexpired; 21 wallets at launch, all founders) gets 1 free Rain Cat on https://www.intherooms.xyz/mint.
- New guard group `verify` (group labels max 6 bytes): `thirdPartySigner` signerKey 2yz9xm2YfRCSXrYtRsSZGHWBdCwy8Hhu1fx2xKAUjJYs + `mintLimit` id 2, limit 1. `public` and `free` unchanged; still no default guards.
- Co-signer: Rooms route `/api/raincats/verified-mint` signs only an exact Rain Cats `verify` mint whose fee payer = minter = a wallet that has signed and is verified at that moment. The secret lives only in the Rooms Vercel Secret `RAINCATS_VERIFIED_SIGNER_SECRET` (and the 0600 box file `~/.raincats/verified-signer.json`); the signer key holds no SOL.
- updateCandyGuard tx: 2WeCYRyfDRfueHSCwizqjJLW4dHsBaaYo39p2JtNUinVn46cuDe5SukiLRHuUpkLa6x28UkxYvVyY1SdKqRTtDMz (finalized slot 465394585). Guard account 188 -> 237 bytes.
- Cost: 0.00025392 SOL (0.00024892 rent + 0.000005 fee). Authority 0.023881334 -> 0.023627414 SOL.
- Script: `NET=mainnet node verified-guard.js` (preflight, prints cost) / `--send` (re-reads the guard and keeps every existing group). Local validator test: `node verified-local.mjs` (needs the Rooms repo at /workspace/rooms-rc for its co-sign code).
- Local validator: verified free mint ok, 2nd AllowedMintLimitReached, unverified refused by the co-signer and (bypassing it) by the chain (signature verification), public 0.04 SOL and owner free still work, owner who is also verified gets both.
- Mainnet simulations (never sent): 4Gaue verify = success (sigVerify off), public = success, free = AllowedMintLimitReached (Christian already used it); fresh unverified wallet without the co-signature = SignatureFailure, live route = 403.
- The Rain's World in-game panel mints `free`/`public` only; verified free mints happen on intherooms.xyz/mint.
- Rotate the co-signer: new key -> updateCandyGuard with the new signerKey (edit verified-guard.js) -> RAINCATS.verifiedSigner in Rooms -> replace the Vercel Secret.

## Collection update authority -> 4Gaue (2026-11-04)
Moved so Christian can sign Tensor's collection-ownership verification with Phantom.
- updateCollectionV1 (newUpdateAuthority = 4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC, name/uri unchanged), signed by Ejy3n... only (new UA is a plain account, no co-sign).
- Tx: [5bMxFJjdu4G3A35GYUmnpVbGCYGUAcQypEHnVyfVrUAZd5Qvw4wMPbQm7xqvBeVa2CiKsPwJXufnPLgJpPgTg3fF](https://solscan.io/tx/5bMxFJjdu4G3A35GYUmnpVbGCYGUAcQypEHnVyfVrUAZd5Qvw4wMPbQm7xqvBeVa2CiKsPwJXufnPLgJpPgTg3fF), finalized slot 465401668, 12:25:37 CST. Fee 0.000005 SOL; authority 0.023627414 -> 0.023622414 SOL.
- Preflight (mainnet simulations): updateCollection + a public mint in the same tx = success (mint works with the new UA); updateCollection alone with the real signer = success.
- After (on-chain): updateAuthority = 4Gaue...; UpdateDelegate plugin unchanged (authority UpdateAuthority, additionalDelegates = [CM authority PDA FnqZ1FwKAZgESEzT9h9UVW9ogfpQwrnMWJYHwovnq45R]); Royalties unchanged (500 bps, 4Gaue 100%, ruleSet None); numMinted 1. Simulated public mint after = success (never sent).
- Script: `node transfer-ua.js` (preflight) / `--send` (refuses if UA is no longer Ejy3n...) / `--verify`.
- Still Ejy3n... alone (no 4Gaue needed): Candy Machine authority (updateCandyMachine, addConfigLines, deleteCandyMachine/withdraw rent), Candy Guard authority (updateCandyGuard, e.g. rotating the `verify` co-signer, deleteCandyGuard), Irys withdrawals.
- Now needs 4Gaue's signature: anything on the collection itself — name/uri, Royalties changes, adding/removing collection plugins, approving/revoking UpdateDelegate (e.g. removing the CM PDA delegate after sell-out, or re-adding a delegate if a new/replacement Candy Machine is ever pointed at this collection: create/setCollection needs the collection UA to sign), and burning/updating assets via collection authority.
- Unaffected: Rain's World in-game mint (`public`/`free`) and the Rooms verified route (`verify`, thirdPartySigner co-sign) both mint through the Candy Guard -> CM authority PDA -> UpdateDelegate; none of them reads or signs as the collection UA. Asset lookups match asset.updateAuthority = Collection(NoKDy...), which does not change.
