import type { ObjectId } from "mongodb";
import { ApiError } from "./api";
import { oid, track } from "./access";
import { getDb } from "./db";

/**
 * Files a report about something public: a whole profile, or one wallet's public claim on it.
 * Only public things can be reported, so a report never reveals that a private record exists.
 */
export async function createReport(reporterId: ObjectId, input: { targetType: "entity" | "wallet_entity_link"; targetId: string; reason: string; details: string }) {
  const db = await getDb();
  let targetId: ObjectId, entityId: ObjectId;
  if (input.targetType === "entity") {
    const entity = await db.collection("entities").findOne({ _id: oid(input.targetId), visibility: "public" }, { projection: { _id: 1 } });
    if (!entity) throw new ApiError(404, "That profile isn't public.");
    targetId = entity._id; entityId = entity._id;
  } else {
    const link = await db.collection("wallet_entity_links").findOne({ _id: oid(input.targetId), visibility: "public" }, { projection: { entityId: 1 } });
    const entity = link && await db.collection("entities").findOne({ _id: link.entityId, visibility: "public" }, { projection: { _id: 1 } });
    if (!link || !entity) throw new ApiError(404, "That wallet label isn't public.");
    targetId = link._id; entityId = entity._id;
  }
  await db.collection("reports").insertOne({
    targetType: input.targetType, targetId, entityId, reporterId, reason: input.reason, details: input.details,
    status: "open", createdAt: new Date(), resolvedAt: null,
  });
  await track("report_submitted", reporterId);
}
