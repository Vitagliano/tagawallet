import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyMessage } from "viem";
import { isValidEvmAddress, normalizeAddress, truncateAddress } from "@tagawallet/shared";
import { ApiError, publicRoute } from "@/lib/api";
import { createSession, loginWithIdentity, randomToken, sessionCookie, sha256 } from "@/lib/auth";
import { getDb } from "@/lib/db";

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
  const input = await body(z.object({ address: z.string(), signature: z.string().regex(/^0x[0-9a-fA-F]+$/), nonce: z.string().max(100) }));
  if (!isValidEvmAddress(input.address)) throw new ApiError(422, "That isn't a valid EVM address.");
  const db = await getDb();
  const consumed = await db.collection("tokens").findOneAndDelete({ tokenHash: sha256(input.nonce), kind: "wallet_nonce", expiresAt: { $gt: new Date() } });
  if (!consumed) throw new ApiError(400, "This sign-in request expired. Try again.");
  const ok = await verifyMessage({
    address: input.address as `0x${string}`, message: signInMessage(input.nonce), signature: input.signature as `0x${string}`,
  }).catch(() => false);
  if (!ok) throw new ApiError(401, "That signature doesn't match the address.");
  const account = await loginWithIdentity({
    provider: "wallet", subject: normalizeAddress(input.address, "evm"), displayName: truncateAddress(input.address), current: user,
  });
  const session = await createSession(account._id);
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookie(session.token, session.maxAge));
  return res;
}, { rate: { name: "wallet-login", limit: 20, windowSec: 900 } });
