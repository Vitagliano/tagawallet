// Renders the logo into the PNG sizes the manifest needs, and the fixed light/dark favicons.
// Run once after changing the logo: node e2e/icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "@playwright/test";

const src = readFileSync("apps/web/src/app/icon.svg", "utf8");
const bare = src.replace(/<style>[\s\S]*?<\/style>\s*/, "");
const lightSvg = bare.replace(/\sclass="i"/g, ' fill="#1a1a18"');
const darkSvg = bare.replace(/\sclass="i"/g, ' fill="#fff"');

mkdirSync("apps/web/public", { recursive: true });
writeFileSync("apps/web/public/icon-light.svg", lightSvg);
writeFileSync("apps/web/public/icon-dark.svg", darkSvg);
writeFileSync("apps/web/public/icon-system.svg", src);

mkdirSync("apps/extension/public/icons/dark", { recursive: true });

const browser = await chromium.launch();
for (const [variant, logo] of [["", lightSvg], ["dark", darkSvg]]) {
  const dir = variant ? `apps/extension/public/icons/${variant}` : "apps/extension/public/icons";
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
    await page.screenshot({ path: `${dir}/${size}.png`, omitBackground: true });
  }
}
await browser.close();
