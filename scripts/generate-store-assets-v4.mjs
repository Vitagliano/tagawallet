// Builds the Chrome Web Store images from REAL captures of the shipped extension.
// Run scripts/capture-store-screenshots.mjs first. Nothing in the frames is drawn by hand.
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMMON_CSS, LOGO_SVG } from "./generate-assets-common.mjs";

const OUT_DIR = resolve("store-assets");
const EXT_OUT_DIR = resolve("apps/extension/store-assets");
const CAP = resolve("store-assets/_captures");
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(EXT_OUT_DIR, { recursive: true });

const cap = (name) => `data:image/png;base64,${readFileSync(resolve(CAP, `${name}.png`)).toString("base64")}`;

async function renderPage(browser, { width, height, html, filename }) {
  console.log(`Rendering ${filename} (${width}x${height})...`);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><style>${COMMON_CSS}</style></head><body>${html}</body></html>`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const raw = resolve(OUT_DIR, `_raw_${filename}.png`);
  await page.screenshot({ path: raw, type: "png" });
  await page.close();
  const targets = ["png", "jpg"].flatMap((ext) => [resolve(OUT_DIR, `${filename}.${ext}`), resolve(EXT_OUT_DIR, `${filename}.${ext}`)]);
  execSync(`python3 scripts/convert-rgb.py "${raw}" ${targets.map((t) => `"${t}"`).join(" ")}`, { stdio: "inherit" });
  execSync(`rm -f "${raw}"`);
}

const slide = ({ pill, title, subtitle, tab, url, image, pillColor = "#ee6a42" }) => `
  <div style="width:1280px;height:800px;background:#0b0b0a;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-120px;right:-80px;width:520px;height:520px;border-radius:50%;background:radial-gradient(circle, rgba(238,106,66,0.10) 0%, transparent 70%);"></div>
    <div class="slide-header" style="position:relative;z-index:2;">
      <div>
        <div class="slide-tag" style="color:${pillColor};border-color:${pillColor}55;background:${pillColor}1f;">${pill}</div>
        <div class="slide-title">${title}</div>
        <div class="slide-subtitle">${subtitle}</div>
      </div>
      <div class="slide-brand">${LOGO_SVG(30, "dark")}<span>TagAWallet</span></div>
    </div>
    <div class="browser-frame" style="position:absolute;left:36px;right:36px;top:136px;bottom:28px;z-index:2;">
      <div class="browser-titlebar">
        <div class="window-dots"><div class="window-dot dot-red"></div><div class="window-dot dot-yellow"></div><div class="window-dot dot-green"></div></div>
        <div class="browser-tabs"><div class="browser-tab">${tab}</div></div>
      </div>
      <div class="browser-addressbar">
        <div class="url-input"><span>🔒</span><span>${url}</span></div>
        <div class="ext-icon-active">${LOGO_SVG(18, "dark")}</div>
      </div>
      <div style="flex:1;min-height:0;background:#0f0f0e;"><img src="${image}" style="display:block;width:100%;height:100%;object-fit:cover;object-position:top left;" /></div>
    </div>
  </div>`;

const icon128Html = `
  <div style="width:128px;height:128px;background:#141412;display:grid;place-items:center;position:relative;overflow:hidden;">
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(238,106,66,0.18) 0%, transparent 75%);"></div>
    <div style="position:absolute;inset:2px;border:1px solid #2c2b26;border-radius:24px;"></div>
    <div style="position:relative;z-index:2;display:grid;place-items:center;">${LOGO_SVG(84, "dark")}</div>
  </div>`;

// The real card, cropped from a capture, in a plain frame.
const cardImg = (w) => `<img src="${cap("1b-card-only")}" style="display:block;width:${w}px;border-radius:12px;border:1px solid #2e2d28;box-shadow:0 18px 44px rgba(0,0,0,0.6);" />`;

const promoSmallHtml = `
  <div style="width:440px;height:280px;background:#0f0f0e;position:relative;overflow:hidden;display:flex;align-items:center;gap:18px;padding:0 22px;border:1px solid #2a2924;">
    <div style="position:absolute;top:-60px;right:-60px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle, rgba(238,106,66,0.20) 0%, transparent 70%);"></div>
    <div style="position:relative;z-index:2;width:190px;display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;align-items:center;gap:8px;">${LOGO_SVG(26, "dark")}<span style="font-size:17px;font-weight:800;color:#fff;letter-spacing:-0.02em;">TagAWallet</span></div>
      <h2 style="font-size:19px;font-weight:800;line-height:1.2;color:#fff;letter-spacing:-0.02em;">Know whose wallet it is.</h2>
      <p style="font-size:11.5px;color:#a49f91;line-height:1.4;">Private tags, right beside every address you browse.</p>
    </div>
    <div style="position:relative;z-index:2;flex:1;">${cardImg(196)}</div>
  </div>`;

const pill = (t) => `<span style="font-size:13px;font-weight:600;color:#d6d3c9;background:#181816;border:1px solid #2e2d28;border-radius:8px;padding:8px 14px;">${t}</span>`;
const promoMarqueeHtml = `
  <div style="width:1400px;height:560px;background:#0b0b0a;position:relative;overflow:hidden;display:flex;align-items:center;padding:0 70px;gap:60px;border:1px solid #2a2924;">
    <div style="position:absolute;top:-120px;right:80px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle, rgba(238,106,66,0.16) 0%, transparent 65%);"></div>
    <div style="position:relative;z-index:2;width:600px;display:flex;flex-direction:column;gap:22px;">
      <div style="display:flex;align-items:center;gap:12px;">${LOGO_SVG(40, "dark")}<span style="font-size:24px;font-weight:800;color:#fff;">TagAWallet</span>
        <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:#ee6a42;border:1px solid rgba(238,106,66,0.4);background:rgba(238,106,66,0.12);padding:4px 11px;border-radius:99px;">CHROME EXTENSION</span></div>
      <h1 style="font-size:50px;line-height:1.08;font-weight:800;color:#fff;letter-spacing:-0.03em;">Never wonder whose wallet you're looking at again.</h1>
      <p style="font-size:17px;line-height:1.5;color:#a49f91;">Tag addresses privately and see who's behind them as you browse explorers, DEX pages and crypto social, with nothing sent anywhere you didn't choose.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">${pill("🔒 Private by default")}${pill("🏷 Inline wallet tags")}${pill("📚 Lists &amp; address book")}</div>
    </div>
    <div style="position:relative;z-index:2;flex:1;display:flex;justify-content:center;">${cardImg(420)}</div>
  </div>`;

const tasks = [
  { width: 128, height: 128, html: icon128Html, filename: "icon-128" },
  { width: 440, height: 280, html: promoSmallHtml, filename: "promo-small-440x280" },
  { width: 1400, height: 560, html: promoMarqueeHtml, filename: "promo-marquee-1400x560" },
  { width: 1280, height: 800, filename: "screenshot-1-identity", html: slide({
    pill: "FEATURE 01 // BLOCK EXPLORERS", title: "Identify Wallets Instantly in Block Explorers",
    subtitle: "Your tags appear beside every address in explorer tables, and a click opens the full card. Works on Etherscan, Blockscout, Solscan and more.",
    tab: "Address details | Blockscout", url: "eth.blockscout.com/address/0xd8dA…6045", image: cap("1-explorer-card") }) },
  { width: 1280, height: 800, filename: "screenshot-2-dexscreener", html: slide({
    pill: "FEATURE 02 // DEX ANALYTICS", title: "Spot Who's Trading in Live DEX Pools",
    subtitle: "Trades list wallets as short hashes. TagAWallet puts the names you've given them right in the table. Also on DexScreener.",
    tab: "WETH/USDC | GeckoTerminal", url: "geckoterminal.com/eth/pools/0x88e6…5640", image: cap("2-dex-pool") }) },
  { width: 1280, height: 800, filename: "screenshot-3-twitter", html: slide({
    pill: "FEATURE 03 // EVERYWHERE YOU BROWSE", title: "Recognize Wallets Across Crypto Sites and X",
    subtitle: "Holder lists, token pages, feeds and profiles: any address on a site you turn on gets recognized. Turn sites on one at a time.",
    tab: "USDC token | Blockscout", url: "eth.blockscout.com/token/0xA0b8…eB48", image: cap("3-token-holders"), pillColor: "#4aa8ff" }) },
  { width: 1280, height: 800, filename: "screenshot-4-quick-tag", html: slide({
    pill: "FEATURE 04 // 1-CLICK TAGGING", title: "Privately Tag & Categorize Any Wallet",
    subtitle: "Click the mark next to any address, name it, set a status, and file it in a list. Tags are private to you until you choose to share.",
    tab: "Address details | Blockscout", url: "eth.blockscout.com/address/0xd8dA…6045", image: cap("4-tag-form") }) },
  { width: 1280, height: 800, filename: "screenshot-5-address-book", html: slide({
    pill: "FEATURE 05 // ADDRESS BOOK & LISTS", title: "Your Private Web3 Address Book Everywhere",
    subtitle: "Search your contacts, lists and people from any page, and jump to the full dashboard when you need more.",
    tab: "Address details | Blockscout", url: "eth.blockscout.com/address/0xd8dA…6045", image: cap("5-library") }) },
];

const browser = await chromium.launch({ headless: true });
for (const t of tasks) await renderPage(browser, t);
await browser.close();
console.log("Store assets regenerated in", OUT_DIR, "and", EXT_OUT_DIR);
