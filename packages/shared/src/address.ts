import { keccak_256 } from "@noble/hashes/sha3.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { base58, bech32, bech32m } from "@scure/base";
import { chainFamily, type ChainFamily, type ChainId } from "./chains";

const EVM_RE = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function toChecksumAddress(address: string): string {
  const lower = address.toLowerCase().replace(/^0x/, "");
  const hash = Array.from(keccak_256(new TextEncoder().encode(lower)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  let out = "0x";
  for (let i = 0; i < lower.length; i++) {
    out += parseInt(hash[i]!, 16) >= 8 ? lower[i]!.toUpperCase() : lower[i]!;
  }
  return out;
}

export function isValidEvmAddress(address: string): boolean {
  if (!EVM_RE.test(address)) return false;
  const body = address.slice(2);
  // All-lower and all-upper addresses carry no checksum, per EIP-55.
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  return toChecksumAddress(address) === address;
}

export function isValidSolanaAddress(address: string): boolean {
  if (!SOLANA_RE.test(address)) return false;
  try {
    return base58.decode(address).length === 32;
  } catch {
    return false;
  }
}

function isValidBase58Check(address: string): boolean {
  try {
    const bytes = base58.decode(address);
    if (bytes.length !== 25) return false;
    const version = bytes[0];
    if (version !== 0x00 && version !== 0x05) return false;
    const payload = bytes.slice(0, 21);
    const check = sha256(sha256(payload)).slice(0, 4);
    return check.every((b, i) => b === bytes[21 + i]);
  } catch {
    return false;
  }
}

function isValidSegwit(address: string): boolean {
  const lower = address.toLowerCase();
  if (address !== lower && address !== address.toUpperCase()) return false;
  if (!lower.startsWith("bc1")) return false;
  const v0 = lower[3] === "q";
  try {
    const { prefix, words } = (v0 ? bech32 : bech32m).decode(lower as `${string}1${string}`);
    if (prefix !== "bc" || words.length === 0) return false;
    const program = (v0 ? bech32 : bech32m).fromWords(words.slice(1));
    if (v0) return words[0] === 0 && (program.length === 20 || program.length === 32);
    return words[0]! >= 1 && words[0]! <= 16 && program.length >= 2 && program.length <= 40;
  } catch {
    return false;
  }
}

export function isValidBitcoinAddress(address: string): boolean {
  if (/^[13]/.test(address)) return isValidBase58Check(address);
  return isValidSegwit(address);
}

export function isValidAddress(address: string, chain: ChainId): boolean {
  switch (chainFamily(chain)) {
    case "evm":
      return isValidEvmAddress(address);
    case "solana":
      return isValidSolanaAddress(address);
    case "bitcoin":
      return isValidBitcoinAddress(address);
  }
}

/** Why an address failed, phrased for the person who pasted it. */
export function addressError(address: string, chain: ChainId): string | null {
  if (isValidAddress(address, chain)) return null;
  const family = chainFamily(chain);
  if (family === "evm" && EVM_RE.test(address)) {
    return "Checksum mismatch. One of the letters has the wrong case, so the address may be mistyped.";
  }
  if (family === "evm") return "EVM addresses are 0x followed by 40 hexadecimal characters.";
  if (family === "solana") return "That isn't a valid Solana address.";
  return "That isn't a valid Bitcoin address.";
}

/** Canonical form used for storage and lookup. Only case-insensitive formats are folded. */
export function normalizeAddress(address: string, family: ChainFamily): string {
  const a = address.trim();
  if (family === "evm") return a.toLowerCase();
  if (family === "bitcoin" && /^bc1/i.test(a)) return a.toLowerCase();
  return a;
}

export function inferFamily(address: string): ChainFamily | null {
  if (isValidEvmAddress(address)) return "evm";
  if (isValidBitcoinAddress(address)) return "bitcoin";
  if (isValidSolanaAddress(address)) return "solana";
  return null;
}

export function truncateAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail + 1) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
