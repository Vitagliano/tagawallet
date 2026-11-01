import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { ObjectId, type WithId, type Document } from "mongodb";
import { getDb } from "./db";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const N = 2 ** 15, R = 8, P = 1, KEYLEN = 64;

export const SESSION_COOKIE = "taw_session";
export const SESSION_DAYS = 30;
const EXTENSION_SESSION_DAYS = 90;

export type User = WithId<Document>;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 128 * N * R * 2 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  // Burn the same time for accounts with no password, so timing can't reveal them.
  const value = stored ?? `scrypt$${N}$${R}$${P}$AAAAAAAAAAAAAAAAAAAAAA==$${"A".repeat(86)}==`;
  const [, n, r, p, salt, hash] = value.split("$");
  const expected = Buffer.from(hash!, "base64");
  const actual = await scrypt(password, Buffer.from(salt!, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return timingSafeEqual(actual, expected) && !!stored;
}

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export async function createSession(userId: ObjectId, kind: "web" | "extension" = "web") {
  const token = randomToken();
  const days = kind === "extension" ? EXTENSION_SESSION_DAYS : SESSION_DAYS;
  const db = await getDb();
  await db.collection("sessions").insertOne({
    tokenHash: sha256(token), userId, kind, createdAt: new Date(),
    expiresAt: new Date(Date.now() + days * 864e5),
  });
  return { token, maxAge: days * 86400 };
}

export function sessionCookie(token: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export async function userFromToken(token: string | undefined | null): Promise<User | null> {
  if (!token) return null;
  const db = await getDb();
  const session = await db.collection("sessions").findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  return db.collection("users").findOne({ _id: session.userId, deletedAt: null });
}

export async function destroySession(token: string) {
  const db = await getDb();
  await db.collection("sessions").deleteOne({ tokenHash: sha256(token) });
}

export function publicUser(u: User) {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return {
    id: u._id.toString(), email: u.email ?? null, displayName: u.displayName, plan: u.plan ?? "free",
    authProviders: u.authProviders ?? [], hasPassword: !!u.passwordHash,
    emailPrefs: u.emailPrefs ?? { product: true, moderation: true },
    isAdmin: !!u.email && admins.includes(u.email), restricted: !!u.restrictedAt,
    onboardingDismissed: !!u.onboardingDismissed,
  };
}

export function isAdmin(u: User) {
  return publicUser(u).isAdmin;
}

export async function createUser(fields: {
  email?: string | null; passwordHash?: string | null; displayName: string; provider: string; subject?: string;
}): Promise<User> {
  const db = await getDb();
  const now = new Date();
  const doc: Document = {
    displayName: fields.displayName, passwordHash: fields.passwordHash ?? null, authProviders: [fields.provider],
    identities: fields.subject ? [{ provider: fields.provider, subject: fields.subject }] : [],
    plan: "free", emailPrefs: { product: true, moderation: true }, createdAt: now, updatedAt: now, deletedAt: null,
  };
  if (fields.email) doc.email = fields.email;
  const { insertedId } = await db.collection("users").insertOne(doc);
  return { ...doc, _id: insertedId } as User;
}

/** Finds the account for an external identity, linking by verified email or to the signed-in user. */
export async function loginWithIdentity(p: {
  provider: string; subject: string; email?: string | null; emailVerified?: boolean; displayName: string; current?: User | null;
}): Promise<User> {
  const db = await getDb();
  const users = db.collection("users");
  const bound = await users.findOne({ identities: { $elemMatch: { provider: p.provider, subject: p.subject } }, deletedAt: null });
  if (bound) return bound;
  const target = p.current ?? (p.email && p.emailVerified ? await users.findOne({ email: p.email, deletedAt: null }) : null);
  if (target) {
    await users.updateOne({ _id: target._id }, {
      $addToSet: { authProviders: p.provider, identities: { provider: p.provider, subject: p.subject } },
      $set: { updatedAt: new Date() },
    });
    return target;
  }
  return createUser({ email: p.emailVerified ? p.email : null, displayName: p.displayName, provider: p.provider, subject: p.subject });
}
