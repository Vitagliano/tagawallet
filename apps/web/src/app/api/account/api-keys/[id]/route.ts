import { ApiError, route } from "@/lib/api";
import { oid } from "@/lib/access";
import { getDb } from "@/lib/db";

/** Revoked keys stop working on the next request. */
export const DELETE = route<{ id: string }>(async ({ user, params }) => {
  const db = await getDb();
  const r = await db.collection("api_keys").updateOne({ _id: oid(params.id), userId: user._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
  if (!r.matchedCount) throw new ApiError(404, "That key was already revoked.");
  return { ok: true };
});
