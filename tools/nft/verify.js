const fs = require('fs');
const { publicKey } = require('@metaplex-foundation/umi');
const M = require('@metaplex-foundation/mpl-core-candy-machine');
const { fetchCollection } = require('@metaplex-foundation/mpl-core');
const { umiFor } = require('./umi');
const dep = JSON.parse(fs.readFileSync('/workspace/rainworld/raincats/deploy-mainnet-main.json'));
(async () => {
  const umi = umiFor('authority', 'https://api.mainnet-beta.solana.com');
  const cm = await M.fetchCandyMachine(umi, publicKey(dep.candyMachine));
  const g = await M.fetchCandyGuard(umi, publicKey(dep.candyGuard));
  const col = await fetchCollection(umi, publicKey(dep.collection));
  const items = cm.items; const bad = items.filter((it, i) => it.name !== `Rain Cat #${String(i + 1).padStart(4, '0')}` || !it.uri.endsWith(`/${i}.json`));
  console.log(JSON.stringify({
    collection: { address: dep.collection, name: col.name, uri: col.uri, updateAuthority: col.updateAuthority.toString(), royalties: col.royalties },
    candyMachine: { address: dep.candyMachine, collectionMint: cm.collectionMint.toString(), authority: cm.authority.toString(), mintAuthority: cm.mintAuthority.toString(), itemsAvailable: Number(cm.data.itemsAvailable), itemsLoaded: cm.itemsLoaded, itemsRedeemed: Number(cm.itemsRedeemed), badLines: bad.length, sample: [items[0], items[999]].map(i => i.name + ' ' + i.uri) },
    guard: { address: g.publicKey.toString(), base: g.base.toString(), default: Object.entries(g.guards).filter(([k, v]) => v.__option === 'Some').map(([k]) => k),
      groups: g.groups.map(x => ({ label: x.label, guards: Object.fromEntries(Object.entries(x.guards).filter(([k, v]) => v.__option === 'Some').map(([k, v]) => [k, k === 'solPayment' ? { sol: Number(v.value.lamports.basisPoints) / 1e9, destination: v.value.destination } : k === 'allowList' ? { merkleRoot: Buffer.from(v.value.merkleRoot).toString('hex'), matchesCreatorOnly: Buffer.from(v.value.merkleRoot).equals(Buffer.from(M.getMerkleRoot(['4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC']))) } : v.value])) })) },
  }, (k, v) => typeof v === 'bigint' ? Number(v) : v, 1));
})();
