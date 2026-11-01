import { z } from "zod";
import { CURATED_SITES } from "@tagawallet/shared";
import { publicRoute, route } from "@/lib/api";
import { audit, requireAdmin } from "@/lib/admin";
import { getDb } from "@/lib/db";

/** The remote allowlist, so supported sites can change without an extension release. */
export const GET = publicRoute(async () => {
  const db = await getDb();
  const config = await db.collection<{ _id: string; sites: string[] }>("config").findOne({ _id: "extension_sites" });
  return { sites: config?.sites ?? CURATED_SITES };
}, { cors: true });

export const PUT = route(async ({ user, body }) => {
  requireAdmin(user);
  const { sites } = await body(z.object({ sites: z.array(z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/)).max(500) }));
  const db = await getDb();
  await db.collection<{ _id: string; sites: string[] }>("config").updateOne({ _id: "extension_sites" }, { $set: { sites } }, { upsert: true });
  await audit(user._id, "config.extension_sites", { count: sites.length });
  return { sites };
});
export { preflight as OPTIONS } from "@/lib/api";
