import { test as base, expect, chromium, type BrowserContext, type Page } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { closeE2eDb, signUpAndEnter } from "./helpers";

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
base.afterAll(async () => { await context?.close(); await closeE2eDb(); });

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
  expect(m.permissions.sort()).toEqual(["activeTab", "alarms", "contextMenus", "scripting", "sidePanel", "storage"]);
  expect(m.side_panel.default_path).toBe("panel.html");
  // The toolbar click opens the panel itself, so there's no popup.
  expect(m.action.default_popup).toBeUndefined();
  // Only the panel page can be framed by sites, and only on https.
  expect(m.web_accessible_resources).toEqual([{ resources: ["panel.html"], matches: ["https://*/*"] }]);
  expect(JSON.stringify(m)).not.toContain("<all_urls>");
  for (const banned of ["history", "downloads", "cookies", "clipboardRead", "tabs", "webRequest"]) expect(m.permissions).not.toContain(banned);
  expect(m.externally_connectable.matches).toEqual(["https://tagawallet.com/*"]);
});

const PANEL = () => `chrome-extension://${extensionId}/panel.html`;

test("first-run page opens on install, and the panel shows the empty state", async () => {
  await expect.poll(() => context.pages().some((p) => p.url().includes("welcome.html"))).toBe(true);
  const panel = await context.newPage();
  await panel.goto(PANEL());
  await panel.getByRole("tab", { name: "This page" }).click();
  await expect(panel.getByText("Browser pages can't be scanned.", { exact: false })).toBeVisible();
  await panel.getByRole("tab", { name: "Library" }).click();
  await expect(panel.getByText("Your contacts and lists live here")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Paste address to tag" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Open dashboard" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Connect account" }).first()).toBeVisible();
  // Docked to the side, it offers to float instead. There's nothing to close or drag.
  await expect(panel.getByRole("button", { name: "Float over the page" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Close" })).toHaveCount(0);
  await panel.close();
});

test("detects addresses, ignores hashes and inputs, and keeps the layout intact", async () => {
  await ext({ type: "updateSettings", patch: {} });
  const page = await context.newPage();
  await page.goto(FIXTURE);
  const width = await page.locator("#t").evaluate((t) => t.getBoundingClientRect().width);
  await expect(chipOn(page, "#plain")).toHaveCount(1);
  await expect(chipOn(page, "#plain").getByRole("button", { name: "Tag this wallet" })).toBeVisible();
  await expect(chipOn(page, "#linked")).toHaveCount(1); // Truncated text, found through the link's href
  await expect(chipOn(page, "#sol")).toHaveCount(1);
  await expect(chipOn(page, "#hash")).toHaveCount(0);
  await expect(page.locator("tagawallet-chip[data-address='0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb']")).toHaveCount(0);
  const mid = await page.locator("#mid").evaluate((el) => [...el.childNodes].map((n) => n.nodeType === Node.TEXT_NODE ? `t:${n.textContent}` : (n as Element).tagName.toLowerCase()));
  expect(mid).toEqual(["t:Send 0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed", "tagawallet-chip", "t: today"]);
  await expect(page.locator("#twice tagawallet-chip")).toHaveCount(1);
  await expect(page.locator("#shadow tagawallet-chip")).toHaveCount(1);
  expect(await page.locator("#t").evaluate((t) => t.getBoundingClientRect().width)).toBe(width);
  expect(await chipOn(page, "#plain").evaluate((c) => !!c.shadowRoot)).toBe(true);

  // Dynamically added content is found too.
  await page.click("#add");
  await expect(page.locator("#dyn tagawallet-chip, #dyn + tagawallet-chip")).toHaveCount(1);
  await page.close();
});

/** The floating panel's frame on a page, once a chip, card or right-click has opened it. */
const panelFrame = async (page: Page) => {
  const live = () => page.frames().filter((f) => f.url().includes("panel.html?host=float") && !f.url().includes("guessed") && !f.isDetached());
  await expect.poll(() => live().length).toBeGreaterThan(0);
  return live().at(-1)!;
};

test("an untagged address opens the tag form in the floating panel, which asks an unconnected person to connect", async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await chipOn(page, "#plain").getByRole("button").click();
  // No card for an address nobody tagged: tagging is the only thing to do, so the panel opens on the form.
  await expect(page.locator("tagawallet-card")).toHaveCount(0);
  const panel = await panelFrame(page);
  await expect(panel.getByRole("heading", { name: "Connect to save tags" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Connect account" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("tagawallet-panel")).toHaveCount(0);
  await page.close();
});

test("connecting hands the session to the extension, and a tag saves from the page", async () => {
  const page = await context.newPage();
  await signUpAndEnter(page, `eve${Date.now()}@example.test`);
  await page.goto(`http://localhost:3200/extension/connect?ext=${extensionId}`);
  await page.getByRole("button", { name: "Connect this browser" }).click();
  await expect(page.getByRole("status")).toContainText("Connected");
  expect(page.url()).not.toContain("token");

  await page.goto(FIXTURE);
  await chipOn(page, "#plain").getByRole("button").click();
  let panel = await panelFrame(page);
  await expect(panel.getByRole("heading", { name: "Tag this wallet" })).toBeVisible();
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByRole("alert")).toHaveText("Add a name for this address.");
  await panel.getByLabel("Name for this address").fill("Alice's trading wallet");
  await panel.getByRole("button", { name: "Watchlist" }).click();
  await expect(panel.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-pressed", "true");
  await panel.getByLabel("Your own labels").fill("trader, whale");
  await panel.getByLabel("Also in a list").selectOption("__new");
  await panel.getByLabel("New list name").fill("Alice LLC watch");
  await panel.getByRole("button", { name: "+ Add a note" }).click();
  await panel.getByLabel("Notes").fill("from extension");
  await expect(panel.getByText("One-off name, private to you", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByRole("status")).toHaveText("Saved to Alice LLC watch.");
  // Then it shows what was saved: the wallet, where it's filed, and your note.
  await expect(panel.getByRole("heading", { name: "Alice's trading wallet" })).toBeVisible();
  await expect(panel.getByRole("region", { name: "Filed in" })).toContainText("Alice LLC watch");
  await expect(panel.getByRole("region", { name: "Your note" })).toContainText("from extension");

  // Chip updates in place, and the card shows identity and provenance.
  await expect(chipOn(page, "#plain").getByRole("button")).toHaveText("Alice's trading wallet");
  // Inside the panel, Escape steps back first (wallet → tabs), then closes it. Close shuts it at once.
  await panel.getByRole("button", { name: "Close" }).click();
  await expect(page.locator("tagawallet-panel")).toHaveCount(0);
  const card = page.locator("tagawallet-card");
  await chipOn(page, "#plain").getByRole("button").click();
  await expect(card.getByRole("heading", { name: "Alice's trading wallet" })).toBeVisible();
  await expect(card.getByText("Your private tag")).toBeVisible();
  await expect(card.getByText("Watchlist", { exact: true })).toBeVisible();
  await expect(card.getByText("whale", { exact: true })).toBeVisible();
  for (const b of ["Edit tag", "Details in TagAWallet", "Copy address"]) await expect(card.getByRole("button", { name: b })).toBeVisible();
  // Your own tag can be copied or removed, but not reported.
  await card.getByRole("button", { name: "More actions" }).click();
  await expect(card.getByRole("menuitem", { name: "Copy label" })).toBeVisible();
  await expect(card.getByRole("menuitem", { name: "Open in dashboard" })).toBeVisible();
  await expect(card.getByRole("menuitem", { name: "Remove my tag" })).toBeVisible();
  await expect(card.getByRole("menuitem", { name: "Report this label" })).toHaveCount(0);
  await card.getByRole("button", { name: "More actions" }).click();

  // Editing opens the panel on the form, keeping what was there. The card gets out of the way.
  await card.getByRole("button", { name: "Edit tag" }).click();
  await expect(card).toHaveCount(0);
  panel = await panelFrame(page);
  await expect(panel.getByLabel("Name for this address")).toHaveValue("Alice's trading wallet");
  await expect(panel.getByLabel("Notes")).toHaveValue("from extension");
  await expect(panel.getByRole("button", { name: "Watchlist" })).toHaveAttribute("aria-pressed", "true");
  await panel.getByRole("button", { name: "Cancel" }).click();
  await expect(panel.getByRole("tab", { name: "This page" })).toBeVisible();

  // Details opens the wallet in the same panel, not the dashboard.
  await chipOn(page, "#plain").getByRole("button").click();
  await card.getByRole("button", { name: "Details in TagAWallet" }).click();
  await expect(panel.getByRole("heading", { name: "Alice's trading wallet" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Find on page" })).toBeVisible();
  await panel.getByRole("button", { name: "Back" }).click();
  await expect(panel.getByRole("tab", { name: "This page" })).toBeVisible();

  await chipOn(page, "#plain").getByRole("button").click();
  await page.mouse.click(5, 5);
  await expect(card).toHaveCount(0);
  await page.keyboard.press("Escape");

  const api = await page.request.get("http://localhost:3200/api/search?q=alice");
  const body = await api.json();
  expect(body.wallets[0]).toMatchObject({ displayLabel: "Alice's trading wallet", source: "extension" });
  expect(body.wallets[0].lists[0].name).toBe("Alice LLC watch");
  expect(body.wallets[0]).toMatchObject({ status: "watchlist", tags: ["trader", "whale"], notes: "from extension" });
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
    <article><span><a href="/stranger"><span>Stranger</span></a></span><span><a href="/stranger"><span>@stranger</span></a></span></article>
    <article><span>building with <a href="/nowalletco">@nowalletco</a></span></article></main></body>`;
  await context.route("https://x.com/**", (r) => r.fulfill({ contentType: "text/html", body: html }));
  await ext({ type: "updateSettings", patch: {} });
  const page = await context.newPage();
  const before = seen.length;
  await page.goto("https://x.com/LinkedPerson");
  const header = page.locator("tagawallet-chip[data-tagawallet-profile]");
  await expect(header.getByRole("button")).toHaveText("Linked person");
  await expect(page.locator("article tagawallet-chip")).toHaveCount(2);
  await header.getByRole("button").click();
  await expect(page.locator("tagawallet-card").getByText("Your private tag")).toBeVisible();
  await page.keyboard.press("Escape");

  // X changes profile without a reload and reuses the header element.
  await page.evaluate(() => { history.pushState({}, "", "/stranger"); const at = document.getElementById("at")!; at.textContent = "@stranger"; });
  await expect(header).toHaveCount(0);
  // On someone else's profile, every account recognized in posts and bios is on the page list and in the badge,
  // not just the profile's owner.
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  const xTab = await p.evaluate(async () => (await chrome.tabs.query({ url: "https://x.com/*" }))[0]?.id);
  await expect.poll(async () => ((await p.evaluate((t) => chrome.tabs.sendMessage(t!, { type: "taw:scan" }), xTab)) as { detected: { labels: { label: string }[] }[] })
    .detected.map((d) => d.labels[0]?.label).sort()).toEqual(["Linked person", "No Wallet Co"]);
  await expect.poll(() => p.evaluate((t) => chrome.action.getBadgeText({ tabId: t! }), xTab)).toBe("2");
  // Find works for an account chip too.
  expect(await p.evaluate((t) => chrome.tabs.sendMessage(t!, { type: "taw:locate", normalized: "0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb" }), xTab)).toEqual({ found: true });
  await p.close();
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
  const panel = await panelFrame(page);
  await panel.getByLabel("Name for this address").fill("Offline tag");
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByRole("status")).toContainText("when you're back online");
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

  // Known wallets keep their chip when unknown marks are turned off.
  await ext({ type: "updateSettings", patch: { showUnknown: false } });
  await expect(chipOn(page, "#sol")).toBeHidden();
  await expect(chipOn(page, "#plain")).toBeVisible();
  await ext({ type: "updateSettings", patch: { showUnknown: true } });
  await expect(chipOn(page, "#sol")).toBeVisible();

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

test("the panel's library: paste to tag, look up an address, search, and open a list", async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await expect(chipOn(page, "#plain")).toHaveCount(1);
  const scan = await (async () => {
    const p = await context.newPage();
    await p.goto(`chrome-extension://${extensionId}/options.html`);
    const id = await p.evaluate(async () => (await chrome.tabs.query({ url: "http://localhost:3201/*" }))[0]?.id);
    const result = await p.evaluate(async (t) => chrome.tabs.sendMessage(t!, { type: "taw:scan" }), id);
    await p.close();
    return result;
  })();
  const detected = scan.detected as { normalized: string; labels: { label: string }[] }[];
  expect(detected.find((d) => d.normalized === A1.toLowerCase())?.labels[0]?.label).toBe("Alice's trading wallet");
  expect(detected.length).toBeGreaterThanOrEqual(3);

  const panel = await context.newPage();
  const started = Date.now();
  await panel.goto(PANEL());
  await panel.getByRole("tab", { name: "Library" }).click();
  await expect(panel.getByRole("region", { name: "Lists" })).toBeVisible();
  console.log(`panel library visible after ${Date.now() - started}ms`);
  expect(Date.now() - started).toBeLessThan(1500);

  await panel.getByRole("button", { name: "Paste address to tag" }).click();
  await panel.getByLabel("Address", { exact: true }).fill("0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB");
  await panel.getByLabel("Name for this address").fill("Pasted");
  await panel.getByRole("button", { name: "Save" }).click();
  await expect(panel.getByRole("status")).toContainText("Saved.");

  // "Who is this?": a pasted address is looked up straight away.
  const search = panel.getByLabel("Search wallets, people and lists, or paste an address");
  await search.fill(A1);
  await expect(panel.getByText("Alice's trading wallet")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Edit tag" })).toBeVisible();

  // Words search the directory here and your wallets on the server, like the dashboard's search.
  await search.fill("alice");
  await expect(panel.getByRole("region", { name: "Contacts and lists" }).getByText("Alice LLC watch")).toBeVisible();
  await expect(panel.getByRole("region", { name: "Wallets" }).getByText("Alice's trading wallet")).toBeVisible();
  await search.fill("nothing like this");
  await expect(panel.getByText("No matches")).toBeVisible();
  await search.fill("");

  // A list opens in place, with its wallets, and Back returns to the library.
  await panel.getByRole("region", { name: "Lists" }).getByRole("button", { name: /Alice LLC watch/ }).click();
  await expect(panel.getByRole("heading", { name: "Alice LLC watch" })).toBeVisible();
  await expect(panel.getByText("Alice's trading wallet")).toBeVisible();
  await expect(panel.getByRole("button", { name: "Open Alice LLC watch in the dashboard" })).toBeVisible();
  await panel.getByRole("button", { name: "Library", exact: true }).click();
  await expect(panel.getByRole("region", { name: "Recently changed" })).toBeVisible();
  await panel.close();
  await page.close();
});

const fixtureTabId = async () => {
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  const id = await p.evaluate(async () => (await chrome.tabs.query({ url: "http://localhost:3201/*" }))[0]?.id);
  return { p, id: id! };
};

test("the toolbar badge counts tagged addresses on the page, red when one is flagged", async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await expect(chipOn(page, "#plain").getByRole("button")).toHaveText("Alice's trading wallet");
  const { p, id } = await fixtureTabId();
  // Earlier tests tagged more than one address here. Alice's wallet is the only flagged one: it's on the watchlist.
  const scan = await p.evaluate((t) => chrome.tabs.sendMessage(t, { type: "taw:scan" }), id) as { detected: { labels: unknown[] }[] };
  const tagged = String(scan.detected.filter((d) => d.labels.length).length);
  expect(Number(tagged)).toBeGreaterThanOrEqual(1);
  await expect.poll(() => p.evaluate((t) => chrome.action.getBadgeText({ tabId: t }), id)).toBe(tagged);
  expect(await p.evaluate((t) => chrome.action.getBadgeBackgroundColor({ tabId: t }), id)).toEqual([179, 38, 30, 255]);
  expect(await p.evaluate((t) => chrome.action.getTitle({ tabId: t }), id)).toContain(`${tagged} tagged on this page, 1 flagged`);

  // Switched off, every tab goes back to sync status only.
  await ext({ type: "updateSettings", patch: { pageBadge: false } });
  await expect.poll(() => p.evaluate((t) => chrome.action.getBadgeText({ tabId: t }), id)).toBe("");
  await ext({ type: "updateSettings", patch: { pageBadge: true } });
  await expect.poll(() => p.evaluate((t) => chrome.action.getBadgeText({ tabId: t }), id)).toBe(tagged);

  // Leaving the page clears its count.
  await page.goto("about:blank");
  await expect.poll(() => p.evaluate((t) => chrome.action.getBadgeText({ tabId: t }), id)).toBe("");
  await p.close();
  await page.close();
});

test("rail chips are a colour strip, with the name on hover", async () => {
  await ext({ type: "updateSettings", patch: { chipStyle: "rail" } });
  const page = await context.newPage();
  await page.goto(FIXTURE);
  const rail = chipOn(page, "#plain").getByRole("button");
  await expect(rail).toHaveClass(/rail/);
  await expect(rail).toHaveClass(/flagged/);
  await expect(rail).toHaveAttribute("data-tip", /Alice's trading wallet/);
  await expect(rail).toHaveText("");
  expect(await rail.evaluate((b) => b.getBoundingClientRect().width)).toBeLessThan(8);
  await ext({ type: "updateSettings", patch: { chipStyle: "badge" } });
  await expect(rail).toHaveText("Alice's trading wallet");
  await page.close();
});

test("docked to the side, the panel groups the page's addresses, finds one on the page, and follows the active tab", async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await expect(chipOn(page, "#plain").getByRole("button")).toHaveText("Alice's trading wallet");
  const panel = await context.newPage();
  await panel.goto(PANEL());
  await page.bringToFront();
  await panel.getByRole("tab", { name: "This page" }).click();

  const flagged = panel.getByRole("region", { name: "Flagged" });
  await expect(flagged.getByText("Alice's trading wallet")).toBeVisible();
  const summary = panel.getByRole("group", { name: "Summary" });
  await expect(summary).toContainText("1Flagged");
  await expect(panel.getByRole("region", { name: "Not tagged" })).toBeVisible();

  // The counts filter the list.
  await summary.getByRole("button", { name: /Flagged/ }).click();
  await expect(panel.getByRole("region", { name: "Not tagged" })).toHaveCount(0);
  await summary.getByRole("button", { name: /Flagged/ }).click();

  // "Find" scrolls to the chip and flashes it.
  await flagged.getByRole("button", { name: "Find" }).click();
  await expect.poll(() => page.locator(`tagawallet-chip[data-address="${A1.toLowerCase()}"]`).evaluateAll((chips) =>
    chips.some((c) => c.shadowRoot?.querySelector("button")?.style.outline.includes("2px")))).toBe(true);

  // A tag saved elsewhere shows up without reopening the panel.
  const late = "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb";
  await page.locator("#add").click();
  await expect(chipOn(page, "#dyn")).toHaveCount(1);
  await ext({ type: "tag", input: { address: late, chain: "ethereum", displayLabel: "Late arrival", tags: [] } });
  await page.bringToFront(); // ext() briefly opened a tab of its own.
  await expect(panel.getByRole("region", { name: "Tagged" }).getByText("Late arrival")).toBeVisible();

  // It follows the tab in front.
  const other = await context.newPage();
  await other.goto(`chrome-extension://${extensionId}/options.html`);
  await other.bringToFront();
  await expect(panel.getByText("Browser pages can't be scanned.", { exact: false })).toBeVisible();
  await page.bringToFront();
  await expect(flagged.getByText("Alice's trading wallet")).toBeVisible();
  await other.close();
  await panel.close();
  await page.close();
});

test("floating, the panel opens over the page, moves, shows the library, and closes on Escape", async () => {
  const page = await context.newPage();
  // Its own path, so the tab lookup below can only find this tab, never one an earlier test left open.
  await page.goto(`${FIXTURE}float`);
  await expect(chipOn(page, "#plain").getByRole("button")).toHaveText("Alice's trading wallet");
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  const id = await p.evaluate(async () => (await chrome.tabs.query({ url: "http://localhost:3201/float" }))[0]?.id);
  expect(id).toBeDefined();
  // What the toolbar click does in floating mode.
  await expect.poll(() => p.evaluate((t) => chrome.tabs.sendMessage(t!, { type: "taw:togglePanel" }).then(() => true, () => false), id)).toBe(true);
  await p.close();
  await expect(page.locator("tagawallet-panel")).toHaveCount(1);
  await expect.poll(() => page.frames().some((f) => f.url().includes("panel.html"))).toBe(true);
  const frame = page.frames().find((f) => f.url().includes("panel.html"))!;

  // It belongs to this page: its page tab lists this page's wallets.
  await frame.getByRole("tab", { name: "This page" }).click();
  await expect(frame.getByRole("region", { name: "Flagged" }).getByText("Alice's trading wallet")).toBeVisible();
  for (const b of ["Move to side panel", "Close", "Settings", "Paste address to tag"]) await expect(frame.getByRole("button", { name: b })).toBeVisible();
  await frame.getByRole("tab", { name: "Library" }).click();
  await expect(frame.getByRole("region", { name: "Lists" }).getByText("Alice LLC watch")).toBeVisible();

  // The header drags it, it stays inside the window, and the spot is remembered.
  const host = page.locator("tagawallet-panel");
  const before = await host.evaluate((h) => parseFloat(h.style.right));
  const bar = (await frame.locator("header").boundingBox())!;
  await page.mouse.move(bar.x + 150, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(bar.x + 30, bar.y + bar.height / 2 + 400, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => host.evaluate((h) => parseFloat(h.style.right))).toBeGreaterThan(before + 80);
  const box = (await host.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  const ext2 = await context.newPage();
  await ext2.goto(`chrome-extension://${extensionId}/options.html`);
  // Saved when the drag ends, which lands a moment later.
  await expect.poll(async () => (await ext2.evaluate(() => chrome.storage.local.get("floatPanel"))).floatPanel?.right ?? 0).toBeGreaterThan(before + 80);
  await ext2.close();

  // A page that frames the panel itself gets nothing: it only draws in a frame our script placed.
  await page.evaluate((src) => { const f = document.createElement("iframe"); f.src = src; document.body.append(f); }, `${PANEL()}?host=float&n=guessed`);
  await expect.poll(() => page.frames().some((f) => f.url().includes("n=guessed"))).toBe(true);
  const forged = page.frames().find((f) => f.url().includes("n=guessed"))!;
  await expect(forged.getByText("Open TagAWallet from its toolbar icon.")).toBeVisible();
  await expect(forged.getByRole("tab")).toHaveCount(0);

  // Escape closes it.
  await page.locator("h1").click();
  await page.keyboard.press("Escape");
  await expect(host).toHaveCount(0);
  await page.close();
});

test("options page renders every setting", async () => {
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  for (const t of ["Chips", "Websites", "Saving", "Account"]) await expect(p.getByRole("heading", { name: t })).toBeVisible();
  await expect(p.getByLabel("Chip style")).toBeVisible();
  await expect(p.getByLabel("Theme")).toBeVisible();
  await expect(p.getByRole("switch", { name: "TagAWallet on localhost" })).toHaveAttribute("aria-checked", "true");
  await expect(p.getByRole("switch", { name: "TagAWallet on etherscan.io" })).toHaveAttribute("aria-checked", "false");
  await p.screenshot({ path: "test-results/options.png", fullPage: true });
  await p.close();
});

const fixtureTab = async (message: unknown) => {
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  await p.evaluate(async (m) => {
    const id = (await chrome.tabs.query({ url: "http://localhost:3201/*" }))[0]?.id;
    await chrome.tabs.sendMessage(id!, m as never);
  }, message);
  await p.close();
};

test("right-click tagging opens the tag form for a selected address, and explains when there isn't one", async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await expect(chipOn(page, "#plain")).toHaveCount(1);
  const card = page.locator("tagawallet-card");
  await fixtureTab({ type: "taw:tagSelection", text: "just some words" });
  await expect(card.getByRole("heading", { name: "No wallet address selected" })).toBeVisible();
  await card.getByRole("button", { name: "OK" }).click();
  await expect(card).toHaveCount(0);

  // A known address opens straight on the form in the panel, prefilled.
  await fixtureTab({ type: "taw:tagSelection", text: ` ${A1} ` });
  const panel = await panelFrame(page);
  await expect(panel.getByRole("heading", { name: "Edit tag" })).toBeVisible();
  await expect(panel.getByLabel("Name for this address")).toHaveValue("Alice's trading wallet");
  await page.keyboard.press("Escape");
  await page.close();
});

test("a tag can be removed from the card, and the server forgets it", async () => {
  const page = await context.newPage();
  await page.goto(FIXTURE);
  await expect(chipOn(page, "#linked").getByRole("button")).toHaveText("Offline tag");
  await chipOn(page, "#linked").getByRole("button").click();
  const card = page.locator("tagawallet-card");
  await card.getByRole("button", { name: "More actions" }).click();
  await card.getByRole("menuitem", { name: "Remove my tag" }).click();
  await expect(card.getByRole("heading", { name: "Remove “Offline tag”?" })).toBeVisible();
  await card.getByRole("button", { name: "Remove", exact: true }).click();
  await expect(card.getByRole("status")).toHaveText("Removed.");
  await expect(chipOn(page, "#linked").getByRole("button", { name: "Tag this wallet" })).toBeVisible();
  const res = await (await page.request.get("http://localhost:3200/api/search?q=Offline")).json();
  expect(res.wallets).toHaveLength(0);
  await page.close();
});

test("a tag the server refuses is kept under Needs attention instead of being dropped", async () => {
  await context.route("**/api/extension/tags", (r) => r.abort());
  expect((await ext({ type: "tag", input: { address: A2, chain: "ethereum", displayLabel: "Refused one", tags: [] } })).queued).toBe(true);
  await context.unroute("**/api/extension/tags");
  await context.route("**/api/extension/tags", (r) => r.request().method() === "POST"
    ? r.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: "That list is archived." }) })
    : r.continue());
  await ext({ type: "flush" });
  const status = await ext({ type: "status" });
  expect(status.queued).toBe(0);
  expect(status.failed).toHaveLength(1);
  expect(status.failed[0]).toMatchObject({ error: "That list is archived.", input: { displayLabel: "Refused one" } });

  const popup = await context.newPage();
  await popup.goto(PANEL());
  await expect(popup.getByText("Needs attention")).toBeVisible();
  await expect(popup.getByText("That list is archived.")).toBeVisible();
  // Pending and failed tags are a dot now: the number is the page's tagged count.
  expect(await popup.evaluate(() => chrome.action.getBadgeText({}))).toBe("•");

  await context.unroute("**/api/extension/tags");
  await popup.getByRole("button", { name: "Retry" }).click();
  await expect(popup.getByText("Needs attention")).toHaveCount(0);
  expect((await ext({ type: "status" })).failed).toHaveLength(0);
  expect(await popup.evaluate(() => chrome.action.getBadgeText({}))).toBe("");
  await popup.close();
});

test("queued tags have a retry alarm, so they sync even while no page is open", async () => {
  const p = await context.newPage();
  await p.goto(`chrome-extension://${extensionId}/options.html`);
  const alarm = await p.evaluate(() => chrome.alarms.get("tagawallet-flush"));
  expect(alarm?.periodInMinutes).toBe(5);
  await p.close();
});

test("an expired session is shown with a badge and a reconnect prompt", async () => {
  await context.route("**/api/extension/resolve", (r) => r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "Please sign in." }) }));
  await ext({ type: "resolve", addresses: [{ normalized: "0x000000000000000000000000000000000000dead", kind: "evm" }] });
  expect((await ext({ type: "status" })).authState).toBe("expired");
  const popup = await context.newPage();
  await popup.goto(PANEL());
  await expect(popup.getByText("Your session expired.", { exact: false })).toBeVisible();
  await expect(popup.getByRole("button", { name: "Reconnect" })).toBeVisible();
  expect(await popup.evaluate(() => chrome.action.getBadgeText({}))).toBe("!");
  await popup.close();
  await context.unroute("**/api/extension/resolve");

  const page = await context.newPage();
  await page.goto(FIXTURE);
  await chipOn(page, "#sol").getByRole("button").click();
  await expect((await panelFrame(page)).getByRole("heading", { name: "Your session expired" })).toBeVisible();
  await page.close();
});
