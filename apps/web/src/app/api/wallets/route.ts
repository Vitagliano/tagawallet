import { NextResponse } from "next/server";
import { walletCreateSchema } from "@tagawallet/shared";
import { ApiError, route, ser } from "@/lib/api";
import { getList, getOwnEntity, logActivity, track, trackFirst } from "@/lib/access";
import { getDb } from "@/lib/db";
import { addToList, hydrateWallets, normalizedFor, upsertWallet } from "@/lib/wallets";
import { searchWallets } from "@/lib/search";

export const GET = route(async ({ user, req }) => {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const chain = req.nextUrl.searchParams.get("chain") ?? undefined;
  const wallets = await searchWallets(user._id, q, chain, 100);
  return ser(await hydrateWallets(wallets, user._id));
});

export const POST = route(async ({ user, body }) => {
  const input = await body(walletCreateSchema);
  const db = await getDb();
  const list = input.listId ? (await getList(input.listId, user._id, "editor")).list : null;
  const entity = input.entityId ? await getOwnEntity(input.entityId, user._id) : null;
  const key = { ownerId: user._id, chain: input.chain, normalizedAddress: normalizedFor(input.address, input.chain) };
  const prior = await db.collection("wallets").findOne(key);
  if (prior && list && await db.collection("wallet_list_memberships").findOne({ listId: list._id, walletId: prior._id })) {
    throw new ApiError(409, `This address is already in “${list.name}”.`, { duplicate: true, walletId: prior._id.toString() });
  }
  const { wallet, created } = await upsertWallet(user._id, input);
  if (list) {
    await addToList(list._id, wallet._id, user._id);
    await db.collection("users").updateOne({ _id: user._id }, { $set: { lastListId: list._id } });
    await logActivity(list._id, user._id, "added a wallet", wallet.displayLabel || wallet.address);
  }
  if (entity) {
    await db.collection("wallet_entity_links").updateOne(
      { walletId: wallet._id, entityId: entity._id },
      { $setOnInsert: { relationship: "associated", visibility: "private", source: input.source === "import" ? "import" : "user", claimedBy: user._id, evidence: [], createdAt: new Date(), updatedAt: new Date() } },
      { upsert: true },
    );
  }
  await trackFirst("first_wallet_added", user._id);
  await track("wallet_added", user._id);
  const [hydrated] = await hydrateWallets([wallet], user._id);
  return NextResponse.json(ser({ ...hydrated, existing: !created }), { status: created ? 201 : 200 });
}, { rate: { name: "wallet-create", limit: 300, windowSec: 60 } });
