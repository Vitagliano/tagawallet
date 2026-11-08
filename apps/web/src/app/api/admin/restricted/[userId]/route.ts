import { notFound, route } from "@/lib/api";
import { audit, requireAdmin } from "@/lib/admin";
import { oid } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Lifts a restriction. Profiles made private by it stay private until the owner publishes again. */
export const DELETE = route<{ userId: string }>(async ({ user, params }) => {
  requireAdmin(user);
  const db = await getDb();
  const r = await db.collection("users").updateOne({ _id: oid(params.userId), restrictedAt: { $ne: null } }, { $set: { restrictedAt: null } });
  if (!r.matchedCount) throw notFound("That account isn't restricted.");
  await audit(user._id, "user.unrestrict", { userId: oid(params.userId) });
  return { ok: true };
});
