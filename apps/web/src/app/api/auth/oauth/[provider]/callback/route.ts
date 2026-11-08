import { NextResponse, type NextRequest } from "next/server";
import { createSession, IdentityTakenError, loginWithIdentity, SESSION_COOKIE, sessionCookie, userFromToken } from "@/lib/auth";
import { appUrl } from "@/lib/email";

async function exchange(provider: string, code: string, verifier: string) {
  const redirect_uri = `${appUrl()}/api/auth/oauth/${provider}/callback`;
  const params = { grant_type: "authorization_code", code, redirect_uri, code_verifier: verifier };
  if (provider === "google") {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...params, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET! }),
    });
    const token = await res.json();
    const info = await (await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${token.access_token}` } })).json();
    if (!info.sub) throw new Error("Google sign-in failed");
    return { subject: info.sub as string, email: info.email?.toLowerCase() as string, emailVerified: !!info.email_verified, displayName: (info.name ?? info.email) as string };
  }
  const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${basic}` },
    body: new URLSearchParams({ ...params, client_id: process.env.X_CLIENT_ID! }),
  });
  const token = await res.json();
  const info = await (await fetch("https://api.x.com/2/users/me", { headers: { Authorization: `Bearer ${token.access_token}` } })).json();
  if (!info.data?.id) throw new Error("X sign-in failed");
  return { subject: info.data.id as string, email: null, emailVerified: false, displayName: (info.data.name ?? info.data.username) as string };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const fail = () => NextResponse.redirect(`${appUrl()}/login?error=oauth`);
  const code = req.nextUrl.searchParams.get("code");
  const cookie = req.cookies.get("taw_oauth")?.value;
  if (!code || !cookie || (provider !== "google" && provider !== "x")) return fail();
  try {
    const { state, verifier } = JSON.parse(cookie);
    if (state !== req.nextUrl.searchParams.get("state")) return fail();
    const profile = await exchange(provider, code, verifier);
    const current = await userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
    let user;
    try { user = await loginWithIdentity({ provider, ...profile, current }); }
    catch (err) {
      if (err instanceof IdentityTakenError) return NextResponse.redirect(`${appUrl()}/settings?link_error=${provider}#sign-in`);
      throw err;
    }
    const session = await createSession(user._id);
    // Linking from Settings goes back there, so the person sees it worked.
    const res = NextResponse.redirect(current ? `${appUrl()}/settings?linked=${provider}#sign-in` : `${appUrl()}/dashboard`);
    res.headers.append("Set-Cookie", sessionCookie(session.token, session.maxAge));
    res.cookies.delete({ name: "taw_oauth", path: "/api/auth/oauth" });
    return res;
  } catch (err) {
    console.error(err);
    return fail();
  }
}
