import { z } from "zod";
import { route } from "@/lib/api";
import { getList, logActivity, track } from "@/lib/access";
import { getDb } from "@/lib/db";
import { requireVerifiedEmail } from "@/lib/email-verification";

/**
 * Makes a list public at /l/<id>, shown as published by its owner. Only the owner's own wallets appear there:
 * wallets collaborators added were shared with the list's members, not with everyone.
 */
export const POST = route<{ id: string }>(async ({ user, params, body }) => {
  const { publish } = await body(z.object({ publish: z.boolean() }));
  const { list } = await getList(params.id, user._id, "owner");
  const db = await getDb();
  const now = new Date();
  if (publish) requireVerifiedEmail(user, "publishing a list");
  await db.collection("lists").updateOne({ _id: list._id }, { $set: { publishedAt: publish ? now : null, updatedAt: now } });
  await logActivity(list._id, user._id, publish ? "made the list public" : "made the list private again");
  if (publish) await track("list_published", user._id);
  return { publishedAt: publish ? now.toISOString() : null };
});
