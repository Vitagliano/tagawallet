// Everything except the zod schemas, so scripts injected into pages stay small.
export * from "./chains";
export * from "./address";
export * from "./detect";
export * from "./urls";
export * from "./provenance";
export const CURATED_SITES = [
  "etherscan.io", "bscscan.com", "arbiscan.io", "optimistic.etherscan.io", "polygonscan.com", "basescan.org",
  "solscan.io", "explorer.solana.com", "x.com", "twitter.com",
  "dexscreener.com", "debank.com", "app.zerion.io",
  // Bitcoin and Solana explorers, Blockscout's per-chain explorers, research and NFT tools, and Farcaster.
  "mempool.space", "solana.fm", "blockscout.com", "intel.arkm.com", "opensea.io", "warpcast.com", "farcaster.xyz",
];
