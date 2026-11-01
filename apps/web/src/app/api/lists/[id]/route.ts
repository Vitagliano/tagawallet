import { listUpdateSchema } from "@tagawallet/shared";
import { route, ser } from "@/lib/api";
import { getList, logActivity, trackFirst } from "@/lib/access";
import { getDb } from "@/lib/db";

type P = { id: string };

export const GET = route<P>(async ({ user, params }) => {
  const { list, role } = await getList(params.id, user._id);
  const db = await getDb();
  const ids = [list.ownerId, ...(list.collaborators ?? []).map((c: { userId: unknown }) => c.userId)];
  const people = await db.collection("users").find({ _id: { $in: ids } }, { projection: { displayName: 1, email: 1 } }).toArray();
  const person = (id: { toString(): string }) => people.find((p) => p._id.toString() === id.toString());
  // Viewers see who is on the list, but only list managers see email addresses.
  const manager = role === "owner" || role === "admin";
  const show = (id: { toString(): string }) => ({ name: person(id)?.displayName ?? "Unknown", email: manager ? person(id)?.email : undefined });
  const invites = manager ? await db.collection("tokens").find({ kind: "list_invite", listId: list._id, expiresAt: { $gt: new Date() } }, { projection: { email: 1, role: 1, expiresAt: 1 } }).toArray() : [];
  return ser({
    ...list, role, owner: show(list.ownerId), invites,
    collaborators: (list.collaborators ?? []).map((c: { userId: { toString(): string }; role: string }) => ({ userId: c.userId, role: c.role, ...show(c.userId) })),
  });
});

export const PATCH = route<P>(async ({ user, params, body }) => {
  const input = await body(listUpdateSchema);
  const { list } = await getList(params.id, user._id, input.visibility ? "admin" : "editor");
  const { archived, ...fields } = input;
  const db = await getDb();
  const now = new Date();
  const set: Record<string, unknown> = { ...fields, updatedAt: now };
  if (archived !== undefined) set.archivedAt = archived ? now : null;
  await db.collection("lists").updateOne({ _id: list._id }, { $set: set });
  if (input.visibility === "shared") await trackFirst("first_shared_list_created", user._id);
  if (input.name && input.name !== list.name) await logActivity(list._id, user._id, "renamed the list", input.name);
  return ser({ ...list, ...set });
});

export const DELETE = route<P>(async ({ user, params }) => {
  const { list } = await getList(params.id, user._id, "owner");
  const db = await getDb();
  await db.collection("wallet_list_memberships").deleteMany({ listId: list._id });
  await db.collection("tokens").deleteMany({ kind: "list_invite", listId: list._id });
  await db.collection("lists").deleteOne({ _id: list._id });
  return { ok: true };
});
