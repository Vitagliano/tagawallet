import type { ObjectId } from "mongodb";
import { getDb } from "./db";

export type Publisher = { name: string; handle?: string };

/** Who made something public: their display name, and their handle only while their public profile is on. */
export async function publishers(ownerIds: ObjectId[]): Promise<Map<string, Publisher>> {
  if (!ownerIds.length) return new Map();
  const db = await getDb();
  const users = await db.collection("users").find({ _id: { $in: ownerIds } }, { projection: { displayName: 1, handle: 1, profilePublic: 1 } }).toArray();
  return new Map(users.map((u) => [u._id.toString(), { name: (u.displayName as string) || "A TagAWallet user", ...(u.profilePublic && u.handle ? { handle: u.handle as string } : {}) }]));
}
