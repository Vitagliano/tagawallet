import { route, ser } from "@/lib/api";
import { requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

/** Accounts that can't publish after a moderation review. */
export const GET = route(async ({ user }) => {
  requireAdmin(user);
  const db = await getDb();
  const users = await db.collection("users").find({ restrictedAt: { $ne: null }, deletedAt: null }, { projection: { displayName: 1, email: 1, restrictedAt: 1 } })
    .sort({ restrictedAt: -1 }).limit(200).toArray();
  return ser(users);
});
