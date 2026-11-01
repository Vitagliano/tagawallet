import { NextResponse } from "next/server";
import { entityCreateSchema } from "@tagawallet/shared";
import { route, ser } from "@/lib/api";
import { track, trackFirst } from "@/lib/access";
import { getDb } from "@/lib/db";
import { avatarOrThrow } from "@/lib/entities";
import { searchEntities } from "@/lib/search";

export const GET = route(async ({ user, req }) => {
  const db = await getDb();
  const entities = await searchEntities(user._id, req.nextUrl.searchParams.get("q") ?? "", 200);
  const counts = await db.collection("wallet_entity_links")
    .aggregate([{ $match: { entityId: { $in: entities.map((e) => e._id) } } }, { $group: { _id: "$entityId", n: { $sum: 1 } } }]).toArray();
  return ser(entities.map((e) => ({ ...e, walletCount: counts.find((c) => c._id.equals(e._id))?.n ?? 0 })));
});

export const POST = route(async ({ user, body }) => {
  const input = await body(entityCreateSchema);
  const db = await getDb();
  const now = new Date();
  const doc = {
    ...input, avatarUrl: avatarOrThrow(input.avatarUrl), ownerId: user._id, visibility: "private",
    verification: { status: "unverified", verifiedAt: null, verifiedBy: null, methods: [] }, createdAt: now, updatedAt: now,
  };
  const { insertedId } = await db.collection("entities").insertOne(doc);
  await trackFirst("first_entity_created", user._id);
  if (input.links.length) await trackFirst("first_social_link_added", user._id);
  await track("entity_created", user._id);
  return NextResponse.json(ser({ ...doc, _id: insertedId }), { status: 201 });
});
