import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/api";
import { destroySession, SESSION_COOKIE, sessionCookie } from "@/lib/auth";

export const POST = publicRoute(async ({ req }) => {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await destroySession(token);
  const res = NextResponse.json({ ok: true });
  res.headers.append("Set-Cookie", sessionCookie("", 0));
  return res;
}, { cors: true });
export { preflight as OPTIONS } from "@/lib/api";
