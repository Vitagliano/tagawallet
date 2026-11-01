import { route } from "@/lib/api";
import { handleIndex } from "@/lib/handles";

/** Downloaded whole and matched in the browser. No request ever names the profile being viewed. */
export const GET = route(async ({ user }) => ({ entries: await handleIndex(user._id) }), { cors: true, rate: { name: "handles", limit: 120, windowSec: 60 } });
export { preflight as OPTIONS } from "@/lib/api";
