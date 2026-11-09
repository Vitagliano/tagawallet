import { ApiError, route } from "@/lib/api";
import { isEmailVerified } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email-verification";

/** Sends a fresh confirmation link to the account's email. */
export const POST = route(async ({ user, req }) => {
  if (!user.email) throw new ApiError(422, "This account has no email address.");
  if (isEmailVerified(user)) return { ok: true, alreadyVerified: true };
  await sendVerificationEmail(user as never, req.headers);
  return { ok: true, sentTo: user.email };
}, { rate: { name: "verify-email-send", limit: 5, windowSec: 3600 } });
