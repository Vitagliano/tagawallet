import { resolveSchema } from "@tagawallet/shared";
import { route } from "@/lib/api";
import { resolveAddresses } from "@/lib/resolve";

export const POST = route(async ({ user, body }) => {
  const { addresses } = await body(resolveSchema);
  return { results: await resolveAddresses(addresses, user._id) };
}, { rate: { name: "lookup", limit: 300, windowSec: 60 } });
