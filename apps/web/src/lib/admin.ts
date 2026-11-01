import type { Document, ObjectId } from "mongodb";
import { ApiError } from "./api";
import { isAdmin, type User } from "./auth";
import { getDb } from "./db";

export function requireAdmin(user: User) {
  if (!isAdmin(user)) throw new ApiError(403, "Moderators only.");
}

export async function audit(actorId: ObjectId, action: string, target: Document) {
  const db = await getDb();
  await db.collection("audit_log").insertOne({ actorId, action, target, createdAt: new Date() });
}
