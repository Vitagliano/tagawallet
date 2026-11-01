import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: ["/", "/p/"], disallow: ["/api/", "/dashboard", "/lists/", "/wallets/", "/entities/", "/search", "/settings", "/admin/", "/invite/", "/extension/"] }] };
}
