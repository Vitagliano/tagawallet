import { MongoClient } from "mongodb";
import type { APIRequestContext, Page } from "@playwright/test";

const BASE = "http://localhost:3200";
const PASSWORD = "correct-horse-battery";

let mongo: MongoClient | null = null;

export async function e2eDb () {
  return (mongo ??= await new MongoClient("mongodb://127.0.0.1:3202/tagawallet_e2e").connect()).db();
}

/** Stands in for clicking the link in the confirmation email. */
export async function markVerified (email: string) {
  await (await e2eDb()).collection("users").updateOne({ email }, { $set: { emailVerified: true } });
}

export async function closeE2eDb () {
  await mongo?.close();
  mongo = null;
}

/** Create an account the way the product does: sign up, confirm email, then sign in. */
export async function signUpAndEnter (page: Page, email: string, password = PASSWORD) {
  await page.goto(`${BASE}/signup`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByRole("heading", { name: "Check your email" }).waitFor();
  await markVerified(email);
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/dashboard/);
}

export async function apiSignIn (ctx: APIRequestContext, email: string, password = PASSWORD) {
  return ctx.post("/api/auth/sign-in/email", {
    data: { email, password },
    headers: { Origin: BASE, Referer: `${BASE}/` },
  });
}
