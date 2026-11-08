import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyMessage } from "viem";
import { isValidEvmAddress, isValidSolanaAddress, normalizeAddress, truncateAddress } from "@tagawallet/shared";
import { ApiError, publicRoute } from "@/lib/api";
import { createSession, IdentityTakenError, loginWithIdentity, randomToken, sessionCookie, sha256 } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { verifySolanaSignature } from "@/lib/solana";

const signInMessage = (nonce: string) =>
  `Sign in to TagAWallet.\n\nThis only proves you control this address. It is not a transaction and costs nothing.\n\nNonce: ${nonce}`;

/** Issues a one-time challenge. Signing is the only wallet action we ever ask for. */
export const GET = publicRoute(async () => {
  const nonce = randomToken(16);
  const db = await getDb();
  await db.collection("tokens").insertOne({ kind: "wallet_nonce", tokenHash: sha256(nonce), expiresAt: new Date(Date.now() + 600e3) });
  return { nonce, message: signInMessage(nonce) };
}, { rate: { name: "wallet-nonce", limit: 30, windowSec: 300 } });

export const POST = publicRoute(async ({ body, user }) => {
  const input = await body(z.object({
    address: z.string().max(120), signature: z.string().max(400), nonce: z.string().max(100),
    // EVM wallets sign with personal_sign; Solana wallets like Phantom sign with Ed25519.
    chain: z.enum(["evm", "solana"]).optional().default("evm"),
  }));
  const solana = input.chain === "solana";
  if (solana ? !isValidSolanaAddress(input.address) : !isValidEvmAddress(input.address)) throw new ApiError(422, `That isn't a valid ${solana ? "Solana" : "EVM"} address.`);
  if (!solana && !/^0x[0-9a-fA-F]+$/.test(input.signature)) throw new ApiError(422, "That signature isn't in the expected format.");
  const db = await getDb();
  const consumed = await db.collection("tokens").findOneAndDelete({ tokenHash: sha256(input.nonce), kind: "wallet_nonce", expiresAt: { $gt: new Date() } });
  if (!consumed) throw new ApiError(400, "This sign-in request expired. Try again.");
  const ok = solana
    ? verifySolanaSignature(input.address, signInMessage(input.nonce), input.signature)
    : await verifyMessage({ address: input.address as `0x${string}`, message: signInMessage(input.nonce), signature: input.signature as `0x${string}` }).catch(() => false);
  if (!ok) throw new ApiError(401, "That signature doesn't match the address.");
  const account = await loginWithIdentity({
    provider: "wallet", subject: normalizeAddress(input.address, solana ? "solana" : "evm"), displayName: truncateAddress(input.address), current: user,
  }).catch((err) => { throw err instanceof IdentityTakenError ? new ApiError(409, err.message) : err; });
  const session = await createSession(account._id);
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookie(session.token, session.maxAge));
  return res;
}, { rate: { name: "wallet-login", limit: 20, windowSec: 900 } });
