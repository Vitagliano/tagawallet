import type { Document } from "mongodb";
import { headers } from "next/headers";
import { ApiError } from "./api";
import { auth, isEmailVerified } from "./auth";
import { appUrl } from "./email";

/** Emails a one-time link that confirms the address. */
export async function sendVerificationEmail (user: { email?: string | null }, reqHeaders?: Headers) {
  if (!user.email) return;
  await auth.api.sendVerificationEmail({
    body: { email: user.email, callbackURL: `${appUrl()}/dashboard` },
    headers: reqHeaders ?? await headers(),
  });
}

export function requireVerifiedEmail (user: Document, action: string) {
  if (user.email && !isEmailVerified(user)) {
    throw new ApiError(403, `Confirm your email before ${action}. Check your inbox, or send a new link from the banner at the top of the app.`, { needsVerification: true });
  }
}
