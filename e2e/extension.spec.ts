import { test as base, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const A1 = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const A2 = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";
const FIXTURE = "http://localhost:3201/";
const PASSWORD = "correct-horse-battery";
const DIST = resolve("apps/extension/.e2e-dist");

let context: BrowserContext;
let extensionId: string;
const seen: { url: string; body: string }[] = [];

base.beforeAll(async () => {
  execSync("pnpm --filter @tagawallet/extension build", { stdio: "pipe", env: { ...process.env, TAW_E2E: "1", TAW_API_BASE: "http://localhost:3200", TAW_OUT: ".e2e-dist" } });
  process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = "1";
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "taw-")), {
    channel: "chromium", headless: true, args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
  });
  context.on("request", (r) => { if (r.url().includes(":3200/api/")) seen.push({ url: r.url(), body: r.postData() ?? "" }); });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker");
  extensionId = new URL(worker.url()).host;
});
base.afterAll(async () => { await context?.close(); });

const test = base;
test.describe.configure({ mode: "serial" });

const chipOn = (page: Page, cell: string) => page.locator(`${cell} tagawallet-chip`);
const ext = async (message: unknown) => {
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  const r = await p.evaluate((m) => chrome.runtime.sendMessage(m as never), message);
  await p.close();
  return r;
};

test("manifest asks for no broad host access by default", () => {
  execSync("pnpm --filter @tagawallet/extension build", { stdio: "pipe", env: { ...process.env, TAW_RELEASE: "1", TAW_OUT: ".release-dist", TAW_E2E: "" } });
  const m = JSON.parse(readFileSync("apps/extension/.release-dist/manifest.json", "utf8"));
  expect(m.manifest_version).toBe(3);
  expect(m.host_permissions).toBeUndefined();
  expect(m.content_scripts).toBeUndefined();
  expect(m.permissions.sort()).toEqual(["activeTab", "scripting", "storage"]);
  expect(JSON.stringify(m)).not.toContain("<all_urls>");
  for (const banned of ["history", "downloads", "cookies", "clipboardRead", "tabs", "webRequest"]) expect(m.permissions).not.toContain(banned);
  expect(m.externally_connectable.matches).toEqual(["https://tagawallet.com/*"]);
});

test("first-run page opens on install, and the popup shows the empty state", async () => {
  await expect.poll(() => context.pages().some((p) => p.url().includes("welcome.html"))).toBe(true);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText("No wallet detected on this page.")).toBeVisible();
  await expect(popup.getByRole("button", { name: "Paste address to tag" })).toBeVisible();
  await expect(popup.getByRole("button", { name: "Open dashboard" })).toBeVisible();
  await expect(popup.getByRole("button", { name: "Connect account" })).toBeVisible();
  await popup.close();
});

test("detects addresses, ignores hashes and inputs, and keeps the layout intact", async () => {
  await ext({ type: "updateSettings", patch: {} });
  const page = await context.newPage();
  await page.goto(FIXTURE);
  const width = await page.locator("#t").evaluate((t) => t.getBoundingClientRect().width);
  await expect(chipOn(page, "#plain")).toHaveCount(1);
  await expect(chipOn(page, "#plain").getByRole("button")).toHaveText("Tag this wallet");
  await expect(chipOn(page, "#linked")).toHaveCount(1); // Truncated text, found through the link's href
  await expect(chipOn(page, "#sol")).toHaveCount(1);
  await expect(chipOn(page, "#hash")).toHaveCount(0);
  await expect(page.locator("tagawallet-chip[data-address='0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb']")).toHaveCount(0);
  expect(await page.locator("#t").evaluate((t) => t.getBoundingClientRect().width)).toBe(width);
  expect(await chipOn(page, "#plain").evaluate((c) => !!c.shadowRoot)).toBe(true);

  // Dynamically added content is found too.
  await page.click("#add");
  await expect(page.locator("#dyn tagawallet-chip, #dyn + tagawallet-chip")).toHaveCount(1);
  await page.close();
});

test("the tag form asks an unconnected person to connect", async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await chipOn(page, "#plain").getByRole("button").click();
  await expect(page.locator("tagawallet-card").getByText("Connect to save tags")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("tagawallet-card")).toHaveCount(0);
  await page.close();
});

test("connecting hands the session to the extension, and a tag saves from the page", async () => {
  const page = await context.newPage();
  await page.goto(`/signup`.replace(/^/, "http://localhost:3200"));
  await page.getByLabel("Name").fill("Eve");
  await page.getByLabel("Email").fill(`eve${Date.now()}@example.test`);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto(`http://localhost:3200/extension/connect?ext=${extensionId}`);
  await page.getByRole("button", { name: "Connect this browser" }).click();
  await expect(page.getByRole("status")).toContainText("Connected");
  expect(page.url()).not.toContain("token");

  await page.goto(FIXTURE);
  await chipOn(page, "#plain").getByRole("button").click();
  const card = page.locator("tagawallet-card");
  await expect(card.getByRole("heading", { name: "Tag this wallet" })).toBeVisible();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("alert")).toHaveText("Add a name.");
  await card.getByLabel("Name").fill("Alice's trading wallet");
  await card.getByLabel("Tags").fill("trader, watchlist");
  await card.getByLabel("Notes").fill("from extension");
  await card.getByLabel("X or link").fill("@alice");
  await card.getByLabel("Entity").selectOption("__new");
  await card.locator("input[placeholder='Entity name']").fill("Alice LLC");
  await card.getByLabel("List").selectOption("__new");
  await card.locator("input[placeholder='List name']").fill("Research");
  await expect(card.getByText("Private: only you will see this tag.")).toBeVisible();
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("status")).toHaveText("Saved to Research.");

  // Chip updates in place, and the card shows identity and provenance.
  await expect(chipOn(page, "#plain").getByRole("button")).toHaveText("Alice's trading wallet");
  await expect(card).toHaveCount(0, { timeout: 5000 });
  await chipOn(page, "#plain").getByRole("button").click();
  await expect(card.getByRole("heading", { name: "Alice's trading wallet" })).toBeVisible();
  await expect(card.getByText("Source: Your private tag")).toBeVisible();
  await expect(card.getByText("Alice LLC")).toBeVisible();
  await expect(card.getByText("1 wallet linked")).toBeVisible();
  for (const b of ["View profile", "Edit tag", "Report", "Copy address"]) await expect(card.getByRole("button", { name: b })).toBeVisible();
  await page.mouse.click(5, 5);
  await expect(card).toHaveCount(0);

  const api = await page.request.get("http://localhost:3200/api/search?q=alice");
  const body = await api.json();
  expect(body.wallets[0]).toMatchObject({ displayLabel: "Alice's trading wallet", source: "extension" });
  expect(body.wallets[0].lists[0].name).toBe("Research");
  await page.close();
});

test("recognizes a linked X account on its profile and posts, across in-app navigation, without sending the handle", async () => {
  const api = await context.newPage();
  await api.goto("http://localhost:3200/dashboard");
  await api.request.post("http://localhost:3200/api/wallets", { data: { address: "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb", chain: "ethereum", displayLabel: "Linked person", links: [{ type: "x", url: "@LinkedPerson" }] } });
  await api.request.post("http://localhost:3200/api/entities", { data: { name: "No Wallet Co", links: [{ type: "x", url: "@nowalletco" }] } });
  await api.close();
  // Mirrors real X: no test ids, a bare @handle in the header, and @handle links on posts.
  const html = `<!doctype html><title>X</title><body><main><div><div><span>Linked Person</span></div><div><span><span id="at">@LinkedPerson</span></span></div></div>
    <article><span><a href="/LinkedPerson"><span>Linked Person</span></a></span><span><a id="author" href="/LinkedPerson"><span>@LinkedPerson</span></a></span><a href="/LinkedPerson/status/1">Oct 28</a></article>
    <article><span><a href="/stranger"><span>Stranger</span></a></span><span><a href="/stranger"><span>@stranger</span></a></span></article></main></body>`;
  await context.route("https://x.com/**", (r) => r.fulfill({ contentType: "text/html", body: html }));
  await ext({ type: "updateSettings", patch: {} });
  const page = await context.newPage();
  const before = seen.length;
  await page.goto("https://x.com/LinkedPerson");
  const header = page.locator("tagawallet-chip[data-tagawallet-profile]");
  await expect(header.getByRole("button")).toHaveText("Linked person");
  await expect(page.locator("article tagawallet-chip")).toHaveCount(1);
  await header.getByRole("button").click();
  await expect(page.locator("tagawallet-card").getByText("Source: Your private tag")).toBeVisible();
  await page.keyboard.press("Escape");

  // X changes profile without a reload and reuses the header element.
  await page.evaluate(() => { history.pushState({}, "", "/stranger"); const at = document.getElementById("at")!; at.textContent = "@stranger"; });
  await expect(header).toHaveCount(0);
  await page.evaluate(() => { history.pushState({}, "", "/nowalletco"); document.getElementById("at")!.textContent = "@nowalletco"; });
  await expect(header.getByRole("button")).toHaveText("No Wallet Co");
  await page.close();
  await context.unroute("https://x.com/**");
  for (const s of seen.slice(before)) {
    if (s.url.includes("/api/extension/handles")) continue;
    expect(s.url + s.body).not.toMatch(/linkedperson|stranger|nowalletco/i);
  }
});

test("nothing but addresses is sent, and the page's content never leaves", async () => {
  const resolves = seen.filter((s) => s.url.includes("/api/extension/resolve"));
  expect(resolves.length).toBeGreaterThan(0);
  for (const s of seen) {
    expect(s.body).not.toContain("SECRET_PAGE_TEXT");
    expect(s.body).not.toContain("localhost:3201");
    expect(s.url).not.toContain("localhost:3201");
  }
  for (const r of resolves) {
    expect(Object.keys(JSON.parse(r.body))).toEqual(["addresses"]);
    for (const a of JSON.parse(r.body).addresses) expect(Object.keys(a).sort()).toEqual(["kind", "normalized"]);
  }
});

test("offline: a tag is saved locally and syncs later", async () => {
  await context.route("**/api/extension/tags", (r) => r.abort());
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await chipOn(page, "#linked").getByRole("button").click();
  const card = page.locator("tagawallet-card");
  await card.getByLabel("Name").fill("Offline tag");
  await card.getByRole("button", { name: "Save" }).click();
  await expect(card.getByRole("status")).toContainText("when you're back online");
  await expect(chipOn(page, "#linked").getByRole("button")).toHaveText("Offline tag");
  expect((await ext({ type: "status" })).queued).toBe(1);

  await context.unroute("**/api/extension/tags");
  expect(await ext({ type: "flush" })).toBe(0);
  const res = await (await page.request.get("http://localhost:3200/api/search?q=Offline")).json();
  expect(res.wallets[0].address).toBe(A2);
  await page.close();
});

test("settings: chips can be turned off globally, per site and by style", async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await expect(chipOn(page, "#plain")).toHaveCount(1);

  await ext({ type: "updateSettings", patch: { chipStyle: "hidden" } });
  await expect(chipOn(page, "#plain")).toBeHidden();
  await ext({ type: "updateSettings", patch: { chipStyle: "minimal" } });
  await expect(chipOn(page, "#plain")).toBeVisible();
  await ext({ type: "updateSettings", patch: { chipStyle: "badge" } });

  await ext({ type: "updateSettings", patch: { chipsEnabled: false } });
  await expect(chipOn(page, "#plain")).toHaveCount(0);
  await ext({ type: "updateSettings", patch: { chipsEnabled: true } });
  await expect(chipOn(page, "#plain")).toHaveCount(1);

  await ext({ type: "setSiteEnabled", host: "localhost", enabled: false });
  await expect(chipOn(page, "#plain")).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(800);
  await expect(page.locator("tagawallet-chip")).toHaveCount(0);
  await ext({ type: "setSiteEnabled", host: "localhost", enabled: true });
  await page.reload();
  await expect(chipOn(page, "#plain")).toHaveCount(1);
  await page.close();
});

test("the popup lists detected addresses for the active page, and loads fast", async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await expect(chipOn(page, "#plain")).toHaveCount(1);
  const tabId = await (async () => {
    const p = await context.newPage();
    await p.goto(`chrome-extension://${extensionId}/options.html`);
    const id = await p.evaluate(async () => (await chrome.tabs.query({ url: "http://localhost:3201/*" }))[0]?.id);
    const result = await p.evaluate(async (t) => chrome.tabs.sendMessage(t!, { type: "taw:scan" }), id);
    await p.close();
    return result;
  })();
  const detected = tabId.detected as { normalized: string; labels: { label: string }[] }[];
  expect(detected.find((d) => d.normalized === A1.toLowerCase())?.labels[0]?.label).toBe("Alice's trading wallet");
  expect(detected.length).toBeGreaterThanOrEqual(3);

  const popup = await context.newPage();
  const started = Date.now();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.getByText("No wallet detected on this page.").or(popup.getByText("addresses on this page"))).toBeVisible();
  console.log(`popup visible after ${Date.now() - started}ms`);
  expect(Date.now() - started).toBeLessThan(1000);
  await popup.getByRole("button", { name: "Paste address to tag" }).click();
  await popup.getByLabel("Address").fill("0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB");
  await popup.getByLabel("Name").fill("Pasted");
  await popup.getByRole("button", { name: "Save" }).click();
  await expect(popup.getByRole("status")).toContainText("Saved to Research.");
  await popup.close();
  await page.close();
});

test("options page renders every setting", async () => {
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  for (const t of ["Inline chips", "Enabled websites", "Sync", "Keyboard shortcut", "Account"]) await expect(p.getByRole("heading", { name: t })).toBeVisible();
  await expect(p.getByLabel("Chip style")).toBeVisible();
  await expect(p.getByLabel("Theme")).toBeVisible();
  await expect(p.getByLabel("Default private list")).toBeVisible();
  await p.screenshot({ path: "test-results/options.png", fullPage: true });
  await p.close();
});
