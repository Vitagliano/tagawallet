import { test, expect } from "@playwright/test";

const A1 = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";

test("first-run web flow in the browser, with no CSP violations", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Know who/ })).toBeVisible();
  await page.getByRole("link", { name: "Get started" }).click();

  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Add a name")).toBeVisible();
  await page.getByLabel("Name").fill("Dana");
  await page.getByLabel("Email").fill(`dana${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("Getting started")).toBeVisible();

  await page.getByRole("button", { name: "Create", exact: true }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Research");
  await page.getByRole("button", { name: "Create list" }).click();
  await expect(page).toHaveURL(/lists\//);
  await expect(page.getByRole("heading", { name: "Research" })).toBeVisible();
  await expect(page.locator("main").getByText("Private", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add wallet" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Address").fill(A1.replace("aA", "Aa"));
  await dialog.getByRole("button", { name: "Save wallet" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Checksum");
  await dialog.getByLabel("Address").fill(A1);
  await dialog.getByLabel("Name").fill("Alice main");
  await dialog.getByLabel("Tags").fill("trader, watchlist");
  await dialog.getByRole("button", { name: "Save wallet" }).click();
  await expect(dialog.getByRole("status")).toContainText("Saved");
  await dialog.getByLabel("Address").fill(A1);
  await dialog.getByRole("button", { name: "Save wallet" }).click();
  await expect(dialog.getByRole("alert")).toContainText("already in");
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("link", { name: "Alice main" }).click();
  await expect(page).toHaveURL(/wallets\//);
  await page.getByLabel("Notes").fill("Met at a conference");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.getByRole("link", { name: "Entities", exact: true }).click();
  await page.getByRole("button", { name: "New entity" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Alice Ventures");
  await page.getByRole("button", { name: "Create entity" }).click();
  await expect(page.getByRole("heading", { name: "Alice Ventures" })).toBeVisible();
  await page.getByRole("button", { name: "+ Add link" }).click();
  await page.getByLabel("URL or handle").fill("@alice");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("status")).toHaveText("Saved");

  await page.getByRole("link", { name: "Search", exact: true }).click();
  await page.getByLabel("Search").fill("6053f3");
  await expect(page.getByRole("link", { name: "Alice main" })).toBeVisible();
  await page.getByLabel("Search").fill("conference");
  await expect(page.getByRole("link", { name: "Alice main" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/login/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/login\?next/);
  expect(problems).toEqual([]);
});

test("phone width has no horizontal page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  for (const path of ["/", "/login", "/signup", "/privacy"]) {
    await page.goto(path);
    const [scroll, client] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(scroll, path).toBeLessThanOrEqual(client);
  }
});

test("open redirects are refused after sign-in", async ({ page }) => {
  const email = `r${Date.now()}@example.test`;
  await page.request.post("/api/auth/register", { data: { email, password: "correct-horse-battery", displayName: "R" } });
  await page.request.post("/api/auth/logout");
  await page.goto("/login?next=//evil.example/x");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/localhost:3200\/dashboard/);
});
