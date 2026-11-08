import { NextResponse } from "next/server";
import { registerSchema } from "@tagawallet/shared";
import { ApiError, publicRoute } from "@/lib/api";
import { createSession, createUser, hashPassword, publicUser, sessionCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { track } from "@/lib/access";
import { sendVerificationEmail } from "@/lib/email-verification";

export const POST = publicRoute(async ({ body }) => {
  const input = await body(registerSchema);
  const db = await getDb();
  if (await db.collection("users").findOne({ email: input.email })) {
    throw new ApiError(409, "An account with that email already exists.", { fields: { email: "Already registered. Try signing in." } });
  }
  const user = await createUser({
    email: input.email, passwordHash: await hashPassword(input.password), displayName: input.displayName, provider: "password",
  });
  await track("account_created", user._id);
  await sendVerificationEmail(user).catch((err) => console.error("Couldn't send the verification email", err));
  const { token, maxAge } = await createSession(user._id);
  const res = NextResponse.json({ user: publicUser(user) }, { status: 201 });
  res.headers.append("Set-Cookie", sessionCookie(token, maxAge));
  return res;
}, { rate: { name: "register", limit: 10, windowSec: 3600 } });
