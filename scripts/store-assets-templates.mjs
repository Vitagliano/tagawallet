import { COMMON_CSS, LOGO_SVG } from "./generate-assets-common.mjs";

export const TAG_ICON_SVG = `
  <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor">
    <path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4c.4 0 .8.16 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9V4.5Z" />
  </svg>
`;

export const EXTENSION_STYLE = `
  ${COMMON_CSS}
  
  /* Etherscan Specific Real Styles */
  .es-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    text-align: left;
  }
  .es-table th {
    padding: 10px 12px;
    color: #7b8b9e;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-bottom: 1px solid #1f2f42;
    background: #0f1924;
  }
  .es-table td {
    padding: 12px 12px;
    border-bottom: 1px solid #182535;
    color: #c9d6e5;
    vertical-align: middle;
  }
  .es-link {
    color: #3b82f6;
    text-decoration: none;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11.5px;
  }
  .es-link:hover { text-decoration: underline; }
  .es-method {
    display: inline-block;
    padding: 2px 8px;
    background: #182738;
    border: 1px solid #283e57;
    border-radius: 4px;
    font-size: 10.5px;
    color: #a3b8cc;
    font-weight: 500;
  }
  .es-pill-in {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid #10b981;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }
  .es-pill-out {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid #ef4444;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }

  /* DexScreener Specific Real Styles */
  .dex-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11.5px;
    text-align: left;
  }
  .dex-table th {
    padding: 8px 10px;
    color: #6b7280;
    font-size: 10.5px;
    font-weight: 600;
    text-transform: uppercase;
    border-bottom: 1px solid #1f2937;
    background: #111827;
  }
  .dex-table td {
    padding: 9px 10px;
    border-bottom: 1px solid #17202f;
    color: #d1d5db;
  }
  .dex-buy { color: #10b981; font-weight: 600; }
  .dex-sell { color: #ef4444; font-weight: 600; }

  /* Twitter Specific Real Styles */
  .tweet-card {
    padding: 14px 16px;
    border-bottom: 1px solid #2f3336;
    display: flex;
    gap: 12px;
  }
  .tweet-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    flex-shrink: 0;
    background: #272c30;
    display: grid;
    place-items: center;
    font-weight: 700;
    color: #fff;
  }
  .tweet-header {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
  }
  .tweet-name { font-weight: 700; color: #e7e9ea; }
  .tweet-handle { color: #71767b; font-size: 13.5px; }
  .tweet-body {
    margin-top: 5px;
    font-size: 14px;
    line-height: 1.45;
    color: #e7e9ea;
  }

  /* Real TagAWallet Injected Chip */
  .taw-chip {
    display: inline-flex;
    vertical-align: middle;
    margin-left: 4px;
  }
  .taw-btn {
    all: unset;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 220px;
    padding: 0 6px;
    line-height: 16px;
    height: 18px;
    border-radius: 4px;
    font: 500 11px/16px ui-sans-serif, system-ui, -apple-system, sans-serif;
    cursor: pointer;
    border: 1px solid #33322c;
    background: #1c1c19;
    color: #efece3;
    white-space: nowrap;
  }
  .taw-btn.verified {
    border-color: #1b7a4a;
    color: #55c58d;
    background: rgba(27, 122, 74, 0.12);
  }
  .taw-btn.private {
    border-color: #c8421b;
    color: #ee6a42;
    background: rgba(238, 106, 66, 0.12);
  }
  .taw-btn.watchlist {
    border-color: #9a6a00;
    color: #dbab45;
    background: rgba(219, 171, 69, 0.12);
  }
  .taw-btn.unknown {
    width: 18px;
    padding: 0;
    justify-content: center;
    color: #8c887c;
    border: 1px dashed #4d4a42;
    background: transparent;
  }
`;

export const PAGES = [
  {
    id: "screenshot-1-identity",
    title: "1. Etherscan Recognition",
    width: 1280,
    height: 800,
    desc: "Etherscan transactions table with inline verified, private and unknown tags + floating card",
    html: `
  <div style="width:1280px;height:800px;background:#0b1118;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <div class="slide-header">
      <div>
        <div class="slide-tag">FEATURE 01 // ETHERSCAN RECOGNITION</div>
        <h1 class="slide-title">Identify Wallets Instantly on Etherscan</h1>
        <p class="slide-subtitle">Turn anonymous 0x hex addresses into recognized entities and private tags directly in your Etherscan tables.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <div style="flex:1;margin:0 36px 28px;position:relative;" class="browser-frame">
      <div class="browser-titlebar" style="background:#090f17;border-bottom:1px solid #1a2838;">
        <div class="window-dots">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="browser-tabs">
          <div class="browser-tab" style="background:#111b27;border-color:#1e2f42;color:#e2e8f0;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#3b82f6" style="margin-right:4px;"><path d="M12 2 4.5 14.5 12 19l7.5-4.5L12 2Z"/></svg>
            <span>Ethereum Transactions | Etherscan</span>
          </div>
          <div class="browser-tab inactive"><span>dexscreener.com</span></div>
          <div class="browser-tab inactive"><span>x.com</span></div>
        </div>
      </div>

      <div class="browser-addressbar" style="background:#0c141e;border-bottom:1px solid #1a2838;">
        <div class="nav-btns"><span>←</span> <span>→</span> <span>↻</span></div>
        <div class="url-input" style="background:#070c12;border-color:#1c2c3e;">
          <span style="color:#10b981;">🔒</span>
          <span>https://</span><strong style="color:#60a5fa;">etherscan.io</strong><span>/txs</span>
        </div>
        <div class="ext-bar">
          <div class="ext-icon-active" style="border-color:#ee6a42;">
            ${LOGO_SVG(16, "dark")}
          </div>
        </div>
      </div>

      <div style="flex:1;background:#0d141e;padding:16px 20px;position:relative;overflow:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:1px solid #1c2b3d;">
          <div>
            <h2 style="font-size:15px;font-weight:700;color:#f1f5f9;">Transactions</h2>
            <span style="font-size:11.5px;color:#64748b;">Showing latest transactions on Ethereum Mainnet</span>
          </div>
          <div style="display:flex;gap:14px;font-size:11px;color:#94a3b8;">
            <span>Gas: <strong style="color:#10b981;">18 Gwei</strong></span>
            <span>ETH Price: <strong style="color:#f1f5f9;">$3,420.50</strong></span>
          </div>
        </div>

        <table class="es-table" style="margin-top:10px;">
          <thead>
            <tr>
              <th>Txn Hash</th>
              <th>Method</th>
              <th>Block</th>
              <th>From</th>
              <th></th>
              <th>To</th>
              <th>Value</th>
              <th>Txn Fee</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><span class="es-link">0x9e8f5c...3a1c</span></td>
              <td><span class="es-method">Transfer</span></td>
              <td><span class="es-link">21148920</span></td>
              <td>
                <span class="es-link">0xd8dA6B...6045</span>
                <span class="taw-chip"><button class="taw-btn verified">✓ Vitalik Buterin</button></span>
              </td>
              <td><span class="es-pill-in">IN</span></td>
              <td>
                <span class="es-link">0x1f9840...f984</span>
                <span class="taw-chip"><button class="taw-btn verified">✓ Uniswap: Treasury</button></span>
              </td>
              <td style="font-weight:600;color:#f8fafc;">320.00 ETH</td>
              <td style="color:#64748b;">0.0014 ETH</td>
            </tr>

            <tr style="background:rgba(238,106,66,0.06);">
              <td><span class="es-link">0x4b721e...89d1</span></td>
              <td><span class="es-method">Multicall</span></td>
              <td><span class="es-link">21148919</span></td>
              <td>
                <span class="es-link" style="font-weight:700;color:#93c5fd;">0x776964...4199</span>
                <span class="taw-chip"><button class="taw-btn verified" style="outline:2px solid #55c58d;outline-offset:1px;">✓ Paradigm Capital</button></span>
              </td>
              <td><span class="es-pill-out">OUT</span></td>
              <td>
                <span class="es-link">0x3fC91A...7FAD</span>
                <span class="taw-chip"><button class="taw-btn verified">✓ Uniswap V3: Router</button></span>
              </td>
              <td style="font-weight:600;color:#f8fafc;">1,250,000 USDC</td>
              <td style="color:#64748b;">0.0042 ETH</td>
            </tr>

            <tr>
              <td><span class="es-link">0x2c1589...6f44</span></td>
              <td><span class="es-method">Swap Exact</span></td>
              <td><span class="es-link">21148918</span></td>
              <td>
                <span class="es-link">0x47ac0f...d503</span>
                <span class="taw-chip"><button class="taw-btn private">Wintermute Arb</button></span>
              </td>
              <td><span class="es-pill-out">OUT</span></td>
              <td>
                <span class="es-link">0xdAc17F...1ec7</span>
                <span class="taw-chip"><button class="taw-btn verified">✓ Tether USD</button></span>
              </td>
              <td style="font-weight:600;color:#f8fafc;">45.80 ETH</td>
              <td style="color:#64748b;">0.0089 ETH</td>
            </tr>

            <tr>
              <td><span class="es-link">0x7a31b4...11cb</span></td>
              <td><span class="es-method">Deposit</span></td>
              <td><span class="es-link">21148917</span></td>
              <td>
                <span class="es-link">0x5aAeb6...bAed</span>
                <span class="taw-chip"><button class="taw-btn watchlist">Alice's Vault</button></span>
              </td>
              <td><span class="es-pill-in">IN</span></td>
              <td>
                <span class="es-link">0x28C6c0...1d60</span>
                <span class="taw-chip"><button class="taw-btn verified">✓ Binance 14</button></span>
              </td>
              <td style="font-weight:600;color:#f8fafc;">12.50 ETH</td>
              <td style="color:#64748b;">0.0008 ETH</td>
            </tr>

            <tr>
              <td><span class="es-link">0x1e902f...4f88</span></td>
              <td><span class="es-method">Mint</span></td>
              <td><span class="es-link">21148916</span></td>
              <td>
                <span class="es-link" style="color:#94a3b8;">0xdbF03B...C6FB</span>
                <span class="taw-chip"><button class="taw-btn unknown" title="Tag this wallet">${TAG_ICON_SVG}</button></span>
              </td>
              <td><span class="es-pill-in">IN</span></td>
              <td>
                <span class="es-link">0xBC4CA0...f13D</span>
                <span class="taw-chip"><button class="taw-btn verified">✓ Bored Ape YC</button></span>
              </td>
              <td style="font-weight:600;color:#f8fafc;">2.00 ETH</td>
              <td style="color:#64748b;">0.0021 ETH</td>
            </tr>
          </tbody>
        </table>

        <div style="position:absolute;top:175px;left:270px;width:370px;background:#1c1c19;border:1px solid #3c3b33;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.06);padding:16px;z-index:30;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:34px;height:34px;border-radius:8px;background:#2a2924;border:1px solid #3a3932;display:grid;place-items:center;font-weight:800;color:#ffffff;font-size:14px;">
                P
              </div>
              <div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="font-size:15px;font-weight:700;color:#ffffff;">Paradigm Capital</span>
                  <span class="taw-btn verified" style="font-size:10px;height:18px;">✓ Verified</span>
                </div>
                <span style="font-size:11px;color:#9c988b;">Role: Treasury & Liquidity Deployer</span>
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
            Lead investor for Uniswap & Blur. Monitored for large liquidity rebalances on mainnet pools.
          </div>

          <div style="margin-top:14px;display:flex;gap:8px;">
            <button style="flex:1;height:28px;background:#ee6a42;border:none;border-radius:6px;font-size:11.5px;font-weight:600;color:#ffffff;cursor:pointer;">Edit Tag</button>
            <button style="flex:1;height:28px;background:#24231f;border:1px solid #35342d;border-radius:6px;font-size:11.5px;font-weight:500;color:#e8e5db;cursor:pointer;">Etherscan ↗</button>
          </div>
        </div>

        <div style="position:absolute;bottom:20px;right:24px;background:#181816;border:1px solid #ee6a42;border-radius:30px;padding:8px 18px;display:flex;align-items:center;gap:10px;box-shadow:0 12px 30px rgba(0,0,0,0.7);z-index:30;">
          <span style="color:#ee6a42;font-size:16px;">⚡</span>
          <span style="font-size:12.5px;font-weight:600;color:#ffffff;">Chips inject beside addresses automatically across Etherscan tables</span>
        </div>
      </div>
    </div>
  </div>
    `
  },
  {
    id: "screenshot-2-dexscreener",
    title: "2. DexScreener Live Swaps",
    width: 1280,
    height: 800,
    desc: "DexScreener live transactions table streaming buys/sells with TagAWallet maker labels",
    html: `
  <div style="width:1280px;height:800px;background:#0d1117;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <div class="slide-header">
      <div>
        <div class="slide-tag">FEATURE 02 // DEXSCREENER RECOGNITION</div>
        <h1 class="slide-title">Spot Whales & Market Makers on DexScreener</h1>
        <p class="slide-subtitle">See who is executing trades, swaps, and arbitrage in live DEX liquidity pools with TagAWallet maker labels.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <div style="flex:1;margin:0 36px 28px;position:relative;" class="browser-frame">
      <div class="browser-titlebar" style="background:#0b0f14;border-bottom:1px solid #1a232f;">
        <div class="window-dots">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="browser-tabs">
          <div class="browser-tab" style="background:#111823;border-color:#1e2d3d;color:#e2e8f0;">
            <span style="color:#10b981;font-weight:800;margin-right:4px;">🦅</span>
            <span>WETH / USDC - Uniswap V3 | DexScreener</span>
          </div>
          <div class="browser-tab inactive"><span>etherscan.io</span></div>
        </div>
      </div>

      <div class="browser-addressbar" style="background:#0e141c;border-bottom:1px solid #1a232f;">
        <div class="nav-btns"><span>←</span> <span>→</span> <span>↻</span></div>
        <div class="url-input" style="background:#090d12;border-color:#1a2736;">
          <span style="color:#10b981;">🔒</span>
          <span>https://</span><strong style="color:#38bdf8;">dexscreener.com</strong><span>/ethereum/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640</span>
        </div>
        <div class="ext-bar">
          <div class="ext-icon-active" style="border-color:#ee6a42;">
            ${LOGO_SVG(16, "dark")}
          </div>
        </div>
      </div>

      <div style="flex:1;background:#0d131a;display:flex;flex-direction:column;overflow:hidden;position:relative;">
        <div style="padding:10px 16px;background:#111822;border-bottom:1px solid #1b2838;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:15px;font-weight:800;color:#ffffff;">WETH / USDC</span>
            <span style="font-size:11px;background:#1f2937;color:#9ca3af;padding:2px 6px;border-radius:4px;">Uniswap V3</span>
            <span style="font-size:16px;font-weight:800;color:#10b981;">$3,420.50</span>
            <span style="font-size:11.5px;color:#10b981;font-weight:600;">+4.25%</span>
          </div>
          <div style="display:flex;gap:16px;font-size:11.5px;color:#94a3b8;">
            <span>24h Vol: <strong style="color:#ffffff;">$184.2M</strong></span>
            <span>Liquidity: <strong style="color:#ffffff;">$94.5M</strong></span>
            <span>FDV: <strong style="color:#ffffff;">$410.5B</strong></span>
          </div>
        </div>

        <div style="padding:8px 16px;background:#0f151e;border-bottom:1px solid #1a2533;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:12px;font-weight:700;color:#ffffff;background:#1f2937;padding:3px 10px;border-radius:4px;">Live Transactions</span>
            <span style="font-size:11.5px;color:#6b7280;cursor:pointer;">Top Traders</span>
            <span style="font-size:11.5px;color:#6b7280;cursor:pointer;">Liquidity</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:11px;">
            <span style="color:#10b981;background:rgba(16,185,129,0.12);border:1px solid #10b981;padding:2px 8px;border-radius:4px;font-weight:600;">Streaming Real-Time</span>
          </div>
        </div>

        <table class="dex-table" style="flex:1;">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>USD Value</th>
              <th>WETH</th>
              <th>USDC</th>
              <th>Price</th>
              <th>Maker (Wallet)</th>
              <th>Txn</th>
            </tr>
          </thead>
          <tbody>
            <tr style="background:rgba(16,185,129,0.04);">
              <td style="color:#9ca3af;">12s ago</td>
              <td><span class="dex-buy">BUY</span></td>
              <td style="font-weight:700;color:#fff;">$85,512</td>
              <td>25.00</td>
              <td>85,512</td>
              <td>$3,420.50</td>
              <td>
                <span class="mono" style="color:#60a5fa;">0x47ac...d503</span>
                <span class="taw-chip"><button class="taw-btn private">Wintermute Arb</button></span>
              </td>
              <td><span class="es-link">0x9a4f...</span></td>
            </tr>

            <tr style="background:rgba(239,68,68,0.04);">
              <td style="color:#9ca3af;">34s ago</td>
              <td><span class="dex-sell">SELL</span></td>
              <td style="font-weight:700;color:#fff;">$342,050</td>
              <td>100.00</td>
              <td>342,050</td>
              <td>$3,420.50</td>
              <td>
                <span class="mono" style="color:#60a5fa;">0xd8dA...6045</span>
                <span class="taw-chip"><button class="taw-btn verified">✓ Vitalik Buterin</button></span>
              </td>
              <td><span class="es-link">0x3b1c...</span></td>
            </tr>

            <tr style="background:rgba(16,185,129,0.04);">
              <td style="color:#9ca3af;">1m ago</td>
              <td><span class="dex-buy">BUY</span></td>
              <td style="font-weight:700;color:#fff;">$120,400</td>
              <td>35.20</td>
              <td>120,400</td>
              <td>$3,420.45</td>
              <td>
                <span class="mono" style="color:#60a5fa;">0x5aAe...bAed</span>
                <span class="taw-chip"><button class="taw-btn watchlist">Alice's Whale Vault</button></span>
              </td>
              <td><span class="es-link">0x7c2d...</span></td>
            </tr>

            <tr style="background:rgba(16,185,129,0.04);">
              <td style="color:#9ca3af;">2m ago</td>
              <td><span class="dex-buy">BUY</span></td>
              <td style="font-weight:700;color:#fff;">$513,075</td>
              <td>150.00</td>
              <td>513,075</td>
              <td>$3,420.50</td>
              <td>
                <span class="mono" style="color:#60a5fa;">0x7769...4199</span>
                <span class="taw-chip"><button class="taw-btn verified">✓ Paradigm Capital</button></span>
              </td>
              <td><span class="es-link">0x11ab...</span></td>
            </tr>

            <tr>
              <td style="color:#9ca3af;">3m ago</td>
              <td><span class="dex-sell">SELL</span></td>
              <td style="font-weight:700;color:#fff;">$15,392</td>
              <td>4.50</td>
              <td>15,392</td>
              <td>$3,420.40</td>
              <td>
                <span class="mono" style="color:#9ca3af;">0x388C...1127</span>
                <span class="taw-chip"><button class="taw-btn unknown">${TAG_ICON_SVG}</button></span>
              </td>
              <td><span class="es-link">0x88ee...</span></td>
            </tr>
          </tbody>
        </table>

        <div style="position:absolute;top:60px;right:20px;width:340px;background:#181815;border:1px solid #302f28;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,0.85);padding:14px;z-index:20;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;">
              ${LOGO_SVG(20, "dark")}
              <span style="font-size:14px;font-weight:700;color:#fff;">TagAWallet Scanner</span>
            </div>
            <span style="font-size:10.5px;color:#55c58d;background:rgba(27,122,74,0.18);padding:1px 6px;border-radius:4px;">5 Wallets Found</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <div style="background:#1e1e1a;padding:7px 10px;border-radius:6px;display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:12px;font-weight:600;color:#fff;">Wintermute Trading</span>
              <span class="taw-btn private" style="font-size:9.5px;height:16px;">Hot Wallet</span>
            </div>
            <div style="background:#1e1e1a;padding:7px 10px;border-radius:6px;display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:12px;font-weight:600;color:#fff;">Vitalik Buterin</span>
              <span class="taw-btn verified" style="font-size:9.5px;height:16px;">✓ Verified</span>
            </div>
            <div style="background:#1e1e1a;padding:7px 10px;border-radius:6px;display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:12px;font-weight:600;color:#fff;">Alice's Whale Vault</span>
              <span class="taw-btn watchlist" style="font-size:9.5px;height:16px;">Watchlist</span>
            </div>
          </div>
        </div>

        <div style="position:absolute;bottom:16px;left:20px;background:#181816;border:1px solid #ee6a42;border-radius:30px;padding:6px 14px;display:flex;align-items:center;gap:8px;box-shadow:0 8px 24px rgba(0,0,0,0.6);z-index:20;">
          <span style="color:#ee6a42;">⚡</span>
          <span style="font-size:11.5px;font-weight:600;color:#fff;">TagAWallet labels DEX makers & bots in real time</span>
        </div>
      </div>
    </div>
  </div>
    `
  },
  {
    id: "screenshot-3-twitter",
    title: "3. Twitter / X Detection",
    width: 1280,
    height: 800,
    desc: "Crypto Twitter feed detecting addresses in tweets and whale alerts",
    html: `
  <div style="width:1280px;height:800px;background:#000000;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <div class="slide-header">
      <div>
        <div class="slide-tag" style="background:rgba(29,155,240,0.12);border-color:rgba(29,155,240,0.35);color:#1d9bf0;">FEATURE 03 // TWITTER / X DETECTION</div>
        <h1 class="slide-title">Recognize Wallets Across Crypto Twitter / X</h1>
        <p class="slide-subtitle">Never guess who is behind an address posted in a tweet, announcement, or bio. TagAWallet recognizes them automatically.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <div style="flex:1;margin:0 36px 28px;position:relative;" class="browser-frame">
      <div class="browser-titlebar" style="background:#000000;border-bottom:1px solid #2f3336;">
        <div class="window-dots">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="browser-tabs">
          <div class="browser-tab" style="background:#16181c;border-color:#2f3336;color:#e7e9ea;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#ffffff" style="margin-right:4px;"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span>Home / X</span>
          </div>
          <div class="browser-tab inactive"><span>etherscan.io</span></div>
        </div>
      </div>

      <div class="browser-addressbar" style="background:#000000;border-bottom:1px solid #2f3336;">
        <div class="nav-btns"><span>←</span> <span>→</span> <span>↻</span></div>
        <div class="url-input" style="background:#16181c;border-color:#2f3336;">
          <span style="color:#10b981;">🔒</span>
          <span>https://</span><strong style="color:#e7e9ea;">x.com</strong><span>/home</span>
        </div>
        <div class="ext-bar">
          <div class="ext-icon-active" style="border-color:#ee6a42;">
            ${LOGO_SVG(16, "dark")}
          </div>
        </div>
      </div>

      <div style="flex:1;background:#000000;display:flex;justify-content:center;overflow:hidden;position:relative;">
        <div style="width:640px;border-left:1px solid #2f3336;border-right:1px solid #2f3336;background:#000000;display:flex;flex-direction:column;">
          <div style="height:48px;border-bottom:1px solid #2f3336;display:flex;align-items:center;padding:0 20px;">
            <span style="font-size:15px;font-weight:700;color:#ffffff;border-bottom:4px solid #1d9bf0;padding-bottom:12px;">Following</span>
          </div>

          <div class="tweet-card">
            <div class="tweet-avatar" style="background:#27435f;color:#60a5fa;">V</div>
            <div style="flex:1;">
              <div class="tweet-header">
                <span class="tweet-name">vitalik.eth</span>
                <span style="color:#1d9bf0;font-size:13px;">✓</span>
                <span class="tweet-handle">@VitalikButerin · 2h</span>
              </div>
              <div class="tweet-body">
                Testing a new multi-sig recovery setup. Please send all test donations and grants to primary address:
                <div style="margin-top:6px;padding:6px 10px;background:#16181c;border:1px solid #2f3336;border-radius:6px;display:inline-flex;align-items:center;">
                  <span class="mono" style="color:#1d9bf0;font-size:12px;">0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</span>
                  <span class="taw-chip"><button class="taw-btn verified">✓ Vitalik Buterin</button></span>
                </div>
              </div>
            </div>
          </div>

          <div class="tweet-card" style="background:rgba(238,106,66,0.03);">
            <div class="tweet-avatar" style="background:#ee6a42;color:#ffffff;">🚨</div>
            <div style="flex:1;">
              <div class="tweet-header">
                <span class="tweet-name">Whale Alert</span>
                <span style="color:#1d9bf0;font-size:13px;">✓</span>
                <span class="tweet-handle">@whale_alert · 45m</span>
              </div>
              <div class="tweet-body">
                🚨 10,000 ETH ($34,200,000 USD) transferred from
                <span class="mono" style="color:#1d9bf0;">0x776964...4199</span>
                <span class="taw-chip"><button class="taw-btn verified" style="outline:2px solid #55c58d;">✓ Paradigm Capital</button></span>
                to
                <span class="mono" style="color:#1d9bf0;">0x28C6c0...1d60</span>
                <span class="taw-chip"><button class="taw-btn verified">✓ Binance 14</button></span>
              </div>
            </div>
          </div>

          <div class="tweet-card">
            <div class="tweet-avatar" style="background:#1f2937;color:#fff;">W</div>
            <div style="flex:1;">
              <div class="tweet-header">
                <span class="tweet-name">Wintermute</span>
                <span style="color:#1d9bf0;font-size:13px;">✓</span>
                <span class="tweet-handle">@wintermute_t · 4h</span>
              </div>
              <div class="tweet-body">
                Our automated liquidity provision engine is now fully active across Arbitrum and Base via router
                <span class="mono" style="color:#1d9bf0;">0x47ac0f...d503</span>
                <span class="taw-chip"><button class="taw-btn private">Wintermute Arb</button></span>
              </div>
            </div>
          </div>
        </div>

        <div style="position:absolute;top:200px;right:40px;width:340px;background:#1c1c19;border:1px solid #3c3b33;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,0.85);padding:16px;z-index:20;">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div style="display:flex;align-items:center;gap:8px;">
              <div style="width:30px;height:30px;border-radius:6px;background:#2a2924;display:grid;place-items:center;font-weight:700;color:#fff;">P</div>
              <div>
                <div style="font-size:14px;font-weight:700;color:#fff;">Paradigm Capital</div>
                <div style="font-size:11px;color:#55c58d;">✓ Verified Entity · Treasury</div>
              </div>
            </div>
            <span style="font-size:10px;color:#ee6a42;background:rgba(238,106,66,0.15);padding:2px 6px;border-radius:4px;">EVM</span>
          </div>
          <div style="margin-top:10px;background:#141412;padding:6px 8px;border-radius:6px;border:1px solid #282722;">
            <span class="mono" style="font-size:11px;color:#d5d1c5;">0x7769647890bF5c531d0413A2c06F447883654199</span>
          </div>
          <p style="margin-top:8px;font-size:11px;color:#a49f92;line-height:1.4;">
            Lead venture backer. Transferred 10,000 ETH to Binance 14 for market liquidity.
          </p>
          <div style="margin-top:10px;display:flex;gap:6px;">
            <button style="flex:1;height:26px;background:#ee6a42;border:none;border-radius:6px;font-size:11px;font-weight:600;color:#fff;">View Entity</button>
            <button style="flex:1;height:26px;background:#24231f;border:1px solid #35342d;border-radius:6px;font-size:11px;color:#d5d1c5;">Add Note</button>
          </div>
        </div>
      </div>
    </div>
  </div>
    `
  },
  {
    id: "screenshot-4-quick-tag",
    title: "4. Quick Tag Modal",
    width: 1280,
    height: 800,
    desc: "1-Click Quick Tag modal with entity grouping, role selection, status pills, and private notes",
    html: `
  <div style="width:1280px;height:800px;background:#0d1118;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <div class="slide-header">
      <div>
        <div class="slide-tag">FEATURE 04 // 1-CLICK QUICK TAGGING</div>
        <h1 class="slide-title">Privately Tag & Categorize Any Wallet</h1>
        <p class="slide-subtitle">Assign custom names, group multiple addresses under entities, add private notes, and organize into team watchlists.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <div style="flex:1;margin:0 36px 28px;position:relative;display:flex;align-items:center;justify-content:center;" class="browser-frame">
      <div class="browser-titlebar" style="position:absolute;top:0;left:0;right:0;background:#090f17;border-bottom:1px solid #1a2838;">
        <div class="window-dots">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="browser-tabs">
          <div class="browser-tab" style="background:#111b27;border-color:#1e2f42;color:#e2e8f0;">
            <span>etherscan.io / Tagging Wallet</span>
          </div>
        </div>
      </div>

      <div style="position:absolute;inset:38px 0 0 0;background:#0d141e;opacity:0.65;filter:blur(2px);"></div>

      <div style="position:relative;z-index:10;width:480px;background:#1a1a17;border:1px solid #3c3a32;border-radius:14px;box-shadow:0 30px 90px rgba(0,0,0,0.85), 0 0 0 1px rgba(238,106,66,0.2);overflow:hidden;">
        <div style="padding:16px 20px 12px;border-bottom:1px solid #2c2b25;display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:28px;height:28px;border-radius:6px;background:rgba(238,106,66,0.15);border:1px solid #c8421b;display:grid;place-items:center;">
              ${LOGO_SVG(16, "dark")}
            </div>
            <h2 style="font-size:16px;font-weight:700;color:#ffffff;">Tag this wallet</h2>
          </div>
          <span style="font-size:11px;font-weight:600;color:#55c58d;background:rgba(27,122,74,0.15);padding:2px 8px;border-radius:99px;border:1px solid #1b7a4a;">Private to you</span>
        </div>

        <div style="padding:18px 20px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;justify-content:space-between;background:#141412;border:1px solid #282721;border-radius:6px;padding:8px 12px;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span style="font-size:11px;color:#7e7b72;">Address:</span>
              <span class="mono" style="font-size:12px;color:#ffffff;font-weight:600;">0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503</span>
            </div>
            <span style="font-size:11px;background:#24231e;border:1px solid #35342d;padding:2px 7px;border-radius:4px;color:#d5d1c5;">Ethereum</span>
          </div>

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

          <div>
            <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:4px;">Name for this address</label>
            <div style="background:#141412;border:1px solid #ee6a42;border-radius:6px;padding:7px 10px;font-size:13px;color:#ffffff;font-weight:500;">
              Wintermute: High-Freq Arb Engine #1
            </div>
          </div>

          <div>
            <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:6px;">Status Classification</label>
            <div style="display:flex;gap:6px;">
              <span style="background:#22211c;border:1px solid #36352d;color:#8f8b80;padding:4px 10px;border-radius:99px;font-size:11.5px;">Mine</span>
              <span style="background:#22211c;border:1px solid #36352d;color:#8f8b80;padding:4px 10px;border-radius:99px;font-size:11.5px;">Trusted</span>
              <span style="background:rgba(219,171,69,0.18);border:1px solid #9a6a00;color:#dbab45;padding:4px 10px;border-radius:99px;font-size:11.5px;font-weight:600;">✓ Watchlist</span>
              <span style="background:#22211c;border:1px solid #36352d;color:#8f8b80;padding:4px 10px;border-radius:99px;font-size:11.5px;">Scam</span>
            </div>
          </div>

          <div>
            <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:4px;">Also in a list</label>
            <div style="background:#141412;border:1px solid #302f28;border-radius:6px;padding:7px 10px;font-size:12.5px;color:#ffffff;">
              📁 DeFi Market Makers & HFT (shared)
            </div>
          </div>

          <div>
            <label style="display:block;font-size:11.5px;font-weight:600;color:#a8a395;margin-bottom:4px;">Private Notes</label>
            <div style="background:#141412;border:1px solid #302f28;border-radius:6px;padding:8px 10px;font-size:12px;color:#c9c5b9;line-height:1.4;">
              Active on Uniswap V3 ETH/USDC 5bps pool. Very high priority gas fees. Monitors for flash swap rebalances.
            </div>
          </div>

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

      <div style="position:absolute;bottom:24px;left:40px;background:#181816;border:1px solid #33322b;border-radius:10px;padding:12px 18px;display:flex;align-items:center;gap:12px;box-shadow:0 12px 30px rgba(0,0,0,0.6);">
        <div style="font-size:20px;">🔒</div>
        <div>
          <div style="font-size:12.5px;font-weight:700;color:#ffffff;">100% Client-Side Privacy</div>
          <div style="font-size:11px;color:#9c988b;">Tags and notes are encrypted and never exposed to the public.</div>
        </div>
      </div>
    </div>
  </div>
    `
  },
  {
    id: "screenshot-5-address-book",
    title: "5. Address Book & Library",
    width: 1280,
    height: 800,
    desc: "Side Panel Library view with curated watchlists and shared team notebooks",
    html: `
  <div style="width:1280px;height:800px;background:#0d1118;display:flex;flex-direction:column;position:relative;overflow:hidden;">
    <div class="slide-header">
      <div>
        <div class="slide-tag">FEATURE 05 // ADDRESS BOOK & WATCHLISTS</div>
        <h1 class="slide-title">Your Private Web3 Address Book Everywhere</h1>
        <p class="slide-subtitle">Group addresses into custom watchlists, share notebooks with your team, and search across Ethereum, Solana, and Bitcoin.</p>
      </div>
      <div class="slide-brand">
        ${LOGO_SVG(26, "dark")}
        TagAWallet
      </div>
    </div>

    <div style="flex:1;margin:0 36px 28px;position:relative;" class="browser-frame">
      <div class="browser-titlebar" style="background:#090f17;border-bottom:1px solid #1a2838;">
        <div class="window-dots">
          <span class="window-dot dot-red"></span>
          <span class="window-dot dot-yellow"></span>
          <span class="window-dot dot-green"></span>
        </div>
        <div class="browser-tabs">
          <div class="browser-tab" style="background:#111b27;border-color:#1e2f42;color:#e2e8f0;">
            <span>TagAWallet / Library & Watchlists</span>
          </div>
        </div>
      </div>

      <div class="browser-addressbar" style="background:#0c141e;border-bottom:1px solid #1a2838;">
        <div class="nav-btns"><span>←</span> <span>→</span> <span>↻</span></div>
        <div class="url-input" style="background:#070c12;border-color:#1c2c3e;">
          <span style="color:#10b981;">🔒</span>
          <span>chrome-extension://</span><strong style="color:#60a5fa;">tagawallet</strong><span>/panel.html#library</span>
        </div>
        <div class="ext-bar">
          <div class="ext-icon-active" style="border-color:#ee6a42;">
            ${LOGO_SVG(16, "dark")}
          </div>
        </div>
      </div>

      <div style="flex:1;background:#141412;display:flex;overflow:hidden;">
        <div style="width:360px;background:#181815;border-right:1px solid #2a2923;padding:14px;display:flex;flex-direction:column;gap:12px;">
          <div style="background:#121210;border:1px solid #2e2d27;border-radius:8px;padding:7px 12px;display:flex;align-items:center;gap:8px;">
            <span style="color:#6d6a60;font-size:12px;">🔍</span>
            <input placeholder="Search contacts, lists, entities..." style="background:transparent;border:none;color:#efece3;font-size:12px;outline:none;width:100%;font-family:inherit;" value="" />
          </div>

          <div>
            <div style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#858176;margin-bottom:8px;">
              Your Lists
            </div>
            <div style="display:flex;flex-direction:column;gap:6px;">
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

        <div style="flex:1;padding:20px 24px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;background:#141412;">
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

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="background:#1b1b18;border:1px solid #302f28;border-radius:8px;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:13px;color:#fff;">Jump Trading: High-Freq #1</strong>
                  <div style="font-size:11px;color:#ee6a42;margin-top:2px;">Entity: Jump Crypto · Arbitrage</div>
                </div>
                <span class="taw-btn private" style="font-size:9.5px;">Private</span>
              </div>
              <div class="mono" style="font-size:11px;color:#858176;margin-top:8px;">0x1111111254fb6c44bac0bed2854e76f90643097d</div>
              <p style="font-size:11px;color:#9c988b;margin-top:6px;line-height:1.35;">Top market maker for 1inch and Uniswap V3.</p>
            </div>

            <div style="background:#1b1b18;border:1px solid #302f28;border-radius:8px;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:13px;color:#fff;">Wintermute: Arbitrage Engine</strong>
                  <div style="font-size:11px;color:#ee6a42;margin-top:2px;">Entity: Wintermute · Hot Wallet</div>
                </div>
                <span class="taw-btn private" style="font-size:9.5px;">Private</span>
              </div>
              <div class="mono" style="font-size:11px;color:#858176;margin-top:8px;">0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503</div>
              <p style="font-size:11px;color:#9c988b;margin-top:6px;line-height:1.35;">Active flash swap rebalancing bot.</p>
            </div>

            <div style="background:#1b1b18;border:1px solid #302f28;border-radius:8px;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:13px;color:#fff;">Vitalik Buterin (vitalik.eth)</strong>
                  <div style="font-size:11px;color:#55c58d;margin-top:2px;">Entity: Vitalik Buterin · Founder</div>
                </div>
                <span class="taw-btn verified" style="font-size:9.5px;">Verified</span>
              </div>
              <div class="mono" style="font-size:11px;color:#858176;margin-top:8px;">0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045</div>
              <p style="font-size:11px;color:#9c988b;margin-top:6px;line-height:1.35;">Ethereum creator primary public identity.</p>
            </div>

            <div style="background:#1b1b18;border:1px solid #302f28;border-radius:8px;padding:12px 14px;">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <div>
                  <strong style="font-size:13px;color:#fff;">Paradigm Capital: LP Vault</strong>
                  <div style="font-size:11px;color:#55c58d;margin-top:2px;">Entity: Paradigm · Treasury</div>
                </div>
                <span class="taw-btn verified" style="font-size:9.5px;">Verified</span>
              </div>
              <div class="mono" style="font-size:11px;color:#858176;margin-top:8px;">0x7769647890bF5c531d0413A2c06F447883654199</div>
              <p style="font-size:11px;color:#9c988b;margin-top:6px;line-height:1.35;">Key liquidity provider across mainnet DEXes.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
    `
  },
  {
    id: "promo-small-440x280",
    title: "Small Promo Tile",
    width: 440,
    height: 280,
    desc: "440x280 store search & category promo card",
    html: `
  <div style="width:440px;height:280px;background:#0d131a;position:relative;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between;padding:20px 22px;border:1px solid #1c2b3d;">
    <div style="position:absolute;top:-40px;right:-40px;width:240px;height:240px;border-radius:50%;background:radial-gradient(circle, rgba(238,106,66,0.22) 0%, transparent 70%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-60px;left:-40px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle, rgba(16,185,129,0.14) 0%, transparent 70%);pointer-events:none;"></div>

    <div style="position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;">
      <div style="display:flex;align-items:center;gap:9px;">
        ${LOGO_SVG(28, "dark")}
        <span style="font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">TagAWallet</span>
      </div>
      <span style="font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ee6a42;background:rgba(238,106,66,0.14);border:1px solid rgba(238,106,66,0.35);padding:2px 8px;border-radius:99px;">CHROME EXTENSION</span>
    </div>

    <div style="position:relative;z-index:2;margin-top:2px;">
      <h2 style="font-size:20px;font-weight:800;line-height:1.2;color:#ffffff;letter-spacing:-0.02em;">Private Wallet Identity for Web3</h2>
      <p style="font-size:12px;color:#94a3b8;margin-top:3px;line-height:1.35;">Instant recognition on Etherscan, DexScreener & Twitter/X.</p>
    </div>

    <div style="position:relative;z-index:2;background:#131c26;border:1px solid #23354a;border-radius:8px;padding:9px 12px;display:flex;flex-direction:column;gap:6px;box-shadow:0 8px 24px rgba(0,0,0,0.6);">
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="mono" style="font-size:11px;color:#60a5fa;">0xd8dA...6045</span>
          <span class="taw-btn verified" style="font-size:10px;height:18px;padding:0 6px;">✓ Vitalik Buterin</span>
        </div>
        <span style="font-size:10px;color:#55c58d;font-weight:600;">Etherscan</span>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="mono" style="font-size:11px;color:#60a5fa;">0x47ac...d503</span>
          <span class="taw-btn private" style="font-size:10px;height:18px;padding:0 6px;">Wintermute Arb</span>
        </div>
        <span style="font-size:10px;color:#ee6a42;font-weight:600;">DexScreener</span>
      </div>
    </div>

    <div style="position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between;padding-top:4px;border-top:1px solid #1c2b3d;font-size:10.5px;color:#94a3b8;font-weight:500;">
      <span>🔒 100% Private</span>
      <span>•</span>
      <span>⚡ Inline Badges</span>
      <span>•</span>
      <span>📑 Side Panel</span>
    </div>
  </div>
    `
  },
  {
    id: "promo-marquee-1400x560",
    title: "Marquee Promo Tile",
    width: 1400,
    height: 560,
    desc: "1400x560 storefront hero marquee banner",
    html: `
  <div style="width:1400px;height:560px;background:#0b1118;position:relative;overflow:hidden;display:flex;align-items:center;padding:0 70px;gap:60px;border:1px solid #1f2f42;">
    <div style="position:absolute;top:-100px;right:100px;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle, rgba(238,106,66,0.18) 0%, transparent 65%);pointer-events:none;"></div>
    <div style="position:absolute;bottom:-150px;left:200px;width:500px;height:500px;border-radius:50%;background:radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 65%);pointer-events:none;"></div>
    <div style="position:absolute;inset:0;background-image:linear-gradient(to right, #172433 1px, transparent 1px), linear-gradient(to bottom, #172433 1px, transparent 1px);background-size:44px 44px;opacity:0.3;pointer-events:none;"></div>

    <div style="position:relative;z-index:2;width:580px;display:flex;flex-direction:column;gap:20px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${LOGO_SVG(36, "dark")}
        <span style="font-size:22px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">TagAWallet</span>
        <span style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ee6a42;background:rgba(238,106,66,0.14);border:1px solid rgba(238,106,66,0.35);padding:3px 10px;border-radius:99px;margin-left:6px;">CHROME EXTENSION</span>
      </div>

      <h1 style="font-size:42px;font-weight:800;line-height:1.15;letter-spacing:-0.03em;color:#ffffff;">
        Never wonder whose wallet you're looking at again.
      </h1>

      <p style="font-size:17px;line-height:1.5;color:#94a3b8;font-weight:400;">
        Privately tag addresses, organize custom watchlists, and recognize verified Web3 identities directly on Etherscan, DexScreener, Twitter/X, and OpenSea.
      </p>

      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:4px;">
        <span style="display:inline-flex;align-items:center;gap:6px;background:#111b27;border:1px solid #23354a;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;color:#e2e8f0;">
          <span style="color:#ee6a42;">🔒</span> 100% Private Tags
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;background:#111b27;border:1px solid #23354a;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;color:#e2e8f0;">
          <span style="color:#55c58d;">✓</span> Etherscan & DEX Badges
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;background:#111b27;border:1px solid #23354a;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;color:#e2e8f0;">
          <span style="color:#38bdf8;">🐦</span> Twitter/X Detection
        </span>
        <span style="display:inline-flex;align-items:center;gap:6px;background:#111b27;border:1px solid #23354a;padding:7px 14px;border-radius:8px;font-size:12.5px;font-weight:600;color:#e2e8f0;">
          <span style="color:#dbab45;">⚡</span> Chrome Side Panel
        </span>
      </div>

      <div style="display:flex;align-items:center;gap:18px;margin-top:10px;font-size:12.5px;color:#64748b;">
        <span>Free for Chrome</span>
        <span>•</span>
        <span>No Wallet Connection Needed</span>
        <span>•</span>
        <span>Zero Tracking</span>
      </div>
    </div>

    <div style="position:relative;z-index:2;flex:1;height:460px;display:flex;align-items:center;justify-content:center;">
      <div style="width:600px;background:#0e1722;border:1px solid #1f3044;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,0.85);overflow:hidden;display:flex;flex-direction:column;">
        <div style="height:36px;background:#090f17;border-bottom:1px solid #1a2838;display:flex;align-items:center;justify-content:space-between;padding:0 14px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="display:flex;gap:6px;">
              <span class="window-dot dot-red"></span>
              <span class="window-dot dot-yellow"></span>
              <span class="window-dot dot-green"></span>
            </div>
            <span style="font-size:11.5px;font-weight:600;color:#64748b;margin-left:8px;">etherscan.io / txs</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="taw-btn verified" style="font-size:10px;height:18px;">4 Detected</span>
            <div class="ext-icon-active" style="width:22px;height:22px;">
              ${LOGO_SVG(14, "dark")}
            </div>
          </div>
        </div>

        <div style="height:380px;position:relative;background:#0d141e;padding:16px;display:flex;flex-direction:column;gap:12px;">
          <div style="background:#111b26;border:1px solid #1f3145;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between;">
            <div>
              <span class="es-method">Transfer</span>
              <span class="mono" style="margin-left:8px;color:#3b82f6;font-size:11.5px;">0xd8dA6BF...6045</span>
              <span class="taw-btn verified">✓ Vitalik Buterin</span>
            </div>
            <span style="color:#ffffff;font-weight:600;font-size:12px;">320.00 ETH</span>
          </div>

          <div style="background:#1c1c19;border:1px solid #3c3b33;border-radius:12px;box-shadow:0 24px 60px rgba(0,0,0,0.85);padding:16px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:36px;height:36px;border-radius:8px;background:#2a2924;border:1px solid #3c3a33;display:grid;place-items:center;font-weight:700;font-size:14px;color:#efece3;">
                  P
                </div>
                <div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <span style="font-size:15px;font-weight:700;color:#ffffff;">Paradigm Capital</span>
                    <span class="taw-btn verified" style="font-size:10.5px;">✓ Verified</span>
                  </div>
                  <span style="font-size:11.5px;color:#9c988b;">Treasury & Liquidity Deployer</span>
                </div>
              </div>
              <span style="font-size:11px;font-weight:600;color:#ee6a42;background:rgba(238,106,66,0.12);padding:2px 8px;border-radius:6px;border:1px solid rgba(238,106,66,0.3);">EVM</span>
            </div>

            <div style="margin-top:10px;display:flex;align-items:center;justify-content:space-between;background:#141412;padding:6px 10px;border-radius:6px;border:1px solid #282722;">
              <span class="mono" style="font-size:11.5px;color:#cdc9be;">0x7769647890bF5c531d0413A2c06F447883654199</span>
              <span style="font-size:11px;color:#ee6a42;font-weight:600;">Copy</span>
            </div>

            <p style="margin-top:8px;font-size:11.5px;color:#a49f92;line-height:1.4;background:rgba(238,106,66,0.06);border-left:2px solid #ee6a42;padding:6px 10px;border-radius:0 4px 4px 0;">
              Lead backer & tier-1 LP in Uniswap V3 pools. Large rebalancing events flagged automatically.
            </p>

            <div style="margin-top:10px;display:flex;gap:8px;">
              <button style="flex:1;height:28px;background:#ee6a42;border:none;border-radius:6px;font-size:11.5px;font-weight:600;color:#fff;">Edit Tag</button>
              <button style="flex:1;height:28px;background:#25241f;border:1px solid #38372f;border-radius:6px;font-size:11.5px;color:#d5d1c5;">Etherscan ↗</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
    `
  },
  {
    id: "icon-128",
    title: "Store Icon (128x128)",
    width: 128,
    height: 128,
    desc: "128x128 store emblem on obsidian background",
    html: `
  <div style="width:128px;height:128px;background:#141412;display:grid;place-items:center;position:relative;overflow:hidden;">
    <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%, rgba(238,106,66,0.18) 0%, transparent 75%);"></div>
    <div style="position:absolute;inset:2px;border:1px solid #2c2b26;border-radius:24px;"></div>
    <div style="position:relative;z-index:2;display:grid;place-items:center;">
      ${LOGO_SVG(84, "dark")}
    </div>
  </div>
    `
  }
];
