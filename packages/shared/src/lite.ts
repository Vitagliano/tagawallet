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
];
