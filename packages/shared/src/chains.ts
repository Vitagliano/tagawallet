export type ChainFamily = "evm" | "solana" | "bitcoin";

export const CHAINS = {
  ethereum: { name: "Ethereum", family: "evm", explorer: "https://etherscan.io/address/" },
  base: { name: "Base", family: "evm", explorer: "https://basescan.org/address/" },
  arbitrum: { name: "Arbitrum", family: "evm", explorer: "https://arbiscan.io/address/" },
  optimism: { name: "Optimism", family: "evm", explorer: "https://optimistic.etherscan.io/address/" },
  polygon: { name: "Polygon", family: "evm", explorer: "https://polygonscan.com/address/" },
  bsc: { name: "BNB Chain", family: "evm", explorer: "https://bscscan.com/address/" },
  solana: { name: "Solana", family: "solana", explorer: "https://solscan.io/account/" },
  bitcoin: { name: "Bitcoin", family: "bitcoin", explorer: "https://mempool.space/address/" },
} as const satisfies Record<string, { name: string; family: ChainFamily; explorer: string }>;

export type ChainId = keyof typeof CHAINS;
export const CHAIN_IDS = Object.keys(CHAINS) as [ChainId, ...ChainId[]];

export function chainFamily(chain: ChainId): ChainFamily {
  return CHAINS[chain].family;
}

export function chainsInFamily(family: ChainFamily): ChainId[] {
  return CHAIN_IDS.filter((c) => CHAINS[c].family === family);
}
