import { ApiError, route } from "@/lib/api";
import { getList, logActivity, oid } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Revoking makes the invite's link stop working at once, for emailed and link invites alike. */
export const DELETE = route<{ id: string; inviteId: string }>(async ({ user, params }) => {
  const { list } = await getList(params.id, user._id, "admin");
  const db = await getDb();
  const { deletedCount } = await db.collection("tokens").deleteOne({ _id: oid(params.inviteId), kind: "list_invite", listId: list._id });
  if (!deletedCount) throw new ApiError(404, "That invitation was already used, revoked or expired.");
  await logActivity(list._id, user._id, "revoked an invitation");
  return { ok: true };
});
