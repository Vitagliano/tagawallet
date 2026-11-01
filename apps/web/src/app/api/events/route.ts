import { z } from "zod";
import { route } from "@/lib/api";
import { track, trackFirst } from "@/lib/access";

// A fixed vocabulary of counts. There is deliberately no field for a URL, address or page text.
const NAMES = ["inline_chip_impression", "inline_chip_click", "popup_open", "first_inline_tag_viewed", "extension_installed", "content_script_error", "lookup_latency", "popup_load_time", "public_profile_view", "dashboard_session"] as const;
const FIRSTS = new Set(["first_inline_tag_viewed", "extension_installed"]);

export const POST = route(async ({ user, body }) => {
  const { name, value } = await body(z.object({ name: z.enum(NAMES), value: z.number().min(0).max(1e7).optional() }));
  if (FIRSTS.has(name)) await trackFirst(name, user._id);
  else await track(name, user._id, value === undefined ? {} : { value });
  return { ok: true };
}, { cors: true, rate: { name: "events", limit: 120, windowSec: 60 } });
export { preflight as OPTIONS } from "@/lib/api";
