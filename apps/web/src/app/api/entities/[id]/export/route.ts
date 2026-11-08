import { route } from "@/lib/api";
import { getOwnEntity } from "@/lib/access";
import { getDb } from "@/lib/db";
import { exportResponse, exportRows, safeFilename } from "@/lib/export";

/** One person or project and every wallet linked to it. */
export const GET = route<{ id: string }>(async ({ user, params, req }) => {
  const entity = await getOwnEntity(params.id, user._id);
  const db = await getDb();
  const links = await db.collection("wallet_entity_links").find({ entityId: entity._id }).toArray();
  const wallets = await db.collection("wallets").find({ _id: { $in: links.map((l) => l.walletId) } }).toArray();
  const rows = await exportRows(wallets, user._id);
  return exportResponse(req.nextUrl.searchParams.get("format"), safeFilename(entity.name, "entity"), rows, {
    entity: { name: entity.name, type: entity.type, description: entity.description, links: entity.links ?? [] },
  });
}, { rate: { name: "entity-export", limit: 60, windowSec: 3600 } });
