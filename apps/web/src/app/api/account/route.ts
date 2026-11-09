import { NextResponse } from "next/server";
import { z } from "zod";
import { APIError } from "better-auth/api";
import { ApiError, route } from "@/lib/api";
import { auth, publicUser } from "@/lib/auth";
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

export const PATCH = route(async ({ body, user, req }) => {
  const { password, displayName, ...fields } = await body(patch);
  const set: Record<string, unknown> = { ...fields, updatedAt: new Date() };
  if (displayName !== undefined) {
    set.name = displayName;
    set.displayName = displayName;
  }
  // The extension keeps its own synced settings; its theme follows the account's choice when the choice covers it.
  if (fields.theme || fields.themeScope) {
    const theme = fields.theme ?? user.theme ?? "system", scope = fields.themeScope ?? user.themeScope ?? "both";
    set.extensionSettings = { ...DEFAULT_SETTINGS, ...user.extensionSettings, theme: scope === "web" ? "system" : theme };
  }
  if (password) {
    try {
      await auth.api.changePassword({
        body: {
          currentPassword: password.current ?? "",
          newPassword: password.next,
          revokeOtherSessions: true,
        },
        headers: req.headers,
      });
    } catch (err) {
      if (err instanceof APIError) throw new ApiError(401, "Your current password is incorrect.");
      throw err;
    }
    set.authProviders = [...new Set([...(user.authProviders as string[] ?? []), "password"])];
  }
  const db = await getDb();
  if (fields.handle && fields.handle !== user.handle) {
    if (RESERVED.has(fields.handle)) throw new ApiError(422, "That handle is reserved.", { fields: { handle: "That handle is reserved." } });
    if (await db.collection("users").findOne({ handle: fields.handle, _id: { $ne: user._id } }, { projection: { _id: 1 } })) {
      throw new ApiError(409, "That handle is taken.", { fields: { handle: "That handle is taken." } });
    }
  }
  if (fields.profilePublic && !(fields.handle ?? user.handle)) throw new ApiError(422, "Pick a handle before turning on your public profile.", { fields: { handle: "Pick a handle first." } });
  await db.collection("users").updateOne({ _id: user._id }, { $set: set });
  return { user: publicUser({ ...user, ...set } as typeof user) };
});

/** Removes the account and everything it owns. Lists others collaborate on go too: the owner's data is the owner's. */
export const DELETE = route(async ({ body, req }) => {
  const { confirm, password } = await body(z.object({ confirm: z.literal("DELETE"), password: z.string().max(200).optional() }));
  void confirm;
  try {
    await auth.api.deleteUser({
      body: { password },
      headers: req.headers,
    });
  } catch (err) {
    if (err instanceof APIError) throw new ApiError(401, "Your password is incorrect.");
    throw err;
  }
  return NextResponse.json({ ok: true });
}, { rate: { name: "delete-account", limit: 5, windowSec: 3600 } });
