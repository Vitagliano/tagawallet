import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { confirmEmail } from "@/lib/email-verification";

/** The link in the email lands on a page that posts here, so a mail scanner's GET can't consume it. */
export const POST = publicRoute(async ({ body }) => {
  const { token } = await body(z.object({ token: z.string().min(10).max(200) }));
  await confirmEmail(token);
  return { ok: true };
}, { rate: { name: "verify-email-confirm", limit: 30, windowSec: 900 } });
