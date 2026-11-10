import { test, expect } from "@playwright/test";
import { closeE2eDb, markVerified, signUpAndEnter } from "./helpers";

const A1 = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
const A2 = "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359";
const PASSWORD = "correct-horse-battery";

test.afterAll(async () => { await closeE2eDb(); });

test("first-run web flow in the browser, with no CSP violations", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) problems.push(m.text()); });
  page.on("pageerror", (e) => problems.push(e.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "TagAWallet" })).toBeVisible();
  await page.getByRole("link", { name: "Join the dashboard" }).click();

  const email = `dana${Date.now()}@example.test`;
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 10 characters")).toBeVisible();
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await markVerified(email);
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading", { name: "All wallets" })).toBeVisible();
  await expect(page.getByText("Getting started")).toBeVisible();
  await expect(page.getByText("Add a contact")).toBeVisible();

  // + New starts with a person or project. A wallet is secondary.
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("menu").getByRole("button", { name: "Wallet" }).click();
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
  await expect(add.getByText("Private to you. Link it to someone, file it in a list, or leave it as a one-off name.")).toBeVisible();
  await add.getByRole("combobox", { name: "Belongs to" }).fill("Alice Ventures");
  await add.getByRole("option", { name: /New project “Alice Ventures”/ }).click();
  await expect(add.getByText("New: Alice Ventures")).toBeVisible();
  await expect(add.getByLabel("Name for this address")).toBeVisible();
  await add.getByLabel("Role").selectOption("treasury");
  await add.getByRole("button", { name: "Add wallet" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added Alice main" })).toBeVisible();
  await expect(add).toBeHidden();

  // The project lands in the directory. Open it, then its profile, and find the address with its role.
  const directory = page.getByRole("complementary", { name: "Directory" });
  await directory.getByRole("button", { name: /Alice Ventures/ }).click();
  await expect(page.getByRole("heading", { name: "Alice Ventures" })).toBeVisible();
  await page.getByRole("button", { name: "More for Alice Ventures" }).click();
  await page.getByRole("link", { name: "Open full page" }).click();
  await expect(page.getByRole("heading", { name: "Alice Ventures" })).toBeVisible();
  await expect(page.getByText("Private", { exact: true })).toBeVisible();
  const addressRow = page.getByRole("button", { name: /Alice main/ });
  await expect(addressRow).toBeVisible();
  await expect(page.getByLabel("Role for Alice main")).toHaveValue("treasury");

  // Details open in a drawer and save as you go.
  await addressRow.click();
  const drawer = page.getByRole("dialog", { name: "Wallet" });
  await expect(drawer.getByRole("heading", { name: "Alice main" })).toBeVisible();
  await expect(page).toHaveURL(/w=/);
  await expect(drawer.getByText("Belongs to")).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Alice Ventures" })).toBeVisible();
  await drawer.getByLabel("Notes").fill("Met at a conference");
  await drawer.getByLabel("Notes").blur();
  await expect(drawer.getByText("Saved", { exact: true })).toBeVisible();
  await drawer.getByLabel("Add a label").fill("whale");
  await drawer.getByLabel("Add a label").press("Enter");
  await expect(drawer.getByRole("button", { name: "Remove whale" })).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toBeHidden();

  // Wallet table: search only finds. An address you don't have yet gets an explicit "Add wallet".
  const home = page.getByRole("link", { name: "TagAWallet home" });
  await home.click();
  await expect(page.getByRole("heading", { name: "All wallets" })).toBeVisible();
  const row = page.locator("tbody tr").filter({ hasText: "Alice main" });
  await expect(row.getByText("trader", { exact: true })).toBeVisible();
  await expect(row.getByText("whale", { exact: true })).toBeVisible();
  const bar = page.getByLabel("Search or add");
  await bar.fill(A1);
  await expect(row).toBeVisible();
  await bar.fill(A2);
  const missing = page.getByRole("status").filter({ hasText: "isn't in your wallets yet." });
  await expect(missing).toBeVisible();
  await missing.getByRole("button", { name: "Add wallet" }).click();
  await expect(page.getByRole("dialog", { name: "Add a wallet" }).getByLabel("Address")).toHaveValue(A2);
  await page.getByRole("dialog", { name: "Add a wallet" }).getByRole("button", { name: "Cancel" }).click();

  // + New can still make a plain shared list.
  await page.getByRole("button", { name: "Create new" }).click();
  await page.getByRole("menu").getByRole("button", { name: "List" }).click();
  const newList = page.getByRole("dialog", { name: "New list" });
  await expect(newList.getByRole("radio", { name: /List/ })).toBeChecked();
  await newList.getByLabel("Name").fill("Research");
  await newList.getByRole("button", { name: "Create list" }).click();
  await expect(page).toHaveURL(/lists\//);
  await expect(page.getByRole("heading", { name: "Research" })).toBeVisible();
  await expect(page.getByText("Not shared with anyone yet.")).toBeVisible();

  // Bulk: select it in the table and file it in the list.
  await home.click();
  await page.getByRole("checkbox", { name: "Select Alice main" }).check();
  await page.getByRole("button", { name: "File under…" }).click();
  await page.getByRole("menu").getByRole("combobox", { name: "File under" }).fill("Resea");
  await page.getByRole("listbox").getByRole("option", { name: "Research" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Added to Research" })).toBeVisible();

  // The directory lists contacts and lists beside the table, and the one search bar narrows it too.
  await expect(directory.getByRole("button", { name: /Research/ })).toBeVisible();
  await expect(directory.getByRole("button", { name: /Alice Ventures/ })).toBeVisible();
  await page.getByLabel("Search or add").fill("Resea");
  await expect(directory.getByRole("button", { name: /Research/ })).toBeVisible();
  await expect(directory.getByRole("button", { name: /Alice Ventures/ })).toHaveCount(0);
  await page.getByLabel("Search or add").fill("");
  await directory.getByRole("button", { name: /Alice Ventures/ }).click();
  await page.getByRole("button", { name: "More for Alice Ventures" }).click();
  await page.getByRole("link", { name: "Open full page" }).click();
  await expect(page.getByRole("heading", { name: "Alice Ventures" })).toBeVisible();
  const about = page.getByRole("region", { name: "About" });
  await about.getByRole("button", { name: "+ Add link" }).click();
  await about.getByLabel("URL or handle").fill("@alice");
  await expect(about.getByText("X", { exact: true })).toBeVisible();
  await about.getByLabel("URL or handle").blur();
  // Making a contact public needs no proof of ownership: pick wallets, confirm, done. A person also needs the public-figure box.
  await page.getByRole("button", { name: "Make public…" }).click();
  const publish = page.getByRole("dialog", { name: "Make public" });
  await expect(publish.getByRole("heading", { name: "Choose which wallets appear" })).toBeVisible();
  await expect(publish.getByText("Verify it's you")).toHaveCount(0);
  await expect(publish.getByRole("button", { name: "Make public" })).toBeDisabled();
  await publish.getByRole("button", { name: "Close" }).click();
  await expect.poll(async () => (await (await page.request.get(page.url().replace("/entities/", "/api/entities/"))).json()).links?.[0]?.type).toBe("x");

  // ⌘K finds people above wallets, and notes still resolve.
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Search" });
  await palette.getByLabel("Search everything").fill("Alice Ventures");
  await expect(palette.getByRole("option", { name: /Alice Ventures/ })).toBeVisible();
  await palette.getByLabel("Search everything").fill("6053f3");
  await expect(palette.getByRole("option", { name: /Alice main/ })).toBeVisible();
  await palette.getByLabel("Search everything").fill("conference");
  await palette.getByRole("option", { name: /Alice main/ }).click();
  await expect(page.getByRole("dialog", { name: "Wallet" }).getByRole("heading", { name: "Alice main" })).toBeVisible();
  await page.keyboard.press("Escape");

  // Deleting asks first, and can still be undone. (/wallets is an old link that lands on home.)
  await page.goto("/wallets");
  await expect(page).toHaveURL(/dashboard/);
  await page.getByRole("checkbox", { name: "Select Alice main" }).check();
  await page.getByRole("button", { name: "Delete…" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.locator("tbody tr").filter({ hasText: "Alice main" })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: "Alice main" })).toBeVisible();

  // Account features live behind the avatar and on one Settings page.
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menu").getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Sign-in methods" })).toBeVisible();
  await expect(page.getByText("Free plan")).toBeVisible();
  // Display: how a wallet opens is an account setting.
  const openAs = page.getByRole("radiogroup", { name: "Open wallets as" });
  await expect(openAs.getByRole("radio", { name: /Peek/ })).toHaveAttribute("aria-checked", "true");
  await openAs.getByRole("radio", { name: /Inline/ }).click();
  await expect(openAs.getByRole("radio", { name: /Inline/ })).toHaveAttribute("aria-checked", "true");
  await expect.poll(async () => (await (await page.request.get("/api/auth/session")).json()).user.walletOpen).toBe("inline");
  // Theme: forced dark applies to the website at once and after a reload (set by the server, no flash);
  // the extension's synced theme follows only when the choice covers it.
  const html = page.locator("html");
  const extTheme = async () => (await (await page.request.get("/api/extension/settings")).json()).theme;
  const themes = page.getByRole("radiogroup", { name: "Theme", exact: true });
  const useOn = page.getByRole("group", { name: "Use the theme on" });
  await useOn.getByRole("checkbox", { name: "Extension" }).uncheck();
  await expect(useOn.getByRole("checkbox", { name: "Website" })).toBeDisabled(); // the last place can't be turned off
  await themes.getByRole("radio", { name: "Dark" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect.poll(extTheme).toBe("system");
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");
  await useOn.getByRole("checkbox", { name: "Extension" }).check();
  await expect.poll(extTheme).toBe("dark");
  await useOn.getByRole("checkbox", { name: "Website" }).uncheck();
  await expect(html).not.toHaveAttribute("data-theme", /./);
  await themes.getByRole("radio", { name: "System" }).click();
  await expect.poll(extTheme).toBe("system");
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
  await page.request.post("/api/auth/sign-up/email", {
    data: { email, password: PASSWORD, name: email.split("@")[0] },
    headers: { Origin: "http://localhost:3200" },
  });
  await markVerified(email);
  await page.goto("/login?next=//evil.example/x");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/localhost:3200\/dashboard/);
});

test("import from the wallets page: columns are matched, previewed, then imported; a wallet's chain can be fixed", async ({ page }) => {
  await signUpAndEnter(page, `ivy${Date.now()}@example.test`);

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

  // Wrong chain? Fix it in place (it's tucked under "Sources, address and more").
  await page.getByRole("button", { name: /Imported one/ }).click();
  const drawer = page.getByRole("dialog", { name: "Wallet" });
  await drawer.getByRole("button", { name: /Sources, address and more/ }).click();
  await drawer.getByRole("button", { name: "Change address or chain" }).click();
  await drawer.getByLabel("Chain").selectOption("base");
  await drawer.getByRole("button", { name: "Save" }).click();
  await expect(drawer.getByRole("button", { name: "Change address or chain" })).toBeVisible();
  await expect(drawer).toContainText("Base");
  await expect(drawer).not.toContainText("Ethereum");
});

test("an unverified account cannot sign in until the email is confirmed", async ({ page }) => {
  const email = `vera${Date.now()}@example.test`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText(/Confirm your email before signing in/)).toBeVisible();
  await page.getByRole("button", { name: "Resend confirmation link" }).click();
  await expect(page.getByText(`Sent. Check ${email}`)).toBeVisible();

  await markVerified(email);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
});
