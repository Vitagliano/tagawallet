import { route } from "@/lib/api";
import { getOwnEntity, oid } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Unlinks only. The wallet itself stays, with its tags and notes. */
export const DELETE = route<{ id: string; walletId: string }>(async ({ user, params }) => {
  const entity = await getOwnEntity(params.id, user._id);
  const db = await getDb();
  await db.collection("wallet_entity_links").deleteOne({ entityId: entity._id, walletId: oid(params.walletId) });
  return { ok: true };
});
