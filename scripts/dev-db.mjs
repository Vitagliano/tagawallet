// A throwaway local MongoDB for development. Data is kept in .dev-db between runs.
import { mkdirSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

mkdirSync(".dev-db", { recursive: true });
const server = await MongoMemoryServer.create({ instance: { port: 27017, dbPath: ".dev-db", storageEngine: "wiredTiger" } });
console.log(`MongoDB ready: ${server.getUri()}tagawallet`);
process.on("SIGINT", async () => { await server.stop({ doCleanup: false }); process.exit(0); });
