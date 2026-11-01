import { MongoClient, type Db } from "mongodb";

const globalForMongo = globalThis as unknown as { __mongo?: Promise<Db> };

async function connect(): Promise<Db> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");
  const client = await new MongoClient(uri, { maxPoolSize: 20 }).connect();
  const db = client.db();
  await ensureIndexes(db);
  return db;
}

export function getDb(): Promise<Db> {
  globalForMongo.__mongo ??= connect().catch((err) => {
    globalForMongo.__mongo = undefined;
    throw err;
  });
  return globalForMongo.__mongo;
}

async function ensureIndexes(db: Db) {
  await Promise.all([
    // Partial: X and wallet sign-ins have no email.
    db.collection("users").createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } }),
    db.collection("users").createIndex({ "identities.provider": 1, "identities.subject": 1 }),
    db.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
    db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("sessions").createIndex({ userId: 1 }),
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
  ]);
}
