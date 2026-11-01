// Renders the logo into the PNG sizes the manifest needs. Run once after changing the logo.
import { chromium } from "@playwright/test";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"><path d="M3 4.5A1.5 1.5 0 0 1 4.5 3h7.4c.4 0 .8.16 1.06.44l7.6 7.6a1.5 1.5 0 0 1 0 2.12l-7.4 7.4a1.5 1.5 0 0 1-2.12 0l-7.6-7.6A1.5 1.5 0 0 1 3 11.9V4.5Z" fill="#c8421b"/><circle cx="8" cy="8" r="1.8" fill="#fff"/></svg>`;
const browser = await chromium.launch();
for (const size of [16, 32, 48, 128]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await page.screenshot({ path: `apps/extension/public/icons/${size}.png`, omitBackground: true });
}
await browser.close();
