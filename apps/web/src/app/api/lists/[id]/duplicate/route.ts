import { route, ser } from "@/lib/api";
import { getList } from "@/lib/access";
import { getDb } from "@/lib/db";

export const POST = route<{ id: string }>(async ({ user, params }) => {
  const { list } = await getList(params.id, user._id);
  const db = await getDb();
  const now = new Date();
  // A copy always starts private and owned by whoever made it, whatever the original was.
  const doc = {
    name: `${list.name} (copy)`.slice(0, 80), description: list.description, tags: list.tags, ownerId: user._id,
    visibility: "private", collaborators: [], createdAt: now, updatedAt: now, deletedAt: null,
  };
  const { insertedId } = await db.collection("lists").insertOne(doc);
  const members = await db.collection("wallet_list_memberships").find({ listId: list._id }).toArray();
  if (members.length) {
    await db.collection("wallet_list_memberships").insertMany(
      members.map((m) => ({ listId: insertedId, walletId: m.walletId, addedBy: user._id, addedAt: now })),
    );
  }
  return ser({ ...doc, _id: insertedId });
});
