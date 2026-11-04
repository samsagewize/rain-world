// Rain Cats mint config. Live on Solana mainnet-beta (see README and tools/nft/MAINNET_LAUNCH.md).
window.RAINCATS_CONFIG = {
  version: 4,
  status: 'live',
  cluster: 'mainnet-beta',
  explorerCluster: 'mainnet-beta',
  rpc: 'https://solana-rpc.publicnode.com', // browser-friendly; api.mainnet-beta returns 403 to browsers
  das: null,                 // e.g. a Helius DAS URL for faster "My Rain Cats"
  candyMachine: 'DM8HhCKYCXESv1UHB5W31mSr9MF9WncL3gd6DMbAgwtJ',
  candyGuard: '9oZ6UaRjaVmi75wQQVsVFmG1xkcR2nEN7v8iCsh8LH7x',
  collection: 'NoKDyLnGYSHjfSSAwQkfxsBLzk94NXgNqEXoSg84Bvi',
  treasury: '4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC',
  freeWallets: ['4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC'],
  freeMintLimitId: 1,        // free group mintLimit guard: 1 free mint per allowlisted wallet
  freeMintLimit: 1,
  price: 0.04,
  supply: 1000,
  rooms: /^\/rainworld(\/|$)/.test(location.pathname) ? location.origin : 'https://www.intherooms.xyz' // read-only Rooms API: /api/raincats/owned?wallet= (owned cats + check mark)
};
