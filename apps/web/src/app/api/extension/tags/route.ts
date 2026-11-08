import { CHAIN_IDS, extensionTagSchema, provenanceText } from "@tagawallet/shared";
import { z } from "zod";
import { route, ser } from "@/lib/api";
import { getList, getOwnEntity, logActivity, track, trackFirst } from "@/lib/access";
import { getDb } from "@/lib/db";
import { addToList, normalizedFor, upsertWallet } from "@/lib/wallets";

/** A list only when one is asked for. Without one the wallet just lands in the person's library, private. */
async function chooseList(user: { _id: never }, input: { listId?: string; newListName?: string }) {
  const db = await getDb();
  const now = new Date();
  if (input.newListName) {
    const doc = { name: input.newListName, description: "", tags: [], ownerId: user._id, visibility: "private", collaborators: [], createdAt: now, updatedAt: now, deletedAt: null };
    const { insertedId } = await db.collection("lists").insertOne(doc);
    await trackFirst("first_list_created", user._id);
    return { ...doc, _id: insertedId };
  }
  if (input.listId) return (await getList(input.listId, user._id, "editor")).list;
  return null;
}

/** Idempotent on address and chain, so an offline queue can retry safely. */
export const POST = route(async ({ user, body }) => {
  const input = await body(extensionTagSchema);
  const db = await getDb();
  const list = await chooseList(user as never, input);
  const { wallet } = await upsertWallet(user._id, { ...input, links: input.links ?? [], source: "extension" });
  const fields = { displayLabel: input.displayLabel, notes: input.notes, tags: input.tags, status: input.status, ...(input.links ? { links: input.links } : {}), updatedAt: new Date() };
  await db.collection("wallets").updateOne({ _id: wallet._id }, { $set: fields });
  if (list) {
    await addToList(list._id, wallet._id, user._id);
    await logActivity(list._id, user._id, "tagged a wallet", input.displayLabel);
    await db.collection("users").updateOne({ _id: user._id }, { $set: { lastListId: list._id } });
  }
  let entityId = input.entityId;
  // Typing a name that already exists links to it, rather than making a twin.
  const same = input.newEntityName
    ? await db.collection("entities").findOne({ ownerId: user._id, name: input.newEntityName }, { collation: { locale: "en", strength: 2 }, projection: { _id: 1 } })
    : null;
  if (same) entityId = same._id.toString();
  else if (input.newEntityName) {
    const now = new Date();
    const type = input.newEntityType === "individual" ? "individual" : (input.newEntityType ?? "project");
    const { insertedId } = await db.collection("entities").insertOne({
      name: input.newEntityName, type, description: "", avatarUrl: null, links: [], tags: [], ownerId: user._id, visibility: "private",
      verification: { status: "unverified", verifiedAt: null, verifiedBy: null, methods: [] }, createdAt: now, updatedAt: now,
    });
    entityId = insertedId.toString();
    await trackFirst("first_entity_created", user._id);
  }
  if (entityId) {
    const entity = await getOwnEntity(entityId, user._id);
    const now = new Date();
    await db.collection("wallet_entity_links").updateOne({ walletId: wallet._id, entityId: entity._id }, {
      $set: { relationship: input.relationship ?? "associated", updatedAt: now },
      $setOnInsert: { visibility: "private", source: "extension", claimedBy: user._id, evidence: [], createdAt: now },
    }, { upsert: true });
  }
  await trackFirst("first_wallet_tagged_from_extension", user._id);
  await track("wallet_tagged_extension", user._id);
  return ser({
    walletId: wallet._id, listId: list?._id ?? null, listName: list?.name ?? null, shared: list?.visibility === "shared",
    provenance: provenanceText(list?.visibility === "shared" ? "shared" : "private", list?.name),
  });
}, { cors: true, rate: { name: "tag", limit: 120, windowSec: 60 } });
const untagSchema = z.object({ address: z.string().trim().min(1).max(120), chain: z.enum(CHAIN_IDS) });

/** Removes the person's own record for an address. Idempotent, so a queued delete can retry safely. */
export const DELETE = route(async ({ user, body }) => {
  const { address, chain } = await body(untagSchema);
  const db = await getDb();
  const wallet = await db.collection("wallets").findOne({ ownerId: user._id, chain, normalizedAddress: normalizedFor(address, chain) }, { projection: { _id: 1 } });
  if (!wallet) return { ok: true, removed: false };
  await Promise.all([
    db.collection("wallet_list_memberships").deleteMany({ walletId: wallet._id }),
    db.collection("wallet_entity_links").deleteMany({ walletId: wallet._id }),
    db.collection("wallets").deleteOne({ _id: wallet._id }),
  ]);
  return { ok: true, removed: true };
}, { cors: true, rate: { name: "untag", limit: 120, windowSec: 60 } });
export { preflight as OPTIONS } from "@/lib/api";
