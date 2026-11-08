import { route } from "@/lib/api";
import { getList } from "@/lib/access";
import { getDb } from "@/lib/db";
import { exportResponse, exportRows, safeFilename } from "@/lib/export";

export const GET = route<{ id: string }>(async ({ user, params, req }) => {
  const { list } = await getList(params.id, user._id);
  const db = await getDb();
  const members = await db.collection("wallet_list_memberships").find({ listId: list._id }).toArray();
  const wallets = await db.collection("wallets").find({ _id: { $in: members.map((m) => m.walletId) } }).toArray();
  const rows = await exportRows(wallets, user._id);
  return exportResponse(req.nextUrl.searchParams.get("format"), safeFilename(list.name, "list"), rows, { list: { name: list.name, description: list.description } });
}, { rate: { name: "list-export", limit: 60, windowSec: 3600 } });
