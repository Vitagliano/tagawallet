import http from "node:http";
import { exec, execSync } from "node:child_process";
import { resolve } from "node:path";
import { PAGES, EXTENSION_STYLE } from "./store-assets-templates.mjs";

const PORT = 4567;

function getPageHtml(page) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${page.title} - TagAWallet Store Asset</title>
  <style>
    ${EXTENSION_STYLE}
  </style>
</head>
<body style="width:${page.width}px;height:${page.height}px;margin:0;padding:0;overflow:hidden;">
  ${page.html}
</body>
</html>`;
}

function getDashboardHtml(activeId = PAGES[0].id) {
  const activePage = PAGES.find((p) => p.id === activeId) || PAGES[0];
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>TagAWallet - Chrome Web Store Asset Studio</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #090d12;
      color: #e2e8f0;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      display: flex;
      height: 100vh;
      overflow: hidden;
    }
    
    /* Sidebar */
    .sidebar {
      width: 320px;
      background: #0d141e;
      border-right: 1px solid #1c2b3d;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
    }
    .side-header {
      padding: 18px 20px;
      border-bottom: 1px solid #1c2b3d;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .side-title {
      font-size: 16px;
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.02em;
    }
    .side-sub {
      font-size: 11px;
      color: #ee6a42;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .nav-list {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .nav-item {
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid transparent;
      text-decoration: none;
      color: #94a3b8;
      display: flex;
      flex-direction: column;
      gap: 3px;
      transition: all 0.15s ease;
      cursor: pointer;
    }
    .nav-item:hover {
      background: #141f2d;
      color: #e2e8f0;
    }
    .nav-item.active {
      background: #182738;
      border-color: #ee6a42;
      color: #fff;
    }
    .nav-item-title {
      font-size: 13px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-item-dim {
      font-size: 10.5px;
      color: #64748b;
      font-family: monospace;
    }
    .nav-item.active .nav-item-dim {
      color: #ee6a42;
      font-weight: 600;
    }
    .nav-item-desc {
      font-size: 11px;
      color: #64748b;
      line-height: 1.3;
    }

    /* Main Area */
    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #070a0e;
    }
    .topbar {
      height: 56px;
      background: #0d141e;
      border-bottom: 1px solid #1c2b3d;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      flex-shrink: 0;
    }
    .top-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .top-title {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }
    .top-badge {
      font-size: 11px;
      font-family: monospace;
      padding: 3px 8px;
      background: #182738;
      border: 1px solid #283e57;
      border-radius: 4px;
      color: #60a5fa;
    }
    .top-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn {
      height: 32px;
      padding: 0 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
      transition: all 0.15s;
    }
    .btn-secondary {
      background: #182738;
      border: 1px solid #283e57;
      color: #e2e8f0;
    }
    .btn-secondary:hover {
      background: #23354a;
      color: #fff;
    }
    .btn-primary {
      background: #ee6a42;
      border: none;
      color: #fff;
    }
    .btn-primary:hover {
      background: #f07b56;
    }
    .btn-zoom {
      background: transparent;
      border: 1px solid #283e57;
      color: #94a3b8;
      padding: 0 10px;
    }
    .btn-zoom.active {
      background: #182738;
      color: #fff;
      border-color: #3b82f6;
    }

    /* Preview Canvas Container */
    .viewport {
      flex: 1;
      overflow: auto;
      padding: 40px;
      display: grid;
      place-items: center;
      background-image: radial-gradient(#1e293b 1px, transparent 1px);
      background-size: 24px 24px;
    }
    .frame-wrapper {
      box-shadow: 0 25px 60px rgba(0,0,0,0.8), 0 0 0 1px #1c2b3d;
      border-radius: 12px;
      overflow: hidden;
      background: #000;
      transition: transform 0.2s ease;
      transform-origin: center center;
    }
    iframe {
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <!-- Sidebar Navigation -->
  <div class="sidebar">
    <div class="side-header">
      <div style="width:32px;height:32px;border-radius:8px;background:#182738;border:1px solid #ee6a42;display:grid;place-items:center;">
        <svg viewBox="0 -50 515 515" width="20" height="20" fill="none"><path d="M173.442 129.078C174.055 129.49 173.114 133.104 172.929 133.906C170.498 144.413 172.034 154.444 176.059 164.567C171.846 171.297 170.103 177.023 172.344 184.891C175.412 195.407 184.198 201.517 194.933 201.714C213.495 202.055 228.491 181.928 217.334 165.329C215.601 162.751 214.031 161.045 211.876 158.87C215.708 150.974 215.12 147.97 221.884 139.876C239.62 144.934 241.432 149.138 249.263 165.038L257.059 180.748C259.109 184.837 261.449 188.765 263.418 192.906C266.92 200.269 271.459 206.838 273.374 214.875C275.703 224.647 272.702 230.667 269.243 239.407C266.014 247.395 262.738 255.364 259.416 263.316L231.036 331.798L212.612 376.03C208.193 386.676 205.429 397.713 196.28 405.328C190.794 409.892 185.472 412.484 178.528 413.958C178.003 414.036 177.477 414.107 176.95 414.171C164.027 415.746 158.831 411.992 147.335 407.786C132.301 402.12 117.297 396.372 102.324 390.546L46.9429 369.009C38.5386 365.733 30.3719 362.786 21.6765 359.212C6.16247 352.837 -3.72375 332.873 2.1105 316.786C4.29497 310.762 8.87963 302.897 11.8749 297.026L27.3071 266.083L59.0153 202.479L65.9855 188.379C68.1486 183.931 70.4438 178.356 73.5176 174.596C75.7929 171.992 79.1395 168.378 82.2924 166.834C91.764 162.196 101.695 158.194 111.351 153.985L145.18 139.33C153.256 135.885 165.111 129.951 173.442 129.078Z" fill="#EE6A42"/></svg>
      </div>
      <div>
        <div class="side-title">TagAWallet</div>
        <div class="side-sub">Store Asset Studio</div>
      </div>
    </div>

    <div class="nav-list">
      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;padding:6px 6px 2px;">
        Screenshots (5 max)
      </div>
      ${PAGES.slice(0, 5).map((p) => `
        <a class="nav-item ${p.id === activeId ? "active" : ""}" href="/?id=${p.id}">
          <div class="nav-item-title">
            <span>${p.title}</span>
            <span class="nav-item-dim">${p.width}x${p.height}</span>
          </div>
          <div class="nav-item-desc">${p.desc}</div>
        </a>
      `).join("")}

      <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;padding:12px 6px 2px;">
        Promo Tiles & Icon
      </div>
      ${PAGES.slice(5).map((p) => `
        <a class="nav-item ${p.id === activeId ? "active" : ""}" href="/?id=${p.id}">
          <div class="nav-item-title">
            <span>${p.title}</span>
            <span class="nav-item-dim">${p.width}x${p.height}</span>
          </div>
          <div class="nav-item-desc">${p.desc}</div>
        </a>
      `).join("")}
    </div>
  </div>

  <!-- Main Preview Stage -->
  <div class="main">
    <div class="topbar">
      <div class="top-info">
        <span class="top-title">${activePage.title}</span>
        <span class="top-badge">${activePage.width} × ${activePage.height} px</span>
        <span style="font-size:12px;color:#64748b;">${activePage.desc}</span>
      </div>

      <div class="top-actions">
        <!-- Zoom Controls -->
        <div style="display:flex;gap:4px;">
          <button class="btn btn-zoom" onclick="setZoom(0.5)">50%</button>
          <button class="btn btn-zoom" onclick="setZoom(0.75)">75%</button>
          <button class="btn btn-zoom active" id="btn-zoom-100" onclick="setZoom(1)">100%</button>
        </div>

        <button class="btn btn-secondary" onclick="openExactWindow('/page/${activePage.id}', ${activePage.width}, ${activePage.height})">
          ↗ Open Exact Window
        </button>

        <button class="btn btn-primary" id="btn-capture" onclick="captureAssets()">
          📸 Take Screenshots Now
        </button>
      </div>
    </div>

    <!-- Live Preview Canvas -->
    <div class="viewport" id="viewport">
      <div class="frame-wrapper" id="frame-wrapper" style="width:${activePage.width}px;height:${activePage.height}px;">
        <iframe src="/page/${activePage.id}" width="${activePage.width}" height="${activePage.height}"></iframe>
      </div>
    </div>
  </div>

  <script>
    function setZoom(scale) {
      const el = document.getElementById('frame-wrapper');
      el.style.transform = scale === 1 ? 'none' : 'scale(' + scale + ')';
      document.querySelectorAll('.btn-zoom').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
    }

    function openExactWindow(url, w, h) {
      window.open(url, 'asset_preview', 'width=' + w + ',height=' + h + ',menubar=no,toolbar=no,location=no,status=no');
    }

    async function captureAssets() {
      const btn = document.getElementById('btn-capture');
      btn.textContent = '⏳ Screenshotting...';
      btn.disabled = true;
      try {
        const res = await fetch('/api/capture', { method: 'POST' });
        const data = await res.json();
        alert('✅ ' + data.message);
      } catch(err) {
        alert('❌ Error: ' + err.message);
      } finally {
        btn.textContent = '📸 Take Screenshots Now';
        btn.disabled = false;
      }
    }
  </script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === "/") {
    const activeId = url.searchParams.get("id") || PAGES[0].id;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getDashboardHtml(activeId));
    return;
  }

  if (url.pathname.startsWith("/page/")) {
    const id = url.pathname.replace("/page/", "");
    const page = PAGES.find((p) => p.id === id);
    if (!page) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Page not found");
      return;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(getPageHtml(page));
    return;
  }

  if (url.pathname === "/api/capture") {
    console.log("Triggering capture from Studio...");
    try {
      execSync("node scripts/generate-store-assets-v3.mjs", { stdio: "inherit" });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "All 8 store assets captured and verified successfully!" }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n🎉 TagAWallet Asset Review Studio running at: http://localhost:${PORT}`);
  console.log(`Opening browser for live review...\n`);
  exec(`open http://localhost:${PORT}`);
});
