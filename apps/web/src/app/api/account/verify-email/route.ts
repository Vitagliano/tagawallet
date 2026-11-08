import { ApiError, route } from "@/lib/api";
import { sendVerificationEmail } from "@/lib/email-verification";

/** Sends a fresh confirmation link to the account's email. */
export const POST = route(async ({ user }) => {
  if (!user.email) throw new ApiError(422, "This account has no email address.");
  if (user.emailVerifiedAt) return { ok: true, alreadyVerified: true };
  await sendVerificationEmail(user as never);
  return { ok: true, sentTo: user.email };
}, { rate: { name: "verify-email-send", limit: 5, windowSec: 3600 } });
