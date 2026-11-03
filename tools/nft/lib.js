// shared helpers; never logs secrets
const fs = require('fs');
const { Keypair, Connection, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const DIR = '/home/box/.raincats';
function loadOrCreate(name) {
  const p = `${DIR}/${name}.json`;
  if (!fs.existsSync(p)) { const k = Keypair.generate(); fs.writeFileSync(p, JSON.stringify(Array.from(k.secretKey)), { mode: 0o600 }); }
  fs.chmodSync(p, 0o600);
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(p, 'utf8'))));
}
const RPC = process.env.RPC || 'https://api.devnet.solana.com';
const conn = new Connection(RPC, 'confirmed');
module.exports = { fs, DIR, loadOrCreate, conn, RPC, LAMPORTS_PER_SOL };
