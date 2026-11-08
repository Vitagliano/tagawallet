import { z } from "zod";
import { CURATED_SITES } from "@tagawallet/shared";
import { publicRoute, route } from "@/lib/api";
import { audit, requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

/** The remote allowlist, so supported sites can change without an extension release. */
export const GET = publicRoute(async () => {
  const db = await getDb();
  const config = await db.collection<{ _id: string; sites: string[] }>("config").findOne({ _id: "extension_sites" });
  return { sites: config?.sites ?? CURATED_SITES, custom: !!config?.sites, defaults: CURATED_SITES };
}, { cors: true });

export const PUT = route(async ({ user, body }) => {
  requireAdmin(user);
  const parsed = await body(z.object({ sites: z.array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "Use a bare hostname, like etherscan.io")).min(1, "Keep at least one site").max(500) }));
  const sites = [...new Set(parsed.sites)];
  const db = await getDb();
  await db.collection<{ _id: string; sites: string[] }>("config").updateOne({ _id: "extension_sites" }, { $set: { sites } }, { upsert: true });
  await audit(user._id, "config.extension_sites", { count: sites.length });
  return { sites };
});
/** Back to the built-in list that ships with the extension. */
export const DELETE = route(async ({ user }) => {
  requireAdmin(user);
  const db = await getDb();
  await db.collection<{ _id: string }>("config").deleteOne({ _id: "extension_sites" });
  await audit(user._id, "config.extension_sites.reset", {});
  return { sites: CURATED_SITES };
});
export { preflight as OPTIONS } from "@/lib/api";
