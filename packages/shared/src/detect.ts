import { inferFamily, normalizeAddress, isValidBitcoinAddress, isValidEvmAddress, isValidSolanaAddress } from "./address";
import type { ChainFamily } from "./chains";

export type DetectedKind = ChainFamily | "ens" | "sns";

export interface DetectedAddress {
  raw: string;
  normalized: string;
  kind: DetectedKind;
}

// Lookarounds stop us matching inside longer identifiers such as tx hashes.
const EVM = /(?<![0-9a-zA-Z_])0x[0-9a-fA-F]{40}(?![0-9a-zA-Z_])/g;
const BTC = /(?<![0-9a-zA-Z_])(?:[13][1-9A-HJ-NP-Za-km-z]{25,34}|bc1[0-9a-z]{11,71})(?![0-9a-zA-Z_])/g;
const SOL = /(?<![0-9a-zA-Z_])[1-9A-HJ-NP-Za-km-z]{32,44}(?![0-9a-zA-Z_])/g;
const ENS = /(?<![0-9a-zA-Z_.-])(?:[a-z0-9-]{1,63}\.)+eth(?![0-9a-zA-Z_-])/gi;
const SNS = /(?<![0-9a-zA-Z_.-])[a-z0-9-]{1,63}\.sol(?![0-9a-zA-Z_-])/gi;

// Base58 words of this length are almost always addresses, but require mixed
// character classes so long plain words never pass even if they decode to 32 bytes.
function looksLikeSolana(s: string): boolean {
  return /[0-9]/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s) && isValidSolanaAddress(s);
}

/** Finds addresses and names in a string. Pure so it runs in a content script and in tests. */
export function detectAddresses(text: string): DetectedAddress[] {
  const found = new Map<string, DetectedAddress>();
  const add = (raw: string, kind: DetectedKind, normalized: string) => {
    if (!found.has(`${kind}:${normalized}`)) found.set(`${kind}:${normalized}`, { raw, kind, normalized });
  };
  // A cheap gate: nearly all text nodes are too short to hold anything.
  if (text.length < 5) return [];
  for (const m of text.matchAll(EVM)) {
    if (isValidEvmAddress(m[0])) add(m[0], "evm", normalizeAddress(m[0], "evm"));
  }
  for (const m of text.matchAll(ENS)) add(m[0], "ens", m[0].toLowerCase());
  for (const m of text.matchAll(SNS)) add(m[0], "sns", m[0].toLowerCase());
  if (text.length < 26) return [...found.values()];
  for (const m of text.matchAll(BTC)) {
    if (isValidBitcoinAddress(m[0])) add(m[0], "bitcoin", normalizeAddress(m[0], "bitcoin"));
  }
  for (const m of text.matchAll(SOL)) {
    if (!found.has(`bitcoin:${m[0]}`) && looksLikeSolana(m[0])) add(m[0], "solana", m[0]);
  }
  return [...found.values()];
}

/** Treats a pasted value as an address or name, without the Solana word heuristic. */
export function parsePastedAddress(value: string): DetectedAddress | null {
  const raw = value.trim();
  if (/^[a-z0-9-.]+\.eth$/i.test(raw)) return { raw, kind: "ens", normalized: raw.toLowerCase() };
  const family = inferFamily(raw);
  return family ? { raw, kind: family, normalized: normalizeAddress(raw, family) } : null;
}
