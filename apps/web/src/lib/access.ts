import { ObjectId, type Document, type WithId } from "mongodb";
import { getDb } from "./db";
import { notFound, ApiError } from "./api";

export type ListRole = "owner" | "admin" | "editor" | "viewer";

export function oid(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw notFound();
  return new ObjectId(id);
}

export function roleIn(list: Document, userId: ObjectId): ListRole | null {
  if (list.ownerId.equals(userId)) return "owner";
  return list.collaborators?.find((c: Document) => c.userId.equals(userId))?.role ?? null;
}

const RANK: Record<ListRole, number> = { viewer: 0, editor: 1, admin: 2, owner: 3 };

/** Loads a list the user may access. A list they can't see is a 404, so ids reveal nothing. */
export async function getList(id: string, userId: ObjectId, min: ListRole = "viewer") {
  const db = await getDb();
  const list = await db.collection("lists").findOne({ _id: oid(id), deletedAt: null });
  const role = list && roleIn(list, userId);
  if (!list || !role) throw notFound("List not found");
  if (RANK[role] < RANK[min]) throw new ApiError(403, `This needs ${min} access to the list.`);
  return { list, role };
}

export async function accessibleLists(userId: ObjectId, projection?: Document) {
  const db = await getDb();
  return db.collection("lists")
    .find({ deletedAt: null, $or: [{ ownerId: userId }, { "collaborators.userId": userId }] }, projection ? { projection } : {})
    .sort({ updatedAt: -1 }).toArray();
}

/** Lists shared *with* this user, i.e. the only route to someone else's wallet records. */
export async function collaboratorListIds(userId: ObjectId) {
  const db = await getDb();
  const lists = await db.collection("lists")
    .find({ deletedAt: null, "collaborators.userId": userId }, { projection: { _id: 1 } }).toArray();
  return lists.map((l) => l._id);
}

export async function getWallet(id: string, userId: ObjectId, write = false): Promise<{ wallet: WithId<Document>; own: boolean }> {
  const db = await getDb();
  const wallet = await db.collection("wallets").findOne({ _id: oid(id) });
  if (!wallet) throw notFound("Wallet not found");
  if (wallet.ownerId.equals(userId)) return { wallet, own: true };
  const ids = (await db.collection("wallet_list_memberships").find({ walletId: wallet._id }).toArray()).map((m) => m.listId);
  const lists = await db.collection("lists").find({ _id: { $in: ids }, deletedAt: null, "collaborators.userId": userId }).toArray();
  const roles = lists.map((l) => roleIn(l, userId)!);
  if (!roles.length) throw notFound("Wallet not found");
  if (write && !roles.some((r) => RANK[r] >= RANK.editor)) throw new ApiError(403, "You have view-only access to this wallet.");
  return { wallet, own: false };
}

export async function getOwnEntity(id: string, userId: ObjectId) {
  const db = await getDb();
  const entity = await db.collection("entities").findOne({ _id: oid(id), ownerId: userId });
  if (!entity) throw notFound("Entity not found");
  return entity;
}

/** An entity the user owns, or one reached through a non-private link on a wallet shared with them. */
export async function getVisibleEntity(id: string, userId: ObjectId) {
  const db = await getDb();
  const entity = await db.collection("entities").findOne({ _id: oid(id) });
  if (!entity) throw notFound("Entity not found");
  if (entity.ownerId?.equals(userId)) return { entity, own: true };
  if (entity.visibility === "public" && !entity.moderation?.removedAt) return { entity, own: false };
  const links = await db.collection("wallet_entity_links").find({ entityId: entity._id, visibility: { $ne: "private" } }).toArray();
  const listIds = await collaboratorListIds(userId);
  const hit = links.length && listIds.length && await db.collection("wallet_list_memberships")
    .findOne({ walletId: { $in: links.map((l) => l.walletId) }, listId: { $in: listIds } });
  if (!hit) throw notFound("Entity not found");
  return { entity, own: false };
}

export async function logActivity(listId: ObjectId, userId: ObjectId, action: string, detail = "") {
  const db = await getDb();
  await db.collection("activity").insertOne({ listId, userId, action, detail, createdAt: new Date() });
}

export async function track(name: string, userId?: ObjectId | null, props?: Record<string, string | number | boolean>) {
  const db = await getDb();
  await db.collection("events").insertOne({ name, userId: userId ?? null, props: props ?? {}, createdAt: new Date() }).catch(() => {});
}

export async function trackFirst(name: string, userId: ObjectId) {
  const db = await getDb();
  const seen = await db.collection("events").findOne({ name, userId }, { projection: { _id: 1 } });
  if (!seen) await track(name, userId);
}
