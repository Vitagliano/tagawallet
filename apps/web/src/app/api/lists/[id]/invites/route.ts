import { route, ser } from "@/lib/api";
import { getList } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Pending invitations, for list admins. An emailed invite names its address; a link invite doesn't. */
export const GET = route<{ id: string }>(async ({ user, params }) => {
  const { list } = await getList(params.id, user._id, "admin");
  const db = await getDb();
  const invites = await db.collection("tokens")
    .find({ kind: "list_invite", listId: list._id, expiresAt: { $gt: new Date() } }, { projection: { email: 1, role: 1, expiresAt: 1, createdAt: 1 } })
    .sort({ _id: -1 }).toArray();
  return ser(invites);
});
