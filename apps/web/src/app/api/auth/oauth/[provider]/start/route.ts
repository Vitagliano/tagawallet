import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { randomToken } from "@/lib/auth";
import { appUrl } from "@/lib/email";

const CONFIG = {
  google: { url: "https://accounts.google.com/o/oauth2/v2/auth", scope: "openid email profile", id: "GOOGLE_CLIENT_ID" },
  x: { url: "https://x.com/i/oauth2/authorize", scope: "users.read tweet.read", id: "X_CLIENT_ID" },
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  const cfg = CONFIG[provider as keyof typeof CONFIG];
  const clientId = cfg && process.env[cfg.id];
  if (!clientId) return NextResponse.redirect(`${appUrl()}/login?error=provider`);
  const state = randomToken(16), verifier = randomToken(48);
  const url = new URL(cfg.url);
  url.search = new URLSearchParams({
    client_id: clientId, redirect_uri: `${appUrl()}/api/auth/oauth/${provider}/callback`, response_type: "code",
    scope: cfg.scope, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("taw_oauth", JSON.stringify({ state, verifier }), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/auth/oauth", maxAge: 600,
  });
  return res;
}
