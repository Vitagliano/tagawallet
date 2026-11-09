import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/api";
import { auth, destroySession } from "@/lib/auth";

/** Signs out Better Auth cookie sessions and legacy extension bearer tokens. */
export const POST = publicRoute(async ({ req }) => {
  await auth.api.signOut({ headers: req.headers }).catch(() => {});
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (token) await destroySession(token);
  return NextResponse.json({ ok: true });
}, { cors: true });
export { preflight as OPTIONS } from "@/lib/api";
