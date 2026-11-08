// Renders the logo into the PNG sizes the manifest needs. Run once after changing the logo.
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const logo = readFileSync("apps/web/src/app/icon.svg", "utf8")
  .replace(/<style>[\s\S]*?<\/style>\s*/, "")
  .replace(/\sclass="i"/g, ' fill="#1a1a18"');

mkdirSync("apps/extension/public/icons", { recursive: true });

const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const pad = Math.max(1, Math.round(size * 0.06));
  const inner = size - pad * 2;
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(
    `<body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:transparent">${logo.replace(
      /<svg/,
      `<svg width="${inner}" height="${inner}"`,
    )}</body>`,
  );
  await page.screenshot({ path: `apps/extension/public/icons/${size}.png`, omitBackground: true });
}
await browser.close();
