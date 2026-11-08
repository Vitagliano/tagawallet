import { z } from "zod";
import { VERIFY_METHODS, objectId, normalizeLink } from "@tagawallet/shared";
import { ApiError, route, ser } from "@/lib/api";
import { getOwnEntity, getWallet, oid } from "@/lib/access";
import { randomToken } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { checkDns, checkEns, checkMeta, checkSignature, checkXPost, signatureMessage, verifyToken } from "@/lib/verify";

const start = z.object({
  method: z.enum(VERIFY_METHODS),
  target: z.string().trim().min(1).max(2048),       // the handle URL, domain, ENS name or wallet id being claimed
});
const check = z.object({
  verificationId: objectId,
  proof: z.string().trim().max(2048).optional(),    // a post URL, or a signature
});

function instructions(method: string, code: string, message?: string) {
  switch (method) {
    case "x_post": return `Post this from the account, then paste the post's URL: ${verifyToken(code)}`;
    case "dns": return `Add a TXT record on the domain with the value: ${verifyToken(code)}`;
    case "meta": return `Add this to your homepage's <head>: <meta name="tagawallet-verify" content="${code}">`;
    case "ens": return `Set the text record "tagawallet-verify" on the ENS name to: ${code}`;
    default: return `Sign this message in your wallet. It isn't a transaction: ${message}`;
  }
}

/** Starts a verification when given a method and target, or checks one when given a verificationId. */
export const POST = route<{ id: string }>(async ({ user, params, req }) => {
  const entity = await getOwnEntity(params.id, user._id);
  const db = await getDb();
  const raw = await req.json().catch(() => { throw new ApiError(400, "Expected a JSON body."); });

  if (!raw.verificationId) {
    const { method, target } = start.parse(raw);
    const code = randomToken(12);
    let normalizedTarget = target, message: string | undefined, walletId;
    if (method === "signature") {
      const { wallet, own } = await getWallet(objectId.parse(target), user._id);
      if (!own || wallet.chain === "bitcoin") throw new ApiError(422, "Signature proof is available for your own EVM and Solana wallets.");
      walletId = wallet._id; normalizedTarget = wallet.address;
      message = signatureMessage(entity.name, wallet.address, code);
    } else {
      const type = method === "x_post" ? "x" : method === "ens" ? "ens" : "website";
      const link = normalizeLink(type, target);
      if (!link) throw new ApiError(422, `That isn't a valid ${type === "website" ? "site" : type} for this method.`);
      // Proof only counts for a channel the profile actually lists, so readers can check it themselves.
      if (!(entity.links ?? []).some((l: { url: string }) => l.url === link || (type === "website" && new URL(l.url.startsWith("http") ? l.url : "https://x.invalid").hostname === new URL(link).hostname))) {
        throw new ApiError(422, "Add this link to the entity first, then verify it.");
      }
      normalizedTarget = link;
    }
    const doc = { entityId: entity._id, userId: user._id, method, target: normalizedTarget, code, message, walletId, status: "pending", createdAt: new Date() };
    const { insertedId } = await db.collection("verifications").insertOne(doc);
    return ser({ ...doc, _id: insertedId, instructions: instructions(method, code, message) });
  }

  const { verificationId, proof } = check.parse(raw);
  const v = await db.collection("verifications").findOne({ _id: oid(verificationId), entityId: entity._id });
  if (!v) throw new ApiError(404, "Verification not found.");
  let passed = false;
  if (v.method === "x_post") passed = !!proof && await checkXPost(proof, v.target, v.code);
  if (v.method === "dns") passed = await checkDns(new URL(v.target).hostname, v.code);
  if (v.method === "meta") passed = await checkMeta(v.target, v.code);
  if (v.method === "ens") passed = await checkEns(v.target, v.code);
  if (v.method === "signature") passed = !!proof && await checkSignature(v.target, v.message, proof);
  if (!passed) {
    await db.collection("verifications").updateOne({ _id: v._id }, { $set: { lastCheckedAt: new Date() } });
    throw new ApiError(422, "We couldn't find the proof yet. DNS and ENS changes can take a few minutes to appear.");
  }
  const now = new Date();
  await db.collection("verifications").updateOne({ _id: v._id }, { $set: { status: "verified", verifiedAt: now } });
  if (v.method === "signature") {
    await db.collection("wallet_entity_links").updateOne({ walletId: v.walletId, entityId: entity._id }, {
      $push: { evidence: { type: "signature", value: proof, verifiedAt: now } } as never,
      $set: { source: "verified_claim", updatedAt: now },
      $setOnInsert: { relationship: "owner", visibility: "private", claimedBy: user._id, createdAt: now },
    }, { upsert: true });
    return { status: "wallet_verified", entityStatus: entity.verification?.status };
  }
  // Proof of an official channel is what verifies the entity. It must be one of the entity's own links.
  await db.collection("entities").updateOne({ _id: entity._id }, {
    $set: { "verification.status": "verified", "verification.verifiedAt": now, "verification.verifiedBy": user._id, updatedAt: now },
    $addToSet: { "verification.methods": v.method, "verification.proofs": { method: v.method, target: v.target } },
  });
  return { status: "verified", entityStatus: "verified" };
}, { rate: { name: "verify", limit: 40, windowSec: 3600 } });
