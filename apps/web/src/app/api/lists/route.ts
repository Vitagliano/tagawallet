import { listCreateSchema } from "@tagawallet/shared";
import { route, ser } from "@/lib/api";
import { accessibleLists, roleIn, track, trackFirst } from "@/lib/access";
import { getDb } from "@/lib/db";

export const GET = route(async ({ user, req }) => {
  const db = await getDb();
  const archived = req.nextUrl.searchParams.get("archived") === "1";
  const lists = (await accessibleLists(user._id)).filter((l) => !!l.archivedAt === archived);
  const counts = await db.collection("wallet_list_memberships")
    .aggregate([{ $match: { listId: { $in: lists.map((l) => l._id) } } }, { $group: { _id: "$listId", n: { $sum: 1 } } }]).toArray();
  const byId = new Map(counts.map((c) => [c._id.toString(), c.n]));
  return ser(lists.map(({ shareSettings: _s, ...l }) => ({
    ...l, role: roleIn(l, user._id), walletCount: byId.get(l._id.toString()) ?? 0, collaboratorCount: l.collaborators?.length ?? 0,
    collaborators: undefined,
  })));
});

export const POST = route(async ({ user, body }) => {
  const input = await body(listCreateSchema);
  const db = await getDb();
  const now = new Date();
  const doc = { ...input, ownerId: user._id, visibility: "private", collaborators: [], createdAt: now, updatedAt: now, deletedAt: null };
  const { insertedId } = await db.collection("lists").insertOne(doc);
  await db.collection("users").updateOne({ _id: user._id }, { $set: { lastListId: insertedId } });
  await trackFirst("first_list_created", user._id);
  await track("list_created", user._id);
  return ser({ ...doc, _id: insertedId, role: "owner", walletCount: 0, collaboratorCount: 0 });
});
