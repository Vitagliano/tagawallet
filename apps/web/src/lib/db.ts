import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set");

const globalForMongo = globalThis as unknown as {
  __mongoClient?: MongoClient;
  __mongoReady?: Promise<Db>;
};

/** Shared client for Better Auth and the rest of the app. */
export const mongoClient = globalForMongo.__mongoClient ?? new MongoClient(uri, { maxPoolSize: 20 });
globalForMongo.__mongoClient = mongoClient;

export const mongoDb = mongoClient.db();

async function ready (): Promise<Db> {
  await mongoClient.connect();
  await ensureIndexes(mongoDb);
  return mongoDb;
}

export function getDb (): Promise<Db> {
  globalForMongo.__mongoReady ??= ready().catch((err) => {
    globalForMongo.__mongoReady = undefined;
    throw err;
  });
  return globalForMongo.__mongoReady;
}

async function ensureIndexes (db: Db) {
  // Accounts from before email verification existed are treated as verified, so nobody is locked out.
  await db.collection("users").updateMany(
    { email: { $type: "string" }, emailVerified: { $exists: false }, emailVerifiedAt: { $exists: true } },
    [{ $set: { emailVerified: { $ne: ["$emailVerifiedAt", null] } } }],
  ).catch(() => {});
  await Promise.all([
    // Partial: X and wallet sign-ins have no email.
    db.collection("users").createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } }),
    db.collection("users").createIndex({ "identities.provider": 1, "identities.subject": 1 }),
    db.collection("users").createIndex({ handle: 1 }, { unique: true, partialFilterExpression: { handle: { $type: "string" } } }),
    // Extension bearer sessions (web sessions live in Better Auth's `session` collection).
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("sessions").createIndex({ userId: 1 }),
    db.collection("session").createIndex({ token: 1 }, { unique: true }),
    db.collection("session").createIndex({ userId: 1 }),
    db.collection("session").createIndex({ expiresAt: 1 }),
    db.collection("account").createIndex({ userId: 1 }),
    db.collection("account").createIndex({ providerId: 1, accountId: 1 }, { unique: true }),
    db.collection("verification").createIndex({ identifier: 1 }),
    db.collection("verification").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("tokens").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("tokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("rate_limits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("lists").createIndex({ ownerId: 1, updatedAt: -1 }),
    db.collection("lists").createIndex({ "collaborators.userId": 1 }),
    db.collection("wallets").createIndex({ ownerId: 1, chain: 1, normalizedAddress: 1 }, { unique: true }),
    db.collection("wallets").createIndex({ ownerId: 1, updatedAt: -1 }),
    db.collection("wallets").createIndex({ normalizedAddress: 1 }),
    db.collection("wallets").createIndex({ displayLabel: "text" }),
    db.collection("wallet_list_memberships").createIndex({ listId: 1, walletId: 1 }, { unique: true }),
    db.collection("wallet_list_memberships").createIndex({ walletId: 1 }),
    db.collection("wallet_entity_links").createIndex({ walletId: 1, entityId: 1 }, { unique: true }),
    db.collection("wallet_entity_links").createIndex({ entityId: 1 }),
    db.collection("entities").createIndex({ ownerId: 1, updatedAt: -1 }),
    db.collection("entities").createIndex({ name: "text" }),
    db.collection("entities").createIndex({ slug: 1 }, { unique: true, partialFilterExpression: { slug: { $type: "string" } } }),
    db.collection("reports").createIndex({ targetType: 1, targetId: 1, status: 1 }),
    db.collection("reports").createIndex({ status: 1, createdAt: -1 }),
    db.collection("verifications").createIndex({ entityId: 1 }),
    db.collection("activity").createIndex({ listId: 1, createdAt: -1 }),
    db.collection("audit_log").createIndex({ createdAt: -1 }),
    db.collection("events").createIndex({ name: 1, createdAt: -1 }),
    db.collection("events").createIndex({ userId: 1, name: 1 }),
    db.collection("ens_cache").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("api_keys").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("api_keys").createIndex({ userId: 1, createdAt: -1 }),
  ]);
}
