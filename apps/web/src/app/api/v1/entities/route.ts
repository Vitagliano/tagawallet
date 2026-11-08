import { apiKeyRoute } from "@/lib/api";
import { getDb } from "@/lib/db";
import { searchEntities } from "@/lib/search";

/** GET /api/v1/entities?q=: your people and projects. */
export const GET = apiKeyRoute(async ({ req, user }) => {
  const db = await getDb();
  const entities = await searchEntities(user._id, (req.nextUrl.searchParams.get("q") ?? "").slice(0, 200), 500);
  const counts = await db.collection("wallet_entity_links")
    .aggregate([{ $match: { entityId: { $in: entities.map((e) => e._id) } } }, { $group: { _id: "$entityId", n: { $sum: 1 } } }]).toArray();
  return {
    entities: entities.map((e) => ({
      id: e._id.toString(), name: e.name, type: e.type, description: e.description ?? "", tags: e.tags ?? [],
      links: (e.links ?? []).map((l: { type: string; url: string; label?: string }) => ({ type: l.type, url: l.url, label: l.label })),
      visibility: e.visibility, verification: e.verification?.status ?? "unverified", slug: e.slug ?? null,
      walletCount: counts.find((c) => c._id.equals(e._id))?.n ?? 0,
    })),
  };
});
