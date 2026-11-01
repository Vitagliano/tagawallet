import { route } from "@/lib/api";
import { createSession } from "@/lib/auth";
import { track, trackFirst } from "@/lib/access";

/** Called from the signed-in /extension/connect page. The token goes to the extension, never into a URL. */
export const POST = route(async ({ user }) => {
  const { token } = await createSession(user._id, "extension");
  await trackFirst("extension_connected", user._id);
  await track("extension_session_created", user._id);
  return { token };
}, { rate: { name: "ext-connect", limit: 20, windowSec: 3600 } });
