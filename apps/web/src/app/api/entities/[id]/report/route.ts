import { reportSchema } from "@tagawallet/shared";
import { route } from "@/lib/api";
import { oid, track } from "@/lib/access";
import { getDb } from "@/lib/db";
import { ApiError } from "@/lib/api";

export const POST = route<{ id: string }>(async ({ user, params, body }) => {
  const input = await body(reportSchema.omit({ targetId: true, targetType: true }));
  const db = await getDb();
  const entity = await db.collection("entities").findOne({ _id: oid(params.id), visibility: "public" }, { projection: { _id: 1 } });
  if (!entity) throw new ApiError(404, "That profile isn't public.");
  await db.collection("reports").insertOne({
    targetType: "entity", targetId: entity._id, reporterId: user._id, reason: input.reason, details: input.details,
    status: "open", createdAt: new Date(), resolvedAt: null,
  });
  await track("report_submitted", user._id);
  return { ok: true };
}, { rate: { name: "report", limit: 10, windowSec: 3600 } });
