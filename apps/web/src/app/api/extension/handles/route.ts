import { createHash } from "node:crypto";
import { route } from "@/lib/api";
import { handleIndex } from "@/lib/handles";

/**
 * Downloaded whole and matched in the browser. No request ever names the profile being viewed.
 * The ETag lets an unchanged index come back as an empty 304 instead of the full list.
 */
export const GET = route(async ({ user, req }) => {
  const entries = await handleIndex(user._id);
  const body = JSON.stringify({ entries });
  const etag = `"${createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`;
  const headers = { ETag: etag, "Cache-Control": "no-store", "Content-Type": "application/json" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return new Response(body, { status: 200, headers });
}, { cors: true, rate: { name: "handles", limit: 120, windowSec: 60 } });
export { preflight as OPTIONS } from "@/lib/api";
