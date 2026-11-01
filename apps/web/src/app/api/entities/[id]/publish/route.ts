import { z } from "zod";
import { ApiError, route } from "@/lib/api";
import { getOwnEntity, track } from "@/lib/access";
import { getDb } from "@/lib/db";
import { assertPublishable, uniqueSlug } from "@/lib/entities";

export const POST = route<{ id: string }>(async ({ user, params, body }) => {
  const { publish, allowIndexing, acknowledge } = await body(z.object({
    publish: z.boolean(), allowIndexing: z.boolean().optional(), acknowledge: z.boolean().optional(),
  }));
  const entity = await getOwnEntity(params.id, user._id);
  const db = await getDb();
  const now = new Date();
  if (!publish) {
    // Going private also pulls the entity out of search and everyone's chips, because both filter on visibility.
    await db.collection("entities").updateOne({ _id: entity._id }, { $set: { visibility: "private", allowIndexing: false, updatedAt: now } });
    return { visibility: "private" };
  }
  if (!acknowledge) throw new ApiError(422, "Confirm that this profile can be public before publishing.");
  await assertPublishable(entity, user);
  const slug = entity.slug ?? await uniqueSlug(entity.name, entity._id);
  const status = entity.verification?.status === "verified" ? "verified" : "self_claimed";
  await db.collection("entities").updateOne({ _id: entity._id }, {
    $set: { visibility: "public", slug, allowIndexing: !!allowIndexing, "verification.status": status, publishedAt: now, updatedAt: now },
  });
  await track("profile_published", user._id);
  return { visibility: "public", slug, status };
});
