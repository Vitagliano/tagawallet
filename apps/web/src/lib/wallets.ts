import { ObjectId, type Document } from "mongodb";
import { CHAINS, normalizeAddress, chainFamily, type ChainId } from "@tagawallet/shared";
import { getDb } from "./db";

export function normalizedFor(address: string, chain: ChainId) {
  return normalizeAddress(address, chainFamily(chain));
}

/** Finds or creates this user's record for an address, so one address is one record per chain. */
export async function upsertWallet(ownerId: ObjectId, w: {
  address: string; chain: ChainId; displayLabel?: string; notes?: string; tags?: string[]; status?: string;
  links?: Document[]; source?: string;
}) {
  const db = await getDb();
  const now = new Date();
  const normalizedAddress = normalizedFor(w.address, w.chain);
  const key = { ownerId, chain: w.chain, normalizedAddress };
  const existing = await db.collection("wallets").findOne(key);
  if (existing) return { wallet: existing, created: false };
  const doc = {
    ...key, address: w.address.trim(), displayLabel: w.displayLabel ?? "", notes: w.notes ?? "", tags: w.tags ?? [],
    status: w.status ?? "none", links: w.links ?? [], source: w.source ?? "user", createdAt: now, updatedAt: now,
  };
  try {
    const { insertedId } = await db.collection("wallets").insertOne(doc);
    return { wallet: { ...doc, _id: insertedId }, created: true };
  } catch (err) {
    if ((err as { code?: number }).code !== 11000) throw err;
    return { wallet: (await db.collection("wallets").findOne(key))!, created: false };
  }
}

export async function addToList(listId: ObjectId, walletId: ObjectId, addedBy: ObjectId) {
  const db = await getDb();
  const r = await db.collection("wallet_list_memberships").updateOne(
    { listId, walletId },
    { $setOnInsert: { addedBy, addedAt: new Date() } },
    { upsert: true },
  );
  if (r.upsertedCount) {
    await db.collection("lists").updateOne({ _id: listId }, { $set: { updatedAt: new Date() } });
  }
  return r.upsertedCount > 0;
}

/** Attaches entity, list and link context. Only the viewer's own records show private entity links. */
export async function hydrateWallets<T extends Document>(wallets: T[], viewerId: ObjectId): Promise<(T & Document & { _id: ObjectId })[]> {
  if (!wallets.length) return [];
  const db = await getDb();
  const ids = wallets.map((w) => w._id);
  const [memberships, entityLinks] = await Promise.all([
    db.collection("wallet_list_memberships").find({ walletId: { $in: ids } }).toArray(),
    db.collection("wallet_entity_links").find({ walletId: { $in: ids } }).toArray(),
  ]);
  const lists = await db.collection("lists").find({
    _id: { $in: memberships.map((m) => m.listId) }, deletedAt: null,
    $or: [{ ownerId: viewerId }, { "collaborators.userId": viewerId }],
  }, { projection: { name: 1, visibility: 1 } }).toArray();
  const listById = new Map(lists.map((l) => [l._id.toString(), l]));
  const entities = await db.collection("entities").find({ _id: { $in: entityLinks.map((l) => l.entityId) } },
    { projection: { name: 1, type: 1, verification: 1, slug: 1, visibility: 1 } }).toArray();
  const entityById = new Map(entities.map((e) => [e._id.toString(), e]));
  return (wallets as Document[]).map((w) => {
    const own = w.ownerId.equals(viewerId);
    return {
      ...w, own, explorerUrl: CHAINS[w.chain as ChainId]?.explorer + w.address,
      lists: memberships.filter((m) => m.walletId.equals(w._id)).map((m) => listById.get(m.listId.toString())).filter(Boolean),
      entities: entityLinks.filter((l) => l.walletId.equals(w._id) && (own || l.visibility !== "private")).map((l) => {
        const e = entityById.get(l.entityId.toString());
        return e && { ...e, relationship: l.relationship, linkVisibility: l.visibility, source: l.source };
      }).filter(Boolean),
    } as never;
  });
}
