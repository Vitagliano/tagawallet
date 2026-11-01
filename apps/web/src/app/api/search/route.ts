import { route, ser } from "@/lib/api";
import { track } from "@/lib/access";
import { searchEntities, searchWallets } from "@/lib/search";
import { hydrateWallets } from "@/lib/wallets";

export const GET = route(async ({ user, req }) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").slice(0, 200);
  const chain = req.nextUrl.searchParams.get("chain") || undefined;
  const started = Date.now();
  const [wallets, entities] = await Promise.all([searchWallets(user._id, q, chain, 50), searchEntities(user._id, q, 20)]);
  void track("search_query", user._id);
  return ser({ wallets: await hydrateWallets(wallets, user._id), entities, tookMs: Date.now() - started });
}, { rate: { name: "search", limit: 240, windowSec: 60 } });
