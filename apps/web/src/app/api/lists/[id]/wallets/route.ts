import { z } from "zod";
import { objectId } from "@tagawallet/shared";
import { ApiError, route, ser } from "@/lib/api";
import { getList, getWallet, logActivity, oid } from "@/lib/access";
import { getDb } from "@/lib/db";
import { addToList, hydrateWallets } from "@/lib/wallets";

type P = { id: string };

export const GET = route<P>(async ({ user, params, req }) => {
  const { list } = await getList(params.id, user._id);
  const db = await getDb();
  const page = Math.max(0, Number(req.nextUrl.searchParams.get("page") ?? 0) || 0);
  const size = 100;
  const members = await db.collection("wallet_list_memberships").find({ listId: list._id }).sort({ addedAt: -1 }).skip(page * size).limit(size).toArray();
  const wallets = await db.collection("wallets").find({ _id: { $in: members.map((m) => m.walletId) } }).toArray();
  const order = new Map(members.map((m, i) => [m.walletId.toString(), i]));
  wallets.sort((a, b) => order.get(a._id.toString())! - order.get(b._id.toString())!);
  const total = await db.collection("wallet_list_memberships").countDocuments({ listId: list._id });
  return ser({ wallets: await hydrateWallets(wallets, user._id), total, page, size });
});

/** Adds an existing wallet, or moves it from another list when moveFrom is set. */
export const POST = route<P>(async ({ user, params, body }) => {
  const { walletId, moveFrom } = await body(z.object({ walletId: objectId, moveFrom: objectId.optional() }));
  const { list } = await getList(params.id, user._id, "editor");
  const { wallet } = await getWallet(walletId, user._id);
  const added = await addToList(list._id, wallet._id, user._id);
  if (moveFrom) {
    if (moveFrom === params.id) throw new ApiError(422, "That wallet is already in this list.");
    const { list: from } = await getList(moveFrom, user._id, "editor");
    await getDb().then((db) => db.collection("wallet_list_memberships").deleteOne({ listId: from._id, walletId: wallet._id }));
    await logActivity(from._id, user._id, "moved a wallet out", wallet.displayLabel || wallet.address);
  }
  if (added) await logActivity(list._id, user._id, "added a wallet", wallet.displayLabel || wallet.address);
  await getDb().then((db) => db.collection("users").updateOne({ _id: user._id }, { $set: { lastListId: list._id } }));
  return { ok: true, added };
});

/** Removes the membership only. The wallet stays in the user's other lists. */
export const DELETE = route<P>(async ({ user, params, req }) => {
  const { list } = await getList(params.id, user._id, "editor");
  const walletId = oid(req.nextUrl.searchParams.get("walletId") ?? "");
  const db = await getDb();
  const r = await db.collection("wallet_list_memberships").deleteOne({ listId: list._id, walletId });
  if (r.deletedCount) await logActivity(list._id, user._id, "removed a wallet");
  return { ok: true };
});
