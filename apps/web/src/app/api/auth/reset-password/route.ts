import { z } from "zod";
import { emailSchema } from "@tagawallet/shared";
import { publicRoute } from "@/lib/api";
import { randomToken, sha256 } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";

export const POST = publicRoute(async ({ body }) => {
  const { email } = await body(z.object({ email: emailSchema }));
  const db = await getDb();
  const user = await db.collection("users").findOne({ email, deletedAt: null });
  if (user) {
    const token = randomToken();
    await db.collection("tokens").insertOne({
      kind: "password_reset", tokenHash: sha256(token), userId: user._id, expiresAt: new Date(Date.now() + 3600e3),
    });
    await sendEmail(email, "Reset your TagAWallet password",
      `Use this link within an hour to choose a new password:\n\n${appUrl()}/reset-password?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`);
  }
  // The same answer either way, so this can't be used to find out who has an account.
  return { ok: true };
}, { rate: { name: "reset", limit: 5, windowSec: 900 } });
