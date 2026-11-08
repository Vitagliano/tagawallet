import { test, expect } from "@playwright/test";

const A1 = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const A2 = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";

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
  await expect(page.getByRole("heading", { name: "Wallets" })).toBeVisible();
  await expect(page.getByText("Getting started")).toBeVisible();
  // Adding is one obvious button, with a labeled form. No setup first.
  await page.locator("main").getByRole("button", { name: "Add wallet" }).first().click();
  const add = page.getByRole("dialog", { name: "Add a wallet" });
  await add.getByLabel("Address").fill(A1.replace("aA", "Aa"));
  await add.getByLabel("Name", { exact: true }).fill("Alice main");
  await add.getByRole("button", { name: "Add wallet" }).click();
  await expect(add.getByRole("alert")).toContainText("Checksum");
  await add.getByLabel("Address").fill(A1);
  const labels = add.getByRole("group", { name: "Labels" });
  await labels.getByRole("button", { name: "Watchlist" }).click();
  await labels.getByLabel("Add a label").fill("trader");
  await labels.getByLabel("Add a label").press("Enter");
  await expect(add.getByText("Private to you. A wallet doesn't have to be in a list.")).toBeVisible();
  await add.getByRole("combobox", { name: "Add to list" }).fill("Alice Ventures");
  await add.getByRole("option", { name: /New project “Alice Ventures”/ }).click();
  await expect(add.getByText("New: Alice Ventures")).toBeVisible();
  await add.getByRole("button", { name: "Add wallet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added Alice main" })).toBeVisible();
  await expect(add).toBeHidden();
  const row = page.getByRole("button", { name: /Alice main/ });
  await expect(row.getByText("trader", { exact: true })).toBeVisible();

  // Search only finds. An address you don't have yet gets an explicit "Add it".
  const bar = page.getByLabel("Search wallets");
  await bar.fill(A1);
  await expect(row).toBeVisible();
  await bar.fill(A2);
  await expect(page.getByText("isn't in your wallets yet.")).toBeVisible();
  await page.getByRole("button", { name: "Add it" }).click();
  await expect(page.getByRole("dialog", { name: "Add a wallet" }).getByLabel("Address")).toHaveValue(A2);
  await page.getByRole("dialog", { name: "Add a wallet" }).getByRole("button", { name: "Cancel" }).click();

  // Details open in a drawer and save as you go.
  await row.click();
  const drawer = page.getByRole("dialog", { name: "Wallet" });
  await expect(drawer.getByRole("heading", { name: "Alice main" })).toBeVisible();
  await expect(page).toHaveURL(/w=/);
  await expect(drawer.getByRole("link", { name: "Alice Ventures" })).toBeVisible();
  await drawer.getByLabel("Notes").fill("Met at a conference");
  await drawer.getByLabel("Notes").blur();
  await expect(drawer.getByText("Saved", { exact: true })).toBeVisible();
  await drawer.getByLabel("Add a label").fill("whale");
  await drawer.getByLabel("Add a label").press("Enter");
  await expect(drawer.getByRole("button", { name: "Remove whale" })).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toBeHidden();
  await expect(row.getByText("whale", { exact: true })).toBeVisible();

  // + New starts anything from any page. A list is just a named group of wallets.
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("menu").getByRole("button", { name: "List" }).click();
  const newList = page.getByRole("dialog", { name: "New list" });
  await expect(newList.getByRole("radio", { name: /List/ })).toBeChecked();
  await newList.getByLabel("Name").fill("Research");
  await newList.getByRole("button", { name: "Create list" }).click();
  await expect(page).toHaveURL(/lists\//);
  await expect(page.getByRole("heading", { name: "Research" })).toBeVisible();
  await expect(page.getByText("Not shared with anyone yet.")).toBeVisible();

  // Bulk: select it on Wallets and add it to the list.
  const nav = page.getByRole("navigation", { name: "Main" });
  await nav.getByRole("link", { name: "Wallets" }).click();
  await page.getByRole("checkbox", { name: "Select Alice main" }).check();
  await page.getByRole("button", { name: "Add to list" }).click();
  await page.getByRole("menu").getByRole("combobox", { name: "Add to list" }).fill("Resea");
  await page.getByRole("listbox").getByRole("option", { name: "Research" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to Research" })).toBeVisible();

  // Lists, people and projects live together.
  await nav.getByRole("link", { name: "Lists" }).click();
  await expect(page.getByRole("link", { name: /Research/ })).toBeVisible();
  await page.getByRole("toolbar", { name: "Show" }).getByRole("button", { name: /Projects/ }).click();
  await expect(page.getByRole("link", { name: /Research/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Alice Ventures/ }).click();
  await expect(page.getByRole("heading", { name: "Alice Ventures" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Alice main/ })).toBeVisible();
  const about = page.getByRole("region", { name: "About" });
  await about.getByRole("button", { name: "+ Add link" }).click();
  await about.getByLabel("URL or handle").fill("@alice");
  await expect(about.getByText("X", { exact: true })).toBeVisible();
  await about.getByLabel("URL or handle").blur();
  await page.getByRole("button", { name: "Publish…" }).click();
  await expect(page.getByRole("heading", { name: "Verify it's you" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Publish profile" })).toBeDisabled();
  await page.getByRole("dialog", { name: "Public profile" }).getByRole("button", { name: "Close" }).click();
  await expect.poll(async () => (await (await page.request.get(page.url().replace("/entities/", "/api/entities/"))).json()).links?.[0]?.type).toBe("x");

  // ⌘K finds things from anywhere, by address fragment or by note.
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Search" });
  await palette.getByLabel("Search everything").fill("6053f3");
  await expect(palette.getByRole("option", { name: /Alice main/ })).toBeVisible();
  await palette.getByLabel("Search everything").fill("conference");
  await expect(palette.getByRole("option", { name: /Alice main/ })).toBeVisible();
  await palette.getByLabel("Search everything").press("Enter");
  await expect(page.getByRole("dialog", { name: "Wallet" }).getByRole("heading", { name: "Alice main" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Deleting can be undone.
  await page.goto("/dashboard");
  await page.getByRole("checkbox", { name: "Select Alice main" }).check();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: /Alice main/ })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: /Alice main/ })).toBeVisible();

  // Account features live behind the avatar and on one Settings page.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menu").getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Sign-in methods" })).toBeVisible();
  await expect(page.getByText("Free plan")).toBeVisible();
  const product = page.getByRole("switch", { name: "Product updates" });
  await expect(product).toHaveAttribute("aria-checked", "true");
  await product.click();
  await expect(product).toHaveAttribute("aria-checked", "false");
  await page.getByLabel("Display name").fill("Dana R");
  await page.getByLabel("Display name").press("Enter");
  await expect(page.getByRole("heading", { name: "Dana R" })).toBeVisible();
  await page.getByRole("button", { name: "Change" }).click();
  await page.getByRole("dialog").getByLabel("Current password").fill("wrong-password-x");
  await page.getByRole("dialog").getByLabel("New password").fill("another-horse-battery");
  await page.getByRole("button", { name: "Save password" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("incorrect");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Account menu" }).click();
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

test("import from the wallets page: columns are matched, previewed, then imported; a wallet's chain can be fixed", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Ivy");
  await page.getByLabel("Email").fill(`ivy${Date.now()}@example.test`);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);

  await page.getByRole("button", { name: "Import or export" }).click();
  await page.getByRole("button", { name: "Import CSV or JSON" }).click();
  const dialog = page.getByRole("dialog", { name: "Import wallets" });
  await dialog.getByLabel("Or paste CSV or JSON").fill(`Wallet,Alias,Network\n${A1},Imported one,ethereum\n${A1},Again,ethereum\nnot-an-address,Bad,`);
  await expect(dialog.getByLabel("Column for Address")).toHaveValue("Wallet");
  await expect(dialog.getByLabel("Column for Name")).toHaveValue("Alias");
  await expect(dialog.getByLabel("Column for Chain")).toHaveValue("Network");
  await dialog.getByRole("button", { name: "Preview" }).click();
  const preview = dialog.getByRole("status", { name: "Import preview" });
  await expect(preview).toContainText("1 new");
  await expect(preview).toContainText("1 duplicate");
  await expect(preview).toContainText("Row 3");
  await dialog.getByRole("button", { name: "Import 1 wallet" }).click();
  await expect(dialog.getByRole("status")).toContainText("Imported 1 wallet");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.getByRole("button", { name: /Imported one/ })).toBeVisible();

  // Wrong chain? Fix it in place.
  await page.getByRole("button", { name: /Imported one/ }).click();
  const drawer = page.getByRole("dialog", { name: "Wallet" });
  await drawer.getByRole("button", { name: "Change address or chain" }).click();
  await drawer.getByLabel("Chain").selectOption("base");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByRole("button", { name: "Change address or chain" })).toBeVisible();
  await expect(drawer).toContainText("Base");
  await expect(drawer).not.toContainText("Ethereum");
});

test("a new account sees a verify-email banner it can resend from or dismiss", async ({ page }) => {
  const email = `vera${Date.now()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Vera");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/dashboard/);
  const banner = page.getByRole("region", { name: "Verify your email" });
  await expect(banner).toContainText(email);
  await banner.getByRole("button", { name: "Resend link" }).click();
  await expect(banner).toContainText("Sent.");
  await banner.getByRole("button", { name: "Dismiss" }).click();
  await expect(banner).toHaveCount(0);
});
