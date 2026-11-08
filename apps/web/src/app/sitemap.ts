import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/email";
import { indexableProfiles } from "@/lib/public-address";

// Built per request: at build time there's no database, and a cached empty sitemap would hide new profiles.
export const dynamic = "force-dynamic";

/** Only profiles whose owners allowed indexing, and the addresses those profiles publicly claim. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = appUrl();
  const { profiles, addresses } = await indexableProfiles().catch(() => ({ profiles: [], addresses: [] }));
  return [
    { url: `${base}/`, changeFrequency: "weekly" },
    ...profiles.map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const })),
    ...addresses.map((a) => ({ url: `${base}/a/${encodeURIComponent(a)}`, changeFrequency: "weekly" as const })),
  ];
}
