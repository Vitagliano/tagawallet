import type { Document, ObjectId } from "mongodb";
import { ApiError } from "./api";
import { randomToken, sha256 } from "./auth";
import { getDb } from "./db";
import { appUrl, sendEmail } from "./email";

const DAYS = 3;

/** Emails a one-time link that confirms the address. Earlier links stop working. */
export async function sendVerificationEmail(user: { _id: ObjectId; email?: string | null; displayName?: string }) {
  if (!user.email) return;
  const db = await getDb();
  const token = randomToken();
  await db.collection("tokens").deleteMany({ kind: "email_verify", userId: user._id });
  await db.collection("tokens").insertOne({ kind: "email_verify", tokenHash: sha256(token), userId: user._id, email: user.email, expiresAt: new Date(Date.now() + DAYS * 864e5) });
  await sendEmail(user.email, "Confirm your email for TagAWallet",
    `Hi ${user.displayName ?? "there"},\n\nConfirm this is your email address:\n${appUrl()}/verify-email/${token}\n\nThe link works for ${DAYS} days. If you didn't create a TagAWallet account, ignore this email.`);
}

/** Confirms the address a token was issued for, as long as the account still uses it. */
export async function confirmEmail(token: string) {
  const db = await getDb();
  const doc = await db.collection("tokens").findOneAndDelete({ kind: "email_verify", tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!doc) throw new ApiError(400, "This link has expired or was already used. Send a new one from the banner in the app.");
  const r = await db.collection("users").updateOne({ _id: doc.userId, email: doc.email, deletedAt: null }, { $set: { emailVerifiedAt: new Date(), updatedAt: new Date() } });
  if (!r.matchedCount) throw new ApiError(400, "This link is for an email address the account no longer uses.");
}

/** For actions that send email or publish under your name. Accounts without an email have nothing to verify. */
export function requireVerifiedEmail(user: Document, action: string) {
  if (user.email && !user.emailVerifiedAt) throw new ApiError(403, `Confirm your email before ${action}. Check your inbox, or send a new link from the banner at the top of the app.`, { needsVerification: true });
}
