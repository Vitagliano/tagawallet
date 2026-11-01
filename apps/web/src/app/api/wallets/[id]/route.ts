import { walletUpdateSchema } from "@tagawallet/shared";
import { ApiError, route, ser } from "@/lib/api";
import { getWallet } from "@/lib/access";
import { getDb } from "@/lib/db";
import { hydrateWallets } from "@/lib/wallets";

type P = { id: string };

export const GET = route<P>(async ({ user, params }) => {
  const { wallet } = await getWallet(params.id, user._id);
  const [hydrated] = await hydrateWallets([wallet], user._id);
  return ser(hydrated);
});

export const PATCH = route<P>(async ({ user, params, body }) => {
  const input = await body(walletUpdateSchema);
  const { wallet } = await getWallet(params.id, user._id, true);
  const db = await getDb();
  await db.collection("wallets").updateOne({ _id: wallet._id }, { $set: { ...input, updatedAt: new Date() } });
  const [hydrated] = await hydrateWallets([{ ...wallet, ...input }], user._id);
  return ser(hydrated);
});

export const DELETE = route<P>(async ({ user, params }) => {
  const db = await getDb();
  const { wallet, own } = await getWallet(params.id, user._id, true);
  if (!own) throw new ApiError(403, "Only the person who added a wallet can delete it. You can remove it from the list instead.");
  await Promise.all([
    db.collection("wallet_list_memberships").deleteMany({ walletId: wallet._id }),
    db.collection("wallet_entity_links").deleteMany({ walletId: wallet._id }),
    db.collection("wallets").deleteOne({ _id: wallet._id }),
  ]);
  return { ok: true };
});
