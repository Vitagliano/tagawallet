import { apiKeyRoute } from "@/lib/api";
import { searchWallets, walletFiltersFrom } from "@/lib/search";
import { v1Wallet } from "@/lib/v1";
import { hydrateWallets } from "@/lib/wallets";

/** GET /api/v1/wallets?q=&list=&entity=&tag=&status=&chain=&limit= */
export const GET = apiKeyRoute(async ({ req, user }) => {
  const p = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(p.get("limit")) || 100, 1), 500);
  const found = await searchWallets(user._id, (p.get("q") ?? "").slice(0, 200), await walletFiltersFrom(p, user._id), limit + 1);
  const wallets = await hydrateWallets(found.slice(0, limit), user._id);
  return { wallets: wallets.map(v1Wallet), more: found.length > limit };
});
