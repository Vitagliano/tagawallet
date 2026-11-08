import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, route } from "@/lib/api";
import { publicUser, sessionCookie, verifyPassword, hashPassword } from "@/lib/auth";
import { passwordSchema } from "@tagawallet/shared";
import { getDb } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/settings";

const patch = z.object({
  displayName: z.string().trim().min(1).max(80).optional(),
  emailPrefs: z.object({ product: z.boolean(), moderation: z.boolean() }).optional(),
  onboardingDismissed: z.boolean().optional(),
  /** How a wallet opens from the wallet table: a floating panel, expanded in its row, or as its own view. */
  walletOpen: z.enum(["peek", "inline", "page"]).optional(),
  /** Light or dark, or follow the system; and whether that applies to the website, the extension, or both. */
  theme: z.enum(["system", "light", "dark"]).optional(),
  themeScope: z.enum(["both", "web", "extension"]).optional(),
  password: z.object({ current: z.string().max(200).optional(), next: passwordSchema }).optional(),
  /** Your public profile: a handle for its address, a short bio, and whether it's shown at all. */
  handle: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,30}$/, "Use 3–30 letters, numbers or underscores.").optional(),
  bio: z.string().trim().max(280).optional(),
  profilePublic: z.boolean().optional(),
});

const RESERVED = new Set(["admin", "api", "app", "dashboard", "settings", "support", "help", "login", "signup", "tagawallet", "team", "about", "moderator", "root", "www"]);

export const PATCH = route(async ({ body, user }) => {
  const { password, ...fields } = await body(patch);
  const set: Record<string, unknown> = { ...fields, updatedAt: new Date() };
  // The extension keeps its own synced settings; its theme follows the account's choice when the choice covers it.
  if (fields.theme || fields.themeScope) {
    const theme = fields.theme ?? user.theme ?? "system", scope = fields.themeScope ?? user.themeScope ?? "both";
    set.extensionSettings = { ...DEFAULT_SETTINGS, ...user.extensionSettings, theme: scope === "web" ? "system" : theme };
  }
  if (password) {
    if (user.passwordHash && !(await verifyPassword(password.current ?? "", user.passwordHash))) {
      throw new ApiError(401, "Your current password is incorrect.");
    }
    set.passwordHash = await hashPassword(password.next);
  }
  const db = await getDb();
  if (fields.handle && fields.handle !== user.handle) {
    if (RESERVED.has(fields.handle)) throw new ApiError(422, "That handle is reserved.", { fields: { handle: "That handle is reserved." } });
    if (await db.collection("users").findOne({ handle: fields.handle, _id: { $ne: user._id } }, { projection: { _id: 1 } })) {
      throw new ApiError(409, "That handle is taken.", { fields: { handle: "That handle is taken." } });
    }
  }
  if (fields.profilePublic && !(fields.handle ?? user.handle)) throw new ApiError(422, "Pick a handle before turning on your public profile.", { fields: { handle: "Pick a handle first." } });
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
