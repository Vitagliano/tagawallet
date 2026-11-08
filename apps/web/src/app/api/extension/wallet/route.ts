import { ApiError, route, ser } from "@/lib/api";
import { getWallet } from "@/lib/access";
import { hydrateWallets } from "@/lib/wallets";

/**
 * One wallet as the dashboard shows it, for the panel's Details: every list and contact it's filed under.
 * Same access rule as the dashboard: your own wallets, or ones in a list shared with you.
 */
export const GET = route(async ({ user, req }) => {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[a-f0-9]{24}$/i.test(id)) throw new ApiError(422, "Pick a wallet.");
  const { wallet, own } = await getWallet(id, user._id);
  const [w] = await hydrateWallets([wallet], user._id);
  return ser({
    _id: w!._id, address: w!.address, chain: w!.chain, own,
    lists: w!.lists, entities: w!.entities,
  });
}, { cors: true });
export { preflight as OPTIONS } from "@/lib/api";
