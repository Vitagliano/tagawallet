import type { Document } from "mongodb";
import { route, ser } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

export const GET = route(async ({ user, req }) => {
  requireAdmin(user);
  const db = await getDb();
  const status = req.nextUrl.searchParams.get("status") ?? "open";
  const reports = await db.collection("reports").find({ status }).sort({ createdAt: 1 }).limit(100).toArray();
  // Older reports predate entityId, so a profile report's target is its entity.
  const entityIdOf = (r: Document) => r.entityId ?? (r.targetType === "entity" ? r.targetId : null);
  const entities = await db.collection("entities").find({ _id: { $in: reports.map(entityIdOf).filter(Boolean) as never[] } },
    { projection: { name: 1, slug: 1, visibility: 1, verification: 1, ownerId: 1, moderation: 1 } }).toArray();
  const links = await db.collection("wallet_entity_links").find({ _id: { $in: reports.filter((r) => r.targetType === "wallet_entity_link").map((r) => r.targetId) } },
    { projection: { walletId: 1, relationship: 1, visibility: 1, evidence: 1 } }).toArray();
  const wallets = await db.collection("wallets").find({ _id: { $in: links.map((l) => l.walletId) } }, { projection: { address: 1, chain: 1 } }).toArray();
  const owners = await db.collection("users").find({ _id: { $in: entities.map((e) => e.ownerId) } }, { projection: { restrictedAt: 1 } }).toArray();
  const history = await db.collection("reports").aggregate([
    { $match: { targetId: { $in: reports.map((r) => r.targetId) } } }, { $group: { _id: "$targetId", n: { $sum: 1 } } },
  ]).toArray();
  return ser(reports.map((r) => {
    const entity = entities.find((e) => e._id.equals(entityIdOf(r) as never));
    const link = r.targetType === "wallet_entity_link" ? links.find((l) => l._id.equals(r.targetId)) : undefined;
    const wallet = link && wallets.find((w) => w._id.equals(link.walletId));
    return {
      ...r, entity,
      ownerRestricted: !!owners.find((o) => entity?.ownerId && o._id.equals(entity.ownerId))?.restrictedAt,
      link: link ? { relationship: link.relationship, visibility: link.visibility, signed: (link.evidence ?? []).some((e: { verifiedAt?: Date }) => e.verifiedAt), address: wallet?.address, chain: wallet?.chain } : undefined,
      priorReports: history.find((h) => h._id.equals(r.targetId))?.n ?? 1,
    };
  }));
});
