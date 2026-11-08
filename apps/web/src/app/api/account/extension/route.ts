import { route, ser } from "@/lib/api";
import { getDb } from "@/lib/db";

/** Browsers this account is connected in. Only dates, never anything about what they browsed. */
export const GET = route(async ({ user }) => {
  const db = await getDb();
  const sessions = await db.collection("sessions")
    .find({ userId: user._id, kind: "extension", expiresAt: { $gt: new Date() } }, { projection: { createdAt: 1, expiresAt: 1 } })
    .sort({ createdAt: -1 }).toArray();
  const lastTag = await db.collection("wallets").findOne({ ownerId: user._id, source: "extension" }, { sort: { updatedAt: -1 }, projection: { updatedAt: 1 } });
  return ser({ browsers: sessions, lastTaggedAt: lastTag?.updatedAt ?? null });
});

/** Signs every browser out. Each one shows "Session expired" and offers to reconnect. */
export const DELETE = route(async ({ user }) => {
  const db = await getDb();
  const { deletedCount } = await db.collection("sessions").deleteMany({ userId: user._id, kind: "extension" });
  return { ok: true, disconnected: deletedCount };
});
