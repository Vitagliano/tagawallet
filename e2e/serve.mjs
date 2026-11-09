// One process for the suite: a real MongoDB, the production Next server, and a fixture site.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { MongoMemoryServer } from "mongodb-memory-server";

const mongo = await MongoMemoryServer.create({ instance: { port: 3202 } });
const fixture = createServer((req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.end(readFileSync(new URL("./fixture.html", import.meta.url)));
}).listen(3201);
const next = spawn("pnpm", ["--filter", "@tagawallet/web", "exec", "next", "start", "-p", "3200"], {
  stdio: "inherit",
  env: {
    ...process.env,
    MONGODB_URI: mongo.getUri("tagawallet_e2e"),
    APP_URL: "http://localhost:3200",
    BETTER_AUTH_URL: "http://localhost:3200",
    BETTER_AUTH_SECRET: "e2e-better-auth-secret-at-least-32-chars!!",
    ADMIN_EMAILS: "moderator@example.test",
    NODE_ENV: "production",
  },
});
const stop = async () => { next.kill(); fixture.close(); await mongo.stop(); process.exit(0); };
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
