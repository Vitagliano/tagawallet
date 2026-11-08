import { z } from "zod";
import { notFound, route } from "@/lib/api";
import { audit, requireAdmin } from "@/lib/admin";
import { oid } from "@/lib/access";
import { getDb } from "@/lib/db";
import { sendEmail } from "@/lib/email";

const action = z.object({
  action: z.enum(["review", "remove", "annotate", "preserve", "dismiss", "restrict_owner", "unrestrict_owner"]),
  note: z.string().trim().max(1000).optional().default(""),
});

export const POST = route<{ id: string }>(async ({ user, params, body }) => {
  requireAdmin(user);
  const input = await body(action);
  const db = await getDb();
  const report = await db.collection("reports").findOne({ _id: oid(params.id) });
  if (!report) throw notFound("Report not found");
  const now = new Date();
  const isLink = report.targetType === "wallet_entity_link";
  const entityId = report.entityId ?? (report.targetType === "entity" ? report.targetId : null);
  const entity = entityId ? await db.collection("entities").findOne({ _id: entityId }) : null;
  const closes = !["review", "restrict_owner", "unrestrict_owner"].includes(input.action);
  // A wallet report removes only that wallet's public claim. The rest of the profile stays up.
  if (isLink && input.action === "remove") {
    await db.collection("wallet_entity_links").updateOne({ _id: report.targetId }, { $set: { visibility: "private", "moderation.removedAt": now, "moderation.note": input.note, updatedAt: now } });
  }
  if (!isLink && entity && input.action === "remove") {
    await db.collection("entities").updateOne({ _id: entity._id }, { $set: { visibility: "private", allowIndexing: false, "moderation.removedAt": now, "moderation.note": input.note } });
  }
  if (entity && input.action === "annotate") {
    await db.collection("entities").updateOne({ _id: entity._id }, { $set: { "moderation.annotation": input.note } });
  }
  if (entity?.ownerId && input.action === "unrestrict_owner") {
    // Lifting a restriction lets them publish again. Profiles that were made private stay private until they choose.
    await db.collection("users").updateOne({ _id: entity.ownerId }, { $set: { restrictedAt: null } });
  }
  if (entity?.ownerId && input.action === "restrict_owner") {
    await db.collection("users").updateOne({ _id: entity.ownerId }, { $set: { restrictedAt: now } });
    await db.collection("entities").updateMany({ ownerId: entity.ownerId, visibility: "public" }, { $set: { visibility: "private", allowIndexing: false } });
  }
  await db.collection("reports").updateOne({ _id: report._id }, {
    $set: { status: input.action === "dismiss" ? "dismissed" : closes ? "resolved" : "reviewing", resolvedAt: closes ? now : null, resolution: input.action },
  });
  await audit(user._id, `report.${input.action}`, { reportId: report._id, entityId: entity?._id ?? null, linkId: isLink ? report.targetId : null, note: input.note });
  if (closes) {
    const people = await db.collection("users").find({ _id: { $in: [report.reporterId, entity?.ownerId].filter(Boolean) } }).toArray();
    await Promise.all(people.filter((p) => p.email && p.emailPrefs?.moderation !== false).map((p) => sendEmail(
      p.email, "An update on a TagAWallet report",
      `A report about ${isLink ? `a wallet on "${entity?.name ?? "a public profile"}"` : `"${entity?.name ?? "a public profile"}"`} has been reviewed. Outcome: ${input.action === "dismiss" ? "no change" : input.action}.`,
    )));
  }
  return { ok: true };
});
