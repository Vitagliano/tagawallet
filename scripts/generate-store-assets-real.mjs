import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMMON_CSS, LOGO_SVG } from "./generate-assets-common.mjs";

const OUT_DIR = resolve("store-assets");
const EXT_OUT_DIR = resolve("apps/extension/store-assets");
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(EXT_OUT_DIR, { recursive: true });

// Read the real live screenshots taken earlier
const blockscoutTxsBase64 = `data:image/png;base64,${readFileSync("/tmp/real-site-blockscout-txs.png").toString("base64")}`;
const uniswapPoolBase64 = `data:image/png;base64,${readFileSync("/tmp/real-site-uniswap-pool.png").toString("base64")}`;
const vitalikBlockscoutBase64 = `data:image/png;base64,${readFileSync("/tmp/real-site-vitalik.png").toString("base64")}`;
const mempoolBase64 = `data:image/png;base64,${readFileSync("/tmp/real-site-mempool.png").toString("base64")}`;

async function renderPage(browser, { width, height, html, filename }) {
  console.log(`Rendering ${filename} (${width}x${height})...`);
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });

  const fullHtml = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <style>${COMMON_CSS}</style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;

  await page.setContent(fullHtml, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  const rawPath = resolve(OUT_DIR, `_raw_${filename}.png`);
  await page.screenshot({ path: rawPath, type: "png" });
  await page.close();

  const pngPath = resolve(OUT_DIR, `${filename}.png`);
  const jpgPath = resolve(OUT_DIR, `${filename}.jpg`);
  const extPngPath = resolve(EXT_OUT_DIR, `${filename}.png`);
  const extJpgPath = resolve(EXT_OUT_DIR, `${filename}.jpg`);

  execSync(`python3 scripts/convert-rgb.py "${rawPath}" "${pngPath}" "${jpgPath}" "${extPngPath}" "${extJpgPath}"`, { stdio: "inherit" });
  execSync(`rm -f "${rawPath}"`);
}

// -------------------------------------------------------------
// 1. STORE ICON (128x128 pixels)
// -------------------------------------------------------------
const icon128Html = `
  <div style="width:128px;height:128px;background:#141412;display:grid;place-items:center;position:relative;overflow:hidden;">
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(238,106,66,0.18) 0%, transparent 75%);"></div>
    <div style="position:absolute;inset:2px;border:1px solid #2c2b26;border-radius:24px;"></div>
    <div style="position:relative;z-index:2;display:grid;place-items:center;">
      ${LOGO_SVG(84, "dark")}
    </div>
  </div>
`;

// -------------------------------------------------------------
// 2. SMALL PROMO TILE (440x280 Canvas) - Real Websites Edition
// -------------------------------------------------------------
const promoSmallHtml = `
  <div style="width:440px;height:280px;background:#10100f;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:20px 22px;border:1px solid #282723;">
    <!-- Background Real Uniswap Pool Subtle Overlay -->
    <div style="position:absolute;inset:0;opacity:0.18;background-image:url('${uniswapPoolBase64}');background-size:cover;background-position:center;filter:blur(1px);pointer-events:none;"></div>
    
    <!-- Background Glow -->
    <div style="position:absolute;top:-40px;right:-40px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle, rgba(238,106,66,0.24) 0%, transparent 70%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-60px;left:-40px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle, rgba(27,122,74,0.16) 0%, transparent 70%);pointer-events:none;"></div>

    <!-- Top Branding -->
    <div style="position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:9px;">
        ${LOGO_SVG(28, "dark")}
        <span style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#fdfcf9;">TagAWallet</span>
      </div>
      <span style="font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ee6a42;background:rgba(238,106,66,0.14);border:1px solid rgba(238,106,66,0.35);padding:2px 8px;border-radius:99px;">CHROME EXTENSION</span>
    </div>

    <!-- Center Headline & Value Prop -->
    <div style="position:relative;z-index:2;margin-top:2px;">
      <h2 style="font-size:20px;font-weight:800;line-height:1.2;color:#ffffff;letter-spacing:-0.02em;">Private Wallet Identity for Web3</h2>
      <p style="font-size:12px;color:#aba69a;margin-top:3px;line-height:1.35;">Works live on Blockscout, Uniswap, OpenSea & Etherscan.</p>
    </div>

    <!-- Real Tag Preview Box -->
    <div style="position:relative;z-index:2;background:#181816;border:1px solid #32312a;border-radius:8px;padding:9px 12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 24px rgba(0,0,0,0.6);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="mono" style="font-size:11px;color:#858278;">0xd8dA...6045</span>
          <span class="tag-badge badge-verified" style="font-size:10px;height:18px;padding:0 6px;">Vitalik Buterin ✓ Verified</span>
        </div>
        <span style="font-size:10px;color:#55c58d;font-weight:600;">Personal</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="mono" style="font-size:11px;color:#858278;">0x88e6...5640</span>
          <span class="tag-badge badge-private" style="font-size:10px;height:18px;padding:0 6px;">Uniswap V3: ETH/USDC 🔒 Tagged</span>
        </div>
        <span style="font-size:10px;color:#ee6a42;font-weight:600;">Pool</span>
      </div>
    </div>

    <!-- Bottom Feature Pills -->
    <div style="position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding-top:4px;border-top:1px solid #22211d;font-size:10.5px;color:#8a867c;font-weight:500;">
      <span>🔒 100% Private</span>
      <span>•</span>
      <span>⚡ Live Side Panel</span>
      <span>•</span>
      <span>🌐 Multi-Chain</span>
    </div>
  </div>
`;

// -------------------------------------------------------------
// 3. MARQUEE PROMO TILE (1400x560 Canvas) - Real Websites Edition
// -------------------------------------------------------------
const promoMarqueeHtml = `
  <div style="width:1400px;height:560px;background:#0d0d0c;position:relative;overflow:hidden;display:flex;align-items:center;padding:0 70px;gap:60px;border:1px solid #262520;">
    <!-- Ambient Background with Real Live Explorer Atmosphere -->
    <div style="position:absolute;right:0;top:0;bottom:0;width:55%;background-image:url('${uniswapPoolBase64}');background-size:cover;background-position:top right;opacity:0.18;filter:blur(2px);pointer-events:none;"></div>
    
    <!-- Ambient Lighting Glows -->
    <div style="position:absolute;top:-100px;right:100px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle, rgba(238,106,66,0.18) 0%, transparent 65%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-150px;left:200px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle, rgba(27,122,74,0.14) 0%, transparent 65%);pointer-events:none;"></div>
    
    <!-- Subtle Grid Background -->
    <div style="position:absolute;inset:0;background-image:linear-gradient(to right, #1a1a17 1px, transparent 1px), linear-gradient(to bottom, #1a1a17 1px, transparent 1px);background-size:44px 44px;opacity:0.25;pointer-events:none;"></div>

    <!-- Left Column: Copy & Value Proposition (580px) -->
    <div style="position:relative;z-index:2;width:580px;display:flex;flex-direction:column;gap:20px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${LOGO_SVG(36, "dark")}
        <span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">TagAWallet</span>
        <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ee6a42;background:rgba(238,106,66,0.14);border:1px solid rgba(238,106,66,0.35);padding:3px 10px;border-radius:99px;margin-left:6px;">CHROME EXTENSION</span>
      </div>

      <h1 style="font-size:42px;font-weight:800;line-height:1.15;letter-spacing:-0.03em;color:#ffffff;">
        Never wonder whose wallet you're looking at again.
      </h1>

      <p style="font-size:17px;line-height:1.5;color:#aba69a;font-weight:400;">
        Privately tag addresses, organize custom watchlists, and recognize verified Web3 identities directly on Blockscout, Uniswap, OpenSea, and Twitter.
      </p>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">
        <span style="display:inline-flex;align-items:center;gap:6px;background:#181815;border:1px solid #2e2d27;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;color:#e8e5db;">
          <span style="color:#ee6a42;">🔒</span> 100% Private Tags
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;background:#181815;border:1px solid #2e2d27;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;color:#e8e5db;">
          <span style="color:#55c58d;">✓</span> Real-Time Recognition
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;background:#181815;border:1px solid #2e2d27;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;color:#e8e5db;">
          <span style="color:#dbab45;">⚡</span> Chrome Side Panel
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;background:#181815;border:1px solid #2e2d27;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;color:#e8e5db;">
          <span style="color:#ee6a42;">🌐</span> EVM • Solana • Bitcoin
        </span>
      </div>

      <div style="display:flex;align-items:center;gap:18px;margin-top:10px;font-size:12.5px;color:#7e7a70;">
        <span>Free for Chrome</span>
        <span>•</span>
        <span>No Wallet Connection Needed</span>
        <span>•</span>
        <span>Zero Tracking</span>
      </div>
    </div>

    <!-- Right Column: Visual Product Showcase with Real Uniswap & Extension (640px) -->
    <div style="position:relative;z-index:2;flex:1;height:460px;display:flex;align-items:center;justify-content:center;">
      <div style="width:600px;background:#161614;border:1px solid #302f29;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,0.75), 0 4px 16px rgba(0,0,0,0.4);overflow:hidden;display:flex;flex-direction:column;">
        <!-- Window Bar -->
        <div style="height:36px;background:#121210;border-bottom:1px solid #262520;display:flex;align-items:center;justify-content:space-between;padding:0 14px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="display:flex;gap:6px;">
              <span class="window-dot dot-red"></span>
              <span class="window-dot dot-yellow"></span>
              <span class="window-dot dot-green"></span>
            </div>
            <span style="font-size:11.5px;font-weight:600;color:#8c887d;margin-left:8px;">app.uniswap.org / explore / pools</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="tag-badge badge-verified" style="font-size:10px;height:18px;">4 Detected</span>
            <div class="ext-icon-active" style="width:22px;height:22px;">
              ${LOGO_SVG(14, "dark")}
            </div>
          </div>
        </div>

        <!-- Inside: Real Live Uniswap Pool + Overlay Card -->
        <div style="height:380px;position:relative;background:#141412;overflow:hidden;">
          <!-- Real Uniswap Pool Image -->
          <img src="${uniswapPoolBase64}" style="width:100%;height:100%;object-fit:cover;object-position:top left;opacity:0.45;filter:contrast(1.05);" alt="Real Uniswap" />

          <!-- Overlaid Real TagAWallet Floating Card -->
          <div style="position:absolute;top:30px;left:40px;width:380px;background:#1c1c19;border:1px solid #3c3b33;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,0.85);padding:16px;z-index:20;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:8px;background:#2a2924;border:1px solid #3c3a33;display:grid;place-items:center;font-weight:700;font-size:14px;color:#efece3;">
                  P
                </div>
                <div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:15px;font-weight:700;color:#ffffff;">Paradigm Capital</span>
                    <span class="tag-badge badge-verified" style="font-size:10.5px;">✓ Verified</span>
                  </div>
                  <span style="font-size:11.5px;color:#9c988b;">Treasury & Liquidity Deployer</span>
                </div>
              </div>
              <span style="font-size:11px;font-weight:600;color:#ee6a42;background:rgba(238,106,66,0.12);padding:2px 8px;border-radius:6px;border:1px solid rgba(238,106,66,0.3);">EVM</span>
            </div>

            <div style="margin-top:12px;display:flex;align-items:center;justify-content:space-between;background:#141412;padding:7px 10px;border-radius:6px;border:1px solid #282722;">
              <span class="mono" style="font-size:12px;color:#cdc9be;">0x7769647890bF5c531d0413A2c06F447883654199</span>
              <span style="font-size:11px;color:#ee6a42;font-weight:600;">Copy</span>
            </div>

            <div style="margin-top:10px;display:flex;gap:6px;">
              <span style="font-size:10.5px;background:#25241f;border:1px solid #35342d;padding:2px 8px;border-radius:99px;color:#aba699;">#venture</span>
              <span style="font-size:10.5px;background:#25241f;border:1px solid #35342d;padding:2px 8px;border-radius:99px;color:#aba699;">#uniswap-lp</span>
              <span style="font-size:10.5px;background:#25241f;border:1px solid #35342d;padding:2px 8px;border-radius:99px;color:#aba699;">#tier-1</span>
            </div>

            <p style="margin-top:10px;font-size:11.5px;color:#a49f92;line-height:1.4;background:rgba(238,106,66,0.06);border-left:2px solid #ee6a42;padding:6px 10px;border-radius:0 4px 4px 0;">
              Lead backer & tier-1 LP in Uniswap V3 pools. Large rebalancing events flagged automatically.
            </p>

            <div style="margin-top:12px;display:flex;gap:8px;">
              <button style="flex:1;height:28px;background:#ee6a42;border:none;border-radius:6px;font-size:11.5px;font-weight:600;color:#fff;">Edit Tag</button>
              <button style="flex:1;height:28px;background:#25241f;border:1px solid #38372f;border-radius:6px;font-size:11.5px;color:#d5d1c5;">Explorer ↗</button>
            </div>
          </div>

          <!-- Bottom Live Detected Pill -->
          <div style="position:absolute;bottom:14px;right:18px;background:#181816;border:1px solid #ee6a42;border-radius:30px;padding:6px 14px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.6);">
            <span style="color:#ee6a42;">⚡</span>
            <span style="font-size:11.5px;font-weight:600;color:#fff;">Detected live on Uniswap V3 Pool</span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// -------------------------------------------------------------
// 4. SCREENSHOT 1: REAL BLOCKCHAIN EXPLORER (1280x800)
// -------------------------------------------------------------
const screenshot1Html = `
  <div style="width:1280px;height:800px;background:#0d0d0c;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <!-- Top Marketing Header -->
    <div class="slide-header">
      <div>
        <div class="slide-tag">FEATURE 01 // REAL-TIME EXPLORER IDENTITY</div>
        <h1 class="slide-title">Recognize Any Wallet on Real Blockchain Explorers</h1>
        <p class="slide-subtitle">TagAWallet automatically detects addresses on Blockscout, Etherscan, and DEXes — enriching them with verified identity and your private notes.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <!-- Browser Mockup Window with Real Blockscout Live Explorer -->
    <div style="flex:1;margin:0 36px 28px;position:relative;" class="browser-frame">
      <!-- Titlebar -->
      <div class="browser-titlebar">
        <div class="window-dots">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="browser-tabs">
          <div class="browser-tab">
            <span>eth.blockscout.com/txs</span>
          </div>
          <div class="browser-tab inactive">
            <span>app.uniswap.org</span>
          </div>
          <div class="browser-tab inactive">
            <span>mempool.space</span>
          </div>
        </div>
      </div>

      <!-- Address Bar -->
      <div class="browser-addressbar">
        <div class="nav-btns">
          <span>←</span> <span>→</span> <span>↻</span>
        </div>
        <div class="url-input">
          <span style="color:#55c58d;">🔒</span>
          <span>https://</span><strong>eth.blockscout.com</strong><span>/txs</span>
        </div>
        <div class="ext-bar">
          <div class="ext-icon-active">
            ${LOGO_SVG(16, "dark")}
          </div>
        </div>
      </div>

      <!-- Real Live Blockscout Web Content -->
      <div style="flex:1;position:relative;overflow:hidden;background:#121210;">
        <!-- Real Live Screenshot of Blockscout Transactions -->
        <img src="${blockscoutTxsBase64}" style="width:100%;height:100%;object-fit:cover;object-position:top left;opacity:0.85;" alt="Real Blockscout" />

        <!-- Overlay TagAWallet Badges Over Real Transaction Rows -->
        <!-- Row 1: Vitalik Badge -->
        <div style="position:absolute;top:208px;left:290px;z-index:10;">
          <span class="tag-badge badge-verified" style="box-shadow:0 4px 12px rgba(0,0,0,0.5);">Vitalik Buterin ✓ Verified</span>
        </div>

        <!-- Row 2: Paradigm Target Row -->
        <div style="position:absolute;top:256px;left:290px;z-index:10;">
          <span class="tag-badge badge-verified" style="box-shadow:0 4px 12px rgba(0,0,0,0.5);outline:2px solid #55c58d;">Paradigm Capital ✓ Verified</span>
        </div>

        <!-- Row 3: Wintermute Arb -->
        <div style="position:absolute;top:304px;left:290px;z-index:10;">
          <span class="tag-badge badge-private" style="box-shadow:0 4px 12px rgba(0,0,0,0.5);">Wintermute: Arb 🔒 Private</span>
        </div>

        <!-- Row 4: Alice's Cold Wallet -->
        <div style="position:absolute;top:352px;left:290px;z-index:10;">
          <span class="tag-badge badge-watchlist" style="box-shadow:0 4px 12px rgba(0,0,0,0.5);">Alice's Cold Wallet 🔒 Mine</span>
        </div>

        <!-- Row 5: Tag Wallet Prompt -->
        <div style="position:absolute;top:400px;left:290px;z-index:10;">
          <span class="tag-badge badge-unknown" style="box-shadow:0 4px 12px rgba(0,0,0,0.5);background:#1a1a17;">+ Tag wallet</span>
        </div>

        <!-- Active Open TagAWallet Popover Card on Real Blockscout Row -->
        <div style="position:absolute;top:130px;left:560px;width:380px;background:#1c1c19;border:1px solid #3c3b33;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06);padding:16px;z-index:30;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:34px;height:34px;border-radius:8px;background:#2a2924;border:1px solid #3a3932;display:grid;place-items:center;font-weight:800;color:#ffffff;font-size:14px;">
                P
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:15px;font-weight:700;color:#ffffff;">Paradigm Capital</span>
                  <span class="tag-badge badge-verified" style="font-size:10px;height:18px;">✓ Verified</span>
                </div>
                <span style="font-size:11px;color:#9c988b;">Treasury & Liquidity Deployer</span>
              </div>
            </div>
            <span style="font-size:10.5px;color:#ee6a42;background:rgba(238,106,66,0.14);padding:2px 8px;border-radius:6px;font-weight:600;">EVM</span>
          </div>

          <div style="margin-top:12px;background:#141412;border:1px solid #2c2b25;border-radius:6px;padding:7px 10px;display:flex;align-items:center;justify-content:space-between;">
            <span class="mono" style="font-size:11.5px;color:#d6d2c4;">0x7769647890bF5c531d0413A2c06F447883654199</span>
            <span style="font-size:11px;color:#ee6a42;font-weight:600;cursor:pointer;">Copy</span>
          </div>

          <div style="margin-top:10px;display:flex;gap:5px;flex-wrap:wrap;">
            <span style="background:#262520;border:1px solid #38372e;padding:2px 8px;border-radius:99px;font-size:10.5px;color:#aba698;">#venture</span>
            <span style="background:#262520;border:1px solid #38372e;padding:2px 8px;border-radius:99px;font-size:10.5px;color:#aba698;">#tier-1</span>
            <span style="background:#262520;border:1px solid #38372e;padding:2px 8px;border-radius:99px;font-size:10.5px;color:#aba698;">#uniswap-lp</span>
            <span style="background:#262520;border:1px solid #38372e;padding:2px 8px;border-radius:99px;font-size:10.5px;color:#aba698;">#eth-whale</span>
          </div>

          <div style="margin-top:10px;background:rgba(238,106,66,0.06);border-left:2px solid #ee6a42;padding:7px 10px;border-radius:0 6px 6px 0;font-size:11.5px;color:#b0aba0;line-height:1.4;">
            Lead investor for Uniswap & Blur. Monitored for large liquidity adjustments on mainnet pools.
          </div>

          <div style="margin-top:14px;display:flex;gap:8px;">
            <button style="flex:1;height:28px;background:#ee6a42;border:none;border-radius:6px;font-size:11.5px;font-weight:600;color:#ffffff;cursor:pointer;">Edit Tag</button>
            <button style="flex:1;height:28px;background:#24231f;border:1px solid #35342d;border-radius:6px;font-size:11.5px;font-weight:500;color:#e8e5db;cursor:pointer;">Blockscout ↗</button>
          </div>
        </div>

        <!-- Annotation Callout Pill -->
        <div style="position:absolute;bottom:20px;right:24px;background:#181816;border:1px solid #ee6a42;border-radius:30px;padding:8px 18px;display:flex;align-items:center;gap:10px;box-shadow:0 12px 30px rgba(0,0,0,0.7);z-index:30;">
          <span style="color:#ee6a42;font-size:16px;">⚡</span>
          <span style="font-size:12.5px;font-weight:600;color:#ffffff;">Live recognition on real Blockscout Ethereum transactions</span>
        </div>
      </div>
    </div>
  </div>
`;

// -------------------------------------------------------------
// 5. SCREENSHOT 2: REAL UNISWAP POOL + CHROME SIDE PANEL (1280x800)
// -------------------------------------------------------------
const screenshot2Html = `
  <div style="width:1280px;height:800px;background:#0d0d0c;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <!-- Top Marketing Header -->
    <div class="slide-header">
      <div>
        <div class="slide-tag">FEATURE 02 // CHROME SIDE PANEL</div>
        <h1 class="slide-title">Auto-Detect Every Wallet on the Active Page</h1>
        <p class="slide-subtitle">Open Chrome's built-in Side Panel to inspect, categorize, and tag all pool contracts, DEX routers, and traders found on Uniswap.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <!-- Browser Mockup Window -->
    <div style="flex:1;margin:0 36px 28px;position:relative;" class="browser-frame">
      <!-- Titlebar -->
      <div class="browser-titlebar">
        <div class="window-dots">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="browser-tabs">
          <div class="browser-tab">
            <span>ETH/USDC: Uniswap</span>
          </div>
          <div class="browser-tab inactive">
            <span>eth.blockscout.com</span>
          </div>
        </div>
      </div>

      <!-- Address Bar -->
      <div class="browser-addressbar">
        <div class="nav-btns">
          <span>←</span> <span>→</span> <span>↻</span>
        </div>
        <div class="url-input">
          <span style="color:#55c58d;">🔒</span>
          <span>https://</span><strong>app.uniswap.org</strong><span>/explore/pools/ethereum/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640</span>
        </div>
        <div class="ext-bar">
          <div class="ext-icon-active">
            ${LOGO_SVG(16, "dark")}
          </div>
        </div>
      </div>

      <!-- Layout: Real Uniswap Pool (Left) + Chrome Side Panel (Right) -->
      <div style="flex:1;display:flex;overflow:hidden;position:relative;">
        <!-- Left: Real Uniswap Pool Screenshot -->
        <div style="flex:1;position:relative;background:#141412;overflow:hidden;">
          <img src="${uniswapPoolBase64}" style="width:100%;height:100%;object-fit:cover;object-position:top left;opacity:0.9;" alt="Real Uniswap Pool" />
          
          <!-- Subtle Floating Marker on Contract Address -->
          <div style="position:absolute;top:180px;left:80px;background:#1c1c19;border:1px solid #ee6a42;border-radius:6px;padding:4px 10px;display:flex;align-items:center;gap:6px;box-shadow:0 8px 20px rgba(0,0,0,0.6);">
            <span style="font-size:11px;color:#55c58d;">✓</span>
            <span style="font-size:11px;font-weight:600;color:#fff;">Detected: Uniswap V3 ETH/USDC Pool (0x88e6...5640)</span>
          </div>
        </div>

        <!-- Right: Real TagAWallet Chrome Side Panel (390px) -->
        <div style="width:390px;background:#181815;display:flex;flex-direction:column;border-left:1px solid #2e2d27;position:relative;z-index:10;box-shadow:-10px 0 30px rgba(0,0,0,0.5);">
          <!-- Panel Header / Tabs -->
          <div style="padding:12px 16px 8px;border-bottom:1px solid #2b2a24;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <div style="display:flex;align-items:center;gap:8px;">
                ${LOGO_SVG(22, "dark")}
                <span style="font-size:15px;font-weight:700;color:#ffffff;">TagAWallet</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:11px;color:#55c58d;background:rgba(27,122,74,0.18);border:1px solid #1b7a4a;padding:2px 7px;border-radius:99px;font-weight:600;">Active on app.uniswap.org</span>
              </div>
            </div>

            <!-- Tabs -->
            <div style="display:flex;gap:4px;background:#131311;padding:3px;border-radius:8px;border:1px solid #272620;">
              <button style="flex:1;height:26px;background:#24231e;border:1px solid #38372f;border-radius:6px;font-size:11.5px;font-weight:600;color:#ffffff;display:flex;align-items:center;justify-content:center;gap:6px;">
                <span>This page</span>
                <span style="background:#ee6a42;color:#fff;border-radius:99px;font-size:9.5px;padding:0 5px;">5</span>
              </button>
              <button style="flex:1;height:26px;background:transparent;border:none;border-radius:6px;font-size:11.5px;font-weight:500;color:#858176;display:flex;align-items:center;justify-content:center;">
                Library
              </button>
            </div>
          </div>

          <!-- Detected Wallets Filter Bar -->
          <div style="padding:8px 16px;background:#151513;border-bottom:1px solid #25241f;display:flex;align-items:center;justify-content:space-between;font-size:11px;">
            <div style="display:flex;gap:6px;">
              <span style="color:#ffffff;font-weight:600;background:#22211c;padding:2px 8px;border-radius:4px;">All (5)</span>
              <span style="color:#55c58d;cursor:pointer;">Tagged (3)</span>
              <span style="color:#858176;cursor:pointer;">Untagged (2)</span>
            </div>
            <span style="color:#ee6a42;cursor:pointer;font-weight:600;">+ Quick Tag</span>
          </div>

          <!-- Wallets List Detected from Real Uniswap Page -->
          <div style="flex:1;padding:12px 14px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
            <!-- Item 1: ETH/USDC Pool -->
            <div style="background:#1e1e1a;border:1px solid #302f28;border-radius:8px;padding:10px 12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:13px;font-weight:700;color:#ffffff;">Uniswap V3: ETH/USDC 0.05%</span>
                <span class="tag-badge badge-verified" style="font-size:10px;">✓ Verified</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span class="mono" style="font-size:11px;color:#8a867c;">0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640</span>
                <span style="font-size:10.5px;color:#55c58d;">Pool Contract</span>
              </div>
            </div>

            <!-- Item 2: Uniswap V3 Factory -->
            <div style="background:#1e1e1a;border:1px solid #302f28;border-radius:8px;padding:10px 12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:13px;font-weight:700;color:#ffffff;">Uniswap V3: Factory</span>
                <span class="tag-badge badge-verified" style="font-size:10px;">✓ Verified</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span class="mono" style="font-size:11px;color:#8a867c;">0x1F98431c8aD98523631AE4a59f267346ea31F984</span>
                <span style="font-size:10.5px;color:#7e7b72;">Core Deployer</span>
              </div>
            </div>

            <!-- Item 3: Wintermute Arb Bot -->
            <div style="background:#1e1e1a;border:1px solid #302f28;border-radius:8px;padding:10px 12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:13px;font-weight:700;color:#ffffff;">Wintermute Trading</span>
                <span class="tag-badge badge-private" style="font-size:10px;">🔒 Private Tag</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span class="mono" style="font-size:11px;color:#8a867c;">0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503</span>
                <span style="font-size:10.5px;color:#ee6a42;">Hot Wallet / Arb</span>
              </div>
            </div>

            <!-- Item 4: USDC Contract -->
            <div style="background:#1e1e1a;border:1px solid #302f28;border-radius:8px;padding:10px 12px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <span style="font-size:13px;font-weight:700;color:#ffffff;">USD Coin (Circle)</span>
                <span class="tag-badge badge-verified" style="font-size:10px;">✓ Verified</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px;">
                <span class="mono" style="font-size:11px;color:#8a867c;">0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48</span>
                <span style="font-size:10.5px;color:#7e7b72;">Token Contract</span>
              </div>
            </div>

            <!-- Item 5: Unknown Address -->
            <div style="background:#181815;border:1px dashed #3a3932;border-radius:8px;padding:10px 12px;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <span class="mono" style="font-size:11px;color:#858176;">0x388C818CA8B9251b393131C08a73683246A1127</span>
                <div style="font-size:10.5px;color:#6b675e;margin-top:2px;">LP Depositor</div>
              </div>
              <button style="height:24px;padding:0 8px;background:#24231e;border:1px solid #3c3a32;border-radius:6px;font-size:10.5px;font-weight:600;color:#d8d4c7;cursor:pointer;">+ Tag</button>
            </div>
          </div>

          <!-- Side Panel Footer -->
          <div style="padding:10px 16px;background:#131311;border-top:1px solid #25241f;display:flex;align-items:center;justify-content:space-between;font-size:11px;color:#7e7b72;">
            <span>Vault Synced</span>
            <span>Shortcut: <kbd style="background:#20201c;border:1px solid #302f28;padding:1px 5px;border-radius:4px;color:#d8d4c7;">Alt+Shift+P</kbd></span>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// -------------------------------------------------------------
// 6. SCREENSHOT 3: REAL BLOCKSCOUT ADDRESS + QUICK TAGGING FORM (1280x800)
// -------------------------------------------------------------
const screenshot3Html = `
  <div style="width:1280px;height:800px;background:#0d0d0c;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <!-- Top Marketing Header -->
    <div class="slide-header">
      <div>
        <div class="slide-tag">FEATURE 03 // 1-CLICK QUICK TAGGING</div>
        <h1 class="slide-title">Privately Tag & Categorize in Seconds</h1>
        <p class="slide-subtitle">Add custom names, group multiple addresses under entities, assign roles (Treasury, Hot Wallet), and record private notes.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <!-- Center Stage: Browser with Real Vitalik Blockscout Page in Background + Quick Tag Form -->
    <div style="flex:1;margin:0 36px 28px;position:relative;display:flex;align-items:center;justify-content:center;" class="browser-frame">
      <!-- Titlebar -->
      <div class="browser-titlebar" style="position:absolute;top:0;left:0;right:0;">
        <div class="window-dots">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="browser-tabs">
          <div class="browser-tab">
            <span>eth.blockscout.com / Tagging Wallet</span>
          </div>
        </div>
      </div>

      <!-- Real Live Vitalik Blockscout Background (Blurred / Dimmed) -->
      <div style="position:absolute;inset:38px 0 0 0;overflow:hidden;">
        <img src="${vitalikBlockscoutBase64}" style="width:100%;height:100%;object-fit:cover;object-position:top left;opacity:0.35;filter:blur(3px);" alt="Real Vitalik Blockscout" />
        <div style="position:absolute;inset:0;background:rgba(16,16,14,0.65);"></div>
      </div>

      <!-- Quick Tag Form Container (Focus Area) -->
      <div style="position:relative;z-index:10;width:480px;background:#1a1a17;border:1px solid #3c3a32;border-radius:14px;box-shadow:0 30px 90px rgba(0,0,0,0.85), 0 0 0 1px rgba(238,106,66,0.2);overflow:hidden;">
        <!-- Header -->
        <div style="padding:16px 20px 12px;border-bottom:1px solid #2c2b25;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:6px;background:rgba(238,106,66,0.15);border:1px solid #c8421b;display:grid;place-items:center;">
              ${LOGO_SVG(16, "dark")}
            </div>
            <h2 style="font-size:16px;font-weight:700;color:#ffffff;">Tag this wallet</h2>
          </div>
          <span style="font-size:11px;font-weight:600;color:#55c58d;background:rgba(27,122,74,0.15);padding:2px 8px;border-radius:99px;border:1px solid #1b7a4a;">Private to you</span>
        </div>

        <!-- Form Body -->
        <div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
          <!-- Address & Chain Row -->
          <div style="display:flex;align-items:center;justify-content:space-between;background:#141412;border:1px solid #282721;border-radius:6px;padding:8px 12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:#7e7b72;">Address:</span>
              <span class="mono" style="font-size:12px;color:#ffffff;font-weight:600;">0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D</span>
            </div>
            <span style="font-size:11px;background:#24231e;border:1px solid #35342d;padding:2px 7px;border-radius:4px;color:#d5d1c5;">Ethereum</span>
          </div>

          <!-- Entity & Role (Who is this?) -->
          <div style="display:flex;gap:10px;">
            <div style="flex:1;">
              <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:4px;">Who is this? (Entity)</label>
              <div style="background:#141412;border:1px solid #302f28;border-radius:6px;padding:7px 10px;font-size:12.5px;color:#ffffff;font-weight:500;">
                🏢 Wintermute Trading
              </div>
            </div>
            <div style="width:150px;">
              <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:4px;">Role</label>
              <div style="background:#141412;border:1px solid #302f28;border-radius:6px;padding:7px 10px;font-size:12.5px;color:#ffffff;font-weight:500;">
                Hot wallet
              </div>
            </div>
          </div>

          <!-- Name for this address -->
          <div>
            <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:4px;">Name for this address</label>
            <div style="background:#141412;border:1px solid #ee6a42;border-radius:6px;padding:7px 10px;font-size:13px;color:#ffffff;font-weight:500;">
              Wintermute: High-Freq Arb Engine #1
            </div>
          </div>

          <!-- Status Tone Pills -->
          <div>
            <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:6px;">Status Classification</label>
            <div style="display:flex;gap:6px;">
              <span style="background:#22211c;border:1px solid #36352d;color:#8f8b80;padding:4px 10px;border-radius:99px;font-size:11.5px;">Mine</span>
              <span style="background:#22211c;border:1px solid #36352d;color:#8f8b80;padding:4px 10px;border-radius:99px;font-size:11.5px;">Trusted</span>
              <span style="background:rgba(219,171,69,0.18);border:1px solid #9a6a00;color:#dbab45;padding:4px 10px;border-radius:99px;font-size:11.5px;font-weight:600;">✓ Watchlist</span>
              <span style="background:#22211c;border:1px solid #36352d;color:#8f8b80;padding:4px 10px;border-radius:99px;font-size:11.5px;">Scam</span>
            </div>
          </div>

          <!-- Add to List -->
          <div>
            <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:4px;">Also in a list</label>
            <div style="background:#141412;border:1px solid #302f28;border-radius:6px;padding:7px 10px;font-size:12.5px;color:#ffffff;">
              📁 DeFi Market Makers & HFT (shared)
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:4px;">Private Notes</label>
            <div style="background:#141412;border:1px solid #302f28;border-radius:6px;padding:8px 10px;font-size:12px;color:#c9c5b9;line-height:1.4;">
              Active on Uniswap V3 ETH/USDC 5bps pool. Very high priority gas fees. Monitors for flash swap rebalances.
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display:flex;gap:10px;margin-top:6px;">
            <button style="flex:1;height:34px;background:#ee6a42;border:none;border-radius:8px;font-size:13px;font-weight:700;color:#ffffff;cursor:pointer;">
              Save Tag
            </button>
            <button style="width:90px;height:34px;background:#24231f;border:1px solid #38372f;border-radius:8px;font-size:13px;font-weight:500;color:#d5d1c5;cursor:pointer;">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <!-- Floating Annotation Callout -->
      <div style="position:absolute;bottom:24px;left:40px;background:#181816;border:1px solid #33322b;border-radius:10px;padding:12px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 12px 30px rgba(0,0,0,0.6);">
        <div style="font-size:20px;">🔒</div>
        <div>
          <div style="font-size:12.5px;font-weight:700;color:#ffffff;">100% Client-Side Privacy</div>
          <div style="font-size:11px;color:#9c988b;">Tags and notes are encrypted and never exposed to the public.</div>
        </div>
      </div>
    </div>
  </div>
`;

// -------------------------------------------------------------
// 7. SCREENSHOT 4: REAL UNISWAP BACKGROUND + ADDRESS BOOK & LISTS (1280x800)
// -------------------------------------------------------------
const screenshot4Html = `
  <div style="width:1280px;height:800px;background:#0d0d0c;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <!-- Top Marketing Header -->
    <div class="slide-header">
      <div>
        <div class="slide-tag">FEATURE 04 // ADDRESS BOOK & LISTS</div>
        <h1 class="slide-title">Your Curated Web3 Address Book & Watchlists</h1>
        <p class="slide-subtitle">Organize wallets into custom lists, group under entities, and instantly search across your entire tagging history.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <!-- Browser Mockup Window -->
    <div style="flex:1;margin:0 36px 28px;position:relative;" class="browser-frame">
      <!-- Titlebar -->
      <div class="browser-titlebar">
        <div class="window-dots">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="browser-tabs">
          <div class="browser-tab">
            <span>TagAWallet / Library & Watchlists</span>
          </div>
          <div class="browser-tab inactive">
            <span>app.uniswap.org/explore</span>
          </div>
        </div>
      </div>

      <!-- Address Bar -->
      <div class="browser-addressbar">
        <div class="nav-btns">
          <span>←</span> <span>→</span> <span>↻</span>
        </div>
        <div class="url-input">
          <span style="color:#55c58d;">🔒</span>
          <span>chrome-extension://</span><strong>tagawallet</strong><span>/panel.html#library</span>
        </div>
        <div class="ext-bar">
          <div class="ext-icon-active">
            ${LOGO_SVG(16, "dark")}
          </div>
        </div>
      </div>

      <!-- Layout: Real Uniswap Ambient in Background + Side Panel Directory -->
      <div style="flex:1;background:#141412;display:flex;overflow:hidden;position:relative;">
        <!-- Left: Side Panel Library Navigation (360px) -->
        <div style="width:360px;background:#181815;border-right:1px solid #2a2923;padding:14px;display:flex;flex-direction:column;gap:12px;z-index:10;">
          <!-- Search Bar -->
          <div style="background:#121210;border:1px solid #2e2d27;border-radius:8px;padding:7px 12px;display:flex;align-items:center;gap:8px;">
            <span style="color:#6d6a60;font-size:12px;">🔍</span>
            <input placeholder="Search contacts, lists, entities..." style="background:transparent;border:none;color:#efece3;font-size:12px;outline:none;width:100%;font-family:inherit;" value="" />
          </div>

          <!-- Section: Custom Lists -->
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#858176;margin-bottom:8px;">
              Your Lists
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
              <!-- List 1 (Active) -->
              <div style="background:#24231e;border:1px solid #3c3a31;border-radius:8px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:14px;">📁</span>
                  <div>
                    <div style="font-size:13px;font-weight:700;color:#ffffff;">Smart Money & Whales</div>
                    <div style="font-size:11px;color:#8f8b80;">54 wallets · 12 entities</div>
                  </div>
                </div>
                <span style="font-size:10px;color:#dbab45;background:rgba(219,171,69,0.15);padding:1px 6px;border-radius:4px;font-weight:600;">Shared</span>
              </div>

              <!-- List 2 -->
              <div style="background:#1a1a17;border:1px solid #2b2a24;border-radius:8px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:14px;">📁</span>
                  <div>
                    <div style="font-size:13px;font-weight:600;color:#e8e4da;">Protocol Treasuries & DAOs</div>
                    <div style="font-size:11px;color:#7e7b72;">32 wallets · 18 entities</div>
                  </div>
                </div>
                <span style="font-size:10px;color:#858176;">Private</span>
              </div>

              <!-- List 3 -->
              <div style="background:#1a1a17;border:1px solid #2b2a24;border-radius:8px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:14px;">📁</span>
                  <div>
                    <div style="font-size:13px;font-weight:600;color:#e8e4da;">VC & Strategic Backers</div>
                    <div style="font-size:11px;color:#7e7b72;">48 wallets · 15 entities</div>
                  </div>
                </div>
                <span style="font-size:10px;color:#858176;">Private</span>
              </div>

              <!-- List 4 -->
              <div style="background:#1a1a17;border:1px solid #2b2a24;border-radius:8px;padding:9px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="font-size:14px;">📁</span>
                  <div>
                    <div style="font-size:13px;font-weight:600;color:#e8e4da;">Exchange Hot Wallets</div>
                    <div style="font-size:11px;color:#7e7b72;">86 wallets · 10 entities</div>
                  </div>
                </div>
                <span style="font-size:10px;color:#858176;">Private</span>
              </div>
            </div>
          </div>

          <!-- Section: Recent Entities -->
          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#858176;margin-bottom:8px;">
              Recent Entities
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:#1a1a17;">
                <span style="font-size:12.5px;color:#e8e4da;">Vitalik Buterin</span>
                <span style="font-size:11px;color:#7e7b72;">4 addresses</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:#1a1a17;">
                <span style="font-size:12.5px;color:#e8e4da;">Paradigm Capital</span>
                <span style="font-size:11px;color:#7e7b72;">8 addresses</span>
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:6px;background:#1a1a17;">
                <span style="font-size:12.5px;color:#e8e4da;">Wintermute Trading</span>
                <span style="font-size:11px;color:#7e7b72;">9 addresses</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Expanded List Details (Smart Money & Whales) -->
        <div style="flex:1;padding:20px 24px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;z-index:10;background:#141412;">
          <!-- List Banner -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:12px;border-bottom:1px solid #262520;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <h2 style="font-size:18px;font-weight:800;color:#ffffff;">Smart Money & Whales</h2>
                <span style="font-size:11px;color:#55c58d;background:rgba(27,122,74,0.15);padding:2px 8px;border-radius:99px;font-weight:600;">54 Addresses</span>
              </div>
              <span style="font-size:12px;color:#8a867c;">Shared notebook with Research Team · Auto-synced</span>
            </div>
            <button style="height:30px;padding:0 12px;background:#ee6a42;border:none;border-radius:6px;font-size:12px;font-weight:600;color:#fff;cursor:pointer;">+ Add Address</button>
          </div>

          <!-- Wallets in List -->
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <!-- Card 1 -->
            <div style="background:#1b1b18;border:1px solid #302f28;border-radius:8px;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:13px;color:#fff;">Jump Trading: High-Freq #1</strong>
                  <div style="font-size:11px;color:#ee6a42;margin-top:2px;">Entity: Jump Crypto · Arbitrage</div>
                </div>
                <span class="tag-badge badge-private" style="font-size:9.5px;">Private</span>
              </div>
              <div class="mono" style="font-size:11px;color:#858176;margin-top:8px;">0x1111111254fb6c44bac0bed2854e76f90643097d</div>
              <p style="font-size:11px;color:#9c988b;margin-top:6px;line-height:1.35;">Top market maker for 1inch and Uniswap V3.</p>
            </div>

            <!-- Card 2 -->
            <div style="background:#1b1b18;border:1px solid #302f28;border-radius:8px;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:13px;color:#fff;">Wintermute: Arbitrage Engine</strong>
                  <div style="font-size:11px;color:#ee6a42;margin-top:2px;">Entity: Wintermute · Hot Wallet</div>
                </div>
                <span class="tag-badge badge-private" style="font-size:9.5px;">Private</span>
              </div>
              <div class="mono" style="font-size:11px;color:#858176;margin-top:8px;">0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503</div>
              <p style="font-size:11px;color:#9c988b;margin-top:6px;line-height:1.35;">Active flash swap rebalancing bot.</p>
            </div>

            <!-- Card 3 -->
            <div style="background:#1b1b18;border:1px solid #302f28;border-radius:8px;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:13px;color:#fff;">Vitalik Buterin (vitalik.eth)</strong>
                  <div style="font-size:11px;color:#55c58d;margin-top:2px;">Entity: Vitalik Buterin · Founder</div>
                </div>
                <span class="tag-badge badge-verified" style="font-size:9.5px;">Verified</span>
              </div>
              <div class="mono" style="font-size:11px;color:#858176;margin-top:8px;">0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</div>
              <p style="font-size:11px;color:#9c988b;margin-top:6px;line-height:1.35;">Ethereum creator primary public identity.</p>
            </div>

            <!-- Card 4 -->
            <div style="background:#1b1b18;border:1px solid #302f28;border-radius:8px;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:13px;color:#fff;">Paradigm Capital: LP Vault</strong>
                  <div style="font-size:11px;color:#55c58d;margin-top:2px;">Entity: Paradigm · Treasury</div>
                </div>
                <span class="tag-badge badge-verified" style="font-size:9.5px;">Verified</span>
              </div>
              <div class="mono" style="font-size:11px;color:#858176;margin-top:8px;">0x7769647890bF5c531d0413A2c06F447883654199</div>
              <p style="font-size:11px;color:#9c988b;margin-top:6px;line-height:1.35;">Key liquidity provider across mainnet DEXes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

// -------------------------------------------------------------
// 8. SCREENSHOT 5: MULTI-CHAIN & ZERO-COMPROMISE PRIVACY (1280x800)
// -------------------------------------------------------------
const screenshot5Html = `
  <div style="width:1280px;height:800px;background:#0d0d0c;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <!-- Top Marketing Header -->
    <div class="slide-header">
      <div>
        <div class="slide-tag">FEATURE 05 // MULTI-CHAIN & PRIVACY</div>
        <h1 class="slide-title">Multi-Chain Support & Zero-Compromise Privacy</h1>
        <p class="slide-subtitle">Native support for EVM, Solana, and Bitcoin. No wallet connection required, zero tracking, private by design.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <!-- Center Stage: Real Bitcoin Explorer (Mempool) + Multi-Chain Grid + Privacy Pillars -->
    <div style="flex:1;margin:0 36px 28px;display:flex;flex-direction:column;gap:16px;">
      <!-- Top Half: Supported Chains & Live Detection Examples Over Real Mempool Background -->
      <div style="background:#161614;border:1px solid #2e2d28;border-radius:12px;padding:20px 24px;box-shadow:0 12px 30px rgba(0,0,0,0.5);position:relative;overflow:hidden;">
        <!-- Real Mempool / Bitcoin Explorer Backdrop -->
        <div style="position:absolute;inset:0;opacity:0.25;background-image:url('${mempoolBase64}');background-size:cover;background-position:center;filter:blur(1px);pointer-events:none;"></div>
        
        <div style="position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div>
            <h3 style="font-size:15px;font-weight:700;color:#ffffff;">Universal Blockchain Recognition</h3>
            <span style="font-size:12px;color:#8a867c;">TagAWallet recognizes addresses automatically across real EVM, Solana, and Bitcoin explorers</span>
          </div>
          <!-- Chain Logos / Pills -->
          <div style="display:flex;gap:6px;">
            <span style="background:#20201c;border:1px solid #33322b;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;color:#d5d1c5;">Ethereum</span>
            <span style="background:#20201c;border:1px solid #33322b;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;color:#d5d1c5;">Solana</span>
            <span style="background:#20201c;border:1px solid #33322b;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;color:#d5d1c5;">Bitcoin</span>
            <span style="background:#20201c;border:1px solid #33322b;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;color:#d5d1c5;">Base</span>
            <span style="background:#20201c;border:1px solid #33322b;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;color:#d5d1c5;">Arbitrum</span>
            <span style="background:#20201c;border:1px solid #33322b;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;color:#d5d1c5;">Polygon</span>
          </div>
        </div>

        <!-- 3 Live Detected Examples -->
        <div style="position:relative;z-index:2;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
          <!-- Ethereum -->
          <div style="background:#1b1b18;border:1px solid #2e2d27;border-radius:8px;padding:12px 14px;box-shadow:0 6px 16px rgba(0,0,0,0.4);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:700;color:#ee6a42;text-transform:uppercase;">ETHEREUM / EVM</span>
              <span class="tag-badge badge-verified" style="font-size:9.5px;">✓ Verified</span>
            </div>
            <div class="mono" style="font-size:11.5px;color:#efece3;font-weight:600;margin-top:6px;">0xd8dA6BF...6045</div>
            <div style="font-size:12px;color:#aba69a;margin-top:3px;">Vitalik Buterin (vitalik.eth)</div>
          </div>

          <!-- Solana -->
          <div style="background:#1b1b18;border:1px solid #2e2d27;border-radius:8px;padding:12px 14px;box-shadow:0 6px 16px rgba(0,0,0,0.4);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:700;color:#55c58d;text-transform:uppercase;">SOLANA</span>
              <span class="tag-badge badge-verified" style="font-size:9.5px;">✓ Verified</span>
            </div>
            <div class="mono" style="font-size:11.5px;color:#efece3;font-weight:600;margin-top:6px;">9WzDXwB...AWWM</div>
            <div style="font-size:12px;color:#aba69a;margin-top:3px;">Serum DEX Program Authority</div>
          </div>

          <!-- Bitcoin (Mempool) -->
          <div style="background:#1b1b18;border:1px solid #2e2d27;border-radius:8px;padding:12px 14px;box-shadow:0 6px 16px rgba(0,0,0,0.4);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:11px;font-weight:700;color:#dbab45;text-transform:uppercase;">BITCOIN</span>
              <span class="tag-badge badge-private" style="font-size:9.5px;">🔒 Private</span>
            </div>
            <div class="mono" style="font-size:11.5px;color:#efece3;font-weight:600;margin-top:6px;">bc1qgd76...7w2k</div>
            <div style="font-size:12px;color:#aba69a;margin-top:3px;">Satoshi Era Cold Storage</div>
          </div>
        </div>
      </div>

      <!-- Bottom Half: 4 Security & Privacy Pillars -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;flex:1;">
        <!-- Card 1 -->
        <div style="background:#161614;border:1px solid #2e2d28;border-radius:10px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:24px;margin-bottom:8px;">🛡️</div>
            <h4 style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:6px;">No Wallet Connect</h4>
            <p style="font-size:12px;color:#9c988b;line-height:1.45;">Tag and recognize wallets without connecting private keys or signing transactions.</p>
          </div>
          <span style="font-size:11px;font-weight:600;color:#55c58d;margin-top:10px;">100% Read-Only Safety</span>
        </div>

        <!-- Card 2 -->
        <div style="background:#161614;border:1px solid #2e2d28;border-radius:10px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:24px;margin-bottom:8px;">🔒</div>
            <h4 style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:6px;">Zero Invasive Perms</h4>
            <p style="font-size:12px;color:#9c988b;line-height:1.45;">Strict Manifest V3. No browsing history, no downloads, no cookies, no tracking.</p>
          </div>
          <span style="font-size:11px;font-weight:600;color:#55c58d;margin-top:10px;">Chrome Web Store Verified</span>
        </div>

        <!-- Card 3 -->
        <div style="background:#161614;border:1px solid #2e2d28;border-radius:10px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:24px;margin-bottom:8px;">☁️</div>
            <h4 style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:6px;">Encrypted Sync</h4>
            <p style="font-size:12px;color:#9c988b;line-height:1.45;">Your tags and notes sync securely across all your Chromium browsers and devices.</p>
          </div>
          <span style="font-size:11px;font-weight:600;color:#ee6a42;margin-top:10px;">Private Cloud Vault</span>
        </div>

        <!-- Card 4 -->
        <div style="background:#161614;border:1px solid #2e2d28;border-radius:10px;padding:18px;display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <div style="font-size:24px;margin-bottom:8px;">⚡</div>
            <h4 style="font-size:14px;font-weight:700;color:#ffffff;margin-bottom:6px;">Lightweight Engine</h4>
            <p style="font-size:12px;color:#9c988b;line-height:1.45;">Sub-millisecond regex parsing with zero browser lag or memory bloat.</p>
          </div>
          <span style="font-size:11px;font-weight:600;color:#dbab45;margin-top:10px;">60 FPS Smooth Scrolling</span>
        </div>
      </div>
    </div>
  </div>
`;

async function main() {
  console.log("Generating Chrome Web Store marketing assets using REAL websites...");
  const browser = await chromium.launch({ headless: true });

  const tasks = [
    { width: 128, height: 128, html: icon128Html, filename: "icon-128" },
    { width: 440, height: 280, html: promoSmallHtml, filename: "promo-small-440x280" },
    { width: 1400, height: 560, html: promoMarqueeHtml, filename: "promo-marquee-1400x560" },
    { width: 1280, height: 800, html: screenshot1Html, filename: "screenshot-1-identity" },
    { width: 1280, height: 800, html: screenshot2Html, filename: "screenshot-2-side-panel" },
    { width: 1280, height: 800, html: screenshot3Html, filename: "screenshot-3-quick-tag" },
    { width: 1280, height: 800, html: screenshot4Html, filename: "screenshot-4-address-book" },
    { width: 1280, height: 800, html: screenshot5Html, filename: "screenshot-5-multichain-privacy" },
  ];

  for (const task of tasks) {
    await renderPage(browser, task);
  }

  await browser.close();
  console.log("All real-website Chrome Web Store assets generated successfully!");
}

main().catch((err) => {
  console.error("Error generating assets:", err);
  process.exit(1);
});
