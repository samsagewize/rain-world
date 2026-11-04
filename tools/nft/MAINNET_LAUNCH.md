# Rain Cats: Solana mainnet launch record

Launched 2026-11-04 (America/Chicago). Metaplex Core collection + Core Candy Machine + Candy Guard. No secrets in this file.

## Addresses (mainnet-beta)
| What | Address |
|---|---|
| Collection (Core) | [NoKDyLnGYSHjfSSAwQkfxsBLzk94NXgNqEXoSg84Bvi](https://solscan.io/account/NoKDyLnGYSHjfSSAwQkfxsBLzk94NXgNqEXoSg84Bvi) |
| Candy Machine (Core) | [DM8HhCKYCXESv1UHB5W31mSr9MF9WncL3gd6DMbAgwtJ](https://solscan.io/account/DM8HhCKYCXESv1UHB5W31mSr9MF9WncL3gd6DMbAgwtJ) |
| Candy Guard (mint authority) | [9oZ6UaRjaVmi75wQQVsVFmG1xkcR2nEN7v8iCsh8LH7x](https://solscan.io/account/9oZ6UaRjaVmi75wQQVsVFmG1xkcR2nEN7v8iCsh8LH7x) |
| Authority / update authority | [Ejy3n9xw9U6R1kZCV8GAkgV3A9W6R8v5j9eZ57HdjFxA](https://solscan.io/account/Ejy3n9xw9U6R1kZCV8GAkgV3A9W6R8v5j9eZ57HdjFxA) |
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
