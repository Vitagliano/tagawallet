import { route, ser } from "@/lib/api";
import { searchEntities, searchWallets } from "@/lib/search";
import { hydrateWallets } from "@/lib/wallets";

/** The panel's search box: your wallets and contacts by name, label or address, as on the dashboard. */
export const GET = route(async ({ user, req }) => {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 200);
  if (!q) return { wallets: [], entities: [] };
  const [wallets, entities] = await Promise.all([searchWallets(user._id, q, undefined, 20), searchEntities(user._id, q, 10)]);
  return ser({ wallets: await hydrateWallets(wallets, user._id), entities: entities.map((e) => ({ _id: e._id, name: e.name, type: e.type })) });
}, { cors: true, rate: { name: "search", limit: 240, windowSec: 60 } });
export { preflight as OPTIONS } from "@/lib/api";
