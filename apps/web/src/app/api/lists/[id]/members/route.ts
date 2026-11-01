import { inviteSchema } from "@tagawallet/shared";
import { route } from "@/lib/api";
import { getList, logActivity, trackFirst } from "@/lib/access";
import { randomToken, sha256 } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";

/** Creates an invitation: bound to an email when given, otherwise a shareable link. */
export const POST = route<{ id: string }>(async ({ user, params, body }) => {
  const { email, role } = await body(inviteSchema);
  const { list } = await getList(params.id, user._id, "admin");
  const db = await getDb();
  const token = randomToken();
  await db.collection("tokens").insertOne({
    kind: "list_invite", tokenHash: sha256(token), listId: list._id, role, email: email ?? null, invitedBy: user._id,
    expiresAt: new Date(Date.now() + 14 * 864e5),
  });
  await db.collection("lists").updateOne({ _id: list._id, visibility: "private" }, { $set: { visibility: "shared" } });
  await trackFirst("first_shared_list_created", user._id);
  const url = `${appUrl()}/invite/${token}`;
  if (email) {
    await sendEmail(email, `${user.displayName} invited you to a TagAWallet list`,
      `${user.displayName} invited you to "${list.name}" as ${role}.\n\nAccept within 14 days:\n${url}`);
  }
  await logActivity(list._id, user._id, "created an invitation", role);
  return { url, role, email: email ?? null };
}, { rate: { name: "invite", limit: 30, windowSec: 3600 } });
