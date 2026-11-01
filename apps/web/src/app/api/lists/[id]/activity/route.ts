import { route, ser } from "@/lib/api";
import { getList } from "@/lib/access";
import { getDb } from "@/lib/db";

export const GET = route<{ id: string }>(async ({ user, params }) => {
  const { list } = await getList(params.id, user._id);
  const db = await getDb();
  const items = await db.collection("activity").find({ listId: list._id }).sort({ createdAt: -1 }).limit(30).toArray();
  const users = await db.collection("users").find({ _id: { $in: items.map((i) => i.userId) } }, { projection: { displayName: 1 } }).toArray();
  return ser(items.map((i) => ({ ...i, actor: users.find((u) => u._id.equals(i.userId))?.displayName ?? "Former member" })));
});
