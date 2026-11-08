import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError, type ZodType } from "zod";
import { SESSION_COOKIE, sha256, userFromToken, type User } from "./auth";
import { getDb } from "./db";

export class ApiError extends Error {
  constructor(public status: number, message: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}
export const notFound = (what = "Not found") => new ApiError(404, what);

interface Rate { name: string; limit: number; windowSec: number }
interface Opts { auth?: boolean; rate?: Rate; cors?: boolean }

interface BaseCtx<P> {
  req: NextRequest;
  params: P;
  body<T extends ZodType>(schema: T): Promise<z.output<T>>;
}

function bearer(req: NextRequest) {
  const h = req.headers.get("authorization");
  return h?.startsWith("Bearer ") ? h.slice(7) : null;
}

export function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

export async function rateLimit(rate: Rate, key: string) {
  const db = await getDb();
  const window = Math.floor(Date.now() / (rate.windowSec * 1000));
  const id = `${rate.name}:${key}:${window}`;
  const col = db.collection<{ _id: string; count: number; expiresAt: Date }>("rate_limits");
  const doc = await col.findOneAndUpdate(
    { _id: id },
    { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + rate.windowSec * 2000) } },
    { upsert: true, returnDocument: "after" },
  ).catch(() => null); // A lost upsert race shouldn't fail the request.
  if (doc && doc.count > rate.limit) throw new ApiError(429, "Too many requests. Please slow down and try again shortly.");
}

function corsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin?.startsWith("chrome-extension://")) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, content-type, if-none-match",
    "Access-Control-Expose-Headers": "etag",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** Cookie-authenticated writes must come from our own origin. Bearer requests carry no ambient authority. */
function assertSameOrigin(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || bearer(req)) return;
  const origin = req.headers.get("origin");
  if (!origin) return;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (new URL(origin).host !== host) throw new ApiError(403, "Cross-origin request blocked.");
}

function respondError(err: unknown, headers: Record<string, string>) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, ...err.extra }, { status: err.status, headers });
  }
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const i of err.issues) fields[i.path.join(".")] ??= i.message;
    return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input", fields }, { status: 422, headers });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong." }, { status: 500, headers });
}

type RouteArg<P> = { params: Promise<P> };

async function run<P>(req: NextRequest, arg: RouteArg<P> | undefined, opts: Opts, fn: (c: BaseCtx<P> & { user: User | null }) => Promise<unknown>) {
  const headers = opts.cors ? corsHeaders(req) : {};
  try {
    assertSameOrigin(req);
    const token = bearer(req) ?? req.cookies.get(SESSION_COOKIE)?.value;
    const user = await userFromToken(token);
    if (opts.auth !== false && !user) throw new ApiError(401, "Please sign in.");
    if (opts.rate) await rateLimit(opts.rate, user?._id.toString() ?? clientIp(req));
    const params = (arg ? await arg.params : {}) as P;
    const result = await fn({
      req, params, user,
      async body(schema) {
        const raw = await req.json().catch(() => { throw new ApiError(400, "Expected a JSON body."); });
        return schema.parse(raw);
      },
    });
    if (result instanceof Response) {
      for (const [k, v] of Object.entries(headers)) result.headers.set(k, v);
      return result;
    }
    return NextResponse.json(result ?? { ok: true }, { headers: { ...headers, "Cache-Control": "no-store" } });
  } catch (err) {
    return respondError(err, headers);
  }
}

export function route<P = Record<string, string>>(fn: (c: BaseCtx<P> & { user: User }) => Promise<unknown>, opts: Omit<Opts, "auth"> = {}) {
  return (req: NextRequest, arg?: RouteArg<P>) => run<P>(req, arg, opts, fn as never);
}
export function publicRoute<P = Record<string, string>>(fn: (c: BaseCtx<P> & { user: User | null }) => Promise<unknown>, opts: Omit<Opts, "auth"> = {}) {
  return (req: NextRequest, arg?: RouteArg<P>) => run<P>(req, arg, { ...opts, auth: false }, fn);
}
export function preflight(req: NextRequest) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

/** Turns ObjectIds and dates into JSON-friendly values and _id into id. */
export function ser<T = any>(value: unknown): T {
  if (Array.isArray(value)) return value.map(ser) as T;
  if (value instanceof Date) return value.toISOString() as T;
  if (value && typeof value === "object") {
    if ((value as { _bsontype?: string })._bsontype === "ObjectId") return String(value) as T;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k === "_id" ? "id" : k] = ser(v);
    return out as T;
  }
  return value as T;
}

// ---- Personal API keys: read-only, for /api/v1 only. ----

export const API_KEY_PREFIX = "taw_";

/** The key's owner, or null. Keys never sign anyone into the app, and sessions never work on /api/v1. */
export async function userFromApiKey(key: string | null): Promise<{ user: User; keyId: string } | null> {
  if (!key?.startsWith(API_KEY_PREFIX)) return null;
  const db = await getDb();
  const doc = await db.collection("api_keys").findOne({ tokenHash: sha256(key), revokedAt: null });
  if (!doc) return null;
  const user = await db.collection<User>("users").findOne({ _id: doc.userId, deletedAt: null });
  if (!user) return null;
  // Written at most once a minute, so a busy key doesn't turn every read into a write.
  if (!doc.lastUsedAt || Date.now() - doc.lastUsedAt.getTime() > 60_000) {
    await db.collection("api_keys").updateOne({ _id: doc._id }, { $set: { lastUsedAt: new Date() } });
  }
  return { user, keyId: doc._id.toString() };
}

/** A read-only /api/v1 handler. GET only, authenticated by an API key, rate-limited per key. */
export function apiKeyRoute<P = Record<string, string>>(fn: (c: { req: NextRequest; params: P; user: User }) => Promise<unknown>, rate = { name: "v1", limit: 300, windowSec: 60 }) {
  return async (req: NextRequest, arg?: RouteArg<P>) => {
    const headers = { "Cache-Control": "no-store" };
    try {
      if (req.method !== "GET") throw new ApiError(405, "The API is read-only. Only GET is supported.");
      const auth = await userFromApiKey(bearer(req));
      if (!auth) throw new ApiError(401, "Send a TagAWallet API key as a Bearer token. Create one in Settings › API keys.");
      await rateLimit({ ...rate, name: `${rate.name}` }, `key:${auth.keyId}`);
      const params = (arg ? await arg.params : {}) as P;
      const result = await fn({ req, params, user: auth.user });
      return NextResponse.json(result, { headers });
    } catch (err) {
      return respondError(err, headers);
    }
  };
}
