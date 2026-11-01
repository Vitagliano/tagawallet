import { resolveSchema } from "@tagawallet/shared";
import { route } from "@/lib/api";
import { resolveAddresses } from "@/lib/resolve";

/** Receives addresses only. Page URLs and page text are never part of this contract. */
export const POST = route(async ({ user, body }) => {
  const { addresses } = await body(resolveSchema);
  return { results: await resolveAddresses(addresses, user._id) };
}, { cors: true, rate: { name: "resolve", limit: 600, windowSec: 60 } });
export { preflight as OPTIONS } from "@/lib/api";
