import { NextResponse } from "next/server";
import { z } from "zod";
import { API_KEY_PREFIX, ApiError, route, ser } from "@/lib/api";
import { randomToken, sha256 } from "@/lib/auth";
import { track } from "@/lib/access";
import { getDb } from "@/lib/db";

const MAX_KEYS = 10;

/** Your API keys. The secret itself is shown once, at creation, and only its hash is stored. */
export const GET = route(async ({ user }) => {
  const db = await getDb();
  const keys = await db.collection("api_keys")
    .find({ userId: user._id, revokedAt: null }, { projection: { name: 1, prefix: 1, createdAt: 1, lastUsedAt: 1 } })
    .sort({ createdAt: -1 }).toArray();
  return ser(keys);
});

export const POST = route(async ({ user, body }) => {
  const { name } = await body(z.object({ name: z.string().trim().min(1, "Name the key, e.g. the script that uses it").max(60) }));
  const db = await getDb();
  if (await db.collection("api_keys").countDocuments({ userId: user._id, revokedAt: null }) >= MAX_KEYS) {
    throw new ApiError(422, `You can have up to ${MAX_KEYS} keys. Revoke one you no longer use.`);
  }
  const key = `${API_KEY_PREFIX}${randomToken(24)}`;
  const doc = { userId: user._id, name, prefix: key.slice(0, 10), tokenHash: sha256(key), createdAt: new Date(), lastUsedAt: null, revokedAt: null };
  const { insertedId } = await db.collection("api_keys").insertOne(doc);
  await track("api_key_created", user._id);
  return NextResponse.json({ ...ser({ id: insertedId, name, prefix: doc.prefix, createdAt: doc.createdAt }), key }, { status: 201, headers: { "Cache-Control": "no-store" } });
}, { rate: { name: "api-key-create", limit: 20, windowSec: 3600 } });
