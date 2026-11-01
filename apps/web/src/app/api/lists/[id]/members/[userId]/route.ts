import { z } from "zod";
import { ROLES } from "@tagawallet/shared";
import { ApiError, route } from "@/lib/api";
import { getList, logActivity, oid } from "@/lib/access";
import { getDb } from "@/lib/db";

type P = { id: string; userId: string };

export const PATCH = route<P>(async ({ user, params, body }) => {
  const { role } = await body(z.object({ role: z.enum(ROLES) }));
  const { list } = await getList(params.id, user._id, "admin");
  const db = await getDb();
  await db.collection("lists").updateOne(
    { _id: list._id, "collaborators.userId": oid(params.userId) },
    { $set: { "collaborators.$.role": role, updatedAt: new Date() } },
  );
  await logActivity(list._id, user._id, "changed a member's role", role);
  return { ok: true };
});

/** Admins remove anyone but the owner, and any member can remove themselves. */
export const DELETE = route<P>(async ({ user, params }) => {
  const target = oid(params.userId);
  const self = target.equals(user._id);
  const { list } = await getList(params.id, user._id, self ? "viewer" : "admin");
  if (list.ownerId.equals(target)) throw new ApiError(422, "The owner can't be removed from their own list.");
  const db = await getDb();
  await db.collection("lists").updateOne({ _id: list._id }, { $pull: { collaborators: { userId: target } } } as never);
  await logActivity(list._id, user._id, self ? "left the list" : "removed a member");
  return { ok: true };
});
