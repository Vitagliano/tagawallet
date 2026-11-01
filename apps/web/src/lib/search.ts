import type { Document, ObjectId } from "mongodb";
import { getDb } from "./db";
import { collaboratorListIds } from "./access";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Case-insensitive substring search scoped to the ownerId index, which keeps it fast at
 * 10k+ wallets per user. Scope comes first: nothing outside the viewer's records is examined.
 */
export async function searchWallets(userId: ObjectId, q: string, chain: string | undefined, limit: number) {
  const db = await getDb();
  const sharedLists = await collaboratorListIds(userId);
  const sharedIds = sharedLists.length
    ? (await db.collection("wallet_list_memberships").find({ listId: { $in: sharedLists } }, { projection: { walletId: 1 } }).toArray()).map((m) => m.walletId)
    : [];
  const scope: Document = { $or: [{ ownerId: userId }, { _id: { $in: sharedIds } }] };
  const and: Document[] = [scope];
  if (chain) and.push({ chain });
  const term = q.trim();
  if (term) {
    const re = { $regex: escape(term), $options: "i" };
    const or: Document[] = [
      { normalizedAddress: re }, { displayLabel: re }, { notes: re }, { tags: re }, { chain: re }, { status: re }, { "links.url": re }, { "links.label": re },
    ];
    // Wallets reached through a matching entity or list count as matches too.
    const entities = await db.collection("entities").find({ ownerId: userId, $or: [{ name: re }, { "links.url": re }, { tags: re }] }, { projection: { _id: 1 } }).limit(500).toArray();
    if (entities.length) {
      const links = await db.collection("wallet_entity_links").find({ entityId: { $in: entities.map((e) => e._id) } }, { projection: { walletId: 1 } }).toArray();
      or.push({ _id: { $in: links.map((l) => l.walletId) } });
    }
    const lists = await db.collection("lists").find({
      deletedAt: null, name: re, $or: [{ ownerId: userId }, { "collaborators.userId": userId }],
    }, { projection: { _id: 1 } }).limit(100).toArray();
    if (lists.length) {
      const members = await db.collection("wallet_list_memberships").find({ listId: { $in: lists.map((l) => l._id) } }, { projection: { walletId: 1 } }).limit(20000).toArray();
      or.push({ _id: { $in: members.map((m) => m.walletId) } });
    }
    and.push({ $or: or });
  }
  return db.collection("wallets").find({ $and: and }).sort({ updatedAt: -1 }).limit(limit).toArray();
}

export async function searchEntities(userId: ObjectId, q: string, limit: number) {
  const db = await getDb();
  const term = q.trim();
  const filter: Document = { ownerId: userId };
  if (term) {
    const re = { $regex: escape(term), $options: "i" };
    filter.$or = [{ name: re }, { description: re }, { tags: re }, { "links.url": re }, { "links.label": re }];
  }
  return db.collection("entities").find(filter).sort({ updatedAt: -1 }).limit(limit).toArray();
}
