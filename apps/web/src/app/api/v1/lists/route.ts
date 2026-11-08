import { apiKeyRoute } from "@/lib/api";
import { accessibleLists, roleIn } from "@/lib/access";
import { getDb } from "@/lib/db";

/** GET /api/v1/lists: your lists and the ones shared with you. */
export const GET = apiKeyRoute(async ({ user }) => {
  const db = await getDb();
  const lists = (await accessibleLists(user._id)).filter((l) => !l.archivedAt);
  const counts = await db.collection("wallet_list_memberships")
    .aggregate([{ $match: { listId: { $in: lists.map((l) => l._id) } } }, { $group: { _id: "$listId", n: { $sum: 1 } } }]).toArray();
  const n = new Map(counts.map((c) => [c._id.toString(), c.n as number]));
  return {
    lists: lists.map((l) => ({
      id: l._id.toString(), name: l.name, description: l.description ?? "", visibility: l.visibility, role: roleIn(l, user._id),
      walletCount: n.get(l._id.toString()) ?? 0, updatedAt: l.updatedAt,
    })),
  };
});
