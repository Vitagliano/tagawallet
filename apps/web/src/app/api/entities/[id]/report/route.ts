import { reportSchema } from "@tagawallet/shared";
import { route } from "@/lib/api";
import { createReport } from "@/lib/reports";

/** Kept for existing clients. Same as POST /api/reports with targetType "entity". */
export const POST = route<{ id: string }>(async ({ user, params, body }) => {
  const input = await body(reportSchema.omit({ targetId: true, targetType: true }));
  await createReport(user._id, { targetType: "entity", targetId: params.id, reason: input.reason, details: input.details });
  return { ok: true };
}, { rate: { name: "report", limit: 10, windowSec: 3600 } });
