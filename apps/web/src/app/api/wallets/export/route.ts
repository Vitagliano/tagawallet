import { route } from "@/lib/api";
import { exportResponse, exportRows } from "@/lib/export";
import { searchWallets, walletFiltersFrom } from "@/lib/search";

const MAX = 10000;

/** Exactly what the wallets page shows for the same search and filters. */
export const GET = route(async ({ user, req }) => {
  const p = req.nextUrl.searchParams;
  const wallets = await searchWallets(user._id, (p.get("q") ?? "").slice(0, 200), await walletFiltersFrom(p, user._id), MAX);
  const rows = await exportRows(wallets as never, user._id);
  return exportResponse(p.get("format"), "tagawallet-wallets", rows, { exportedAt: new Date(), filters: Object.fromEntries(p) });
}, { rate: { name: "wallet-export", limit: 60, windowSec: 3600 } });
