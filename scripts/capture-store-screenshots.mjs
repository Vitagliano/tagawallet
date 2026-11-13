// Captures real pages with the real built extension running on them, for the Chrome Web Store images.
// Usage: node scripts/capture-store-screenshots.mjs   (then: node scripts/generate-store-assets.mjs)
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startMockApi } from "./store-assets-mock-api.mjs";

const PORT = 3399;
const API = `http://localhost:${PORT}`;
const OUT = resolve("store-assets/_captures");
const DIST = mkdtempSync(join(tmpdir(), "taw-ext-"));
mkdirSync(OUT, { recursive: true });

const VITALIK = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";
const POOL = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
const USDC = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const HOSTS = ["https://eth.blockscout.com/*", "https://www.geckoterminal.com/*", "https://mempool.space/*"];
// Captured large and scaled down into the browser frame (x0.792), so the floating panel fits whole.
const VIEW = { width: 1520, height: 722 };

execSync("pnpm --filter @tagawallet/extension build", { stdio: "inherit", env: { ...process.env, TAW_E2E: "1", TAW_API_BASE: API, TAW_OUT: DIST } });
const manifest = JSON.parse(readFileSync(join(DIST, "manifest.json"), "utf8"));
manifest.host_permissions = HOSTS; // Chrome's permission prompt can't be clicked by a robot.
writeFileSync(join(DIST, "manifest.json"), JSON.stringify(manifest, null, 2));

const server = await startMockApi(PORT);
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "taw-profile-")), {
  channel: "chromium", headless: true, viewport: VIEW, deviceScaleFactor: 2, colorScheme: "dark",
  args: [`--disable-extensions-except=${DIST}`, `--load-extension=${DIST}`],
});
const worker = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent("serviceworker"));
const extId = new URL(worker.url()).host;

// Connect the extension to the stub account, the way the connect page would.
const setup = await ctx.newPage();
await setup.goto(`chrome-extension://${extId}/options.html`);
await setup.evaluate(() => chrome.storage.local.set({ token: "store-assets", settings: { chipsEnabled: true, chipStyle: "badge", disabledSites: [], enabledSites: [], cloudSync: true, defaultListId: null, theme: "dark", showUnknown: true, pageBadge: true, panelMode: "float" } }));
await setup.close();

async function open(url, settle = 8000) {
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(settle);
  return page;
}
const shot = (page, name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const chips = (page) => page.locator("tagawallet-chip");
const labelled = (page) => page.locator("tagawallet-chip:not([data-unknown])");

async function hideNoise(page) {
  // Cookie banners and ads are not part of what we're showing.
  await page.addStyleTag({ content: "[class*='cookie' i],[id*='cookie' i],[class*='banner' i]{display:none!important}" }).catch(() => {});
}

/** Index of the first on-screen chip that is (or is not) showing a label. */
const pickChip = (page, tagged) => page.locator("tagawallet-chip").evaluateAll((els, want) => els.findIndex((e) => {
  const r = e.getBoundingClientRect();
  const has = r.width > 30; // the mark for an untagged address is a bare 18px square
  return r.width > 0 && r.height > 0 && r.top > 120 && r.bottom < innerHeight && has === want;
}), tagged);
const hovered = async (page, locator) => { await locator.scrollIntoViewIfNeeded(); await locator.click(); await page.waitForTimeout(900); };
const floatPanel = (page) => page.frames().filter((f) => f.url().includes("panel.html?host=float")).at(-1);

// 1. A block explorer's transaction list, with a card open on a tagged wallet.
{
  const page = await open(`https://eth.blockscout.com/address/${VITALIK}?tab=txs`);
  await hideNoise(page);
  console.log("explorer chips:", await chips(page).count());
  await page.evaluate(() => window.scrollTo(0, 190));
  await page.waitForTimeout(600);
  const at = await pickChip(page, true);
  console.log("tagged chip index:", at);
  await page.locator("tagawallet-chip").nth(at).click();
  await page.waitForTimeout(1200);
  await shot(page, "1-explorer-card");
  await page.locator("tagawallet-card").screenshot({ path: join(OUT, "1b-card-only.png") }).catch((e) => console.log("card:", e.message.split("\n")[0]));
  await page.keyboard.press("Escape");
  await page.close();
}

// 2. A live DEX pool: drag the chart/table splitter up so the trades table has room.
{
  const page = await open(`https://www.geckoterminal.com/eth/pools/${POOL}`, 10000);
  const gutter = await page.locator("[class*='split-gutter']").first().boundingBox();
  if (gutter) {
    await page.mouse.move(gutter.x + gutter.width / 2, gutter.y + gutter.height / 2);
    await page.mouse.down();
    await page.mouse.move(gutter.x + gutter.width / 2, 250, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(3000);
  } else console.log("no splitter found");
  console.log("dex chips:", await chips(page).count());
  await shot(page, "2-dex-pool");
  await page.close();
}

// 3. Token holders.
{
  const page = await open(`https://eth.blockscout.com/token/${USDC}?tab=holders`);
  await hideNoise(page);
  console.log("holders chips:", await chips(page).count());
  await page.evaluate(() => window.scrollTo(0, 150));
  await page.waitForTimeout(800);
  await shot(page, "3-token-holders");
  await page.close();
}

// 4. Tagging an address nobody has tagged: the form in the floating panel.
{
  const page = await open(`https://eth.blockscout.com/address/${VITALIK}?tab=txs`);
  await hideNoise(page);
  await page.evaluate(() => window.scrollTo(0, 250));
  await page.waitForTimeout(600);
  const target = await pickChip(page, false);
  console.log("untagged chip index:", target);
  await page.locator("tagawallet-chip").nth(target).click();
  await page.waitForTimeout(3000);
  const f = floatPanel(page);
  if (f) {
    await page.waitForTimeout(2500); // the list picker fills once the account loads
    await f.getByPlaceholder(/hot wallet/i).fill("Alice (OTC desk)").catch((e) => console.log("name:", e.message.split("\n")[0]));
    await f.getByRole("button", { name: "Trusted" }).click().catch((e) => console.log("status:", e.message.split("\n")[0]));
    await f.getByLabel(/also in a list/i).selectOption({ label: "Whale watch" }, { timeout: 1500 }).catch((e) => console.log("list:", e.message.split("\n")[0]));
    await page.waitForTimeout(500);
  }
  await shot(page, "4-tag-form");
  await page.close();
}

// 5. The library in the floating panel.
{
  const page = await open(`https://eth.blockscout.com/address/${VITALIK}?tab=txs`);
  await hideNoise(page);
  await page.evaluate(() => window.scrollTo(0, 250));
  await worker.evaluate(async () => { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); await chrome.tabs.sendMessage(t.id, { type: "taw:togglePanel" }); });
  await page.waitForTimeout(3000);
  const f = floatPanel(page);
  if (f) await f.getByRole("tab", { name: "Library" }).click().catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "5-library");
  await page.close();
}

await ctx.close();
server.close();
console.log("Captured to", OUT);
