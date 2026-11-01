import { extensionSettingsSchema } from "@tagawallet/shared";
import { route } from "@/lib/api";
import { getDb } from "@/lib/db";
import { DEFAULT_SETTINGS } from "@/lib/settings";

export const GET = route(async ({ user }) => ({ ...DEFAULT_SETTINGS, ...user.extensionSettings }), { cors: true });

export const PATCH = route(async ({ user, body }) => {
  const input = await body(extensionSettingsSchema);
  const next = { ...DEFAULT_SETTINGS, ...user.extensionSettings, ...input };
  const db = await getDb();
  await db.collection("users").updateOne({ _id: user._id }, { $set: { extensionSettings: next, updatedAt: new Date() } });
  return next;
}, { cors: true });
export { preflight as OPTIONS } from "@/lib/api";
