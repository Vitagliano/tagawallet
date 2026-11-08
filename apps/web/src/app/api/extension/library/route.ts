import { route, ser } from "@/lib/api";
import { accessibleLists, roleIn } from "@/lib/access";
import { getDb } from "@/lib/db";
import { hydrateWallets } from "@/lib/wallets";

/**
 * The extension panel's home: the same directory as the dashboard (people, projects, lists)
 * plus the most recently changed wallets. Read-only, and only what the person can already see.
 */
export const GET = route(async ({ user }) => {
  const db = await getDb();
  const lists = (await accessibleLists(user._id)).filter((l) => !l.archivedAt);
  const entities = await db.collection("entities").find({ ownerId: user._id }, { projection: { name: 1, type: 1, visibility: 1, verification: 1, avatarUrl: 1 } })
    .sort({ updatedAt: -1 }).limit(300).toArray();
  const [listCounts, entityCounts, recent, walletCount] = await Promise.all([
    db.collection("wallet_list_memberships").aggregate([{ $match: { listId: { $in: lists.map((l) => l._id) } } }, { $group: { _id: "$listId", n: { $sum: 1 } } }]).toArray(),
    db.collection("wallet_entity_links").aggregate([{ $match: { entityId: { $in: entities.map((e) => e._id) } } }, { $group: { _id: "$entityId", n: { $sum: 1 } } }]).toArray(),
    db.collection("wallets").find({ ownerId: user._id }).sort({ updatedAt: -1 }).limit(8).toArray(),
    db.collection("wallets").countDocuments({ ownerId: user._id }),
  ]);
  const count = (rows: { _id: { toString(): string }; n: number }[], id: { toString(): string }) => rows.find((r) => r._id.toString() === id.toString())?.n ?? 0;
  return ser({
    lists: lists.map((l) => ({
      _id: l._id, name: l.name, visibility: l.visibility, role: roleIn(l, user._id), walletCount: count(listCounts as never, l._id),
      shared: l.visibility === "shared" || (l.collaborators?.length ?? 0) > 0, isPublic: !!l.publishedAt,
    })),
    entities: entities.map((e) => ({
      _id: e._id, name: e.name, type: e.type, walletCount: count(entityCounts as never, e._id),
      isPublic: e.visibility === "public", verified: e.verification?.status === "verified", avatarUrl: e.avatarUrl || undefined,
    })),
    recent: await hydrateWallets(recent, user._id),
    counts: { wallets: walletCount, lists: lists.length, entities: entities.length },
  });
}, { cors: true });
export { preflight as OPTIONS } from "@/lib/api";
