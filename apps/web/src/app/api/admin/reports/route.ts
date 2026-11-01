import { route, ser } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = route(async ({ user, req }) => {
  requireAdmin(user);
  const db = await getDb();
  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const reports = await db.collection("reports").find({ status }).sort({ createdAt: 1 }).limit(100).toArray();
  const entities = await db.collection("entities").find({ _id: { $in: reports.filter((r) => r.targetType === "entity").map((r) => r.targetId) } },
    { projection: { name: 1, slug: 1, visibility: 1, verification: 1, ownerId: 1, moderation: 1 } }).toArray();
  const history = await db.collection("reports").aggregate([
    { $match: { targetId: { $in: reports.map((r) => r.targetId) } } }, { $group: { _id: "$targetId", n: { $sum: 1 } } },
  ]).toArray();
  return ser(reports.map((r) => ({
    ...r, entity: entities.find((e) => e._id.equals(r.targetId)), priorReports: history.find((h) => h._id.equals(r.targetId))?.n ?? 1,
  })));
});
