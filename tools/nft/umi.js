const { createUmi } = require('@metaplex-foundation/umi-bundle-defaults');
const { keypairIdentity, createSignerFromKeypair } = require('@metaplex-foundation/umi');
const { mplCore } = require('@metaplex-foundation/mpl-core');
const { mplCandyMachine } = require('@metaplex-foundation/mpl-core-candy-machine');
const { loadOrCreate } = require('./lib');
function umiFor(name, rpc) {
  const umi = createUmi(rpc || process.env.RPC || 'https://api.devnet.solana.com', 'confirmed').use(mplCore()).use(mplCandyMachine());
  const kp = loadOrCreate(name);
  umi.use(keypairIdentity(umi.eddsa.createKeypairFromSecretKey(kp.secretKey)));
  return umi;
}
module.exports = { umiFor };
