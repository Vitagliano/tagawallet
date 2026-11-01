import { entityLinkSchema } from "@tagawallet/shared";
import { ApiError, route } from "@/lib/api";
import { getOwnEntity, getWallet } from "@/lib/access";
import { getDb } from "@/lib/db";

export const POST = route<{ id: string }>(async ({ user, params, body }) => {
  const input = await body(entityLinkSchema);
  const entity = await getOwnEntity(params.id, user._id);
  const { wallet, own } = await getWallet(input.walletId, user._id);
  const db = await getDb();
  const prior = await db.collection("wallet_entity_links").findOne({ walletId: wallet._id, entityId: entity._id });
  if (input.visibility === "public") {
    if (!own) throw new ApiError(403, "You can only make your own wallet records public.");
    if (entity.type === "individual" && !prior?.evidence?.some((e: { verifiedAt?: Date }) => e.verifiedAt)) {
      throw new ApiError(422, "Linking a wallet publicly to an individual needs a wallet signature as proof.");
    }
  }
  const now = new Date();
  await db.collection("wallet_entity_links").updateOne(
    { walletId: wallet._id, entityId: entity._id },
    {
      $set: { relationship: input.relationship, visibility: input.visibility, updatedAt: now },
      $setOnInsert: { source: "user", claimedBy: user._id, evidence: [], createdAt: now },
    },
    { upsert: true },
  );
  return { ok: true };
});
