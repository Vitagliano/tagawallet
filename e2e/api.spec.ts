import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";

const BASE = "http://localhost:3200";
const A1 = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const A2 = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";
const A3 = "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB";
const PASSWORD = "correct-horse-battery";
let n = 0;

let mongo: MongoClient | null = null;
const db = async () => (mongo ??= await new MongoClient("mongodb://127.0.0.1:3202/tagawallet_e2e").connect()).db();
/** Stands in for clicking the link in the confirmation email. */
const markVerified = async (email: string) => { await (await db()).collection("users").updateOne({ email }, { $set: { emailVerified: true } }); };
test.afterAll(async () => { await mongo?.close(); });

const authHeaders = { Origin: BASE, Referer: `${BASE}/` };
const signUp = (ctx: APIRequestContext, email: string) =>
  ctx.post("/api/auth/sign-up/email", { data: { email, password: PASSWORD, name: email.split("@")[0] || "User" }, headers: authHeaders });
const signIn = (ctx: APIRequestContext, email: string, password = PASSWORD) =>
  ctx.post("/api/auth/sign-in/email", { data: { email, password }, headers: authHeaders });
const signOut = (ctx: APIRequestContext) => ctx.post("/api/auth/sign-out", { data: {}, headers: authHeaders });

async function account (email = `u${Date.now()}${n++}@example.test`, { verified = true } = {}) {
  // Each account gets its own client address, so the signup rate limit doesn't trip across tests.
  const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": `10.0.${n % 250}.${Date.now() % 250}` } });
  const res = await signUp(ctx, email);
  expect(res.status(), await res.text()).toBe(200);
  if (verified) await markVerified(email);
  return { ctx, email };
}

/** The moderator named in ADMIN_EMAILS, signed in with a confirmed address. */
async function moderator () {
  const mod = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": "10.2.0.1" } });
  const modEmail = "moderator@example.test";
  await signUp(mod, modEmail);
  await markVerified(modEmail);
  await json(signIn(mod, modEmail));
  return mod;
}
const json = async (p: Promise<any>, status = 200) => {
  const r = await p;
  const body = await r.text();
  expect(r.status(), body).toBe(status);
  return JSON.parse(body);
};
const newList = (c: APIRequestContext, name = "Research") => json(c.post("/api/lists", { data: { name } }));
const addWallet = (c: APIRequestContext, data: object) => json(c.post("/api/wallets", { data: { chain: "ethereum", ...data } }), 201);
const resolve = (c: APIRequestContext, a: string) => json(c.post("/api/extension/resolve", { data: { addresses: [{ normalized: a.toLowerCase(), kind: "evm" }] } })).then((r) => r.results[0].labels);

test("auth: session cookie is HttpOnly and SameSite, passwords aren't returned", async () => {
  const ctx = await request.newContext({ baseURL: BASE });
  const email = `c${Date.now()}@example.test`;
  const res = await signUp(ctx, email);
  const cookie = res.headers()["set-cookie"] ?? "";
  expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/SameSite=Lax/i);
  // Secure is only set when Better Auth sees an https base URL (not localhost e2e).
  expect(await res.text()).not.toMatch(/passwordHash|scrypt|"password"\s*:/);
  expect((await json(ctx.get("/api/auth/session"))).user.email).toBe(email);
  await json(signOut(ctx));
  expect((await json(ctx.get("/api/auth/session"))).user).toBeNull();
  expect((await signIn(ctx, email, "wrong-password-x")).status()).toBe(401);
  await json(signIn(ctx, email));
  expect((await signUp(ctx, email)).status()).toBeGreaterThanOrEqual(400);
  expect((await ctx.post("/api/auth/sign-up/email", { data: { email: "s@example.test", password: "short", name: "x" }, headers: authHeaders })).status()).toBeGreaterThanOrEqual(400);
});

test("auth: unauthenticated users get nothing", async () => {
  const anon = await request.newContext({ baseURL: BASE });
  for (const path of ["/api/lists", "/api/wallets", "/api/entities", "/api/search?q=a", "/api/dashboard", "/api/account/export", "/api/extension/bootstrap"]) {
    expect((await anon.get(path)).status(), path).toBe(401);
  }
  expect((await anon.post("/api/extension/resolve", { data: { addresses: [] } })).status()).toBe(401);
});

test("csrf: cross-origin cookie writes are refused", async () => {
  const { ctx } = await account();
  const r = await ctx.post("/api/lists", { data: { name: "x" }, headers: { Origin: "https://evil.example" } });
  expect(r.status()).toBe(403);
});

test("lists: private by default, public refused, duplicate warns, delete keeps wallets elsewhere", async () => {
  const { ctx } = await account();
  const a = await newList(ctx, "A"), b = await newList(ctx, "B");
  expect(a.visibility).toBe("private");
  expect((await ctx.patch(`/api/lists/${a.id}`, { data: { visibility: "public" } })).status()).toBe(422);
  const w = await addWallet(ctx, { address: A1, displayLabel: "One", listId: a.id, tags: ["Trader", "trader"], notes: "n" });
  expect(w.normalizedAddress).toBe(A1.toLowerCase());
  expect(w.tags).toEqual(["trader"]);
  const dup = await ctx.post("/api/wallets", { data: { address: A1, chain: "ethereum", listId: a.id } });
  expect(dup.status()).toBe(409);
  expect((await dup.json()).duplicate).toBe(true);
  expect((await ctx.post("/api/wallets", { data: { address: A1.replace("aA", "Aa"), chain: "ethereum" } })).status()).toBe(422);
  await json(ctx.post(`/api/lists/${b.id}/wallets`, { data: { walletId: w.id } }));
  expect((await json(ctx.get(`/api/wallets/${w.id}`))).lists.map((l: any) => l.name).sort()).toEqual(["A", "B"]);
  await json(ctx.delete(`/api/lists/${a.id}/wallets?walletId=${w.id}`));
  expect((await json(ctx.get(`/api/lists/${b.id}/wallets`))).total).toBe(1);
  await json(ctx.post(`/api/lists/${a.id}/wallets`, { data: { walletId: w.id, moveFrom: b.id } }));
  expect((await json(ctx.get(`/api/lists/${b.id}/wallets`))).total).toBe(0);
  const copy = await json(ctx.post(`/api/lists/${a.id}/duplicate`));
  expect((await json(ctx.get(`/api/lists/${copy.id}/wallets`))).total).toBe(1);
  await json(ctx.patch(`/api/lists/${copy.id}`, { data: { name: "Renamed", archived: true } }));
  expect((await json(ctx.get("/api/lists"))).some((l: any) => l.id === copy.id)).toBe(false);
  await json(ctx.delete(`/api/lists/${a.id}`));
  expect((await json(ctx.get(`/api/wallets/${w.id}`))).address).toBe(A1);
});

test("import and export round trip, with formula injection neutralised", async () => {
  const { ctx } = await account();
  const list = await newList(ctx);
  const csv = `address,chain,label,tags,notes\n${A1},base,"Hello, world",a; b,=HYPERLINK("x")\nnot-an-address,ethereum,bad,,\n${A2},,Inferred,,`;
  const r = await json(ctx.post("/api/wallets/import", { data: { listId: list.id, format: "csv", content: csv } }));
  expect(r).toMatchObject({ imported: 2, errorCount: 1 });
  const exported = await (await ctx.get(`/api/lists/${list.id}/export?format=csv`)).text();
  expect(exported).toContain('"Hello, world"');
  expect(exported).toContain(`'=HYPERLINK`);
  const j = await json(ctx.get(`/api/lists/${list.id}/export?format=json`));
  expect(j.wallets).toHaveLength(2);
  const other = await newList(ctx, "Reimport");
  const again = await json(ctx.post("/api/wallets/import", { data: { listId: other.id, format: "json", content: JSON.stringify(j) } }));
  expect(again.imported).toBe(2);
});

test("privacy: another user's private tag on the same address never leaks", async () => {
  const alice = await account(), bob = await account();
  const list = await newList(alice.ctx);
  const w = await addWallet(alice.ctx, { address: A1, displayLabel: "Alice secret", notes: "secret note", listId: list.id });
  const entity = await json(alice.ctx.post("/api/entities", { data: { name: "Secret Entity" } }), 201);
  await json(alice.ctx.post(`/api/entities/${entity.id}/wallets`, { data: { walletId: w.id } }));

  expect(await resolve(bob.ctx, A1)).toEqual([]);
  for (const path of [`/api/wallets/${w.id}`, `/api/lists/${list.id}`, `/api/lists/${list.id}/wallets`, `/api/lists/${list.id}/export`, `/api/entities/${entity.id}`]) {
    expect((await bob.ctx.get(path)).status(), path).toBe(404);
  }
  expect((await bob.ctx.patch(`/api/wallets/${w.id}`, { data: { displayLabel: "hacked" } })).status()).toBe(404);
  expect((await bob.ctx.delete(`/api/lists/${list.id}`)).status()).toBe(404);
  const search = await json(bob.ctx.get("/api/search?q=secret"));
  expect(search.wallets).toEqual([]); expect(search.entities).toEqual([]);
  const own = await resolve(alice.ctx, A1);
  expect(own[0]).toMatchObject({ source: "private", provenance: "Your private tag", label: "Alice secret" });
});

test("sharing: roles are enforced, labels carry provenance, private entity links stay hidden", async () => {
  const alice = await account(), bob = await account(), carol = await account();
  const list = await newList(alice.ctx, "Team");
  const w = await addWallet(alice.ctx, { address: A2, displayLabel: "Team wallet", listId: list.id });
  const entity = await json(alice.ctx.post("/api/entities", { data: { name: "Hidden Co" } }), 201);
  await json(alice.ctx.post(`/api/entities/${entity.id}/wallets`, { data: { walletId: w.id } }));

  const { url } = await json(alice.ctx.post(`/api/lists/${list.id}/members`, { data: { role: "viewer" } }));
  const token = url.split("/invite/")[1];
  await json(bob.ctx.post(`/api/invites/${token}`));
  expect((await json(alice.ctx.get(`/api/lists/${list.id}`))).visibility).toBe("shared");

  const labels = await resolve(bob.ctx, A2);
  expect(labels[0]).toMatchObject({ source: "shared", provenance: "Shared by Team", label: "Team wallet" });
  expect(labels[0].entity).toBeUndefined();
  expect((await json(bob.ctx.get(`/api/wallets/${w.id}`))).entities).toEqual([]);
  expect((await bob.ctx.get(`/api/entities/${entity.id}`)).status()).toBe(404);
  expect(await resolve(carol.ctx, A2)).toEqual([]);

  // Viewer can read but not write.
  expect((await bob.ctx.patch(`/api/wallets/${w.id}`, { data: { displayLabel: "no" } })).status()).toBe(403);
  expect((await bob.ctx.post("/api/wallets", { data: { address: A3, chain: "ethereum", listId: list.id } })).status()).toBe(403);
  expect((await bob.ctx.post(`/api/lists/${list.id}/members`, { data: { role: "admin" } })).status()).toBe(403);
  expect((await bob.ctx.delete(`/api/lists/${list.id}`)).status()).toBe(403);
  const me = (await json(bob.ctx.get("/api/auth/session"))).user.id;
  await json(alice.ctx.patch(`/api/lists/${list.id}/members/${me}`, { data: { role: "editor" } }));
  await json(bob.ctx.patch(`/api/wallets/${w.id}`, { data: { notes: "edited by bob" } }));
  expect((await bob.ctx.delete(`/api/wallets/${w.id}`)).status()).toBe(403);
  expect((await json(alice.ctx.get(`/api/lists/${list.id}/activity`))).length).toBeGreaterThan(0);

  // A link set to shared becomes visible. Removal cuts access entirely.
  await json(alice.ctx.post(`/api/entities/${entity.id}/wallets`, { data: { walletId: w.id, visibility: "shared" } }));
  expect((await resolve(bob.ctx, A2))[0].entity.name).toBe("Hidden Co");
  await json(alice.ctx.delete(`/api/lists/${list.id}/members/${me}`));
  expect(await resolve(bob.ctx, A2)).toEqual([]);
  expect((await bob.ctx.get(`/api/wallets/${w.id}`)).status()).toBe(404);

  // An emailed invitation works only for that address.
  const inv = await json(alice.ctx.post(`/api/lists/${list.id}/members`, { data: { role: "viewer", email: "someone@example.test" } }));
  expect((await carol.ctx.post(`/api/invites/${inv.url.split("/invite/")[1]}`)).status()).toBe(403);
});

test("links: dangerous URLs are rejected everywhere", async () => {
  const { ctx } = await account();
  for (const url of ["javascript:alert(1)", "data:text/html,<script>", "vbscript:x"]) {
    expect((await ctx.post("/api/entities", { data: { name: "E", links: [{ type: "custom", url }] } })).status(), url).toBe(422);
  }
  expect((await ctx.post("/api/entities", { data: { name: "E", avatarUrl: "javascript:alert(1)" } })).status()).toBe(422);
  const ok = await json(ctx.post("/api/entities", { data: { name: "E", links: [{ type: "x", url: "@uniswap", label: "Official X", status: "official" }] } }), 201);
  expect(ok.links[0].url).toBe("https://x.com/uniswap");
});

test("entities: many wallets, unlink keeps the wallet", async () => {
  const { ctx } = await account();
  const e = await json(ctx.post("/api/entities", { data: { name: "Multi", type: "dao" } }), 201);
  const w1 = await addWallet(ctx, { address: A1, entityId: e.id });
  const w2 = await addWallet(ctx, { address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", chain: "solana", entityId: e.id });
  expect((await json(ctx.get(`/api/entities/${e.id}`))).wallets).toHaveLength(2);
  await json(ctx.delete(`/api/entities/${e.id}/wallets/${w1.id}`));
  expect((await json(ctx.get(`/api/entities/${e.id}`))).wallets).toHaveLength(1);
  expect((await json(ctx.get(`/api/wallets/${w1.id}`))).entities).toEqual([]);
  expect((await resolve(ctx, A1))[0].entity).toBeUndefined();
  expect(w2.chain).toBe("solana");
});

test("public profiles: explicit publishing, provenance, reports, moderation, unpublish", async () => {
  const owner = await account(), viewer = await account();
  const mod = await moderator();

  const anon = await request.newContext({ baseURL: BASE });
  const name = `Proto ${Date.now()}`;
  const e = await json(owner.ctx.post("/api/entities", { data: { name, type: "protocol", description: "A protocol", links: [{ type: "website", url: "proto.example.org" }] } }), 201);
  const w = await addWallet(owner.ctx, { address: A3, displayLabel: "PRIVATE LABEL", notes: "PRIVATE NOTE", entityId: e.id });
  const hidden = await addWallet(owner.ctx, { address: A1, displayLabel: "Hidden wallet", entityId: e.id });

  // Must be acknowledged, and isn't visible before that.
  expect((await owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true } })).status()).toBe(422);
  const res = await json(owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } }));
  expect(res.status).toBe("community");
  await json(owner.ctx.post(`/api/entities/${e.id}/wallets`, { data: { walletId: w.id, visibility: "public", relationship: "treasury" } }));

  const profile = await json(anon.get(`/api/public/profiles/${res.slug}`));
  expect(profile.verification).toBe("community");
  expect(profile.publishedBy.name).toBeTruthy();
  expect(profile.wallets).toHaveLength(1);
  expect(profile.wallets[0].source).toMatch(/^Published by /);
  const raw = JSON.stringify(profile);
  expect(raw).not.toContain("PRIVATE"); expect(raw).not.toContain(hidden.address); expect(raw).not.toContain("ownerId");

  const page = await (await anon.get(`/p/${res.slug}`)).text();
  expect(page).toContain("Report or dispute"); expect(page).toContain("published by");
  expect(page).toMatch(/<meta name="robots" content="noindex/);
  expect(page).not.toContain("PRIVATE LABEL");

  // Other people's chips see the public claim, with its source, and never the owner's private label.
  const seen = await resolve(viewer.ctx, A3);
  expect(seen[0]).toMatchObject({ source: "community", label: name });
  expect(seen[0].provenance).toMatch(/^Published by /);
  expect(JSON.stringify(seen)).not.toContain("PRIVATE");
  expect(await resolve(viewer.ctx, A1)).toEqual([]);

  // Reporting needs an account, and goes to moderators only.
  expect((await anon.post(`/api/entities/${e.id}/report`, { data: { reason: "incorrect" } })).status()).toBe(401);
  await json(viewer.ctx.post(`/api/entities/${e.id}/report`, { data: { reason: "impersonation", details: "not them" } }));
  expect((await viewer.ctx.get("/api/admin/reports")).status()).toBe(403);
  const queue = await json(mod.get("/api/admin/reports"));
  const report = queue.find((r: any) => r.entity?.name === name);
  expect(report.reason).toBe("impersonation");
  expect((await viewer.ctx.post(`/api/admin/reports/${report.id}`, { data: { action: "remove" } })).status()).toBe(403);

  await json(mod.post(`/api/admin/reports/${report.id}`, { data: { action: "annotate", note: "Disputed" } }));
  expect((await json(anon.get(`/api/public/profiles/${res.slug}`))).annotation).toBe("Disputed");

  // Owner can go private again, which also removes it from chips.
  await json(owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: false } }));
  expect((await anon.get(`/api/public/profiles/${res.slug}`)).status()).toBe(404);
  expect((await anon.get(`/p/${res.slug}`)).status()).toBe(404);
  expect(await resolve(viewer.ctx, A3)).toEqual([]);

  // Removal sticks: a removed profile can't be republished.
  await json(owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true, allowIndexing: true } }));
  expect(await (await anon.get(`/p/${res.slug}`)).text()).not.toMatch(/<meta name="robots" content="noindex/);
  const again = await json(viewer.ctx.post(`/api/entities/${e.id}/report`, { data: { reason: "spam" } }));
  void again;
  const q2 = await json(mod.get("/api/admin/reports"));
  await json(mod.post(`/api/admin/reports/${q2.find((r: any) => r.entity?.name === name).id}`, { data: { action: "remove" } }));
  expect((await anon.get(`/api/public/profiles/${res.slug}`)).status()).toBe(404);
  expect((await owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } })).status()).toBe(403);
});

test("safe attribution: a person can only be published as a confirmed public figure; no personal contact details", async () => {
  const { ctx } = await account();
  const e = await json(ctx.post("/api/entities", { data: { name: "Some Person", type: "individual" } }), 201);
  // A fresh address: published claims are global, so a shared test address would leak into other tests.
  const w = await addWallet(ctx, { address: "0x" + createHash("sha256").update(`person${Math.random()}`).digest("hex").slice(0, 40), entityId: e.id });
  // Publishing is attribution, not ownership: no signature needed, but a person needs the public-figure confirmation.
  await json(ctx.post(`/api/entities/${e.id}/wallets`, { data: { walletId: w.id, visibility: "public" } }));
  expect((await ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } })).status()).toBe(422);
  expect((await json(ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true, publicFigure: true } }))).status).toBe("community");
  const p = await json(ctx.post("/api/entities", { data: { name: "Co", type: "company", description: "call me at +1 415 555 0100 now" } }), 201);
  expect((await ctx.post(`/api/entities/${p.id}/publish`, { data: { publish: true, acknowledge: true } })).status()).toBe(422);
});

test("verification: refuses unlisted channels and private network targets, and accepts a real wallet signature", async () => {
  const { privateKeyToAccount } = await import("viem/accounts");
  const signer = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
  const { ctx } = await account();
  const e = await json(ctx.post("/api/entities", { data: { name: "Chain Co", type: "company", links: [{ type: "website", url: "https://127.0.0.1.nip.io" }] } }), 201);
  expect((await ctx.post(`/api/entities/${e.id}/verify`, { data: { method: "dns", target: "https://unlisted.example.org" } })).status()).toBe(422);
  const meta = await json(ctx.post(`/api/entities/${e.id}/verify`, { data: { method: "meta", target: "https://127.0.0.1.nip.io" } }));
  expect((await ctx.post(`/api/entities/${e.id}/verify`, { data: { verificationId: meta.id } })).status()).toBe(422);

  const w = await addWallet(ctx, { address: signer.address, entityId: e.id });
  const v = await json(ctx.post(`/api/entities/${e.id}/verify`, { data: { method: "signature", target: w.id } }));
  expect((await ctx.post(`/api/entities/${e.id}/verify`, { data: { verificationId: v.id, proof: "0xdeadbeef" } })).status()).toBe(422);
  const signature = await signer.signMessage({ message: v.message });
  expect((await json(ctx.post(`/api/entities/${e.id}/verify`, { data: { verificationId: v.id, proof: signature } }))).status).toBe("wallet_verified");
  const entity = await json(ctx.get(`/api/entities/${e.id}`));
  expect(entity.wallets[0].evidence[0].verifiedAt).toBeTruthy();
  // A wallet signature proves the wallet, not the organisation's name.
  expect(entity.verification.status).toBe("unverified");
});

test.skip("wallet sign-in: valid signature signs in, replay is refused", async () => {
  // Hidden until Better Auth SIWE / wallet providers are wired back in.
});

test("rate limits apply to authentication", async () => {
  const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": `10.1.${Date.now() % 255}.1` } });
  let limited = false;
  for (let i = 0; i < 40 && !limited; i++) {
    limited = (await signIn(ctx, "nobody@example.test", "whatever-x")).status() === 429;
  }
  expect(limited).toBe(true);
});

test("security headers: CSP on pages", async () => {
  const anon = await request.newContext({ baseURL: BASE });
  const res = await anon.get("/");
  const csp = res.headers()["content-security-policy"];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toMatch(/script-src 'self' 'nonce-/);
  expect(csp).not.toContain("unsafe-eval");
});

test("account: export, then delete removes all data and the public profile", async () => {
  const { ctx, email } = await account();
  const anon = await request.newContext({ baseURL: BASE });
  const list = await newList(ctx);
  await addWallet(ctx, { address: A1, listId: list.id, displayLabel: "Mine" });
  const e = await json(ctx.post("/api/entities", { data: { name: `Del ${Date.now()}`, type: "company" } }), 201);
  const pub = await json(ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } }));
  const data = await json(ctx.get("/api/account/export"));
  expect(data.wallets).toHaveLength(1);
  expect(JSON.stringify(data)).not.toContain("scrypt");
  expect((await ctx.delete("/api/account", { data: { confirm: "NOPE", password: PASSWORD } })).status()).toBe(422);
  expect((await ctx.delete("/api/account", { data: { confirm: "DELETE", password: "wrong-password-x" } })).status()).toBe(401);
  await json(ctx.delete("/api/account", { data: { confirm: "DELETE", password: PASSWORD } }));
  expect((await json(ctx.get("/api/auth/session"))).user).toBeNull();
  expect((await anon.get(`/api/public/profiles/${pub.slug}`)).status()).toBe(404);
  expect((await signIn(anon, email)).status()).toBe(401);
});

test("password reset: no enumeration, single use, and it ends old sessions", async () => {
  const { ctx, email } = await account();
  const anon = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": "10.3.0.1" } });
  expect((await json(anon.post("/api/auth/request-password-reset", { data: { email: "unknown@example.test", redirectTo: `${BASE}/reset-password` } }))).status).toBe(true);
  expect((await json(anon.post("/api/auth/request-password-reset", { data: { email, redirectTo: `${BASE}/reset-password` } }))).status).toBe(true);
  expect((await anon.post("/api/auth/reset-password", { data: { token: "not-a-real-token-at-all", newPassword: PASSWORD } })).status()).toBeGreaterThanOrEqual(400);

  // The real token only exists in an email, so plant a known one the same way Better Auth stores it.
  const client = await new MongoClient("mongodb://127.0.0.1:3202/tagawallet_e2e").connect();
  const database = client.db();
  const user = await database.collection("users").findOne({ email });
  const token = "known-reset-token-for-this-test";
  await database.collection("verification").insertOne({
    identifier: `reset-password:${token}`,
    value: user!._id.toString(),
    expiresAt: new Date(Date.now() + 60000),
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await client.close();

  const next = "a-brand-new-password";
  await json(anon.post("/api/auth/reset-password", { data: { token, newPassword: next } }));
  expect((await json(ctx.get("/api/auth/session"))).user).toBeNull();
  expect((await anon.post("/api/auth/reset-password", { data: { token, newPassword: next } })).status()).toBeGreaterThanOrEqual(400);
  expect((await signIn(anon, email, PASSWORD)).status()).toBe(401);
  await json(signIn(anon, email, next));
});

test("search: partial address, name, tag, note, chain, list and link, fast at 10k wallets", async () => {
  test.setTimeout(240_000);
  const { ctx } = await account();
  const list = await newList(ctx, "Whales");
  await addWallet(ctx, { address: A1, displayLabel: "Findable Name", tags: ["needle-tag"], notes: "a needle-note here", listId: list.id, links: [{ type: "x", url: "@needlehandle" }] });
  const e = await json(ctx.post("/api/entities", { data: { name: "Needle Entity" } }), 201);
  await addWallet(ctx, { address: A2, entityId: e.id });
  const q = async (s: string) => (await json(ctx.get(`/api/search?q=${encodeURIComponent(s)}`))).wallets.map((w: any) => w.address);
  expect(await q("6053f3e94")).toContain(A1);
  expect(await q("findable")).toContain(A1);
  expect(await q("needle-tag")).toContain(A1);
  expect(await q("needle-note")).toContain(A1);
  expect(await q("whales")).toContain(A1);
  expect(await q("needlehandle")).toContain(A1);
  expect(await q("needle entity")).toContain(A2);
  expect(await q("(((")).toEqual([]);
  expect((await json(ctx.get("/api/search?q=&chain=solana"))).wallets).toEqual([]);

  // Bulk load through the import route so the numbers reflect real records.
  for (let batch = 0; batch < 2; batch++) {
    const rows = Array.from({ length: 5000 }, (_, i) => ({ address: `0x${(batch * 5000 + i).toString(16).padStart(40, "0")}`, chain: "ethereum", label: `Bulk ${batch}-${i}`, tags: "bulk", notes: "bulk note" }));
    const r = await json(ctx.post("/api/wallets/import", { data: { listId: list.id, format: "json", content: JSON.stringify(rows) }, timeout: 180_000 }));
    expect(r.imported).toBe(5000);
  }
  const started = Date.now();
  const hit = await json(ctx.get("/api/search?q=bulk%201-4999"));
  const took = Date.now() - started;
  expect(hit.wallets).toHaveLength(1);
  console.log(`search over 10k wallets: ${hit.tookMs}ms in query, ${took}ms round trip`);
  expect(took).toBeLessThan(500);
});

test("x handles: own links appear, others' private links and unproven public claims don't", async () => {
  const alice = await account(), bob = await account();
  const handles = async (c: APIRequestContext) => (await json(c.get("/api/extension/handles"))).entries;
  const list = await newList(alice.ctx);
  await addWallet(alice.ctx, { address: A1, displayLabel: "Wallet tag", listId: list.id, links: [{ type: "x", url: "@WalletOwner" }] });
  const e = await json(alice.ctx.post("/api/entities", { data: { name: "Entity Tag", type: "company", links: [{ type: "x", url: "https://x.com/EntityOwner" }] } }), 201);
  const entries = await handles(alice.ctx);
  expect(entries.find((x: any) => x.handle === "walletowner")).toMatchObject({ address: A1, labels: [{ label: "Wallet tag", source: "private" }] });
  expect(entries.find((x: any) => x.handle === "entityowner").labels[0].label).toBe("Entity Tag");
  expect(await handles(bob.ctx)).toEqual([]);
  // A self-claimed public profile must not label a real account for everyone else.
  await json(alice.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } }));
  expect(await handles(bob.ctx)).toEqual([]);
  const { url } = await json(alice.ctx.post(`/api/lists/${list.id}/members`, { data: { role: "viewer" } }));
  await json(bob.ctx.post(`/api/invites/${url.split("/invite/")[1]}`));
  expect((await handles(bob.ctx))[0]).toMatchObject({ handle: "walletowner", labels: [{ source: "shared" }] });
});

test("sign-in methods: the last way in can't be unlinked, and identities show in the session", async () => {
  const { ctx } = await account();
  const me = (await json(ctx.get("/api/auth/session"))).user;
  expect(me.identities).toEqual([]);
  expect(me.hasPassword).toBe(true);
  expect((await ctx.delete("/api/account/identities", { data: { provider: "google" } })).status()).toBe(404);
});

test("import: column mapping, a dry-run preview, no list needed, and into a person or project", async () => {
  const { ctx } = await account();
  await addWallet(ctx, { address: A3, displayLabel: "Already mine" });
  const csv = `Wallet,Network,Name,Memo\n${A1},base,Treasury,from a sheet\n${A1},base,Treasury twice,\n${A3},ethereum,Renamed?,\nnope,ethereum,Bad,`;
  const mapping = { address: "Wallet", chain: "Network", label: "Name", notes: "Memo" };
  const dry = await json(ctx.post("/api/wallets/import", { data: { format: "csv", content: csv, mapping, dryRun: true } }));
  expect(dry).toMatchObject({ dryRun: true, created: 1, existing: 1, duplicates: 1, errorCount: 1, imported: 1, total: 4 });
  expect(dry.preview.map((p: any) => p.outcome)).toEqual(["new", "duplicate", "existing"]);
  expect((await json(ctx.get("/api/search?q=Treasury"))).wallets).toHaveLength(0);

  const done = await json(ctx.post("/api/wallets/import", { data: { format: "csv", content: csv, mapping } }));
  expect(done.imported).toBe(1);
  const found = (await json(ctx.get("/api/search?q=Treasury"))).wallets;
  expect(found[0]).toMatchObject({ displayLabel: "Treasury", chain: "base", notes: "from a sheet", source: "import" });
  // An address you already have keeps its name.
  expect((await json(ctx.get("/api/search?q=Already"))).wallets).toHaveLength(1);

  const entity = await json(ctx.post("/api/entities", { data: { name: "Acme", type: "project" } }), 201);
  const into = await json(ctx.post("/api/wallets/import", { data: { entityId: entity.id, format: "json", content: JSON.stringify([{ address: A2, name: "Acme hot" }, { address: A3 }]) } }));
  expect(into).toMatchObject({ imported: 2, created: 1, existing: 1 });
  const linked = await json(ctx.get(`/api/wallets?entity=${entity.id}`));
  expect(linked.map((w: any) => w.address).sort()).toEqual([A2, A3].sort());

  const other = await account();
  expect((await other.ctx.post("/api/wallets/import", { data: { entityId: entity.id, format: "csv", content: `address\n${A1}` } })).status()).toBe(404);
});

test("invites: admins see and revoke pending invites, and a revoked link stops working", async () => {
  const alice = await account(), bob = await account();
  const list = await newList(alice.ctx, "Revocable");
  const { url } = await json(alice.ctx.post(`/api/lists/${list.id}/members`, { data: { role: "editor" } }));
  await json(alice.ctx.post(`/api/lists/${list.id}/members`, { data: { role: "viewer", email: "someone@example.test" } }));
  const pending = await json(alice.ctx.get(`/api/lists/${list.id}/invites`));
  expect(pending).toHaveLength(2);
  expect((await bob.ctx.get(`/api/lists/${list.id}/invites`)).status()).toBe(404);
  const link = pending.find((i: any) => !i.email);
  expect((await bob.ctx.delete(`/api/lists/${list.id}/invites/${link.id}`)).status()).toBe(404);
  await json(alice.ctx.delete(`/api/lists/${list.id}/invites/${link.id}`));
  expect(await json(alice.ctx.get(`/api/lists/${list.id}/invites`))).toHaveLength(1);
  expect((await bob.ctx.post(`/api/invites/${url.split("/invite/")[1]}`)).status()).toBe(404);
  expect((await alice.ctx.delete(`/api/lists/${list.id}/invites/${link.id}`)).status()).toBe(404);
});

test("bulk edits: labels, notes, moving between lists and linking, with access checked per wallet", async () => {
  const alice = await account(), bob = await account();
  const from = await newList(alice.ctx, "From"), to = await newList(alice.ctx, "To");
  const w1 = await addWallet(alice.ctx, { address: A1, displayLabel: "One", tags: ["keep", "drop"], listId: from.id });
  const w2 = await addWallet(alice.ctx, { address: A2, displayLabel: "Two", tags: ["drop"], notes: "old", listId: from.id });
  const ids = [w1.id, w2.id];
  const bulk = (c: APIRequestContext, data: object) => json(c.post("/api/wallets/bulk", { data: { ids, ...data } }));

  expect(await bulk(alice.ctx, { op: "removeTag", tag: "drop" })).toMatchObject({ changed: 2, failed: [] });
  expect((await json(alice.ctx.get(`/api/wallets/${w1.id}`))).tags).toEqual(["keep"]);
  await bulk(alice.ctx, { op: "addTag", tag: "Whale" });
  await bulk(alice.ctx, { op: "setStatus", status: "watchlist" });
  await bulk(alice.ctx, { op: "setNotes", mode: "append", text: "seen on X" });
  const two = await json(alice.ctx.get(`/api/wallets/${w2.id}`));
  expect(two).toMatchObject({ tags: ["whale"], status: "watchlist", notes: "old\nseen on X" });

  await bulk(alice.ctx, { op: "move", fromListId: from.id, toListId: to.id });
  expect(await json(alice.ctx.get(`/api/wallets?list=${from.id}`))).toHaveLength(0);
  expect(await json(alice.ctx.get(`/api/wallets?list=${to.id}`))).toHaveLength(2);

  const entity = await json(alice.ctx.post("/api/entities", { data: { name: "Bulk Co" } }), 201);
  await bulk(alice.ctx, { op: "linkEntity", entityId: entity.id });
  expect(await json(alice.ctx.get(`/api/wallets?entity=${entity.id}`))).toHaveLength(2);

  // Someone without access changes nothing, and is told so per wallet.
  const r = await bulk(bob.ctx, { op: "addTag", tag: "hijack" });
  expect(r).toMatchObject({ changed: 0 });
  expect(r.failed).toHaveLength(2);
  expect((await json(alice.ctx.get(`/api/wallets/${w1.id}`))).tags).not.toContain("hijack");
});

test("wallets: the chain or address can be changed in place, and a collision says which wallet", async () => {
  const { ctx } = await account();
  const list = await newList(ctx, "Keep me");
  const w = await addWallet(ctx, { address: A1, displayLabel: "Movable", listId: list.id });
  const other = await addWallet(ctx, { address: A2, displayLabel: "Taken", chain: "base" });
  const moved = await json(ctx.patch(`/api/wallets/${w.id}`, { data: { chain: "base" } }));
  expect(moved).toMatchObject({ chain: "base", displayLabel: "Movable" });
  expect(moved.lists.map((l: any) => l.name)).toEqual(["Keep me"]);
  const clash = await ctx.patch(`/api/wallets/${w.id}`, { data: { address: A2 } });
  expect(clash.status()).toBe(409);
  expect(await clash.json()).toMatchObject({ walletId: other.id });
  expect((await ctx.patch(`/api/wallets/${w.id}`, { data: { chain: "solana" } })).status()).toBe(422);
  await json(ctx.patch(`/api/wallets/${w.id}`, { data: { address: A3 } }));
  expect((await json(ctx.get(`/api/wallets/${w.id}`))).address).toBe(A3);
});

test("exports: the filtered wallet view, one person or project, and every linked entity", async () => {
  const { ctx } = await account();
  const w = await addWallet(ctx, { address: A1, displayLabel: "Linked twice", tags: ["vip"] });
  await addWallet(ctx, { address: A2, displayLabel: "Plain" });
  for (const name of ["First Co", "Second Co"]) {
    const e = await json(ctx.post("/api/entities", { data: { name } }), 201);
    await json(ctx.post(`/api/entities/${e.id}/wallets`, { data: { walletId: w.id } }));
  }
  const csv = await (await ctx.get("/api/wallets/export?format=csv&tag=vip")).text();
  expect(csv.split("\n")[0]).toBe("address,chain,label,status,tags,notes,entities");
  expect(csv).toContain("Linked twice");
  expect(csv).not.toContain("Plain");
  expect(csv).toMatch(/First Co; Second Co|Second Co; First Co/);
  const entities = await json(ctx.get("/api/entities"));
  const first = entities.find((e: any) => e.name === "First Co");
  const one = await json(ctx.get(`/api/entities/${first.id}/export?format=json`));
  expect(one.entity.name).toBe("First Co");
  expect(one.wallets.map((r: any) => r.label)).toEqual(["Linked twice"]);
});

test("extension: a tag can be removed, and the handle index answers 304 when unchanged", async () => {
  const { ctx } = await account();
  await json(ctx.post("/api/extension/tags", { data: { address: A1, chain: "ethereum", displayLabel: "Short lived" } }));
  expect(await resolve(ctx, A1)).toHaveLength(1);
  expect(await json(ctx.delete("/api/extension/tags", { data: { address: A1, chain: "ethereum" } }))).toMatchObject({ removed: true });
  expect(await resolve(ctx, A1)).toHaveLength(0);
  expect(await json(ctx.delete("/api/extension/tags", { data: { address: A1, chain: "ethereum" } }))).toMatchObject({ removed: false });

  const first = await ctx.get("/api/extension/handles");
  const etag = first.headers()["etag"];
  expect(etag).toBeTruthy();
  expect((await ctx.get("/api/extension/handles", { headers: { "If-None-Match": etag! } })).status()).toBe(304);
});

test("account: connected browsers are listed and can all be disconnected", async () => {
  const { ctx } = await account();
  const { token } = await json(ctx.post("/api/extension/connect"));
  expect((await json(ctx.get("/api/account/extension"))).browsers).toHaveLength(1);
  expect(await json(ctx.delete("/api/account/extension"))).toMatchObject({ disconnected: 1 });
  const anon = await request.newContext({ baseURL: BASE });
  expect((await anon.get("/api/extension/bootstrap", { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401);
});

test("api keys: read-only v1 works with a key, never with a session, and a revoked key stops at once", async () => {
  const { ctx } = await account();
  const list = await newList(ctx, "Via API");
  await addWallet(ctx, { address: A1, displayLabel: "API wallet", tags: ["bot"], listId: list.id });
  const created = await json(ctx.post("/api/account/api-keys", { data: { name: "notebook" } }), 201);
  expect(created.key).toMatch(/^taw_/);
  expect(JSON.stringify(await json(ctx.get("/api/account/api-keys")))).not.toContain(created.key);

  const bot = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { Authorization: `Bearer ${created.key}` } });
  const wallets = await json(bot.get("/api/v1/wallets?tag=bot"));
  expect(wallets.wallets[0]).toMatchObject({ address: A1, label: "API wallet", tags: ["bot"], lists: [{ id: list.id, name: "Via API" }] });
  expect((await json(bot.get("/api/v1/lists"))).lists[0]).toMatchObject({ name: "Via API", walletCount: 1, role: "owner" });
  expect(await json(bot.get("/api/v1/entities"))).toMatchObject({ entities: [] });
  const looked = await json(bot.get(`/api/v1/lookup?addresses=${A1},${A2}`));
  expect(looked.results[0].labels[0]).toMatchObject({ label: "API wallet", source: "private" });
  expect(looked.results[1].labels).toEqual([]);
  expect((await bot.get("/api/v1/lookup?addresses=nonsense")).status()).toBe(422);

  // Read-only, and the two kinds of credential never cross over.
  expect((await bot.post("/api/v1/wallets", { data: {} })).status()).toBe(405);
  expect((await bot.get("/api/wallets")).status()).toBe(401);
  expect((await bot.get("/api/account/api-keys")).status()).toBe(401);
  expect((await ctx.get("/api/v1/wallets")).status()).toBe(401);

  await json(ctx.delete(`/api/account/api-keys/${created.id}`));
  expect((await bot.get("/api/v1/wallets")).status()).toBe(401);
});

test.skip("solana sign-in: an Ed25519 signature signs in, a wrong one is refused, replay too", async () => {
  // Hidden until wallet sign-in is wired back through Better Auth.
});

test("ens: a name resolved on-chain carries the labels of the wallet behind it, and its address", async () => {
  const { ctx } = await account();
  await addWallet(ctx, { address: A2, displayLabel: "Behind the name" });
  const name = `tagtest${Date.now()}.eth`;
  // No RPC in tests, so plant the cached answer the resolver would have stored.
  const client = await new MongoClient("mongodb://127.0.0.1:3202/tagawallet_e2e").connect();
  await client.db().collection("ens_cache").insertOne({ _id: name as never, address: A2, expiresAt: new Date(Date.now() + 60_000) });
  await client.close();
  const r = await json(ctx.post("/api/extension/resolve", { data: { addresses: [{ normalized: name, kind: "ens" }] } }));
  expect(r.results[0]).toMatchObject({ normalized: name, address: A2 });
  expect(r.results[0].labels[0]).toMatchObject({ label: "Behind the name", source: "private" });
});

test("extension sites: the built-in list covers Bitcoin, Solana and Blockscout explorers", async () => {
  const anon = await request.newContext({ baseURL: BASE });
  const { sites } = await json(anon.get("/api/extension/sites"));
  for (const s of ["mempool.space", "solana.fm", "blockscout.com", "opensea.io"]) expect(sites).toContain(s);
});

test("email verification: needed to publish and invite by email, confirmed by a one-time link, and required for admin", async () => {
  const { ctx, email } = await account(undefined, { verified: false });
  expect((await json(ctx.get("/api/auth/session"))).user.emailVerified).toBe(false);
  const e = await json(ctx.post("/api/entities", { data: { name: `Unverified ${Date.now()}`, type: "project" } }), 201);
  const blocked = await ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } });
  expect(blocked.status()).toBe(403);
  expect(await blocked.json()).toMatchObject({ needsVerification: true });
  const list = await newList(ctx, "Invites");
  expect((await ctx.post(`/api/lists/${list.id}/members`, { data: { role: "viewer", email: "friend@example.test" } })).status()).toBe(403);
  await json(ctx.post(`/api/lists/${list.id}/members`, { data: { role: "viewer" } })); // A link sends no email, so it's fine.

  // Confirm the address the way the verify-email link would (Better Auth sets emailVerified).
  await markVerified(email);
  expect((await json(ctx.get("/api/auth/session"))).user.emailVerified).toBe(true);
  await json(ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } }));
  expect((await json(ctx.post("/api/account/verify-email"))).alreadyVerified).toBe(true);

  // Typing an admin's address at signup grants nothing until it's confirmed.
  const users = (await db()).collection("users");
  await users.deleteOne({ email: "moderator@example.test" });
  await (await db()).collection("account").deleteMany({ accountId: "moderator@example.test" });
  const squatter = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": "10.3.0.1" } });
  await json(signUp(squatter, "moderator@example.test"));
  expect((await squatter.get("/api/admin/reports")).status()).toBe(403);
  await users.deleteOne({ email: "moderator@example.test" });
  await (await db()).collection("account").deleteMany({ accountId: "moderator@example.test" });
});

test("wallet reports: one public wallet claim can be reported and removed, and owners restricted then reinstated", async () => {
  const owner = await account(), viewer = await account();
  const mod = await moderator();
  const anon = await request.newContext({ baseURL: BASE });
  const name = `Claims ${Date.now()}`;
  const e = await json(owner.ctx.post("/api/entities", { data: { name, type: "project" } }), 201);
  const pub = await addWallet(owner.ctx, { address: A1, entityId: e.id });
  const priv = await addWallet(owner.ctx, { address: A2, entityId: e.id });
  const { slug } = await json(owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } }));
  await json(owner.ctx.post(`/api/entities/${e.id}/wallets`, { data: { walletId: pub.id, visibility: "public", relationship: "treasury" } }));

  const profile = await json(anon.get(`/api/public/profiles/${slug}`));
  const linkId = profile.wallets[0].linkId;
  expect(linkId).toBeTruthy();
  expect((await resolve(viewer.ctx, A1))[0]).toMatchObject({ source: "community", linkId });

  // Only public claims can be reported, so a report reveals nothing private.
  const privateLink = (await (await db()).collection("wallet_entity_links").findOne({ walletId: new (await import("mongodb")).ObjectId(priv.id) }))!._id.toString();
  expect((await viewer.ctx.post("/api/reports", { data: { targetType: "wallet_entity_link", targetId: privateLink, reason: "incorrect" } })).status()).toBe(404);
  await json(viewer.ctx.post("/api/reports", { data: { targetType: "wallet_entity_link", targetId: linkId, reason: "incorrect", details: "not their treasury" } }));

  const queue = await json(mod.get("/api/admin/reports"));
  const report = queue.find((r: any) => r.entity?.name === name);
  expect(report).toMatchObject({ targetType: "wallet_entity_link", link: { address: A1, relationship: "treasury" } });
  await json(mod.post(`/api/admin/reports/${report.id}`, { data: { action: "remove", note: "No evidence" } }));
  expect(await resolve(viewer.ctx, A1)).toEqual([]);
  expect((await json(anon.get(`/api/public/profiles/${slug}`))).wallets).toHaveLength(0); // The profile itself stays up.

  await json(viewer.ctx.post("/api/reports", { data: { targetType: "entity", targetId: e.id, reason: "spam" } }));
  const second = (await json(mod.get("/api/admin/reports"))).find((r: any) => r.entity?.name === name);
  await json(mod.post(`/api/admin/reports/${second.id}`, { data: { action: "restrict_owner" } }));
  // Restricting keeps the report open for review, so it moves to the reviewing queue.
  expect((await json(mod.get("/api/admin/reports?status=reviewing"))).find((r: any) => r.id === second.id).ownerRestricted).toBe(true);
  expect((await owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } })).status()).toBe(403);
  const restricted = await json(mod.get("/api/admin/restricted"));
  const me = restricted.find((u: any) => u.email === owner.email);
  expect(me).toBeTruthy();
  expect((await viewer.ctx.delete(`/api/admin/restricted/${me.id}`)).status()).toBe(403);
  await json(mod.delete(`/api/admin/restricted/${me.id}`));
  await json(owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } }));
});

test("admin sites: moderators edit and reset the extension's site list, nobody else can", async () => {
  const mod = await moderator(), { ctx } = await account();
  expect((await ctx.put("/api/extension/sites", { data: { sites: ["evil.example"] } })).status()).toBe(403);
  expect((await mod.put("/api/extension/sites", { data: { sites: ["Not A Host"] } })).status()).toBe(422);
  await json(mod.put("/api/extension/sites", { data: { sites: ["etherscan.io", "Etherscan.io", "explorer.example.org"] } }));
  const anon = await request.newContext({ baseURL: BASE });
  expect(await json(anon.get("/api/extension/sites"))).toMatchObject({ sites: ["etherscan.io", "explorer.example.org"], custom: true });
  await json(mod.delete("/api/extension/sites"));
  const reset = await json(anon.get("/api/extension/sites"));
  expect(reset.custom).toBe(false);
  expect(reset.sites).toContain("mempool.space");
});

test("public lists and profiles: published by their owner, collaborators' wallets and notes stay private", async () => {
  const owner = await account(), helper = await account(), viewer = await account();
  const anon = await request.newContext({ baseURL: BASE });
  const fresh = () => "0x" + createHash("sha256").update(`${Math.random()}`).digest("hex").slice(0, 40);
  const B1 = fresh(), B2 = fresh();
  const handle = `pub${Date.now() % 1e9}`;
  await json(owner.ctx.patch("/api/account", { data: { displayName: "Pat Publisher" } }));
  // A public profile needs a handle; handles are unique and some are reserved.
  expect((await owner.ctx.patch("/api/account", { data: { profilePublic: true } })).status()).toBe(422);
  expect((await owner.ctx.patch("/api/account", { data: { handle: "admin" } })).status()).toBe(422);
  await json(owner.ctx.patch("/api/account", { data: { handle, bio: "I track bridges", profilePublic: true } }));
  expect((await helper.ctx.patch("/api/account", { data: { handle } })).status()).toBe(409);

  const list = await json(owner.ctx.post("/api/lists", { data: { name: "Bridges" } }));
  const mine = await addWallet(owner.ctx, { address: B1, displayLabel: "Wormhole router", tags: ["bridge"], notes: "SECRET NOTE" });
  await json(owner.ctx.post(`/api/lists/${list.id}/wallets`, { data: { walletId: mine.id } }));
  const { url } = await json(owner.ctx.post(`/api/lists/${list.id}/members`, { data: { role: "editor" } }));
  await json(helper.ctx.post(`/api/invites/${url.split("/invite/")[1]}`));
  const theirs = await addWallet(helper.ctx, { address: B2, displayLabel: "HELPER PRIVATE NAME" });
  await json(helper.ctx.post(`/api/lists/${list.id}/wallets`, { data: { walletId: theirs.id } }));

  // Only the owner can publish, and nothing shows before that.
  expect((await anon.get(`/l/${list.id}`)).status()).toBe(404);
  expect((await helper.ctx.post(`/api/lists/${list.id}/publish`, { data: { publish: true } })).status()).toBe(403);
  await json(owner.ctx.post(`/api/lists/${list.id}/publish`, { data: { publish: true } }));

  const page = await (await anon.get(`/l/${list.id}`)).text();
  expect(page).toContain("Wormhole router"); expect(page).toContain("Pat Publisher");
  expect(page).not.toContain("HELPER PRIVATE NAME"); expect(page).not.toContain("SECRET NOTE");
  const profile = await (await anon.get(`/u/${handle}`)).text();
  expect(profile).toContain("I track bridges"); expect(profile).toContain("Bridges");

  // Lookups show it as published by the owner, never the helper's wallet.
  const seen = await resolve(viewer.ctx, B1);
  expect(seen[0]).toMatchObject({ source: "community", label: "Wormhole router", publishedBy: { name: "Pat Publisher", handle } });
  expect(await resolve(viewer.ctx, B2)).toEqual([]);
  expect(await (await anon.get(`/a/${B1}`)).text()).toContain("Wormhole router");

  // Going private takes it all back; turning the profile off hides the page.
  await json(owner.ctx.post(`/api/lists/${list.id}/publish`, { data: { publish: false } }));
  expect((await anon.get(`/l/${list.id}`)).status()).toBe(404);
  expect(await resolve(viewer.ctx, B1)).toEqual([]);
  await json(owner.ctx.patch("/api/account", { data: { profilePublic: false } }));
  expect((await anon.get(`/u/${handle}`)).status()).toBe(404);
});
