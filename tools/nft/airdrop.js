const { loadOrCreate, conn, LAMPORTS_PER_SOL } = require('./lib');
(async () => {
  for (const n of process.argv.slice(2)) {
    const k = loadOrCreate(n);
    try { const sig = await conn.requestAirdrop(k.publicKey, 2 * LAMPORTS_PER_SOL); await conn.confirmTransaction(sig, 'confirmed'); console.log(n, 'airdrop ok'); } catch (e) { console.log(n, 'airdrop failed:', e.message.slice(0, 160)); }
    console.log(n, k.publicKey.toBase58(), (await conn.getBalance(k.publicKey)) / LAMPORTS_PER_SOL, 'SOL');
  }
})();
