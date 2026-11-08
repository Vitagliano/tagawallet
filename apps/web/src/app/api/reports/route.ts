import { z } from "zod";
import { REPORT_REASONS, objectId } from "@tagawallet/shared";
import { route } from "@/lib/api";
import { createReport } from "@/lib/reports";

const input = z.object({
  targetType: z.enum(["entity", "wallet_entity_link"]),
  targetId: objectId,
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(2000).optional().default(""),
});

/** Report a public profile, or one wallet's public label on it. */
export const POST = route(async ({ user, body }) => {
  await createReport(user._id, await body(input));
  return { ok: true };
}, { rate: { name: "report", limit: 10, windowSec: 3600 } });
