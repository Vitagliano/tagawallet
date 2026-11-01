// Pages bundle normally. The worker and content script must each be one self-contained file,
// because content scripts can't import chunks, so they get their own IIFE builds.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import react from "@vitejs/plugin-react";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const prod = process.env.NODE_ENV === "production" || process.env.TAW_RELEASE === "1";
const apiBase = process.env.TAW_API_BASE ?? (prod ? "https://tagawallet.com" : "http://localhost:3000");
const outDir = resolve(root, process.env.TAW_OUT ?? "dist");
const define = { __API_BASE__: JSON.stringify(apiBase), "process.env.NODE_ENV": '"production"' };

await build({
  root, configFile: false, logLevel: "warn", define, plugins: [react()],
  build: {
    outDir, emptyOutDir: true,
    rollupOptions: { input: { popup: resolve(root, "popup.html"), options: resolve(root, "options.html"), welcome: resolve(root, "welcome.html") } },
  },
});
for (const name of ["background", "content"]) {
  await build({
    root, configFile: false, logLevel: "warn", define, publicDir: false,
    build: {
      outDir, emptyOutDir: false, minify: true,
      lib: { entry: resolve(root, `src/${name === "content" ? "content/index" : name}.ts`), formats: ["iife"], name: `taw_${name}`, fileName: () => `${name}.js` },
    },
  });
}

const localDev = apiBase.startsWith("http://localhost");
const manifest = {
  manifest_version: 3,
  name: "TagAWallet",
  version: "1.0.0",
  description: "Privately tag wallet addresses and recognize who's behind them as you browse.",
  icons: { 16: "icons/16.png", 32: "icons/32.png", 48: "icons/48.png", 128: "icons/128.png" },
  action: { default_popup: "popup.html", default_title: "TagAWallet" },
  options_page: "options.html",
  background: { service_worker: "background.js" },
  // `scripting` registers the content script only on sites the person has enabled.
  permissions: ["storage", "activeTab", "scripting"],
  // Nothing is granted at install. Each origin is requested when the person turns a site on.
  optional_host_permissions: ["https://*/*", ...(localDev ? ["http://localhost/*"] : [])],
  // Lets only the TagAWallet site hand the extension its session after sign-in.
  externally_connectable: { matches: [`${new URL(apiBase).origin}/*`] },
  commands: {
    _execute_action: { suggested_key: { default: "Alt+Shift+T" }, description: "Open TagAWallet" },
  },
};
// Test builds pre-grant the fixture origin, because a robot can't click Chrome's permission prompt.
if (process.env.TAW_E2E) manifest.host_permissions = ["http://localhost/*", "https://x.com/*"];
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Built extension in ${outDir} for ${apiBase}`);
