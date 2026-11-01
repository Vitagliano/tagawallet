import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { createHash } from "node:crypto";
import { MongoClient } from "mongodb";

const BASE = "http://localhost:3200";
const A1 = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const A2 = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";
const A3 = "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB";
const PASSWORD = "correct-horse-battery";
let n = 0;

async function account(email = `u${Date.now()}${n++}@example.test`) {
  // Each account gets its own client address, so the signup rate limit doesn't trip across tests.
  const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": `10.0.${n % 250}.${Date.now() % 250}` } });
  const res = await ctx.post("/api/auth/register", { data: { email, password: PASSWORD, displayName: email.split("@")[0] } });
  expect(res.status(), await res.text()).toBe(201);
  return { ctx, email };
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
  const res = await ctx.post("/api/auth/register", { data: { email, password: PASSWORD, displayName: "C" } });
  const cookie = res.headers()["set-cookie"];
  expect(cookie).toMatch(/HttpOnly/i); expect(cookie).toMatch(/SameSite=Lax/i); expect(cookie).toMatch(/Secure/i);
  expect(await res.text()).not.toMatch(/passwordHash|scrypt/);
  expect((await json(ctx.get("/api/auth/session"))).user.email).toBe(email);
  await json(ctx.post("/api/auth/logout"));
  expect((await json(ctx.get("/api/auth/session"))).user).toBeNull();
  expect((await ctx.post("/api/auth/login", { data: { email, password: "wrong-password-x" } })).status()).toBe(401);
  await json(ctx.post("/api/auth/login", { data: { email, password: PASSWORD } }));
  expect((await ctx.post("/api/auth/register", { data: { email, password: PASSWORD, displayName: "C" } })).status()).toBe(409);
  expect((await ctx.post("/api/auth/register", { data: { email: "s@example.test", password: "short", displayName: "C" } })).status()).toBe(422);
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
  const mod = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": "10.2.0.1" } });
  const modEmail = "moderator@example.test";
  await mod.post("/api/auth/register", { data: { email: modEmail, password: PASSWORD, displayName: "Mod" } });
  await json(mod.post("/api/auth/login", { data: { email: modEmail, password: PASSWORD } }));

  const anon = await request.newContext({ baseURL: BASE });
  const name = `Proto ${Date.now()}`;
  const e = await json(owner.ctx.post("/api/entities", { data: { name, type: "protocol", description: "A protocol", links: [{ type: "website", url: "proto.example.org" }] } }), 201);
  const w = await addWallet(owner.ctx, { address: A3, displayLabel: "PRIVATE LABEL", notes: "PRIVATE NOTE", entityId: e.id });
  const hidden = await addWallet(owner.ctx, { address: A1, displayLabel: "Hidden wallet", entityId: e.id });

  // Must be acknowledged, and isn't visible before that.
  expect((await owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true } })).status()).toBe(422);
  const res = await json(owner.ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } }));
  expect(res.status).toBe("self_claimed");
  await json(owner.ctx.post(`/api/entities/${e.id}/wallets`, { data: { walletId: w.id, visibility: "public", relationship: "treasury" } }));

  const profile = await json(anon.get(`/api/public/profiles/${res.slug}`));
  expect(profile.verification).toBe("self_claimed");
  expect(profile.wallets).toHaveLength(1);
  expect(profile.wallets[0].source).toMatch(/Self-claimed/);
  const raw = JSON.stringify(profile);
  expect(raw).not.toContain("PRIVATE"); expect(raw).not.toContain(hidden.address); expect(raw).not.toContain("ownerId");

  const page = await (await anon.get(`/p/${res.slug}`)).text();
  expect(page).toContain("Report or dispute"); expect(page).toContain("Self-claimed");
  expect(page).toMatch(/<meta name="robots" content="noindex/);
  expect(page).not.toContain("PRIVATE LABEL");

  // Other people's chips see the public claim, with its source, and never the owner's private label.
  const seen = await resolve(viewer.ctx, A3);
  expect(seen[0]).toMatchObject({ source: "self_claimed", label: name });
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

test("safe attribution: individuals can't be published or publicly linked unverified", async () => {
  const { ctx } = await account();
  const e = await json(ctx.post("/api/entities", { data: { name: "Some Person", type: "individual" } }), 201);
  const w = await addWallet(ctx, { address: A1, entityId: e.id });
  expect((await ctx.post(`/api/entities/${e.id}/publish`, { data: { publish: true, acknowledge: true } })).status()).toBe(422);
  expect((await ctx.post(`/api/entities/${e.id}/wallets`, { data: { walletId: w.id, visibility: "public" } })).status()).toBe(422);
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

test("wallet sign-in: valid signature signs in, replay is refused", async () => {
  const { privateKeyToAccount } = await import("viem/accounts");
  const signer = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ea870594951c61a2a4c0d3a");
  const ctx = await request.newContext({ baseURL: BASE });
  const { nonce, message } = await json(ctx.get("/api/auth/wallet"));
  const signature = await signer.signMessage({ message });
  await json(ctx.post("/api/auth/wallet", { data: { address: signer.address, signature, nonce } }));
  expect((await json(ctx.get("/api/auth/session"))).user.authProviders).toContain("wallet");
  expect((await ctx.post("/api/auth/wallet", { data: { address: signer.address, signature, nonce } })).status()).toBe(400);
});

test("rate limits apply to authentication", async () => {
  const ctx = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": `10.1.${Date.now() % 255}.1` } });
  let limited = false;
  for (let i = 0; i < 25 && !limited; i++) {
    limited = (await ctx.post("/api/auth/login", { data: { email: "nobody@example.test", password: "whatever-x" } })).status() === 429;
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
  expect((await anon.post("/api/auth/login", { data: { email, password: PASSWORD } })).status()).toBe(401);
});

test("password reset: no enumeration, single use, and it ends old sessions", async () => {
  const { ctx, email } = await account();
  const anon = await request.newContext({ baseURL: BASE, extraHTTPHeaders: { "x-forwarded-for": "10.3.0.1" } });
  expect((await json(anon.post("/api/auth/reset-password", { data: { email: "unknown@example.test" } }))).ok).toBe(true);
  expect((await json(anon.post("/api/auth/reset-password", { data: { email } }))).ok).toBe(true);
  expect((await anon.post("/api/auth/reset-password/confirm", { data: { token: "not-a-real-token-at-all", password: PASSWORD } })).status()).toBe(400);

  // The real token only exists in an email, so plant a known one the same way the route stores it.
  const client = await new MongoClient("mongodb://127.0.0.1:3202/tagawallet_e2e").connect();
  const db = client.db();
  const user = await db.collection("users").findOne({ email });
  const token = "known-reset-token-for-this-test";
  await db.collection("tokens").insertOne({ kind: "password_reset", tokenHash: createHash("sha256").update(token).digest("hex"), userId: user!._id, expiresAt: new Date(Date.now() + 60000) });
  await client.close();

  const next = "a-brand-new-password";
  await json(anon.post("/api/auth/reset-password/confirm", { data: { token, password: next } }));
  expect((await json(ctx.get("/api/auth/session"))).user).toBeNull();
  expect((await anon.post("/api/auth/reset-password/confirm", { data: { token, password: next } })).status()).toBe(400);
  expect((await anon.post("/api/auth/login", { data: { email, password: PASSWORD } })).status()).toBe(401);
  await json(anon.post("/api/auth/login", { data: { email, password: next } }));
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
