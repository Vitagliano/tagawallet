import { NextResponse } from "next/server";
import { walletCreateSchema } from "@tagawallet/shared";
import { ApiError, route, ser } from "@/lib/api";
import { getList, getOwnEntity, logActivity, track, trackFirst } from "@/lib/access";
import { getDb } from "@/lib/db";
import { addToList, hydrateWallets, normalizedFor, upsertWallet } from "@/lib/wallets";
import { searchWallets, searchWalletsPage, walletFiltersFrom, WALLET_SORTS, type WalletSort } from "@/lib/search";

export const GET = route(async ({ user, req }) => {
  const p = req.nextUrl.searchParams;
  const q = (p.get("q") ?? "").slice(0, 200);
  const limit = Math.min(Math.max(Number(p.get("limit")) || 100, 1), 500);
  const filters = await walletFiltersFrom(p, user._id);
  // Paginated tables ask for an offset and get the total back.
  if (p.has("offset")) {
    const offset = Math.max(Number(p.get("offset")) || 0, 0);
    const sort = (p.get("sort") ?? "updated") as WalletSort;
    const page = await searchWalletsPage(user._id, q, filters, { limit, offset, sort: sort in WALLET_SORTS ? sort : "updated" });
    return ser({ wallets: await hydrateWallets(page.wallets, user._id), total: page.total, offset, limit });
  }
  // One extra tells the page whether there are more than it shows.
  const wallets = await searchWallets(user._id, q, filters, limit + 1);
  const hydrated = await hydrateWallets(wallets.slice(0, limit), user._id);
  if (p.get("shape") === "page") return ser({ wallets: hydrated, more: wallets.length > limit });
  return ser(hydrated);
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
    const now = new Date();
    await db.collection("wallet_entity_links").updateOne(
      { walletId: wallet._id, entityId: entity._id },
      {
        $set: { relationship: input.relationship ?? "associated", updatedAt: now },
        $setOnInsert: { visibility: "private", source: input.source === "import" ? "import" : "user", claimedBy: user._id, evidence: [], createdAt: now },
      },
      { upsert: true },
    );
  }
  await trackFirst("first_wallet_added", user._id);
  await track("wallet_added", user._id);
  const [hydrated] = await hydrateWallets([wallet], user._id);
  return NextResponse.json(ser({ ...hydrated, existing: !created }), { status: created ? 201 : 200 });
}, { rate: { name: "wallet-create", limit: 300, windowSec: 60 } });
