import { ApiError, publicRoute, route } from "@/lib/api";
import { sha256 } from "@/lib/auth";
import { logActivity } from "@/lib/access";
import { getDb } from "@/lib/db";

type P = { token: string };

async function findInvite(token: string) {
  const db = await getDb();
  const invite = await db.collection("tokens").findOne({ tokenHash: sha256(token), kind: "list_invite", expiresAt: { $gt: new Date() } });
  if (!invite) throw new ApiError(404, "This invitation has expired or been used.");
  const list = await db.collection("lists").findOne({ _id: invite.listId, deletedAt: null });
  if (!list) throw new ApiError(404, "This invitation has expired or been used.");
  return { invite, list };
}

export const GET = publicRoute<P>(async ({ params }) => {
  const { invite, list } = await findInvite(params.token);
  return { listName: list.name, role: invite.role, email: invite.email };
}, { rate: { name: "invite-view", limit: 60, windowSec: 300 } });

export const POST = route<P>(async ({ user, params }) => {
  const { invite, list } = await findInvite(params.token);
  if (invite.email && invite.email !== user.email) {
    throw new ApiError(403, `This invitation was sent to ${invite.email}. Sign in with that account to accept it.`);
  }
  const db = await getDb();
  if (!list.ownerId.equals(user._id) && !list.collaborators?.some((c: { userId: typeof user._id }) => c.userId.equals(user._id))) {
    await db.collection("lists").updateOne({ _id: list._id }, {
      $push: { collaborators: { userId: user._id, role: invite.role } } as never, $set: { updatedAt: new Date() },
    });
    await logActivity(list._id, user._id, "joined the list", invite.role);
  }
  // Emailed invitations are single use. Link invitations live until they expire or the list is deleted.
  if (invite.email) await db.collection("tokens").deleteOne({ _id: invite._id });
  return { listId: list._id.toString() };
});
