import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, route } from "@/lib/api";
import { publicUser, sessionCookie, verifyPassword, hashPassword } from "@/lib/auth";
import { passwordSchema } from "@tagawallet/shared";
import { getDb } from "@/lib/db";

const patch = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  emailPrefs: z.object({ product: z.boolean(), moderation: z.boolean() }).optional(),
  onboardingDismissed: z.boolean().optional(),
  password: z.object({ current: z.string().max(200).optional(), next: passwordSchema }).optional(),
});

export const PATCH = route(async ({ body, user }) => {
  const { password, ...fields } = await body(patch);
  const set: Record<string, unknown> = { ...fields, updatedAt: new Date() };
  if (password) {
    if (user.passwordHash && !(await verifyPassword(password.current ?? "", user.passwordHash))) {
      throw new ApiError(401, "Your current password is incorrect.");
    }
    set.passwordHash = await hashPassword(password.next);
  }
  const db = await getDb();
  await db.collection("users").updateOne({ _id: user._id }, { $set: set, ...(password ? { $addToSet: { authProviders: "password" } } : {}) });
  return { user: publicUser({ ...user, ...set } as typeof user) };
});

/** Removes the account and everything it owns. Lists others collaborate on go too: the owner's data is the owner's. */
export const DELETE = route(async ({ body, user }) => {
  const { confirm, password } = await body(z.object({ confirm: z.literal("DELETE"), password: z.string().max(200).optional() }));
  void confirm;
  if (user.passwordHash && !(await verifyPassword(password ?? "", user.passwordHash))) {
    throw new ApiError(401, "Your password is incorrect.");
  }
  const db = await getDb();
  const id = user._id;
  const [wallets, lists, entities] = await Promise.all(["wallets", "lists", "entities"].map((c) =>
    db.collection(c).find({ ownerId: id }, { projection: { _id: 1 } }).toArray().then((r) => r.map((d) => d._id))));
  await Promise.all([
    db.collection("wallet_list_memberships").deleteMany({ $or: [{ walletId: { $in: wallets } }, { listId: { $in: lists } }] }),
    db.collection("wallet_entity_links").deleteMany({ $or: [{ walletId: { $in: wallets } }, { entityId: { $in: entities } }] }),
    db.collection("wallets").deleteMany({ ownerId: id }),
    db.collection("lists").deleteMany({ ownerId: id }),
    db.collection("entities").deleteMany({ ownerId: id }),
    db.collection("activity").deleteMany({ $or: [{ userId: id }, { listId: { $in: lists } }] }),
    db.collection("verifications").deleteMany({ entityId: { $in: entities } }),
    db.collection("events").deleteMany({ userId: id }),
    db.collection("sessions").deleteMany({ userId: id }),
    db.collection("api_keys").deleteMany({ userId: id }),
    db.collection("tokens").deleteMany({ userId: id }),
    db.collection("lists").updateMany({ "collaborators.userId": id }, { $pull: { collaborators: { userId: id } } } as never),
    db.collection("reports").updateMany({ reporterId: id }, { $set: { reporterId: null } }),
  ]);
  await db.collection("users").deleteOne({ _id: id });
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookie("", 0));
  return res;
}, { rate: { name: "delete-account", limit: 5, windowSec: 3600 } });
