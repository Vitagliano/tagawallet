import { appUrl } from "@/lib/email";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: ["/", "/p/", "/a/", "/u/", "/l/"], disallow: ["/api/", "/dashboard", "/lists/", "/wallets/", "/entities/", "/search", "/settings", "/admin/", "/invite/", "/extension/"] }], sitemap: `${appUrl()}/sitemap.xml` };
}
