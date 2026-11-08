import { addressError, CHAINS, walletUpdateSchema, type ChainId } from "@tagawallet/shared";
import { ApiError, route, ser } from "@/lib/api";
import { getWallet } from "@/lib/access";
import { getDb } from "@/lib/db";
import { hydrateWallets, normalizedFor } from "@/lib/wallets";

type P = { id: string };

export const GET = route<P>(async ({ user, params }) => {
  const { wallet } = await getWallet(params.id, user._id);
  const [hydrated] = await hydrateWallets([wallet], user._id);
  return ser(hydrated);
});

export const PATCH = route<P>(async ({ user, params, body }) => {
  const { address, chain, ...input } = await body(walletUpdateSchema);
  const { wallet, own } = await getWallet(params.id, user._id, true);
  const db = await getDb();
  const set: Record<string, unknown> = { ...input, updatedAt: new Date() };
  if ((address && address !== wallet.address) || (chain && chain !== wallet.chain)) {
    if (!own) throw new ApiError(403, "Only the person who added a wallet can change its address or chain.");
    const nextChain = (chain ?? wallet.chain) as ChainId;
    const nextAddress = address ?? wallet.address;
    const problem = addressError(nextAddress, nextChain);
    if (problem) throw new ApiError(422, problem, { fields: { [address ? "address" : "chain"]: problem } });
    const normalizedAddress = normalizedFor(nextAddress, nextChain);
    const twin = await db.collection("wallets").findOne({ ownerId: wallet.ownerId, chain: nextChain, normalizedAddress, _id: { $ne: wallet._id } }, { projection: { displayLabel: 1 } });
    if (twin) {
      throw new ApiError(409, `You already have this address on ${CHAINS[nextChain].name}${twin.displayLabel ? ` as “${twin.displayLabel}”` : ""}.`, { duplicate: true, walletId: twin._id.toString() });
    }
    Object.assign(set, { address: nextAddress.trim(), chain: nextChain, normalizedAddress });
  }
  try {
    await db.collection("wallets").updateOne({ _id: wallet._id }, { $set: set });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw new ApiError(409, "You already have this address on that chain.", { duplicate: true });
    throw err;
  }
  const [hydrated] = await hydrateWallets([{ ...wallet, ...set }], user._id);
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
