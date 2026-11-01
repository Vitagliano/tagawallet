import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 60_000,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3200", trace: "retain-on-failure" },
  webServer: { command: "node e2e/serve.mjs", url: "http://localhost:3200", timeout: 180_000, reuseExistingServer: false, stdout: "ignore" },
});
