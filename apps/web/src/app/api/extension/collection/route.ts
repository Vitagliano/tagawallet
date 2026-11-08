import { z } from "zod";
import { ApiError, route, ser } from "@/lib/api";
import { getList, getVisibleEntity, roleIn } from "@/lib/access";
import { getDb } from "@/lib/db";
import { hydrateWallets } from "@/lib/wallets";

const query = z.object({ kind: z.enum(["list", "entity"]), id: z.string().min(1).max(64) });
const LIMIT = 200;

/** One list, person or project with its wallets, for the extension panel. Same access rules as the dashboard. */
export const GET = route(async ({ user, req }) => {
  const parsed = query.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new ApiError(422, "Pick a list or a contact.");
  const { kind, id } = parsed.data;
  const db = await getDb();

  if (kind === "list") {
    const { list } = await getList(id, user._id);
    const members = await db.collection("wallet_list_memberships").find({ listId: list._id }).sort({ addedAt: -1 }).limit(LIMIT).toArray();
    const wallets = await db.collection("wallets").find({ _id: { $in: members.map((m) => m.walletId) } }).toArray();
    const order = new Map(members.map((m, i) => [m.walletId.toString(), i]));
    wallets.sort((a, b) => order.get(a._id.toString())! - order.get(b._id.toString())!);
    const total = await db.collection("wallet_list_memberships").countDocuments({ listId: list._id });
    return ser({
      kind, id: list._id, name: list.name, description: list.description ?? "", role: roleIn(list, user._id),
      shared: list.visibility === "shared" || (list.collaborators?.length ?? 0) > 0, total,
      wallets: await hydrateWallets(wallets, user._id),
    });
  }

  const { entity, own } = await getVisibleEntity(id, user._id);
  const links = await db.collection("wallet_entity_links").find({ entityId: entity._id, ...(own ? {} : { visibility: { $ne: "private" } }) }).limit(LIMIT).toArray();
  const found = await db.collection("wallets").find({ _id: { $in: links.map((l) => l.walletId) } }).toArray();
  // Non-owners get the claim but not the owner's private record, as on the dashboard.
  const visible = own ? found : found.map((w) => ({ ...w, notes: "", displayLabel: "", tags: [], links: [] }));
  const wallets = (await hydrateWallets(visible, user._id)).map((w) => ({ ...w, relationship: links.find((l) => l.walletId.equals(w._id))?.relationship }));
  return ser({
    kind, id: entity._id, name: entity.name, type: entity.type, own, total: links.length,
    isPublic: entity.visibility === "public", verified: entity.verification?.status === "verified", slug: entity.visibility === "public" ? entity.slug : undefined,
    wallets,
  });
}, { cors: true });
export { preflight as OPTIONS } from "@/lib/api";
