import { createHash, randomBytes } from "node:crypto";
import { ObjectId, type WithId, type Document } from "mongodb";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins/bearer";
import { getDb, mongoDb } from "./db";
import { appUrl, sendEmail } from "./email";

const EXTENSION_SESSION_DAYS = 90;
export const SESSION_COOKIE = "taw_session";

export type User = WithId<Document>;

export const auth = betterAuth({
  // Standalone Mongo (local / memory-server) doesn't support transactions; omit `client`.
  database: mongodbAdapter(mongoDb),
  baseURL: process.env.BETTER_AUTH_URL || process.env.APP_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  user: {
    modelName: "users",
    additionalFields: {
      plan: { type: "string", required: false, defaultValue: "free", input: false },
      handle: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, defaultValue: "", input: false },
      profilePublic: { type: "boolean", required: false, defaultValue: false, input: false },
      onboardingDismissed: { type: "boolean", required: false, defaultValue: false, input: false },
      walletOpen: { type: "string", required: false, defaultValue: "peek", input: false },
      theme: { type: "string", required: false, defaultValue: "system", input: false },
      themeScope: { type: "string", required: false, defaultValue: "both", input: false },
      restrictedAt: { type: "date", required: false, input: false },
    },
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        const db = await getDb();
        const id = new ObjectId(user.id);
        const [wallets, lists, entities] = await Promise.all(["wallets", "lists", "entities"].map((c) =>
          db.collection(c).find({ ownerId: id }, { projection: { _id: 1 } }).toArray().then((r) => r.map((d) => d._id))));
        await Promise.all([
          db.collection("wallet_list_memberships").deleteMany({ $or: [{ walletId: { $in: wallets } }, { listId: { $in: lists } }] }),
          db.collection("wallet_entity_links").deleteMany({ $or: [{ walletId: { $in: wallets } }, { entityId: { $in: entities } }] }),
          db.collection("wallets").deleteMany({ ownerId: id }),
          db.collection("lists").deleteMany({ ownerId: id }),
          db.collection("entities").deleteMany({ ownerId: id }),
          db.collection("activity").deleteMany({ $or: [{ userId: id }, { listId: { $in: lists } }] }),
          db.collection("verifications").deleteMany({ entityId: { $in: entities } }),
          db.collection("events").deleteMany({ userId: id }),
          db.collection("sessions").deleteMany({ userId: id }),
          db.collection("api_keys").deleteMany({ userId: id }),
          db.collection("tokens").deleteMany({ userId: id }),
          db.collection("lists").updateMany({ "collaborators.userId": id }, { $pull: { collaborators: { userId: id } } } as never),
          db.collection("reports").updateMany({ reporterId: id }, { $set: { reporterId: null } }),
        ]);
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 200,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, token }) => {
      const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
      void sendEmail(
        user.email,
        "Reset your TagAWallet password",
        `Hi ${user.name || "there"},\n\nReset your password:\n${url}\n\nThe link works for one hour. If you didn't ask for this, ignore the email.`,
      );
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, token }) => {
      const url = `${appUrl()}/verify-email/${encodeURIComponent(token)}`;
      void sendEmail(
        user.email,
        "Confirm your email for TagAWallet",
        `Hi ${user.name || "there"},\n\nConfirm this is your email address:\n${url}\n\nThe link works for a few days. If you didn't create a TagAWallet account, ignore this email.`,
      );
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    // Cookie cache would keep a revoked session alive for a few minutes after password reset.
    cookieCache: { enabled: false },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const db = await getDb();
            const _id = new ObjectId(user.id);
            await db.collection("users").updateOne({ _id }, {
              $set: {
                plan: "free",
                bio: "",
                profilePublic: false,
                onboardingDismissed: false,
                walletOpen: "peek",
                theme: "system",
                themeScope: "both",
                emailPrefs: { product: true, moderation: true },
                authProviders: ["password"],
                identities: [],
                deletedAt: null,
              },
            });
            await db.collection("events").insertOne({
              name: "account_created",
              userId: _id,
              props: {},
              createdAt: new Date(),
            });
          } catch (err) {
            console.error("Couldn't finish account setup", err);
          }
        },
      },
    },
  },
  plugins: [bearer(), nextCookies()],
});

export const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function isEmailVerified (u: Document) {
  if (!u.email) return true;
  if (typeof u.emailVerified === "boolean") return u.emailVerified;
  return !!u.emailVerifiedAt;
}

export function publicUser (u: User) {
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  const displayName = (u.name ?? u.displayName ?? "") as string;
  const emailPrefs = (u.emailPrefs ?? { product: true, moderation: true }) as { product: boolean; moderation: boolean };
  const authProviders = (u.authProviders ?? []) as string[];
  const identities = (u.identities ?? []) as { provider: string; subject: string }[];
  const email = (u.email ?? null) as string | null;
  return {
    id: u._id.toString(),
    email,
    displayName,
    plan: (u.plan ?? "free") as string,
    authProviders,
    hasPassword: authProviders.includes("password") || !!u.passwordHash,
    emailPrefs,
    // Admin needs a confirmed address, so registering with an admin's email grants nothing.
    isAdmin: !!email && isEmailVerified(u) && admins.includes(email),
    restricted: !!u.restrictedAt,
    emailVerified: isEmailVerified(u),
    onboardingDismissed: !!u.onboardingDismissed,
    // The public profile: tagawallet.com/u/<handle>, shown only while profilePublic is on.
    handle: (u.handle ?? null) as string | null,
    bio: (u.bio ?? "") as string,
    profilePublic: !!u.profilePublic,
    walletOpen: (["peek", "inline", "page"].includes(u.walletOpen as string) ? u.walletOpen : "peek") as "peek" | "inline" | "page",
    theme: (["system", "light", "dark"].includes(u.theme as string) ? u.theme : "system") as "system" | "light" | "dark",
    themeScope: (["both", "web", "extension"].includes(u.themeScope as string) ? u.themeScope : "both") as "both" | "web" | "extension",
    // Wallet subjects are addresses the person proved they control, so they're safe to show back to them.
    identities: identities.map((i) => ({ provider: i.provider, address: i.provider === "wallet" ? i.subject : null })),
    createdAt: u.createdAt ?? null,
  };
}

export function isAdmin (u: User) {
  return publicUser(u).isAdmin;
}

/** Loads the Mongo user document for a Better Auth user id. */
export async function userById (id: string | ObjectId | undefined | null): Promise<User | null> {
  if (!id) return null;
  const db = await getDb();
  const _id = typeof id === "string" ? (ObjectId.isValid(id) ? new ObjectId(id) : null) : id;
  if (!_id) return null;
  return db.collection("users").findOne({ _id, deletedAt: null });
}

export function sessionCookie (token: string, maxAge: number) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** Resolves the signed-in user from Better Auth (cookie or bearer) or a legacy extension/oauth session. */
export async function userFromRequest (req: { headers: Headers; cookies?: { get (name: string): { value: string } | undefined } }): Promise<User | null> {
  const session = await auth.api.getSession({ headers: req.headers });
  if (session?.user?.id) return userById(session.user.id);

  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (bearerToken) {
    const fromExt = await userFromExtensionToken(bearerToken);
    if (fromExt) return fromExt;
  }

  const taw = req.cookies?.get?.(SESSION_COOKIE)?.value;
  if (taw) return userFromExtensionToken(taw);
  return null;
}

export async function userFromToken (token: string | undefined | null): Promise<User | null> {
  return userFromExtensionToken(token);
}

/** Extension sessions stay in the custom `sessions` collection for now. */
export async function createSession (userId: ObjectId, kind: "web" | "extension" = "extension") {
  const token = randomToken();
  const days = kind === "extension" ? EXTENSION_SESSION_DAYS : 30;
  const db = await getDb();
  await db.collection("sessions").insertOne({
    tokenHash: sha256(token),
    userId,
    kind,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + days * 864e5),
  });
  return { token, maxAge: days * 86400 };
}

export async function userFromExtensionToken (token: string | undefined | null): Promise<User | null> {
  if (!token) return null;
  const db = await getDb();
  const session = await db.collection("sessions").findOne({ tokenHash: sha256(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  return db.collection("users").findOne({ _id: session.userId, deletedAt: null });
}

export async function destroySession (token: string) {
  const db = await getDb();
  await db.collection("sessions").deleteOne({ tokenHash: sha256(token) });
}

export async function createUser (fields: {
  email?: string | null;
  passwordHash?: string | null;
  displayName: string;
  provider: string;
  subject?: string;
  emailVerified?: boolean;
}): Promise<User> {
  const db = await getDb();
  const now = new Date();
  const doc: Document = {
    name: fields.displayName,
    displayName: fields.displayName,
    email: fields.email ?? undefined,
    emailVerified: !!fields.emailVerified,
    passwordHash: fields.passwordHash ?? null,
    authProviders: [fields.provider],
    identities: fields.subject ? [{ provider: fields.provider, subject: fields.subject }] : [],
    plan: "free",
    emailPrefs: { product: true, moderation: true },
    bio: "",
    profilePublic: false,
    onboardingDismissed: false,
    walletOpen: "peek",
    theme: "system",
    themeScope: "both",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const { insertedId } = await db.collection("users").insertOne(doc);
  return { ...doc, _id: insertedId } as User;
}

export class IdentityTakenError extends Error {
  constructor () { super("That sign-in is already linked to a different TagAWallet account."); }
}

/** Finds the account for an external identity, linking by verified email or to the signed-in user. */
export async function loginWithIdentity (p: {
  provider: string;
  subject: string;
  email?: string | null;
  emailVerified?: boolean;
  displayName: string;
  current?: User | null;
}): Promise<User> {
  const db = await getDb();
  const users = db.collection("users");
  const bound = await users.findOne({ identities: { $elemMatch: { provider: p.provider, subject: p.subject } }, deletedAt: null });
  // Linking from a signed-in account must never quietly switch to whoever owns that identity.
  if (bound && p.current && !bound._id.equals(p.current._id)) throw new IdentityTakenError();
  if (bound) return bound as User;

  const target = p.current ?? (p.email && p.emailVerified
    ? await users.findOne({ email: p.email, emailVerified: true, deletedAt: null })
    : null);
  if (target) {
    await users.updateOne({ _id: target._id }, {
      $addToSet: { authProviders: p.provider, identities: { provider: p.provider, subject: p.subject } },
      $set: {
        updatedAt: new Date(),
        ...(p.emailVerified && p.email && p.email === target.email && !isEmailVerified(target) ? { emailVerified: true } : {}),
      },
    });
    return (await users.findOne({ _id: target._id })) as User;
  }
  if (p.email && p.emailVerified) {
    await users.updateOne(
      { email: p.email, emailVerified: false, deletedAt: null },
      { $unset: { email: "" }, $set: { updatedAt: new Date() } },
    );
  }
  return createUser({
    email: p.emailVerified ? p.email : null,
    emailVerified: !!p.emailVerified,
    displayName: p.displayName,
    provider: p.provider,
    subject: p.subject,
  });
}
