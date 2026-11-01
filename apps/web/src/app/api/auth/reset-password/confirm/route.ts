import { z } from "zod";
import { passwordSchema } from "@tagawallet/shared";
import { ApiError, publicRoute } from "@/lib/api";
import { hashPassword, sha256 } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const POST = publicRoute(async ({ body }) => {
  const { token, password } = await body(z.object({ token: z.string().min(10).max(100), password: passwordSchema }));
  const db = await getDb();
  const record = await db.collection("tokens").findOneAndDelete({
    tokenHash: sha256(token), kind: "password_reset", expiresAt: { $gt: new Date() },
  });
  if (!record) throw new ApiError(400, "This reset link has expired. Request a new one.");
  await db.collection("users").updateOne({ _id: record.userId }, {
    $set: { passwordHash: await hashPassword(password), updatedAt: new Date() }, $addToSet: { authProviders: "password" },
  });
  // Anyone holding the old password loses access now.
  await db.collection("sessions").deleteMany({ userId: record.userId });
  return { ok: true };
}, { rate: { name: "reset-confirm", limit: 10, windowSec: 900 } });
