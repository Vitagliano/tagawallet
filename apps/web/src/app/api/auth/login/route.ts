import { NextResponse } from "next/server";
import { loginSchema } from "@tagawallet/shared";
import { ApiError, publicRoute } from "@/lib/api";
import { createSession, publicUser, sessionCookie, verifyPassword, type User } from "@/lib/auth";
import { getDb } from "@/lib/db";

export const POST = publicRoute(async ({ body }) => {
  const input = await body(loginSchema);
  const db = await getDb();
  const user = await db.collection("users").findOne({ email: input.email, deletedAt: null });
  if (!(await verifyPassword(input.password, user?.passwordHash)) || !user) {
    throw new ApiError(401, "That email and password don't match.");
  }
  const { token, maxAge } = await createSession(user._id);
  const res = NextResponse.json({ user: publicUser(user as User) });
  res.headers.append("Set-Cookie", sessionCookie(token, maxAge));
  return res;
}, { rate: { name: "login", limit: 20, windowSec: 900 } });
