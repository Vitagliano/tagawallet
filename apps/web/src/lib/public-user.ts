import { ObjectId } from "mongodb";
import { getDb } from "./db";
import { publishers } from "./publishers";

/** A person's public page: only what they published, and only while their public profile is on. */
export async function publicUserPage(handle: string) {
  const db = await getDb();
  const user = await db.collection("users").findOne({ handle: handle.toLowerCase(), profilePublic: true }, { projection: { displayName: 1, handle: 1, bio: 1, createdAt: 1 } });
  if (!user) return null;
  const [entities, lists] = await Promise.all([
    db.collection("entities").find({ ownerId: user._id, visibility: "public", "moderation.removedAt": null }, { projection: { name: 1, slug: 1, type: 1, description: 1, avatarUrl: 1, verification: 1 } }).sort({ publishedAt: -1 }).toArray(),
    db.collection("lists").find({ ownerId: user._id, publishedAt: { $ne: null }, deletedAt: null }, { projection: { name: 1, description: 1, publishedAt: 1 } }).sort({ publishedAt: -1 }).toArray(),
  ]);
  const linkCounts = await db.collection("wallet_entity_links").aggregate([{ $match: { entityId: { $in: entities.map((e) => e._id) }, visibility: "public" } }, { $group: { _id: "$entityId", n: { $sum: 1 } } }]).toArray();
  const listCounts = await Promise.all(lists.map((l) => ownerWalletCount(l._id, user._id)));
  return {
    name: user.displayName as string, handle: user.handle as string, bio: (user.bio ?? "") as string,
    contacts: entities.map((e) => ({
      name: e.name as string, slug: e.slug as string, kind: e.type === "individual" ? "Person" : "Project", description: (e.description ?? "") as string,
      avatarUrl: (e.avatarUrl || null) as string | null, verified: e.verification?.status === "verified",
      wallets: linkCounts.find((c) => c._id.equals(e._id))?.n ?? 0,
    })),
    lists: lists.map((l, i) => ({ id: l._id.toString(), name: l.name as string, description: (l.description ?? "") as string, wallets: listCounts[i]! })),
  };
}

async function ownerWalletCount(listId: ObjectId, ownerId: ObjectId) {
  const db = await getDb();
  const ids = (await db.collection("wallet_list_memberships").find({ listId }, { projection: { walletId: 1 } }).toArray()).map((m) => m.walletId);
  return db.collection("wallets").countDocuments({ _id: { $in: ids }, ownerId });
}

/** A published list: its name and the wallets its owner added (name, labels, chain). Notes never appear. */
export async function publicList(id: string) {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  const list = await db.collection("lists").findOne({ _id: new ObjectId(id), publishedAt: { $ne: null }, deletedAt: null });
  if (!list) return null;
  const ids = (await db.collection("wallet_list_memberships").find({ listId: list._id }).sort({ addedAt: -1 }).limit(1000).toArray()).map((m) => m.walletId);
  const wallets = await db.collection("wallets").find({ _id: { $in: ids }, ownerId: list.ownerId }, { projection: { address: 1, chain: 1, displayLabel: 1, tags: 1 } }).toArray();
  const publishedBy = (await publishers([list.ownerId])).get(list.ownerId.toString()) ?? { name: "A TagAWallet user" };
  return {
    id: list._id.toString(), name: list.name as string, description: (list.description ?? "") as string, publishedBy,
    publishedAt: (list.publishedAt as Date).toISOString(),
    wallets: wallets.map((w) => ({ address: w.address as string, chain: w.chain as string, name: (w.displayLabel || "") as string, tags: (w.tags ?? []) as string[] })),
  };
}
