import { createPublicKey, verify } from "node:crypto";
import { decodeBase58, isValidSolanaAddress } from "@tagawallet/shared";

// The fixed DER header of an Ed25519 SubjectPublicKeyInfo, so a raw 32-byte Solana key can be loaded.
const SPKI_ED25519 = Buffer.from("302a300506032b6570032100", "hex");

/** Wallets return signatures as base58 (most) or base64. Either decodes to 64 bytes. */
function signatureBytes(signature: string): Buffer | null {
  try {
    const b58 = Buffer.from(decodeBase58(signature));
    if (b58.length === 64) return b58;
  } catch { /* not base58 */ }
  const b64 = Buffer.from(signature, "base64");
  return b64.length === 64 ? b64 : null;
}

/** Checks an Ed25519 signature of `message` by a Solana address. A signature, never a transaction. */
export function verifySolanaSignature(address: string, message: string, signature: string): boolean {
  if (!isValidSolanaAddress(address)) return false;
  const sig = signatureBytes(signature);
  if (!sig) return false;
  try {
    const key = createPublicKey({ key: Buffer.concat([SPKI_ED25519, Buffer.from(decodeBase58(address))]), format: "der", type: "spki" });
    return verify(null, Buffer.from(message, "utf8"), key, sig);
  } catch {
    return false;
  }
}
