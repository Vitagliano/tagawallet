import { ObjectId } from "mongodb";
import { extensionTagSchema, provenanceText } from "@tagawallet/shared";
import { ApiError, route, ser } from "@/lib/api";
import { getList, getOwnEntity, logActivity, track, trackFirst } from "@/lib/access";
import { getDb } from "@/lib/db";
import { addToList, upsertWallet } from "@/lib/wallets";

async function chooseList(user: { _id: never; lastListId?: never; extensionSettings?: { defaultListId?: string | null } }, input: { listId?: string; newListName?: string }) {
  const db = await getDb();
  const now = new Date();
  if (input.newListName) {
    const doc = { name: input.newListName, description: "", tags: [], ownerId: user._id, visibility: "private", collaborators: [], createdAt: now, updatedAt: now, deletedAt: null };
    const { insertedId } = await db.collection("lists").insertOne(doc);
    await trackFirst("first_list_created", user._id);
    return { ...doc, _id: insertedId };
  }
  if (input.listId) return (await getList(input.listId, user._id, "editor")).list;
  const preferred = user.extensionSettings?.defaultListId ?? user.lastListId;
  if (preferred) {
    const list = await db.collection("lists").findOne({ _id: new ObjectId(String(preferred)), ownerId: user._id, deletedAt: null, visibility: "private" });
    if (list) return list;
  }
  const recent = await db.collection("lists").find({ ownerId: user._id, deletedAt: null, visibility: "private" }).sort({ updatedAt: -1 }).limit(1).next();
  if (recent) return recent;
  throw new ApiError(422, "Create a list first.", { needsList: true });
}

/** Idempotent on address and chain, so an offline queue can retry safely. */
export const POST = route(async ({ user, body }) => {
  const input = await body(extensionTagSchema);
  const db = await getDb();
  const list = await chooseList(user as never, input);
  const { wallet } = await upsertWallet(user._id, { ...input, source: "extension" });
  const fields = { displayLabel: input.displayLabel, notes: input.notes, tags: input.tags, status: input.status, links: input.links, updatedAt: new Date() };
  await db.collection("wallets").updateOne({ _id: wallet._id }, { $set: fields });
  await addToList(list._id, wallet._id, user._id);
  await logActivity(list._id, user._id, "tagged a wallet", input.displayLabel);
  let entityId = input.entityId;
  if (input.newEntityName) {
    const now = new Date();
    const { insertedId } = await db.collection("entities").insertOne({
      name: input.newEntityName, type: "other", description: "", avatarUrl: null, links: [], tags: [], ownerId: user._id, visibility: "private",
      verification: { status: "unverified", verifiedAt: null, verifiedBy: null, methods: [] }, createdAt: now, updatedAt: now,
    });
    entityId = insertedId.toString();
    await trackFirst("first_entity_created", user._id);
  }
  if (entityId) {
    const entity = await getOwnEntity(entityId, user._id);
    const now = new Date();
    await db.collection("wallet_entity_links").updateOne({ walletId: wallet._id, entityId: entity._id }, {
      $setOnInsert: { relationship: "associated", visibility: "private", source: "extension", claimedBy: user._id, evidence: [], createdAt: now, updatedAt: now },
    }, { upsert: true });
  }
  await db.collection("users").updateOne({ _id: user._id }, { $set: { lastListId: list._id } });
  await trackFirst("first_wallet_tagged_from_extension", user._id);
  await track("wallet_tagged_extension", user._id);
  return ser({
    walletId: wallet._id, listId: list._id, listName: list.name, shared: list.visibility === "shared",
    provenance: provenanceText(list.visibility === "shared" ? "shared" : "private", list.name),
  });
}, { cors: true, rate: { name: "tag", limit: 120, windowSec: 60 } });
export { preflight as OPTIONS } from "@/lib/api";
